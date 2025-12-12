// js/views/host/statusDisplay.js

import { db } from "../../main.js";
import { collection, query, where, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { formatTime } from "../../utils.js";

const activeUsersContainer = document.getElementById("active-users-list");
// 今日の一言を表示するコンテナを動的に作成するための親要素を取得（なければactiveUsersContainerの親などを探す）
// ここでは activeUsersContainer の親要素に追加する形で実装します

let statusUnsubscribe = null;
let wordUnsubscribe = null; // 追加: 今日の一言監視用

export function initializeStatusDisplay() {
    console.log("Initializing Status Display...");
    
    // UIの準備: 今日の一言エリアがない場合は作成して追加
    setupDailyWordUI();

    setupStatusMonitoring();
    setupDailyWordMonitoring(); // 追加
}

export function cleanupStatusDisplay() {
    if (statusUnsubscribe) {
        statusUnsubscribe();
        statusUnsubscribe = null;
    }
    if (wordUnsubscribe) { // 追加
        wordUnsubscribe();
        wordUnsubscribe = null;
    }
}

function setupDailyWordUI() {
    // 既存のコンテナを探す
    let wordContainer = document.getElementById("host-daily-word-display");
    
    // まだなければ作成 (activeUsersContainerの直下に配置するか、その親に追加)
    if (!wordContainer && activeUsersContainer) {
        wordContainer = document.createElement("div");
        wordContainer.id = "host-daily-word-display";
        wordContainer.className = "mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm";
        wordContainer.innerHTML = `
            <h3 class="font-bold text-gray-700 mb-2 flex items-center">
                <span class="text-xl mr-2">📢</span> 今日の一言
            </h3>
            <p id="host-daily-word-text" class="text-gray-600 whitespace-pre-wrap">読み込み中...</p>
            <p id="host-daily-word-info" class="text-xs text-gray-400 mt-2 text-right"></p>
        `;
        
        // activeUsersContainerの親要素に追加（リストの下に表示）
        activeUsersContainer.parentNode.appendChild(wordContainer);
    }
}

function setupDailyWordMonitoring() {
    const wordRef = doc(db, "settings", "daily_word");
    
    wordUnsubscribe = onSnapshot(wordRef, (docSnap) => {
        const textElem = document.getElementById("host-daily-word-text");
        const infoElem = document.getElementById("host-daily-word-info");
        
        if (docSnap.exists() && textElem) {
            const data = docSnap.data();
            textElem.textContent = data.text || "（設定されていません）";
            
            if (data.updatedBy) {
                // 日付のフォーマット (簡易)
                let timeStr = "";
                if (data.updatedAt && data.updatedAt.toDate) {
                    const d = data.updatedAt.toDate();
                    timeStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
                }
                infoElem.textContent = `Updated by ${data.updatedBy} (${timeStr})`;
            } else {
                infoElem.textContent = "";
            }
        } else if (textElem) {
            textElem.textContent = "（未設定）";
        }
    }, (error) => {
        console.error("Error listening to daily word:", error);
    });
}

function setupStatusMonitoring() {
    // 既存の稼働状況監視コード
    // (変更なしですが、importパスなどは環境に合わせてください)
    const q = query(
        collection(db, "user_status"),
        where("isOnline", "==", true)
    );

    statusUnsubscribe = onSnapshot(q, (snapshot) => {
        if (!activeUsersContainer) return;

        activeUsersContainer.innerHTML = "";

        if (snapshot.empty) {
            activeUsersContainer.innerHTML = '<p class="text-gray-500 italic">現在稼働中のメンバーはいません。</p>';
            return;
        }

        snapshot.forEach((doc) => {
            const status = doc.data();
            renderActiveUserCard(status);
        });
    }, (error) => {
        console.error("Error monitoring status:", error);
        activeUsersContainer.innerHTML = '<p class="text-red-500">読み込みエラー</p>';
    });
}

function renderActiveUserCard(status) {
    const card = document.createElement("div");
    card.className = "bg-white p-3 rounded-lg shadow border-l-4 border-blue-500 mb-2 flex justify-between items-center";
    
    // 経過時間の計算
    let durationText = "";
    if (status.lastLoginAt) {
        const start = status.lastLoginAt.toDate();
        const now = new Date();
        const diffMs = now - start;
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffMins = Math.floor((diffMs % 3600000) / 60000);
        durationText = `${diffHrs}時間 ${diffMins}分`;
    }

    // ステータスに応じた色分け
    let statusColor = "text-green-600";
    let statusText = "稼働中";
    
    if (status.currentTask === "休憩") {
        card.className = card.className.replace("border-blue-500", "border-orange-400");
        statusColor = "text-orange-500";
        statusText = "休憩中";
    }

    card.innerHTML = `
        <div>
            <div class="font-bold text-gray-800">${status.userName || "不明なユーザー"}</div>
            <div class="text-sm text-gray-600">
                <span class="${statusColor} font-bold">● ${statusText}</span> 
                <span class="text-xs text-gray-400 ml-2">(${status.currentTask || "-"})</span>
            </div>
        </div>
        <div class="text-right">
            <div class="text-xl font-mono font-bold text-gray-700">${formatTime(new Date())}</div> <div class="text-xs text-gray-400">ログインから: ${durationText}</div>
        </div>
    `;
    activeUsersContainer.appendChild(card);
}

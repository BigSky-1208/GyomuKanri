// js/views/host/statusDisplay.js

import { db } from "../../main.js";
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { formatTime } from "../../utils.js";
import { showConfirmationModal } from "../../components/modal.js"; // モーダル用

const activeUsersContainer = document.getElementById("active-users-list");
let statusUnsubscribe = null;
let wordUnsubscribe = null;

export function initializeStatusDisplay() {
    console.log("Initializing Status Display...");
    
    // UIの準備: 今日の一言エリアがない場合は作成して追加
    setupDailyWordUI();

    setupStatusMonitoring();
    setupDailyWordMonitoring();
}

export function cleanupStatusDisplay() {
    if (statusUnsubscribe) {
        statusUnsubscribe();
        statusUnsubscribe = null;
    }
    if (wordUnsubscribe) {
        wordUnsubscribe();
        wordUnsubscribe = null;
    }
}

// --- 今日の一言 機能 ---

function setupDailyWordUI() {
    // 既存のコンテナを探す
    let wordContainer = document.getElementById("host-daily-word-display");
    
    // まだなければ作成 (activeUsersContainerの親要素に追加)
    if (!wordContainer && activeUsersContainer && activeUsersContainer.parentNode) {
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
        
        // activeUsersContainer（稼働状況リスト）の下に追加
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

// --- 稼働状況監視 機能 ---

function setupStatusMonitoring() {
    // オンラインのユーザーのみ取得
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
            // userIdはドキュメントIDを使う（status内にuserIdがない場合への保険）
            const userId = status.userId || doc.id; 
            renderActiveUserCard(status, userId);
        });
    }, (error) => {
        console.error("Error monitoring status:", error);
        activeUsersContainer.innerHTML = '<p class="text-red-500">読み込みエラー</p>';
    });
}

function renderActiveUserCard(status, userId) {
    const card = document.createElement("div");
    card.className = "bg-white p-3 rounded-lg shadow border-l-4 border-blue-500 mb-2 flex justify-between items-center group relative";
    
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
            <div class="font-bold text-gray-800">${escapeHtml(status.userName || "不明なユーザー")}</div>
            <div class="text-sm text-gray-600">
                <span class="${statusColor} font-bold">● ${statusText}</span> 
                <span class="text-xs text-gray-400 ml-2">(${escapeHtml(status.currentTask || "-")})</span>
            </div>
        </div>
        <div class="text-right">
            <div class="text-xl font-mono font-bold text-gray-700">${formatTime(new Date())}</div>
            <div class="text-xs text-gray-400">ログインから: ${durationText}</div>
        </div>
        
        <button 
            class="force-stop-btn absolute top-2 right-2 bg-red-100 text-red-600 p-1 rounded hover:bg-red-200 opacity-0 group-hover:opacity-100 transition-opacity"
            title="強制退勤させる"
            data-user-id="${userId}"
            data-user-name="${escapeHtml(status.userName)}"
        >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
        </button>
    `;
    
    // イベントリスナー設定
    const stopBtn = card.querySelector('.force-stop-btn');
    if (stopBtn) {
        stopBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // カードクリックなどのイベントがもしあれば止める
            const uid = e.target.closest('button').dataset.userId;
            const uname = e.target.closest('button').dataset.userName;
            forceStopUser(uid, uname);
        });
    }

    activeUsersContainer.appendChild(card);
}

/**
 * ユーザーを強制退勤させる関数
 * (exportしてhost.jsからも呼べるようにする)
 */
export async function forceStopUser(targetUserId, targetUserName) {
    if (!targetUserId) return;

    showConfirmationModal(
        `本当に ${targetUserName} さんを強制退勤させますか？\n現在進行中の業務はここで終了となります。`,
        async () => {
            try {
                // 1. ステータスをオフラインにする
                const statusRef = doc(db, "user_status", targetUserId);
                
                // 現在のログIDを取得して終了時間を記録する処理を追加することも可能だが
                // シンプルにステータスを更新し、クライアント側の検知に任せるか、
                // 最低限 isOnline: false にする
                await updateDoc(statusRef, {
                    isOnline: false,
                    lastActiveAt: new Date(),
                    currentTask: null,
                    currentGoal: null
                    // forceLogout: true // 必要ならフラグを立ててクライアント側で検知させる
                });
                
                alert(`${targetUserName} さんを強制退勤処理しました。`);
                
            } catch (error) {
                console.error("Force stop error:", error);
                alert("強制退勤処理に失敗しました。");
            }
        }
    );
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

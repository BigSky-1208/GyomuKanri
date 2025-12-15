// js/views/host/statusDisplay.js

import { db } from "../../main.js";
import { collection, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { escapeHtml, formatDuration } from "../../utils.js";

let unsubscribe = null;

export function startListeningForStatusUpdates() {
    const statusRef = collection(db, "work_status");
    
    unsubscribe = onSnapshot(statusRef, (snapshot) => {
        const activeUsers = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.isWorking) {
                activeUsers.push({ id: doc.id, ...data });
            }
        });
        updateStatusDisplay(activeUsers);
    });
}

export function stopListeningForStatusUpdates() {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
}

function updateStatusDisplay(users) {
    const container = document.getElementById("summary-list");
    if (!container) return;

    container.innerHTML = "";

    if (users.length === 0) {
        container.innerHTML = `<div class="p-4 text-gray-500 text-center border-2 border-dashed border-gray-300 rounded-lg">現在稼働中のメンバーはいません</div>`;
        return;
    }

    // ★ソート処理の修正
    // 1. 休憩は一番下
    // 2. 業務名順
    // 3. 名前順
    users.sort((a, b) => {
        const taskA = a.currentTask || "";
        const taskB = b.currentTask || "";
        const isRestA = taskA === "休憩";
        const isRestB = taskB === "休憩";

        // 休憩判定（休憩している方を後ろにする）
        if (isRestA && !isRestB) return 1;
        if (!isRestA && isRestB) return -1;

        // 業務名でソート
        if (taskA !== taskB) return taskA.localeCompare(taskB, "ja");

        // 名前でソート
        return a.userName.localeCompare(b.userName, "ja");
    });

    users.forEach(user => {
        const startTime = user.startTime ? user.startTime.toDate() : new Date();
        const now = new Date();
        const elapsed = Math.floor((now - startTime) / 1000);
        const durationStr = formatDuration(elapsed);
        
        const isRest = user.currentTask === "休憩";
        
        // ★デザイン修正: 枠取りと色分け
        const cardClass = isRest 
            ? "border-2 border-yellow-400 bg-yellow-50 rounded-lg shadow-md p-3 mb-3 flex justify-between items-center transition hover:shadow-lg hover:translate-y-px"
            : "border-2 border-blue-200 bg-white rounded-lg shadow-md p-3 mb-3 flex justify-between items-center transition hover:shadow-lg hover:translate-y-px";

        const taskBadgeClass = isRest
            ? "bg-yellow-200 text-yellow-800 px-2 py-1 rounded text-sm font-bold ml-2"
            : "bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-bold ml-2";

        const div = document.createElement("div");
        div.className = cardClass;
        // host.jsでのクリック判定用にデータ属性を付与
        div.dataset.userId = user.id; 
        div.dataset.userName = user.userName; 
        
        // クリック可能であることを示すカーソル
        div.style.cursor = "pointer";

        div.innerHTML = `
            <div class="flex flex-col flex-grow overflow-hidden">
                <div class="flex items-center mb-1">
                    <span class="font-bold text-lg text-gray-800 truncate">${escapeHtml(user.userName)}</span>
                    <span class="${taskBadgeClass} whitespace-nowrap">${escapeHtml(user.currentTask)}</span>
                </div>
                <div class="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
                    <span class="font-mono bg-gray-100 px-2 rounded border border-gray-200">⏱ ${durationStr}</span>
                    <span class="text-xs text-gray-500 truncate">${user.currentGoalTitle ? `(${escapeHtml(user.currentGoalTitle)})` : ""}</span>
                </div>
            </div>
            <button class="force-stop-btn ml-3 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 rounded text-xs shadow whitespace-nowrap z-10" 
                    data-user-id="${user.id}" data-user-name="${escapeHtml(user.userName)}">
                停止
            </button>
        `;

        // 停止ボタンのイベント（カード自体のクリックイベントと干渉しないようにstopPropagationを入れる）
        const stopBtn = div.querySelector(".force-stop-btn");
        stopBtn.addEventListener("click", (e) => {
            e.stopPropagation(); 
            forceStopUser(user.id, user.userName);
        });

        container.appendChild(div);
    });
}

// 強制退勤機能
export async function forceStopUser(userId, userName) {
    if (!confirm(`${userName} さんを強制的に退勤（業務終了）させますか？\n※この操作は取り消せません。`)) return;

    try {
        const userStatusRef = doc(db, "work_status", userId);
        
        await updateDoc(userStatusRef, { 
            isWorking: false,
            currentTask: null,
            forcedStop: true 
        });

        alert(`${userName} さんの業務を停止しました。`);
    } catch (error) {
        console.error("Force stop error:", error);
        alert("停止処理に失敗しました。");
    }
}

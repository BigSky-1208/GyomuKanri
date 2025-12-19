// js/views/host/statusDisplay.js

import { db } from "../../main.js";
import { collection, query, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { formatDuration, escapeHtml } from "../../utils.js";
import { updateStatusesCache } from "./userManagement.js";

// --- Module State ---
let statusListenerUnsubscribe = null;
let hostViewIntervals = [];
let statusInterval = null;

// --- DOM Element references ---
const statusListContainer = document.getElementById("status-list");
const taskSummaryContainer = document.getElementById("task-summary-list");

/**
 * 監視を開始する（host.jsから呼ばれる）
 */
export function startListeningForStatusUpdates() {
    // 従来の onSnapshot を削除し、一定間隔で Worker から最新情報を取得する
    statusInterval = setInterval(async () => {
        try {
            const response = await fetch(`${WORKER_URL}/get-all-status`);
            const statusData = await response.json();
            // 取得したデータで UI を更新する（既存の UI 更新関数を呼ぶ）
            updateStatusUI(statusData);
        } catch (error) {
            console.error("ステータス取得エラー:", error);
        }
    }, 5000); // 5秒ごとに最新の状態を確認
}

export function stopListeningForStatusUpdates() {
    if (statusInterval) clearInterval(statusInterval);
}

/**
 * 監視を停止する（host.jsから呼ばれる）
 */
export function stopListeningForStatusUpdates() {
    if (statusListenerUnsubscribe) {
        console.log("Stopping listener for work status updates.");
        statusListenerUnsubscribe();
        statusListenerUnsubscribe = null;
    }
    hostViewIntervals.forEach(clearInterval);
    hostViewIntervals = [];
}

/**
 * 業務サマリー（左上）の描画
 */
function renderTaskSummary(workingClientsData) {
    if (!taskSummaryContainer) return;
    
    const taskSummary = {}; 

    workingClientsData.forEach((data) => {
        const taskDisplayKey = data.currentGoalTitle
            ? `${data.currentTask} (${data.currentGoalTitle})`
            : data.currentTask || "未定義の業務"; 

         let displayKeyClean = taskDisplayKey;
         if (displayKeyClean.startsWith("その他_")) {
            displayKeyClean = displayKeyClean.substring(4); 
         }

        if (!taskSummary[displayKeyClean]) {
            taskSummary[displayKeyClean] = 0;
        }
        taskSummary[displayKeyClean]++;
    });

    const sortedTasks = Object.keys(taskSummary).sort((a, b) => a.localeCompare(b, "ja"));

    sortedTasks.forEach((taskKey) => {
        const count = taskSummary[taskKey];
        const summaryItem = document.createElement("div");
        summaryItem.className = "flex justify-between items-center text-sm";
        summaryItem.innerHTML = `<span class="font-semibold text-gray-600">${escapeHtml(taskKey)}</span><span class="font-mono bg-gray-200 px-2 py-1 rounded-md text-gray-800">${count}人</span>`;
        taskSummaryContainer.appendChild(summaryItem);
    });
}

/**
 * 稼働中ユーザーリスト（左下）の描画
 */
function renderWorkingClientList(workingClientsData) {
    if (!statusListContainer) return;

    // ★ソート処理
    // 1. 休憩は一番下
    // 2. 業務名順
    // 3. 名前順
    workingClientsData.sort((a, b) => {
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

    workingClientsData.forEach((data) => {
        const userId = data.userId || data.id; 
        const userName = data.userName || "不明なユーザー";
        
        // ★デザイン修正: 枠取りと色分け
        const isRest = data.currentTask === "休憩";
        const cardClass = isRest 
            ? "border-2 border-yellow-400 bg-yellow-50 rounded-lg shadow-md p-3 mb-3 flex justify-between items-center transition hover:shadow-lg hover:translate-y-px"
            : "border-2 border-blue-200 bg-white rounded-lg shadow-md p-3 mb-3 flex justify-between items-center transition hover:shadow-lg hover:translate-y-px";

        const taskBadgeClass = isRest
            ? "bg-yellow-200 text-yellow-800 px-2 py-1 rounded text-sm font-bold ml-2"
            : "bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-bold ml-2";

        const div = document.createElement("div");
        div.className = cardClass;
        div.id = `status-card-${userId}`;
        // host.jsでのクリック判定用にデータ属性を付与
        div.dataset.userId = userId; 
        div.dataset.userName = userName; 
        div.style.cursor = "pointer";

        // 時間計算
        const startTime = data.startTime ? data.startTime.toDate() : new Date();
        // 初期表示
        const updateTime = () => {
            const now = new Date();
            const elapsed = Math.floor((now - startTime) / 1000);
            const timeEl = div.querySelector(".duration-display");
            if(timeEl) timeEl.textContent = `⏱ ${formatDuration(elapsed)}`;
        };

        const taskDisplayKey = data.currentGoalTitle
            ? `${data.currentTask} (${data.currentGoalTitle})`
            : data.currentTask || "未定義の業務";
        
        let displayKeyClean = taskDisplayKey;
        if (displayKeyClean.startsWith("その他_")) {
           displayKeyClean = displayKeyClean.substring(4); 
        }

        const wordOfTheDay = data.wordOfTheDay ? escapeHtml(data.wordOfTheDay) : "";

        div.innerHTML = `
            <div class="flex flex-col flex-grow overflow-hidden">
                <div class="flex items-center mb-1">
                    <span class="font-bold text-lg text-gray-800 truncate">${escapeHtml(userName)}</span>
                    <span class="${taskBadgeClass} whitespace-nowrap">${escapeHtml(displayKeyClean)}</span>
                </div>
                <div class="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
                    <span class="duration-display font-mono bg-gray-100 px-2 rounded border border-gray-200">計算中...</span>
                    ${wordOfTheDay ? `<span class="text-xs text-gray-600 bg-yellow-50 p-1 rounded border border-yellow-100 inline-block max-w-full break-words">💬 ${wordOfTheDay}</span>` : ''}
                </div>
            </div>
            <button class="force-stop-btn ml-3 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 rounded text-xs shadow whitespace-nowrap z-10" 
                    data-user-id="${userId}" data-user-name="${escapeHtml(userName)}">
                停止
            </button>
        `;

        // タイマー更新開始
        updateTime();
        const intervalId = setInterval(updateTime, 1000);
        hostViewIntervals.push(intervalId);

        // 停止ボタンのイベント（カード自体のクリックイベントと干渉しないようにstopPropagationを入れる）
        const stopBtn = div.querySelector(".force-stop-btn");
        stopBtn.addEventListener("click", (e) => {
            e.stopPropagation(); 
            forceStopUser(userId, userName);
        });

        statusListContainer.appendChild(div);
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

// js/views/host/statusDisplay.js

import { db } from "../../main.js"; 
// WorkerのURL（実際のURLに合わせて調整してください）
const WORKER_URL = "https://muddy-night-4bd4.sora-yamashita.workers.dev";

let statusInterval = null;

/**
 * D1から全ユーザーの最新ステータスを取得し、UIを更新する
 */
export function startListeningForStatusUpdates() {
    // すでに動いている場合は一度止める（二重起動防止）
    stopListeningForStatusUpdates();

    console.log("D1からのステータス監視を開始します（ポーリング方式）");

    // 初回実行
    fetchAndRefreshStatus();

    // 5秒おきに実行
    statusInterval = setInterval(fetchAndRefreshStatus, 5000);
}

/**
 * 監視を停止する
 */
export function stopListeningForStatusUpdates() {
    if (statusInterval) {
        console.log("ステータス監視を停止しました");
        clearInterval(statusInterval);
        statusInterval = null;
    }
}

/**
 * Worker APIからデータを取得してUIを書き換える内部関数
 */
async function fetchAndRefreshStatus() {
    try {
        const response = await fetch(`${WORKER_URL}/get-all-status`);
        if (!response.ok) throw new Error("ステータス取得失敗");

        const statusData = await response.json();
        
        // UI更新関数を呼び出す（引数はD1から届いた配列データ）
        updateStatusUI(statusData);
    } catch (error) {
        console.error("D1ステータス同期エラー:", error);
    }
}

/**
 * 取得したデータに基づいてHTML要素を更新する
 */
function updateStatusUI(statusArray) {
    statusArray.forEach(userStatus => {
        // 例: user-card-2rsTr... のようなIDの要素を探して色や文字を変える
        const userCard = document.getElementById(`user-card-${userStatus.userId}`);
        if (!userCard) return;

        const statusBadge = userCard.querySelector(".status-badge");
        const taskText = userCard.querySelector(".current-task");

        if (userStatus.isWorking === 1) {
            statusBadge.textContent = "稼働中";
            statusBadge.className = "status-badge bg-green-500 text-white px-2 py-1 rounded-full text-xs";
            taskText.textContent = userStatus.currentTask || "業務中";
        } else {
            statusBadge.textContent = "停止中";
            statusBadge.className = "status-badge bg-gray-400 text-white px-2 py-1 rounded-full text-xs";
            taskText.textContent = "---";
        }
    });
}

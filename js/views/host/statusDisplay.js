// js/views/host/statusDisplay.js

import { db } from "../../main.js";
import { updateStatusesCache } from "./userManagement.js"; // キャッシュ更新用関数をインポート

// WorkerのURL
const WORKER_URL = "https://muddy-night-4bd4.sora-yamashita.workers.dev";

let statusInterval = null;

export function startListeningForStatusUpdates() {
    stopListeningForStatusUpdates();
    console.log("D1からのステータス監視を開始します（ポーリング方式）");
    
    // 初回実行
    fetchAndRefreshStatus();
    // 5秒おきに実行
    statusInterval = setInterval(fetchAndRefreshStatus, 5000);
}

export function stopListeningForStatusUpdates() {
    if (statusInterval) {
        console.log("ステータス監視を停止しました");
        clearInterval(statusInterval);
        statusInterval = null;
    }
}

async function fetchAndRefreshStatus() {
    try {
        // console.log("【Status】① ステータス取得通信開始..."); // 定期実行でうるさい場合はコメントアウト可

        const response = await fetch(`${WORKER_URL}/get-all-status`);
        if (!response.ok) throw new Error("ステータス取得失敗: " + response.status);

        const statusData = await response.json();
        
        // console.log("【Status】② データ取得成功:", statusData); // データが取れているか確認

        // 1. キャッシュ更新
        updateStatusesCache(statusData);

        // 2. 画面更新
        // ここでエラーが出ると、ステータス表示が変わりません
        updateStatusUI(statusData);
        
    } catch (error) {
        console.error("【Status】D1ステータス同期エラー:", error);
    }
}

function updateStatusUI(statusArray) {
    statusArray.forEach(userStatus => {
        // ★修正: userManagement.js で付与したID 'user-row-{userId}' を探す
        const userRow = document.getElementById(`user-row-${userStatus.userId}`);
        
        if (!userRow) return;

        const statusBadge = userRow.querySelector(".status-badge");
        const taskText = userRow.querySelector(".current-task");

        if (userStatus.isWorking === 1) {
            // 稼働中
            if (statusBadge) {
                statusBadge.textContent = "稼働中";
                // クラスを上書きして緑色にする
                statusBadge.className = "status-badge inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800";
            }
            if (taskText) {
                taskText.textContent = userStatus.currentTask || "業務中";
            }
        } else {
            // 停止中
            if (statusBadge) {
                statusBadge.textContent = "未稼働";
                // クラスを上書きしてグレーにする
                statusBadge.className = "status-badge inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800";
            }
            if (taskText) {
                taskText.textContent = "---";
            }
        }
    });
}

export async function forceStopUser(userId) {
    if (!confirm("このユーザーの業務を強制停止しますか？")) return;

    try {
        const response = await fetch(`${WORKER_URL}/force-stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userId })
        });

        if (!response.ok) throw new Error("強制停止に失敗しました");

        const result = await response.json();
        if (result.success) {
            alert("ユーザーを停止しました。");
            fetchAndRefreshStatus();
        }
    } catch (error) {
        console.error("強制停止エラー:", error);
        alert("エラーが発生しました。");
    }
}

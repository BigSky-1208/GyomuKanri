// js/views/host/statusDisplay.js

import { updateStatusesCache } from "./userManagement.js";

// WorkerのURL
const WORKER_URL = "https://muddy-night-4bd4.sora-yamashita.workers.dev";

let statusInterval = null;

export function startListeningForStatusUpdates() {
    stopListeningForStatusUpdates();
    console.log("ステータス監視を開始します（ポーリング方式）");
    
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
        const response = await fetch(`${WORKER_URL}/get-all-status`);
        if (!response.ok) throw new Error("ステータス取得失敗");

        const statusData = await response.json();
        
        // 1. userManagement.js のキャッシュを更新
        updateStatusesCache(statusData);

        // 2. 画面の更新（アカウントリスト & リアルタイム稼働リスト）
        updateStatusUI(statusData);
    } catch (error) {
        console.error("D1ステータス同期エラー:", error);
    }
}

function updateStatusUI(statusArray) {
    // --- ① アカウントリスト（下の表）の更新 ---
    statusArray.forEach(userStatus => {
        const userRow = document.getElementById(`user-row-${userStatus.userId}`);
        if (!userRow) return;

        const statusBadge = userRow.querySelector(".status-badge");
        const taskText = userRow.querySelector(".current-task");

        if (userStatus.isWorking === 1) {
            // 稼働中
            if (statusBadge) {
                statusBadge.textContent = "稼働中";
                statusBadge.className = "status-badge inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800";
            }
            if (taskText) {
                taskText.textContent = userStatus.currentTask || "業務中";
            }
        } else {
            // 停止中
            if (statusBadge) {
                statusBadge.textContent = "未稼働";
                statusBadge.className = "status-badge inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800";
            }
            if (taskText) {
                taskText.textContent = "---";
            }
        }
    });

    // --- ② 【追加】リアルタイム稼働状況（左上のボックス）の更新 ---
    const statusListContainer = document.getElementById("status-list");
    const summaryListContainer = document.getElementById("task-summary-list");

    if (statusListContainer) {
        // 稼働中のユーザーだけを抽出
        const workingUsers = statusArray.filter(u => u.isWorking === 1);

        // A. サマリー表示（〇〇名稼働中）
        if (summaryListContainer) {
            summaryListContainer.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="font-bold text-gray-700">現在稼働中:</span>
                    <span class="text-xl font-bold text-green-600">${workingUsers.length} 名</span>
                </div>
            `;
        }

        // B. リスト表示
        if (workingUsers.length === 0) {
            statusListContainer.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">現在稼働中の人はいません</p>';
        } else {
            let html = '';
            workingUsers.forEach(u => {
                // 名前が取得できない場合は "ID:..." とする
                const displayName = u.userName || `User (${u.userId.slice(0,4)}...)`;
                
                html += `
                <div class="bg-white border border-gray-200 p-3 rounded-lg shadow-sm flex justify-between items-center animate-pulse-slow">
                    <div>
                        <div class="font-bold text-gray-800 text-sm">${escapeHtml(displayName)}</div>
                        <div class="text-xs text-gray-500 mt-1">task: <span class="font-medium text-indigo-600">${escapeHtml(u.currentTask || '不明')}</span></div>
                    </div>
                    <span class="h-3 w-3 bg-green-500 rounded-full shadow-md"></span>
                </div>
                `;
            });
            statusListContainer.innerHTML = html;
        }
    }
}

// HTMLエスケープ用（セキュリティ対策）
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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
            fetchAndRefreshStatus(); // 即時更新
        }
    } catch (error) {
        console.error("強制停止エラー:", error);
        alert("エラーが発生しました。");
    }
}

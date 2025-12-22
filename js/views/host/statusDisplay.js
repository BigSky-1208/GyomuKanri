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
        // ユーザー一覧取得
        const response = await fetch(`${WORKER_URL}/get-all-status`);
        const statusData = await response.json();
        updateStatusUI(statusData);

        // ★追加: 戸村さんステータスも取得
        const tomuraResp = await fetch(`${WORKER_URL}/get-tomura-status`);
        const tomuraData = await tomuraResp.json();
        // 既存の updateUI(tomuraData) などを呼び出して反映
        if (typeof updateUI === "function") updateUI(tomuraData); 

    } catch (error) {
        console.error("同期エラー:", error);
    }
}

function updateStatusUI(statusArray) {
    // ----------------------------------------------------
    // ① 下のテーブル（アカウントリスト）の状態更新
    // ----------------------------------------------------
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
                // 【マージ】工数があればカッコ書きで表示
                const goalSuffix = userStatus.currentGoal ? ` (${userStatus.currentGoal})` : '';
                taskText.textContent = (userStatus.currentTask || "業務中") + goalSuffix;
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

    // ----------------------------------------------------
    // ② 左上のボックス（リアルタイム稼働状況）の更新
    // ----------------------------------------------------
    const statusListContainer = document.getElementById("status-list");
    const summaryListContainer = document.getElementById("task-summary-list");

    if (statusListContainer) {
        // 稼働中のユーザーだけを抽出
        const workingUsers = statusArray.filter(u => u.isWorking === 1);

        // 業務ごとの人数を集計する
        const taskCounts = {};
        workingUsers.forEach(u => {
            const task = u.currentTask || "その他";
            taskCounts[task] = (taskCounts[task] || 0) + 1;
        });

        // A. サマリー表示（合計人数 ＋ 業務別内訳）
        if (summaryListContainer) {
            let summaryHtml = `
                <div class="flex items-center justify-between border-b pb-2 mb-2">
                    <span class="font-bold text-gray-700">現在稼働中:</span>
                    <span class="text-2xl font-bold text-green-600">${workingUsers.length} <span class="text-sm text-gray-500">名</span></span>
                </div>
            `;

            if (workingUsers.length > 0) {
                summaryHtml += `<div class="flex flex-wrap gap-2">`;
                Object.entries(taskCounts).forEach(([taskName, count]) => {
                    summaryHtml += `
                        <span class="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            ${escapeHtml(taskName)}: ${count}名
                        </span>
                    `;
                });
                summaryHtml += `</div>`;
            } else {
                summaryHtml += `<div class="text-xs text-gray-400">現在稼働している業務はありません</div>`;
            }

            summaryListContainer.innerHTML = summaryHtml;
        }

        // B. リスト表示（業務ごとに並び替えて表示）
        if (workingUsers.length === 0) {
            statusListContainer.innerHTML = `
                <div class="text-center py-8 text-gray-400">
                    <p>現在稼働中の人はいません</p>
                </div>`;
        } else {
            // 見やすいように業務名順にソート
            workingUsers.sort((a, b) => {
                const taskA = a.currentTask || "";
                const taskB = b.currentTask || "";
                return taskA.localeCompare(taskB, "ja");
            });

            let html = '';
            workingUsers.forEach(u => {
                const displayName = u.userName || `User (${u.userId.slice(0,4)}...)`;
                const taskName = u.currentTask || '業務中';

                // 【マージ】カード内に工数バッジを表示
                html += `
                <div class="bg-white border border-gray-200 p-3 rounded-lg shadow-sm flex justify-between items-center mb-2 hover:bg-gray-50 transition">
                    <div class="min-w-0 flex-1">
                        <div class="font-bold text-gray-800 text-sm truncate">${escapeHtml(displayName)}</div>
                        <div class="text-xs mt-1 flex flex-wrap items-center gap-1">
                            <span class="text-indigo-600 font-medium flex items-center gap-1">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                ${escapeHtml(taskName)}
                            </span>
                            ${u.currentGoal ? `
                                <span class="px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200 text-[10px]">
                                    目標: ${escapeHtml(u.currentGoal)}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    <div class="flex flex-col items-center ml-2">
                        <span class="relative flex h-3 w-3">
                          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        <span class="text-[10px] text-green-600 mt-1 font-bold">ON</span>
                    </div>
                </div>
                `;
            });
            statusListContainer.innerHTML = html;
        }
    }
}

// XSS対策用エスケープ関数
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
            fetchAndRefreshStatus();
        }
    } catch (error) {
        console.error("強制停止エラー:", error);
        alert("エラーが発生しました。");
    }
}

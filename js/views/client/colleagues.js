// js/views/client/colleagues.js

import { userId } from "../../main.js";
import { escapeHtml } from "../../utils.js";

const WORKER_URL = "https://muddy-night-4bd4.sora-yamashita.workers.dev";
let colleaguesInterval = null;

/**
 * 同僚の稼働状況監視を開始（D1ポーリング版）
 */
export function listenForColleagues(myCurrentTask) {
    stopColleaguesListener();

    if (!myCurrentTask || myCurrentTask === "休憩") {
        updateColleaguesUI([]); // 休憩中や未開始時は表示しない
        return;
    }

    const fetchColleagues = async () => {
        try {
            const resp = await fetch(`${WORKER_URL}/get-all-status`);
            if (!resp.ok) return;
            
            const allStatus = await resp.json();
            
            // 自分以外 且つ 同じ業務 且つ 稼働中 の人を抽出
            const colleagues = allStatus.filter(u => 
                u.userId !== userId && 
                u.isWorking === 1 && 
                u.currentTask === myCurrentTask
            );

            updateColleaguesUI(colleagues);
        } catch (error) {
            console.error("同僚ステータス取得エラー:", error);
        }
    };

    // 初回実行と定期実行（10秒おき）
    fetchColleagues();
    colleaguesInterval = setInterval(fetchColleagues, 10000);
}

/**
 * 監視を停止
 */
export function stopColleaguesListener() {
    if (colleaguesInterval) {
        clearInterval(colleaguesInterval);
        colleaguesInterval = null;
    }
}

/**
 * UIの更新
 */
function updateColleaguesUI(colleagues) {
    const container = document.getElementById("colleagues-on-task-container");
    const listEl = document.getElementById("colleagues-list");

    if (!container || !listEl) return;

    if (colleagues.length === 0) {
        container.classList.add("hidden");
        listEl.innerHTML = "";
        return;
    }

    container.classList.remove("hidden");
    listEl.innerHTML = colleagues.map(c => `
        <li class="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
            <span class="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
            <span class="font-medium">${escapeHtml(c.userName)}</span>
            ${c.currentGoal ? `<span class="text-[10px] bg-orange-100 text-orange-700 px-1 rounded border border-orange-200">${escapeHtml(c.currentGoal)}</span>` : ""}
        </li>
    `).join("");
}

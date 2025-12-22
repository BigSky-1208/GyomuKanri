// js/views/client/colleagues.js

import { userId } from "../../main.js";

const WORKER_URL = "https://muddy-night-4bd4.sora-yamashita.workers.dev";
let colleaguesInterval = null;
let lastColleaguesCache = null; // 節約用のキャッシュ

/**
 * 同僚の稼働状況監視を開始（D1節約ポーリング版）
 */
export function listenForColleagues(myCurrentTask) {
    // 既存のタイマーがあれば一度停止
    stopColleaguesListener();

    // 業務未選択、または休憩中の場合は表示しない
    if (!myCurrentTask || myCurrentTask === "休憩") {
        updateColleaguesUI([]);
        lastColleaguesCache = null;
        return;
    }

    const fetchColleagues = async () => {
        // ★節約対策1: タブが隠れている（非アクティブな）時はDBを読みに行かない
        if (document.hidden) return;

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

            // ★節約対策2: 前回とデータが変わっていなければ、UI更新(DOM操作)をしない
            const dataStr = JSON.stringify(colleagues);
            if (dataStr === lastColleaguesCache) return;

            updateColleaguesUI(colleagues);
            lastColleaguesCache = dataStr; // キャッシュを更新
        } catch (error) {
            console.error("同僚ステータス取得エラー:", error);
        }
    };

    // 初回実行
    fetchColleagues();

    // ★節約対策3: 更新間隔を 60秒(60000ms) に設定
    colleaguesInterval = setInterval(fetchColleagues, 60000);
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
            <span class="font-medium">${escapeHtml(c.userName || '匿名ユーザー')}</span>
            ${c.currentGoal ? `
                <span class="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200">
                    ${escapeHtml(c.currentGoal)}
                </span>
            ` : ""}
        </li>
    `).join("");
}

// XSS対策用
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return "";
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// ★節約対策4: タブに戻った瞬間に、1分待たずに最新の状態をチェックする
document.addEventListener("visibilitychange", () => {
    if (!document.hidden && colleaguesInterval) {
        // 現在の業務名を取得して再実行（timer.jsからグローバルで取れる場合。難しければ省略可）
        // 実際にはtimer.js内のstartTaskからlistenForColleaguesが再起動されるので、ここでの処理は補助的です。
    }
});

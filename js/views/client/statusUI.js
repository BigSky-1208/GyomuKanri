// js/views/client/statusUI.js

import { db, userId } from "../../main.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ステータスと場所の両方を受け取って表示
export function updateTomuraStatusDisplay(data) {
    const statusEl = document.getElementById("tomura-status-display");
    if (!statusEl) return;

    // data が文字列できた場合（後方互換）とオブジェクトの場合を考慮
    let statusText = "声掛けNG";
    let locationText = "";
    
    if (typeof data === 'string') {
        statusText = data;
    } else if (data && typeof data === 'object') {
        statusText = data.status || "声掛けNG";
        locationText = data.location || "";
    }

    // アイコンや色の決定
    let bgColor = "bg-gray-100";
    let textColor = "text-gray-500";
    let icon = "🔒";

    if (statusText === "声掛けOK") {
        bgColor = "bg-green-100";
        textColor = "text-green-700";
        icon = "⭕";
    } else if (statusText === "声掛けNG") {
        bgColor = "bg-red-100";
        textColor = "text-red-700";
        icon = "❌";
    } else if (statusText === "急用ならOK") {
        bgColor = "bg-yellow-100";
        textColor = "text-yellow-800";
        icon = "⚠";
    }

    // 場所アイコン
    let locIcon = "";
    if (locationText === "出社") locIcon = "🏢";
    if (locationText === "リモート") locIcon = "🏠";

    statusEl.className = `p-3 rounded-lg border shadow-sm flex items-center justify-between ${bgColor}`;
    
    // 表示内容の構築
    let htmlContent = `
        <div class="flex flex-col">
            <span class="text-xs text-gray-500 font-bold mb-1">戸村さんステータス</span>
            <div class="flex items-center gap-2">
    `;

    if (locationText) {
        htmlContent += `
            <span class="font-bold text-gray-800 flex items-center bg-white px-2 py-1 rounded shadow-sm border border-gray-200 text-sm">
                ${locIcon} ${locationText}
            </span>
        `;
    }

    htmlContent += `
                <span class="font-bold ${textColor} text-lg flex items-center">
                    ${icon} ${statusText}
                </span>
            </div>
        </div>
    `;

    statusEl.innerHTML = htmlContent;
}

// 今日の一言リスナー設定
export function setupWordOfTheDayListener() {
    const input = document.getElementById("word-of-the-day-input");
    if (!input || !userId) return;

    input.addEventListener("change", async (e) => {
        const val = e.target.value.trim();
        const statusRef = doc(db, "work_status", userId);
        try {
            await updateDoc(statusRef, { wordOfTheDay: val });
        } catch(err) {
            console.error("Error updating word of the day:", err);
        }
    });
}

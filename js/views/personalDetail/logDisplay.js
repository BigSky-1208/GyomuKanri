// js/views/personalDetail/logDisplay.js (UI描画 担当)

import { formatDuration, formatTime, escapeHtml } from "../../utils.js";
import { openUpdateRequestModal } from "./requestModal.js";

export function clearDetails(detailsTitleEl, detailsContentEl) {
    if (detailsTitleEl) detailsTitleEl.textContent = "詳細";
    if (detailsContentEl) {
        detailsContentEl.innerHTML = '<p class="text-gray-500">カレンダーの日付または月をクリックして詳細を表示します。</p>';
    }
}

export function showDailyLogs(date, selectedUserLogs, authLevel, currentUserForDetailView, currentUserName, detailsTitleEl, detailsContentEl) {
    if (!date || !detailsTitleEl || !detailsContentEl) return;

    const logsForDay = selectedUserLogs.filter((log) => log.date === date);
    detailsTitleEl.textContent = `${date} の業務内訳`; 

    if (logsForDay.length > 0) {
        let summaryHtml = '';
        let timelineHtml = '';
        let goalHtml = '';

        const dailyWorkSummary = {}; 
        const goalContributions = {}; 

        logsForDay.sort((a, b) => (a.startTime?.getTime() || 0) - (b.startTime?.getTime() || 0));

        // 変更申請ボタン用ハンドラ
        window.handleRequestUpdateClick = (logId) => {
            const log = logsForDay.find(l => l.id === logId);
            if (log) openUpdateRequestModal(log);
        };

        logsForDay.forEach((log) => {
            const startTimeStr = formatTime(log.startTime);
            const endTimeStr = formatTime(log.endTime);

            // 集計処理
            if (log.type === "goal" && log.goalTitle && log.task) {
                const key = `[${log.task}] ${log.goalTitle}`;
                if (!goalContributions[key]) {
                    goalContributions[key] = { contribution: 0, logs: [] };
                }
                goalContributions[key].contribution += (log.contribution || 0);
                goalContributions[key].logs.push(log);
            } else if (log.task && log.task !== "休憩") {
                const summaryKey = log.goalTitle ? `${log.task} (${log.goalTitle})` : log.task;
                if (!dailyWorkSummary[summaryKey]) dailyWorkSummary[summaryKey] = 0;
                dailyWorkSummary[summaryKey] += (log.duration || 0);
            }

            // タイムライン表示
            const taskDisplay = log.goalTitle
                ? `${escapeHtml(log.task)} <span class="text-xs text-gray-500">(${escapeHtml(log.goalTitle)})</span>`
                : escapeHtml(log.task);
            const memoHtml = log.memo ? `<p class="text-sm text-gray-600 mt-1 pl-2 border-l-2 border-gray-300 whitespace-pre-wrap">${escapeHtml(log.memo)}</p>` : "";

            const isAdmin = authLevel === 'admin';
            const isSelf = currentUserForDetailView === currentUserName;
            
            // ★修正: ボタン表示ロジック
            // 「時間修正」「メモ修正」は、管理者または本人なら表示（元の機能）
            let editButtons = "";
            if (isAdmin || isSelf) {
                editButtons = `
                    <button class="edit-log-btn text-xs bg-blue-500 text-white font-bold py-1 px-2 rounded hover:bg-blue-600" data-log-id="${log.id}" data-duration="${log.duration || 0}" data-task-name="${escapeHtml(log.task)}">時間修正</button>
                    <button class="edit-memo-btn text-xs bg-gray-500 text-white font-bold py-1 px-2 rounded hover:bg-gray-600" data-log-id="${log.id}" data-memo="${escapeHtml(log.memo || "")}">メモ修正</button>
                `;
            }

            // 「変更申請」は、本人の場合に追加で表示
            let requestButton = "";
            if (isSelf) {
                requestButton = `
                    <button onclick="handleRequestUpdateClick('${log.id}')" class="text-xs bg-yellow-500 text-white font-bold py-1 px-2 rounded hover:bg-yellow-600 ml-2">
                        変更申請
                    </button>
                `;
            }

            const bgClass = log.task === "休憩" ? "bg-yellow-50" : "bg-gray-50";
            const textClass = log.task === "休憩" ? "text-yellow-800" : "text-gray-800";

            timelineHtml += `<li class="p-3 ${bgClass} rounded-lg">
                <div class="flex justify-between items-center">
                    <span class="font-semibold ${textClass}">${taskDisplay}</span>
                    <span class="font-mono text-sm bg-gray-200 px-2 py-1 rounded">${startTimeStr} - ${endTimeStr}</span>
                </div>
                ${memoHtml}
                <div class="flex justify-between items-center mt-1">
                     <div class="text-gray-500 text-sm">合計: ${formatDuration(log.duration || 0)} ${log.contribution ? `/ ${log.contribution}件` : ''}</div>
                     <div class="flex gap-1">
                        ${editButtons}
                        ${requestButton}
                     </div>
                </div>
            </li>`;
        });

        // サマリー表示
        summaryHtml = '<h4 class="text-lg font-semibold mb-2">1日の合計 (休憩除く)</h4>';
        if (Object.keys(dailyWorkSummary).length > 0) {
            summaryHtml += '<ul class="space-y-2">';
             Object.entries(dailyWorkSummary)
                 .sort(([, a], [, b]) => b - a)
                 .forEach(([taskKey, duration]) => {
                     summaryHtml += `<li class="p-2 bg-gray-100 rounded-md flex justify-between"><strong>${escapeHtml(taskKey)}</strong> <span>${formatDuration(duration)}</span></li>`;
                 });
             summaryHtml += "</ul>";
        } else {
             summaryHtml += '<p class="text-gray-500 text-sm">この日の業務記録はありません。</p>';
        }

        // ゴール貢献表示
        goalHtml = '';
        if (Object.keys(goalContributions).length > 0) {
            goalHtml += '<h4 class="text-lg font-semibold mt-4 mb-2 border-t pt-4">目標貢献</h4><ul class="space-y-2">';
            const isAdmin = authLevel === 'admin';

            Object.entries(goalContributions)
                 .sort((a, b) => a[0].localeCompare(b[0], "ja"))
                 .forEach(([goalKey, goalData]) => {
                     const firstLog = goalData.logs[0];
                     const editButtonHtml = isAdmin && firstLog ? `
                         <button class="edit-contribution-btn text-xs bg-blue-500 text-white font-bold py-1 px-2 rounded hover:bg-blue-600"
                                 data-user-name="${escapeHtml(currentUserForDetailView)}"
                                 data-goal-id="${firstLog.goalId}"
                                 data-task-name="${escapeHtml(firstLog.task)}"
                                 data-goal-title="${escapeHtml(firstLog.goalTitle)}"
                                 data-date="${date}">修正</button>
                     ` : "";

                     goalHtml += `<li class="p-2 bg-yellow-50 rounded-md flex justify-between items-center">
                         <span><strong>⭐ ${escapeHtml(goalKey)}</strong> <span>${goalData.contribution}件</span></span>
                         ${editButtonHtml}
                     </li>`;
                 });
             goalHtml += "</ul>";
        }

         timelineHtml = timelineHtml ? `<h4 class="text-lg font-semibold mt-4 mb-2 border-t pt-4">タイムライン</h4><ul class="space-y-3">${timelineHtml}</ul>` : '';

        detailsContentEl.innerHTML = summaryHtml + goalHtml + timelineHtml;

    } else {
        detailsContentEl.innerHTML = '<p class="text-gray-500">この日の業務ログはありません。</p>';
    }
}

export function showMonthlyLogs(currentCalendarDate, logsForMonth, detailsTitleEl, detailsContentEl, monthYearEl) {
    if (!detailsTitleEl || !detailsContentEl || !monthYearEl) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth() + 1;
    
    monthYearEl.textContent = `${year}年 ${month}月`;
    detailsTitleEl.textContent = `${year}年 ${month}月 の業務集計`;

    if (logsForMonth.length > 0) {
        const monthlySummary = {};
        const monthlyGoalContributions = {};

        logsForMonth.forEach((log) => {
            if (log.type === "goal" && log.goalTitle && log.task) {
                 const key = `[${log.task}] ${log.goalTitle}`;
                 if (!monthlyGoalContributions[key]) monthlyGoalContributions[key] = 0;
                 monthlyGoalContributions[key] += (log.contribution || 0);
            } else if (log.task && log.task !== "休憩") {
                const summaryKey = log.goalTitle ? `${log.task} (${log.goalTitle})` : log.task;
                if (!monthlySummary[summaryKey]) monthlySummary[summaryKey] = 0;
                monthlySummary[summaryKey] += (log.duration || 0);
            }
        });

        let contentHtml = '<h4 class="text-lg font-semibold mb-2">業務時間合計 (休憩除く)</h4>';
        if (Object.keys(monthlySummary).length > 0) {
            contentHtml += '<ul class="space-y-2">';
            Object.entries(monthlySummary)
                 .sort(([, a], [, b]) => b - a)
                 .forEach(([taskKey, duration]) => {
                     contentHtml += `<li class="p-2 bg-gray-100 rounded-md flex justify-between"><strong>${escapeHtml(taskKey)}</strong> <span>${formatDuration(duration)}</span></li>`;
                 });
             contentHtml += "</ul>";
        } else {
             contentHtml += '<p class="text-gray-500 text-sm">この月の業務時間記録はありません。</p>';
        }

         if (Object.keys(monthlyGoalContributions).length > 0) {
            contentHtml += '<h4 class="text-lg font-semibold mt-4 mb-2 border-t pt-4">目標貢献 合計</h4>';
            contentHtml += '<ul class="space-y-2">';
            Object.entries(monthlyGoalContributions)
                .sort((a,b)=> a[0].localeCompare(b[0], "ja"))
                .forEach(([goalKey, contribution]) => {
                    contentHtml += `<li class="p-2 bg-yellow-50 rounded-md flex justify-between"><span><strong>⭐ ${escapeHtml(goalKey)}</strong></span> <span>${contribution}件</span></li>`;
                });
            contentHtml += "</ul>";
        }

        detailsContentEl.innerHTML = contentHtml;
    } else {
        detailsContentEl.innerHTML = '<p class="text-gray-500">この月の業務ログはありません。</p>';
    }
}

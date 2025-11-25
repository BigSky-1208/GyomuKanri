// js/views/personalDetail/logDisplay.js (UI描画 担当)

import { formatDuration, formatTime, escapeHtml } from "../../utils.js";

/**
 * Clears the details pane and resets the title.
 * @param {HTMLElement} detailsTitleEl - The title element.
 * @param {HTMLElement} detailsContentEl - The content element.
 */
export function clearDetails(detailsTitleEl, detailsContentEl) {
    if (detailsTitleEl) detailsTitleEl.textContent = "詳細";
    if (detailsContentEl) {
        detailsContentEl.innerHTML = '<p class="text-gray-500">カレンダーの日付または月をクリックして詳細を表示します。</p>';
    }
}

/**
 * Displays the detailed logs and summary for a specific day.
 * @param {string} date - The selected date string "YYYY-MM-DD".
 * @param {Array} selectedUserLogs - The array of logs for the *current month*.
 * @param {string} authLevel - The user's auth level.
 * @param {string} currentUserForDetailView - The name of the user being viewed.
 * @param {string} currentUserName - The name of the logged-in user.
 * @param {HTMLElement} detailsTitleEl - The title element.
 * @param {HTMLElement} detailsContentEl - The content element.
 */
export function showDailyLogs(date, selectedUserLogs, authLevel, currentUserForDetailView, currentUserName, detailsTitleEl, detailsContentEl) {
    if (!date || !detailsTitleEl || !detailsContentEl) return;

    // Filter logs for the selected day
    const logsForDay = selectedUserLogs.filter((log) => log.date === date);
    detailsTitleEl.textContent = `${date} の業務内訳`; // Update details title

    if (logsForDay.length > 0) {
        let summaryHtml = '';
        let timelineHtml = '';
        let goalHtml = '';

        const dailyWorkSummary = {}; // Summarize work task durations
        const goalContributions = {}; // Summarize goal contributions { goalKey: { contribution, logs: [] } }

        logsForDay.sort((a, b) => (a.startTime?.getTime() || 0) - (b.startTime?.getTime() || 0));

        logsForDay.forEach((log) => {
            const startTimeStr = formatTime(log.startTime);
            const endTimeStr = formatTime(log.endTime);

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

                 const taskDisplay = log.goalTitle
                     ? `${escapeHtml(log.task)} <span class="text-xs text-gray-500">(${escapeHtml(log.goalTitle)})</span>`
                     : escapeHtml(log.task);
                 const memoHtml = log.memo ? `<p class="text-sm text-gray-600 mt-1 pl-2 border-l-2 border-gray-300 whitespace-pre-wrap">${escapeHtml(log.memo)}</p>` : "";

                 const canEdit = authLevel === 'admin' || currentUserForDetailView === currentUserName;
                 const editButtons = canEdit ? `
                     <div class="flex gap-2 mt-1">
                         <button class="edit-log-btn text-xs bg-blue-500 text-white font-bold py-1 px-2 rounded hover:bg-blue-600" data-log-id="${log.id}" data-duration="${log.duration || 0}" data-task-name="${escapeHtml(log.task)}">時間修正</button>
                         <button class="edit-memo-btn text-xs bg-gray-500 text-white font-bold py-1 px-2 rounded hover:bg-gray-600" data-log-id="${log.id}" data-memo="${escapeHtml(log.memo || "")}">メモ修正</button>
                     </div>
                 ` : "";

                 timelineHtml += `<li class="p-3 bg-gray-50 rounded-lg">
                     <div class="flex justify-between items-center">
                         <span class="font-semibold text-gray-800">${taskDisplay}</span>
                         <span class="font-mono text-sm bg-gray-200 px-2 py-1 rounded">${startTimeStr} - ${endTimeStr}</span>
                     </div>
                     ${memoHtml}
                     <div class="flex justify-between items-center mt-1">
                          <div class="text-gray-500 text-sm">合計: ${formatDuration(log.duration || 0)}</div>
                          ${editButtons}
                     </div>
                 </li>`;

            } else if (log.task === "休憩") {
                 timelineHtml += `<li class="p-3 bg-yellow-50 rounded-lg">
                     <div class="flex justify-between items-center">
                         <span class="font-semibold text-yellow-800">${escapeHtml(log.task)}</span>
                         <span class="font-mono text-sm bg-gray-200 px-2 py-1 rounded">${startTimeStr} - ${endTimeStr}</span>
                     </div>
                      <div class="text-gray-500 text-sm mt-1">合計: ${formatDuration(log.duration || 0)}</div>
                 </li>`;
            }
        });

        // --- Build Summary Section ---
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

        // --- Build Goal Contribution Section ---
        goalHtml = '';
        if (Object.keys(goalContributions).length > 0) {
            goalHtml += '<h4 class="text-lg font-semibold mt-4 mb-2 border-t pt-4">目標貢献</h4><ul class="space-y-2">';
            const canEdit = authLevel === 'admin' || currentUserForDetailView === currentUserName;

            Object.entries(goalContributions)
                 .sort((a, b) => a[0].localeCompare(b[0], "ja"))
                 .forEach(([goalKey, goalData]) => {
                     const firstLog = goalData.logs[0];
                     const editButtonHtml = canEdit && firstLog ? `
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

        // --- Build Timeline Section ---
         timelineHtml = timelineHtml ? `<h4 class="text-lg font-semibold mt-4 mb-2 border-t pt-4">タイムライン</h4><ul class="space-y-3">${timelineHtml}</ul>` : '';

        detailsContentEl.innerHTML = summaryHtml + goalHtml + timelineHtml;

    } else {
        detailsContentEl.innerHTML = '<p class="text-gray-500">この日の業務ログはありません。</p>';
    }
}

/**
 * Displays the monthly summary of work logs in the details pane.
 * @param {Date} currentCalendarDate - The date object for the displayed month.
 * @param {Array} logsForMonth - The (already filtered) array of logs for the month.
 * @param {HTMLElement} detailsTitleEl - The title element.
 * @param {HTMLElement} detailsContentEl - The content element.
 * @param {HTMLElement} monthYearEl - The month/year display element.
 */
export function showMonthlyLogs(currentCalendarDate, logsForMonth, detailsTitleEl, detailsContentEl, monthYearEl) {
    if (!detailsTitleEl || !detailsContentEl || !monthYearEl) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth() + 1; // 1-based
    
    // (monthYearEl は renderCalendar が更新するが、念のためこちらでも更新)
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

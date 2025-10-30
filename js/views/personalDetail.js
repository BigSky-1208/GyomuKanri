// js/views/personalDetail.js

// Import missing functions/variables
import { db, userName as currentUserName, authLevel, viewHistory, showView, VIEWS, allTaskObjects, updateGlobalTaskObjects, handleGoBack } from "../../main.js"; // Import allTaskObjects, updateGlobalTaskObjects, handleGoBack
// Import Timestamp and getDoc, etc.
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, getDocs, deleteDoc, Timestamp, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Import Timestamp, getDoc, etc.
import { renderUnifiedCalendar } from "../components/calendar.js"; // Import calendar rendering function
// getJSTDateString が utils.js からインポートされていることを確認
import { formatDuration, formatTime, getJSTDateString, escapeHtml } from "../utils.js"; // Import utility functions, including escapeHtml
import { showConfirmationModal, hideConfirmationModal, editLogModal, editMemoModal, editContributionModal } from "../components/modal.js"; // Import modal elements and functions

// --- Module State ---
let personalDetailUnsubscribe = null; // Firestore listener unsubscribe function
let selectedUserLogs = []; // Cache for the currently viewed user's logs
let currentCalendarDate = new Date(); // Date displayed on the calendar
let selectedDateStr = null; // Currently selected date string ("YYYY-MM-DD")
let currentUserForDetailView = null; // Name of the user being viewed
let currentEditingLogId = null; // ID of the log being edited (time or memo)
let currentEditingContribution = {}; // State for editing contribution { userName, goalId, date, taskName, goalTitle, logIds }

// --- DOM Element references ---
const detailTitle = document.getElementById("personal-detail-title");
const calendarEl = document.getElementById("calendar");
const monthYearEl = document.getElementById("calendar-month-year");
const prevMonthBtn = document.getElementById("prev-month-btn");
const nextMonthBtn = document.getElementById("next-month-btn");
const detailsTitleEl = document.getElementById("details-title");
const detailsContentEl = document.getElementById("details-content");
const deleteUserContainer = document.getElementById("delete-user-container");
const deleteUserBtn = document.getElementById("delete-user-btn");
const backButton = document.getElementById("back-from-detail-btn");

// Log Edit Modal Elements
const editLogTaskNameEl = document.getElementById("edit-log-task-name");
const editHoursInput = document.getElementById("edit-hours-input");
const editMinutesInput = document.getElementById("edit-minutes-input");
const editLogErrorEl = document.getElementById("edit-log-error");
const editLogSaveBtn = document.getElementById("edit-log-save-btn");
// const editLogCancelBtn = document.getElementById("edit-log-cancel-btn"); // Handled in modal.js

// Memo Edit Modal Elements
const editMemoTextarea = document.getElementById("edit-memo-textarea");
const editMemoSaveBtn = document.getElementById("edit-memo-save-btn");
// const editMemoCancelBtn = document.getElementById("edit-memo-cancel-btn"); // Handled in modal.js

// Contribution Edit Modal Elements
const editContributionTitleEl = document.getElementById("edit-contribution-title");
const editContributionInput = document.getElementById("edit-contribution-input");
const editContributionErrorEl = document.getElementById("edit-contribution-error");
const editContributionSaveBtn = document.getElementById("edit-contribution-save-btn");
// const editContributionCancelBtn = document.getElementById("edit-contribution-cancel-btn"); // Handled in modal.js


/**
 * Initializes the Personal Detail view.
 * Sets the title, determines if delete button should be shown, and starts the log listener.
 * @param {{userName: string}} data - Data object containing the username.
 */
export function initializePersonalDetailView(data) {
    const name = data?.userName; // Extract name from data object
    if (!name) {
        console.error("Cannot initialize Personal Detail View: Username missing in data.");
        // Optionally show an error message in the UI or navigate back
        handleGoBack(); // Go back if no username provided
        return;
    }

    console.log(`Initializing Personal Detail View for: ${name}`);
    currentUserForDetailView = name; // Store the name of the user being viewed

    if (detailTitle) detailTitle.textContent = `${escapeHtml(name)} の業務記録`;

    // Reset date and selection when view initializes for a user
    currentCalendarDate = new Date();
    selectedDateStr = null;

    // Show delete button only if viewing someone else from the host view
    const previousView = viewHistory[viewHistory.length - 2]; // Get the view we came from
    if (deleteUserContainer) {
        // Show delete button if admin is viewing *another* user from the host view.
        if (authLevel === 'admin' && previousView === VIEWS.HOST && currentUserForDetailView !== currentUserName) {
            deleteUserContainer.style.display = "block";
        } else {
            deleteUserContainer.style.display = "none";
        }
    }

    startListeningForUserLogs(name); // Start listener for the specified user's logs
    clearDetails(); // Ensure details pane is cleared initially
}

/**
 * Cleans up the Personal Detail view when navigating away.
 * Stops the Firestore listener.
 */
export function cleanupPersonalDetailView() {
    console.log("Cleaning up Personal Detail View...");
    stopListeningForUserLogs(); // Stop the listener
    selectedUserLogs = []; // Clear log cache
    currentUserForDetailView = null; // Clear current user
    selectedDateStr = null; // Clear selected date
}

/**
 * Sets up event listeners specific to the Personal Detail view.
 */
export function setupPersonalDetailEventListeners() {
    console.log("Setting up Personal Detail event listeners...");
    prevMonthBtn?.addEventListener("click", () => moveMonth(-1));
    nextMonthBtn?.addEventListener("click", () => moveMonth(1));
    backButton?.addEventListener("click", handleGoBack); // Use global go back handler
    deleteUserBtn?.addEventListener("click", handleDeleteUserClick); // Specific handler for delete button

    // Log Edit Modal Listeners
    editLogSaveBtn?.addEventListener("click", handleSaveLogDuration);
    // Cancel buttons are handled globally in modal.js

    // Memo Edit Modal Listeners
    editMemoSaveBtn?.addEventListener("click", handleSaveMemo);

    // Contribution Edit Modal Listeners
    editContributionSaveBtn?.addEventListener("click", handleSaveContribution);

     // Event delegation for timeline buttons (edit time, edit memo, edit contribution)
     detailsContentEl?.addEventListener('click', (event) => {
        const target = event.target; // Get the clicked element directly
        if (target.classList.contains('edit-log-btn')) {
            handleEditLogClick(target); // Pass the button element
        } else if (target.classList.contains('edit-memo-btn')) {
            handleEditMemoClick(target); // Pass the button element
        } else if (target.classList.contains('edit-contribution-btn')) {
             handleEditContributionClick(target); // Pass the button element
        }
     });

    console.log("Personal Detail event listeners set up complete.");
}


/**
 * Starts the Firestore listener for the specified user's work logs.
 * @param {string} name - The username whose logs to fetch.
 */
function startListeningForUserLogs(name) {
    stopListeningForUserLogs(); // Ensure previous listener is stopped

    if (!name) {
        console.error("Cannot listen for logs: Username is missing.");
        renderCalendar(); // Render empty calendar
        return;
    }
    console.log(`Starting log listener for user: ${name}`);

    // --- ▼▼▼ ここから修正 ▼▼▼ ---

    // 1. 表示対象の月の初日と最終日を計算
    // (currentCalendarDate はこのファイルで既に定義・管理されています)
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth(); // 0-based
    
    // getJSTDateString を使って "YYYY-MM-DD" 形式にする
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0); // その月の最終日
    
    const startDateStr = getJSTDateString(firstDay); // "YYYY-MM-01"
    const endDateStr = getJSTDateString(lastDay);   // "YYYY-MM-30" など

    console.log(`Listening for logs for ${name} between ${startDateStr} and ${endDateStr}`);

    // 2. クエリを修正
    const q = query(
        collection(db, "work_logs"),
        where("userName", "==", name),
        where("date", ">=", startDateStr), // ★追加: 月の初日
        where("date", "<=", endDateStr)   // ★追加: 月の最終日
    );
    // (注意: このクエリにはFirestoreの複合インデックスが必要です。
    //  ブラウザのコンソールエラーに従ってインデックスを作成してください。)

    // --- ▲▲▲ ここまで修正 ▲▲▲ ---

    personalDetailUnsubscribe = onSnapshot(q, (snapshot) => {
        selectedUserLogs = snapshot.docs.map((d) => {
            const data = d.data();
            // Convert Firestore Timestamps to JS Date objects
            const log = { id: d.id, ...data };
            if (log.startTime && log.startTime.toDate) log.startTime = log.startTime.toDate();
            if (log.endTime && log.endTime.toDate) log.endTime = log.endTime.toDate();
            return log;
        });
        console.log(`Received ${selectedUserLogs.length} logs for ${name} for month ${startDateStr.substring(0, 7)}.`);
        renderCalendar(); // Re-render calendar with updated log data
        // Re-render details if a date or month was previously selected
        if (selectedDateStr) {
             // Find the day element to simulate the click event object structure
             const dayElement = calendarEl?.querySelector(`.calendar-day[data-date="${selectedDateStr}"]`);
             if (dayElement) {
                showDailyLogs({ currentTarget: dayElement }); // Simulate event with element
             } else {
                 // If selected date is no longer in the (filtered) logs, clear selection/details
                 console.warn("Previously selected day element not found after log update (or filtered out).");
                 clearDetails(); // Clear details
                 showMonthlyLogs(); // Show monthly logs for the current month instead
             }
        } else {
             // If no specific date selected, show monthly logs for the current view
             showMonthlyLogs();
        }
    }, (error) => {
        console.error(`Error listening for logs for user ${name}:`, error);
        selectedUserLogs = []; // Clear cache on error
        renderCalendar(); // Render empty calendar
        clearDetails(); // Clear details pane
        if(detailsContentEl) detailsContentEl.innerHTML = '<p class="text-red-500">ログの読み込み中にエラーが発生しました。</p>';
    });
}

/**
 * Stops the Firestore listener for user logs.
 */
function stopListeningForUserLogs() {
    if (personalDetailUnsubscribe) {
        console.log("Stopping log listener.");
        personalDetailUnsubscribe();
        personalDetailUnsubscribe = null;
    }
}

/**
 * Renders the calendar UI using the unified calendar component.
 */
function renderCalendar() {
    if (!calendarEl || !monthYearEl) {
        console.warn("Calendar elements not found for rendering.");
        return;
    }
    renderUnifiedCalendar({
        calendarEl: calendarEl,
        monthYearEl: monthYearEl,
        dateToDisplay: currentCalendarDate,
        logs: selectedUserLogs, // Pass the cached (filtered by month) logs
        onDayClick: showDailyLogs, // Function to call when a day is clicked
        onMonthClick: showMonthlyLogs, // Function to call when the month/year title is clicked
    });

     // Re-apply selected class if a date was selected
     if (selectedDateStr) {
         const dayElement = calendarEl.querySelector(`.calendar-day[data-date="${selectedDateStr}"]`);
         if (dayElement) {
             dayElement.classList.add("selected");
         }
     }
}

/**
 * Moves the calendar display to the previous or next month.
 * @param {number} direction - -1 for previous month, 1 for next month.
 */
function moveMonth(direction) {
    selectedDateStr = null; // Clear date selection when changing month
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    
    // --- ★ここから修正★ ---
    // renderCalendar(); // renderCalendar() は listener が呼び出すので不要
    // clearDetails();   // clearDetails() も listener が呼び出すので不要
    
    // 代わりに、新しい月のリスナーを開始する
    // (currentUserForDetailView はモジュール状態に保存されている前提)
    if (currentUserForDetailView) {
        startListeningForUserLogs(currentUserForDetailView);
    } else {
         console.error("Cannot move month, currentUserForDetailView is not set.");
         clearDetails(); // フォールバック
         renderCalendar(); // フォールバック
    }
    // --- ▲▲▲ ここまで修正 ▲▲▲ ---
}

/**
 * Clears the details pane and resets the title.
 */
function clearDetails() {
    selectedDateStr = null; // Clear selected date state
     // Remove selected class from calendar days
     calendarEl?.querySelectorAll(".calendar-day.selected").forEach((el) => el.classList.remove("selected"));
    if (detailsTitleEl) detailsTitleEl.textContent = "詳細";
    if (detailsContentEl) {
        detailsContentEl.innerHTML = '<p class="text-gray-500">カレンダーの日付または月をクリックして詳細を表示します。</p>';
    }
}

/**
 * Displays the detailed logs and summary for a specific day clicked on the calendar.
 * @param {Event | {currentTarget: HTMLElement}} event - The click event object or a simulated object containing the clicked element.
 */
function showDailyLogs(event) {
    const dayElement = event.currentTarget;
    const date = dayElement?.dataset?.date;
    if (!date || !detailsTitleEl || !detailsContentEl || !dayElement) return;

    selectedDateStr = date; // Store selected date

    // Update calendar highlighting
    calendarEl?.querySelectorAll(".calendar-day.selected").forEach((el) => el.classList.remove("selected"));
    dayElement.classList?.add("selected"); // Add selected class to clicked day

    // Filter logs for the selected day (selectedUserLogs は既に月でフィルタリング済み)
    const logsForDay = selectedUserLogs.filter((log) => log.date === date);
    detailsTitleEl.textContent = `${date} の業務内訳`; // Update details title

    if (logsForDay.length > 0) {
        let summaryHtml = '';
        let timelineHtml = '';
        let goalHtml = '';

        const dailyWorkSummary = {}; // Summarize work task durations
        const goalContributions = {}; // Summarize goal contributions { goalKey: { contribution, logs: [] } }

        // Sort logs chronologically for timeline display (using Date objects)
        logsForDay.sort((a, b) => (a.startTime?.getTime() || 0) - (b.startTime?.getTime() || 0));

        logsForDay.forEach((log) => {
            const startTimeStr = formatTime(log.startTime); // Format HH:MM
            const endTimeStr = formatTime(log.endTime);     // Format HH:MM

            if (log.type === "goal" && log.goalTitle && log.task) { // Ensure required fields exist
                // Aggregate goal contributions
                const key = `[${log.task}] ${log.goalTitle}`;
                if (!goalContributions[key]) {
                    goalContributions[key] = { contribution: 0, logs: [] };
                }
                goalContributions[key].contribution += (log.contribution || 0);
                goalContributions[key].logs.push(log); // Keep original log for potential editing context

            } else if (log.task && log.task !== "休憩") { // Exclude breaks from work summary, ensure task exists
                // Aggregate work task durations
                const summaryKey = log.goalTitle ? `${log.task} (${log.goalTitle})` : log.task;
                if (!dailyWorkSummary[summaryKey]) dailyWorkSummary[summaryKey] = 0;
                dailyWorkSummary[summaryKey] += (log.duration || 0);

                // Build timeline item for work logs
                 const taskDisplay = log.goalTitle
                     ? `${escapeHtml(log.task)} <span class="text-xs text-gray-500">(${escapeHtml(log.goalTitle)})</span>`
                     : escapeHtml(log.task);
                 const memoHtml = log.memo ? `<p class="text-sm text-gray-600 mt-1 pl-2 border-l-2 border-gray-300 whitespace-pre-wrap">${escapeHtml(log.memo)}</p>` : "";

                 // Check if editing is allowed (Admin, or Self)
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

            } else if (log.task === "休憩") { // Handle Breaks in timeline only
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
                 .sort(([, a], [, b]) => b - a) // Sort by duration desc
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
                 .sort((a, b) => a[0].localeCompare(b[0], "ja")) // Sort by goal key string
                 .forEach(([goalKey, goalData]) => {
                     const firstLog = goalData.logs[0]; // Get first log for metadata
                     // Ensure firstLog exists before trying to access its properties
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


        // Combine sections and update details content
        detailsContentEl.innerHTML = summaryHtml + goalHtml + timelineHtml;

    } else {
        // No logs found for the day
        detailsContentEl.innerHTML = '<p class="text-gray-500">この日の業務ログはありません。</p>';
    }
}

/**
 * Displays the monthly summary of work logs in the details pane.
 */
function showMonthlyLogs() {
    // ★ 修正: clearDetails() は月の切り替え時にリスナーが再実行される前に
    // 呼び出されるため、ここでは実行しないか、選択解除だけにする
    // clearDetails(); 
    selectedDateStr = null; // 日付選択は解除
    calendarEl?.querySelectorAll(".calendar-day.selected").forEach((el) => el.classList.remove("selected"));


    if (!detailsTitleEl || !detailsContentEl || !monthYearEl) return;

    const year = parseInt(monthYearEl.dataset.year || new Date().getFullYear().toString(), 10);
    const month = parseInt(monthYearEl.dataset.month || (new Date().getMonth() + 1).toString(), 10); // 1-based month
    detailsTitleEl.textContent = `${year}年 ${month}月 の業務集計`;

    // ★ 修正: logsForMonth は selectedUserLogs (既に月でフィルタリング済み) をそのまま使う
    // const monthStr = `${year}-${month.toString().padStart(2, "0")}`; // YYYY-MM format
    // const logsForMonth = selectedUserLogs.filter(
    //     (log) => log.date && log.date.startsWith(monthStr)
    // );
    const logsForMonth = selectedUserLogs; // ★そのまま使用

    if (logsForMonth.length > 0) {
        const monthlySummary = {}; // Key: task/goal combo, Value: duration
        const monthlyGoalContributions = {}; // Key: task/goal combo, Value: contribution count

        logsForMonth.forEach((log) => {
            if (log.type === "goal" && log.goalTitle && log.task) {
                 const key = `[${log.task}] ${log.goalTitle}`;
                 if (!monthlyGoalContributions[key]) monthlyGoalContributions[key] = 0;
                 monthlyGoalContributions[key] += (log.contribution || 0);
            } else if (log.task && log.task !== "休憩") { // Exclude breaks from summary
                const summaryKey = log.goalTitle ? `${log.task} (${log.goalTitle})` : log.task;
                if (!monthlySummary[summaryKey]) monthlySummary[summaryKey] = 0;
                monthlySummary[summaryKey] += (log.duration || 0);
            }
        });

        let contentHtml = '<h4 class="text-lg font-semibold mb-2">業務時間合計 (休憩除く)</h4>';
        if (Object.keys(monthlySummary).length > 0) {
            contentHtml += '<ul class="space-y-2">';
            Object.entries(monthlySummary)
                 .sort(([, a], [, b]) => b - a) // Sort by duration desc
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
                .sort((a,b)=> a[0].localeCompare(b[0], "ja")) // Sort by key
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

/**
 * Handles the click on the "時間修正" (Edit Time) button in the timeline.
 * Opens the edit log modal with the current duration.
 * @param {HTMLElement} button - The button element that was clicked.
 */
function handleEditLogClick(button) {
    currentEditingLogId = button.dataset.logId;
    const duration = parseInt(button.dataset.duration || "0", 10); // Default to 0 if missing
    const taskName = button.dataset.taskName;

    if (isNaN(duration) || !currentEditingLogId || !editLogModal || !editHoursInput || !editMinutesInput || !editLogTaskNameEl || !editLogErrorEl) {
         console.error("Missing data or elements for editing log time.");
         return;
    }


    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);

    editLogTaskNameEl.textContent = `「${escapeHtml(taskName || '不明')}」の時間を修正`;
    editHoursInput.value = hours;
    editMinutesInput.value = minutes;
    editLogErrorEl.textContent = ""; // Clear previous errors

    editLogModal.classList.remove("hidden"); // Show the modal
}

/**
 * Saves the updated duration for a work log entry. Called by the edit log modal save button.
 */
async function handleSaveLogDuration() {
    if (!currentEditingLogId || !editHoursInput || !editMinutesInput || !editLogErrorEl || !editLogModal) {
         console.error("Missing data or elements for saving log duration.");
         return;
    }

    const hours = parseInt(editHoursInput.value, 10) || 0;
    const minutes = parseInt(editMinutesInput.value, 10) || 0;


    // Validation
    if (hours < 0 || minutes < 0 || minutes > 59) {
        editLogErrorEl.textContent = "時間(0以上)、分(0～59)を正しく入力してください。";
        return;
    }
     editLogErrorEl.textContent = ""; // Clear error

    const newDuration = hours * 3600 + minutes * 60; // Calculate new duration in seconds
    const logRef = doc(db, "work_logs", currentEditingLogId);

    try {
        await updateDoc(logRef, { duration: newDuration });
        console.log(`Log ${currentEditingLogId} duration updated to ${newDuration} seconds.`);
        editLogModal.classList.add("hidden"); // Hide modal on success
        currentEditingLogId = null; // Reset editing state
        // The onSnapshot listener will automatically refresh the details pane.
    } catch (error) {
        console.error(`Error updating log duration for ${currentEditingLogId}:`, error);
        editLogErrorEl.textContent = "保存中にエラーが発生しました。";
    }
}

/**
 * Handles the click on the "メモ修正" (Edit Memo) button in the timeline.
 * Opens the edit memo modal with the current memo.
 * @param {HTMLElement} button - The button element that was clicked.
 */
function handleEditMemoClick(button) {
    currentEditingLogId = button.dataset.logId;
    const memo = button.dataset.memo || ""; // Get memo, default to empty string

    if (!currentEditingLogId || !editMemoModal || !editMemoTextarea) {
        console.error("Missing data or elements for editing log memo.");
        return;
    }


    editMemoTextarea.value = memo; // Populate textarea
    editMemoModal.classList.remove("hidden"); // Show the modal
    editMemoTextarea.focus(); // Focus textarea
}

/**
 * Saves the updated memo for a work log entry. Called by the edit memo modal save button.
 */
async function handleSaveMemo() {
    if (!currentEditingLogId || !editMemoTextarea || !editMemoModal) {
         console.error("Missing data or elements for saving log memo.");
         return;
    }

    const newMemo = editMemoTextarea.value.trim(); // Get trimmed memo text
    const logRef = doc(db, "work_logs", currentEditingLogId);

    try {
        await updateDoc(logRef, { memo: newMemo });
        console.log(`Log ${currentEditingLogId} memo updated.`);
        editMemoModal.classList.add("hidden"); // Hide modal on success
        currentEditingLogId = null; // Reset editing state
        // The onSnapshot listener will automatically refresh the details pane.
    } catch (error) {
        console.error(`Error updating log memo for ${currentEditingLogId}:`, error);
        alert("メモの保存中にエラーが発生しました。"); // Show alert in modal?
    }
}

/**
 * Handles the click on the "修正" (Edit) button for goal contributions.
 * Opens the contribution edit modal.
 * @param {HTMLElement} btn - The button element that was clicked.
 */
function handleEditContributionClick(btn) {
    const { userName, goalId, taskName, goalTitle, date } = btn.dataset;

    if (!userName || !goalId || !taskName || !goalTitle || !date || !editContributionModal || !editContributionTitleEl || !editContributionInput || !editContributionErrorEl) {
        console.error("Missing data or elements for editing contribution.");
        return;
    }


    // Find all goal logs for this specific user, goal, and date to calculate current total
    const relevantLogs = selectedUserLogs.filter(
        (log) =>
            log.type === "goal" &&
            log.userName === userName && // Ensure it's the correct user's logs
            log.goalId === goalId &&
            log.date === date
    );

    const currentTotal = relevantLogs.reduce(
        (sum, log) => sum + (log.contribution || 0), // Sum up contributions, default to 0 if missing
        0
    );

    // Store context needed for saving
    currentEditingContribution = {
        userName,
        goalId,
        date,
        taskName,
        goalTitle,
        logIds: relevantLogs.map((log) => log.id), // Store IDs of logs to be replaced
        oldTotal: currentTotal // Store old total to calculate difference later
    };

    // Populate and show the modal
    editContributionTitleEl.textContent = `[${escapeHtml(taskName)}] ${escapeHtml(goalTitle)} - ${escapeHtml(userName)}`;
    editContributionInput.value = currentTotal;
    editContributionErrorEl.textContent = ""; // Clear previous errors
    editContributionModal.classList.remove("hidden");
    editContributionInput.focus();
}

/**
 * Saves the updated total contribution for a specific user, goal, and date.
 * Replaces existing contribution logs for that day with a single new log.
 * Called by the contribution edit modal save button.
 */
async function handleSaveContribution() {
     if (!currentEditingContribution.goalId || !editContributionInput || !editContributionErrorEl || !editContributionModal) {
         console.error("Missing context or elements for saving contribution.");
         return;
     }

    const newTotal = parseInt(editContributionInput.value, 10);

    // Validation
    if (isNaN(newTotal) || newTotal < 0) {
        editContributionErrorEl.textContent = "合計件数として、0以上の数値を入力してください。";
        return;
    }
     editContributionErrorEl.textContent = ""; // Clear error


    const { userName, goalId, date, taskName, goalTitle, logIds, oldTotal } = currentEditingContribution;
    const diff = newTotal - oldTotal; // Calculate the difference to adjust the overall goal progress

    // --- Update Overall Goal Progress in settings/tasks ---
    // Ensure allTaskObjects is available
    if (!allTaskObjects) {
        console.error("allTaskObjects is not available for saving contribution.");
        alert("タスクデータの読み込みエラーが発生しました。");
        return;
    }

    const taskIndex = allTaskObjects.findIndex((t) => t.name === taskName);
    if (taskIndex !== -1 && allTaskObjects[taskIndex].goals) {
        const goalIndex = allTaskObjects[taskIndex].goals.findIndex((g) => g.id === goalId);
        if (goalIndex !== -1) {
            // Create deep copy for Firestore update
            const updatedTasks = JSON.parse(JSON.stringify(allTaskObjects));
            const currentGoalProgress = updatedTasks[taskIndex].goals[goalIndex].current || 0;
            // Adjust the overall progress by the difference calculated from daily edits
            updatedTasks[taskIndex].goals[goalIndex].current = Math.max(0, currentGoalProgress + diff); // Ensure progress doesn't go below 0

            // Update Firestore for settings/tasks
            const tasksRef = doc(db, "settings", "tasks");
            try {
                await updateDoc(tasksRef, { list: updatedTasks });
                console.log(`Overall progress for goal ${goalId} updated by ${diff}.`);
                 // Ensure updateGlobalTaskObjects is available and called
                 if (typeof updateGlobalTaskObjects === 'function') {
                    // Update global state *after* successful save
                    // Note: Firestore listener in main.js should ideally handle this update.
                    // updateGlobalTaskObjects(updatedTasks); // Avoid direct update if listener works reliably
                 } else {
                     console.error("updateGlobalTaskObjects function is not defined or imported.");
                 }
            } catch (error) {
                 console.error("Error updating overall goal progress in settings/tasks:", error);
                 alert("工数全体の進捗更新中にエラーが発生しました。");
                 return; // Stop if overall progress update fails
            }

        } else {
             console.warn(`Goal ID ${goalId} not found in task ${taskName} during contribution save.`);
        }
    } else {
         console.warn(`Task ${taskName} not found during contribution save.`);
    }
     // --- End Update Overall Goal Progress ---


    // --- Replace Daily Contribution Logs ---
    const batch = writeBatch(db);

    // Delete all existing contribution logs for this user/goal/date
    logIds.forEach((id) => {
        batch.delete(doc(db, "work_logs", id));
    });

    // Add a single new log entry representing the new total for the day, if total > 0
    if (newTotal > 0) {
        // We need the user's ID for the log entry. Find it based on the name.
        let editedUserId = "unknown"; // Fallback ID
        const profileQuery = query(collection(db, "user_profiles"), where("name", "==", userName));
        try {
            const profileSnapshot = await getDocs(profileQuery);
            if (!profileSnapshot.empty) {
                editedUserId = profileSnapshot.docs[0].id; // Get the actual user ID
            } else {
                 console.warn(`User ID not found for userName "${userName}" during contribution save.`);
            }
        } catch(error) {
             console.error(`Error fetching userId for ${userName}:`, error);
        }

        // Ensure Timestamp is available
        if (typeof Timestamp === 'undefined') {
             console.error("Firestore Timestamp is not defined. Ensure it's imported correctly.");
             alert("タイムスタンプの作成中にエラーが発生しました。");
             return;
        }


        const newLogEntry = {
            type: "goal",
            userId: editedUserId, // Use the fetched ID
            userName: userName,
            task: taskName,
            goalId: goalId,
            goalTitle: goalTitle,
            contribution: newTotal, // Store the new total as the contribution for this single entry
            date: date,
            startTime: Timestamp.now(), // Timestamp of the edit action
            memo: "[編集による合計値]", // Optional memo indicating edit
        };
        batch.set(doc(collection(db, "work_logs")), newLogEntry); // Add the new log entry
    }

    // Commit the batch delete/set operations for work_logs
    try {
        await batch.commit();
        console.log(`Contribution logs for ${userName}, goal ${goalId} on ${date} updated to new total: ${newTotal}.`);
        editContributionModal.classList.add("hidden"); // Hide modal on success
        currentEditingContribution = {}; // Clear editing state

        // Re-fetch the task list if updateGlobalTaskObjects wasn't called after settings update
        // This ensures the goal progress reflects the change immediately.
         // const tasksRef = doc(db, "settings", "tasks");
         // const updatedTasksSnap = await getDoc(tasksRef);
         // if(updatedTasksSnap.exists()){
         //     updateGlobalTaskObjects(updatedTasksSnap.data().list);
         // }


        // The onSnapshot listener for personalDetail logs will refresh the details pane.
    } catch (error) {
        console.error("Error committing contribution log changes:", error);
        editContributionErrorEl.textContent = "貢献ログの更新中にエラーが発生しました。";
    }
    // --- End Replace Daily Contribution Logs ---
}


/**
 * Handles the click on the "このユーザーのプロフィールと全記録を削除" button.
 * Prompts for confirmation before deleting user profile and all associated logs.
 */
function handleDeleteUserClick() {
    if (authLevel !== 'admin' || !currentUserForDetailView || currentUserForDetailView === currentUserName) {
        console.warn("Delete user action aborted: Insufficient permissions or invalid target.");
        return; // Only admin can delete *other* users
    }

    const userNameToDelete = currentUserForDetailView;

    showConfirmationModal(
        `本当に「${escapeHtml(userNameToDelete)}」のプロフィールと全ての業務記録（work_logs, work_status）を削除しますか？\n\nこの操作は元に戻せません。`,
        async () => {
            console.warn(`Attempting to delete user: ${userNameToDelete}`);
            hideConfirmationModal(); // Hide modal immediately

            try {
                const batch = writeBatch(db);

                // 1. Find User Profile ID
                let userIdToDelete = null;
                const qProfiles = query(collection(db, "user_profiles"), where("name", "==", userNameToDelete));
                const profileDocs = await getDocs(qProfiles);
                if (!profileDocs.empty) {
                    userIdToDelete = profileDocs.docs[0].id;
                    batch.delete(profileDocs.docs[0].ref); // Delete user_profiles document
                    console.log(`Deleting profile for ${userNameToDelete} (ID: ${userIdToDelete})`);
                } else {
                    console.warn(`User profile not found for "${userNameToDelete}". Proceeding to delete logs.`);
                     // Continue to delete logs even if profile not found, just in case
                }

                 // 2. Delete Work Logs associated with the username
                 // Querying by userName is necessary if userId wasn't found or logs might exist without matching profile ID
                 const qLogs = query(collection(db, "work_logs"), where("userName", "==", userNameToDelete));
                 const logDocs = await getDocs(qLogs);
                 console.log(`Found ${logDocs.size} work logs for ${userNameToDelete} to delete.`);
                 logDocs.forEach((docSnapshot) => batch.delete(docSnapshot.ref));

                 // 3. Delete Work Status if userId was found
                 if (userIdToDelete) {
                     const statusRef = doc(db, "work_status", userIdToDelete);
                     // Check if status exists before deleting (optional but safer)
                     // const statusSnap = await getDoc(statusRef);
                     // if(statusSnap.exists()) {
                         batch.delete(statusRef); // Delete work_status document
                         console.log(`Deleting status for ${userNameToDelete} (ID: ${userIdToDelete})`);
                     // }
                 } else {
                     console.warn(`Skipping status deletion as userId for ${userNameToDelete} was not found.`);
                 }


                // 4. Commit all deletions
                await batch.commit();
                console.log(`Successfully deleted user ${userNameToDelete} and associated data.`);
                alert(`ユーザー「${escapeHtml(userNameToDelete)}」を削除しました。`);

                // Navigate back to the host view after deletion
                showView(VIEWS.HOST);

            } catch (error) {
                console.error(`Error deleting user ${userNameToDelete}:`, error);
                alert(`ユーザー「${escapeHtml(userNameToDelete)}」の削除中にエラーが発生しました。`);
            }
        },
        () => {
             console.log(`Deletion of user ${userNameToDelete} cancelled.`); // Log cancellation
        }
    );
}

// Global handleGoBack is imported from main.js, no need to redefine here
// /**
//  * Handles the "戻る" (Back) button click, navigating to the previous view.
//  */
// function handleGoBack() {
//     viewHistory.pop(); // Remove current view
//     const previousView = viewHistory.pop() || VIEWS.HOST; // Get previous or default
//     showView(previousView);
// }


}

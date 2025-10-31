// js/views/personalDetail.js (リファクタリング版 - 司令塔)

import { db, userName as currentUserName, authLevel, viewHistory, showView, VIEWS, allTaskObjects, updateGlobalTaskObjects, handleGoBack } from "../../main.js";
import { renderUnifiedCalendar } from "../components/calendar.js";
// モーダル本体の参照は、各ロジックファイルが個別に import するように変更しても良い
import { editLogModal, editMemoModal, editContributionModal } from "../components/modal.js";

// --- 新しく分割したモジュールをインポート ---
import { startListeningForUserLogs, stopListeningForUserLogs } from "./personalDetail/logData.js";
import { showDailyLogs, showMonthlyLogs, clearDetails } from "./personalDetail/logDisplay.js";
import { handleTimelineClick, handleSaveLogDuration, handleSaveMemo, handleSaveContribution } from "./personalDetail/logEditor.js";
import { handleDeleteUserClick } from "./personalDetail/adminActions.js";

// --- Module State (ビュー全体のグローバル状態) ---
let selectedUserLogs = []; // Cache for the currently viewed user's logs
let currentCalendarDate = new Date(); // Date displayed on the calendar
let selectedDateStr = null; // Currently selected date string ("YYYY-MM-DD")
let currentUserForDetailView = null; // Name of the user being viewed

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

// Log Edit Modal Elements (Saveボタンのリスナー設定用)
const editLogSaveBtn = document.getElementById("edit-log-save-btn");
// Memo Edit Modal Elements (Saveボタンのリスナー設定用)
const editMemoSaveBtn = document.getElementById("edit-memo-save-btn");
// Contribution Edit Modal Elements (Saveボタンのリスナー設定用)
const editContributionSaveBtn = document.getElementById("edit-contribution-save-btn");

/**
 * Initializes the Personal Detail view.
 */
export function initializePersonalDetailView(data) {
    const name = data?.userName;
    if (!name) {
        console.error("Cannot initialize Personal Detail View: Username missing in data.");
        handleGoBack();
        return;
    }

    console.log(`Initializing Personal Detail View for: ${name}`);
    currentUserForDetailView = name;

    if (detailTitle) detailTitle.textContent = `${escapeHtml(name)} の業務記録`;

    currentCalendarDate = new Date();
    selectedDateStr = null;

    // Show delete button
    const previousView = viewHistory[viewHistory.length - 2];
    if (deleteUserContainer) {
        if (authLevel === 'admin' && previousView === VIEWS.HOST && currentUserForDetailView !== currentUserName) {
            deleteUserContainer.style.display = "block";
        } else {
            deleteUserContainer.style.display = "none";
        }
    }

    // データ取得を開始（コールバックでUI描画をトリガー）
    startListeningForUserLogs(currentUserForDetailView, currentCalendarDate, (logs) => {
        selectedUserLogs = logs; // 取得したログをローカル状態に保存
        renderCalendar();      // カレンダーを描画
        
        // 初期表示は月次集計
        if (selectedDateStr) {
            const dayElement = calendarEl?.querySelector(`.calendar-day[data-date="${selectedDateStr}"]`);
            if(dayElement) {
                // 日付が選択されていたら日次を表示
                handleDayClick({ currentTarget: dayElement });
            } else {
                handleMonthClick(); // 該当の日付がなければ月次
            }
        } else {
            handleMonthClick(); // 月次集計を表示
        }
    });

    clearDetails(detailsTitleEl, detailsContentEl); // 詳細は一旦クリア
}

/**
 * Cleans up the Personal Detail view when navigating away.
 */
export function cleanupPersonalDetailView() {
    console.log("Cleaning up Personal Detail View...");
    stopListeningForUserLogs(); // データ取得リスナーを停止
    selectedUserLogs = [];
    currentUserForDetailView = null;
    selectedDateStr = null;
}

/**
 * Sets up event listeners specific to the Personal Detail view.
 */
export function setupPersonalDetailEventListeners() {
    console.log("Setting up Personal Detail event listeners...");
    prevMonthBtn?.addEventListener("click", () => moveMonth(-1));
    nextMonthBtn?.addEventListener("click", () => moveMonth(1));
    backButton?.addEventListener("click", handleGoBack);
    
    // 管理者機能
    deleteUserBtn?.addEventListener("click", () => {
        // adminActions モジュールの関数を呼び出し
        handleDeleteUserClick(currentUserForDetailView, authLevel, currentUserName);
    });

    // 編集モーダルの保存ボタン
    editLogSaveBtn?.addEventListener("click", handleSaveLogDuration);
    editMemoSaveBtn?.addEventListener("click", handleSaveMemo);
    editContributionSaveBtn?.addEventListener("click", handleSaveContribution);

     // 詳細ペイン内のクリック（イベント委任）
     detailsContentEl?.addEventListener('click', (event) => {
        // logEditor モジュールの関数に処理を委任
        handleTimelineClick(event.target, selectedUserLogs, currentUserForDetailView, {
             editLogModal,
             editMemoModal,
             editContributionModal
         });
     });

    console.log("Personal Detail event listeners set up complete.");
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
        onDayClick: handleDayClick, // 日付クリック時のハンドラ
        onMonthClick: handleMonthClick, // 月クリック時のハンドラ
    });

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
    selectedDateStr = null; // 日付選択をクリア
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    
    // 新しい月のリスナーを開始
    if (currentUserForDetailView) {
        startListeningForUserLogs(currentUserForDetailView, currentCalendarDate, (logs) => {
            selectedUserLogs = logs;
            renderCalendar();
            handleMonthClick(); // 月次集計を表示
        });
    } else {
         console.error("Cannot move month, currentUserForDetailView is not set.");
    }
}

/**
 * Handles clicks on a calendar day.
 * @param {Event} event - The click event object.
 */
function handleDayClick(event) {
    const dayElement = event.currentTarget;
    const date = dayElement?.dataset?.date;
    if (!date) return;

    selectedDateStr = date;

    // カレンダーのハイライト更新
    calendarEl?.querySelectorAll(".calendar-day.selected").forEach((el) => el.classList.remove("selected"));
    dayElement.classList?.add("selected");

    // 詳細ペインの描画を logDisplay モジュールに委任
    showDailyLogs(
        date,
        selectedUserLogs, // 現在の月のログ
        authLevel,
        currentUserForDetailView,
        currentUserName,
        detailsTitleEl,
        detailsContentEl
    );
}

/**
 * Handles clicks on the month title.
 */
function handleMonthClick() {
    selectedDateStr = null; // 日付選択を解除
    calendarEl?.querySelectorAll(".calendar-day.selected").forEach((el) => el.classList.remove("selected"));

    // 月次集計の描画を logDisplay モジュールに委任
    showMonthlyLogs(
        currentCalendarDate,
        selectedUserLogs,
        detailsTitleEl,
        detailsContentEl,
        monthYearEl
    );
}

/**
 * Simple HTML escaping function (utility, can be moved to utils.js if not already there)
 * @param {string | null | undefined} unsafe - The potentially unsafe string.
 * @returns {string} The escaped string.
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }


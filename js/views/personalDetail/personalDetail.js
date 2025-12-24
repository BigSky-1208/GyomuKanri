// js/views/personalDetail/personalDetail.js (リファクタリング版 - 司令塔)

import { db, userName as currentUserName, authLevel, viewHistory, showView, VIEWS, allTaskObjects, updateGlobalTaskObjects, handleGoBack } from "../../main.js";
import { renderUnifiedCalendar } from "../../components/calendar.js"; 
import { editLogModal, editMemoModal, editContributionModal } from "../../components/modal/index.js";

import { startListeningForUserLogs, stopListeningForUserLogs } from "./logData.js";
import { showDailyLogs, showMonthlyLogs, clearDetails } from "./logDisplay.js";
import { handleTimelineClick, handleSaveLogDuration, handleSaveMemo, handleSaveContribution } from "./logEditor.js";
import { handleDeleteUserClick } from "./adminActions.js";
// ★追加: 申請モーダルロジック
import { openAddRequestModal } from "./requestModal.js";

// --- Module State ---
let selectedUserLogs = [];
let currentCalendarDate = new Date();
let selectedDateStr = null; 
let currentUserForDetailView = null; 

// --- DOM References ---
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
const editLogSaveBtn = document.getElementById("edit-log-save-btn");
const editMemoSaveBtn = document.getElementById("edit-memo-save-btn");
const editContributionSaveBtn = document.getElementById("edit-contribution-save-btn");
const editLogCancelBtn = document.getElementById("edit-log-cancel-btn");
const editMemoCancelBtn = document.getElementById("edit-memo-cancel-btn");
const editContributionCancelBtn = document.getElementById("edit-contribution-cancel-btn");

// ★追加: タイムライン追加申請ボタン
function injectAddRequestButton() {
    // 既存ボタンがあれば削除（重複防止）
    const existingBtn = document.getElementById("add-request-btn");
    if(existingBtn) existingBtn.remove();

    // タイトルの横あたりに追加
    const header = document.querySelector("#personal-detail-view .flex.justify-between");
    if (header) {
        const btn = document.createElement("button");
        btn.id = "add-request-btn";
        btn.className = "bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded shadow ml-4";
        btn.textContent = "＋ 業務タイムライン追加申請";
        btn.onclick = () => {
            // 選択中の日付があればその日、なければ今日
            const targetDate = selectedDateStr || new Date().toISOString().split("T")[0];
            openAddRequestModal(targetDate);
        };
        header.appendChild(btn);
    }
}

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

    // ★追加: 申請ボタン配置
    injectAddRequestButton();

    const previousView = viewHistory[viewHistory.length - 2];
    if (deleteUserContainer) {
        if (authLevel === 'admin' && previousView === VIEWS.HOST && currentUserForDetailView !== currentUserName) {
            deleteUserContainer.style.display = "block";
        } else {
            deleteUserContainer.style.display = "none";
        }
    }

    startListeningForUserLogs(currentUserForDetailView, currentCalendarDate, (logs) => {
        selectedUserLogs = logs;
        renderCalendar();
        
        if (selectedDateStr) {
            const dayElement = calendarEl?.querySelector(`.calendar-day[data-date="${selectedDateStr}"]`);
            if(dayElement) {
                handleDayClick({ currentTarget: dayElement });
            } else {
                handleMonthClick(); 
            }
        } else {
            handleMonthClick(); 
        }
    });

    clearDetails(detailsTitleEl, detailsContentEl);
}

export function cleanupPersonalDetailView() {
    console.log("Cleaning up Personal Detail View...");
    stopListeningForUserLogs();
    selectedUserLogs = [];
    currentUserForDetailView = null;
    selectedDateStr = null;
    
    // ★追加: ボタン掃除
    const btn = document.getElementById("add-request-btn");
    if(btn) btn.remove();
}

export function setupPersonalDetailEventListeners() {
    console.log("Setting up Personal Detail event listeners...");
    prevMonthBtn?.addEventListener("click", () => moveMonth(-1));
    nextMonthBtn?.addEventListener("click", () => moveMonth(1));
    backButton?.addEventListener("click", handleGoBack);
    
    deleteUserBtn?.addEventListener("click", () => {
        handleDeleteUserClick(currentUserForDetailView, authLevel, currentUserName);
    });

    editLogSaveBtn?.addEventListener("click", handleSaveLogDuration);
    editMemoSaveBtn?.addEventListener("click", handleSaveMemo);
    editContributionSaveBtn?.addEventListener("click", handleSaveContribution);

// ★追加: キャンセルボタンのイベント (ここを追加してください)
    editLogCancelBtn?.addEventListener("click", () => {
        if (editLogModal) editLogModal.classList.add("hidden");
    });
    
    editMemoCancelBtn?.addEventListener("click", () => {
        if (editMemoModal) editMemoModal.classList.add("hidden");
    });
    
    editContributionCancelBtn?.addEventListener("click", () => {
        if (editContributionModal) editContributionModal.classList.add("hidden");
    });
    
     detailsContentEl?.addEventListener('click', (event) => {
        handleTimelineClick(event.target, selectedUserLogs, currentUserForDetailView, {
             editLogModal,
             editMemoModal,
             editContributionModal
         });
     });

    console.log("Personal Detail event listeners set up complete.");
}

function renderCalendar() {
    if (!calendarEl || !monthYearEl) {
        console.warn("Calendar elements not found for rendering.");
        return;
    }
    renderUnifiedCalendar({
        calendarEl: calendarEl,
        monthYearEl: monthYearEl,
        dateToDisplay: currentCalendarDate,
        logs: selectedUserLogs, 
        onDayClick: handleDayClick, 
        onMonthClick: handleMonthClick, 
    });

     if (selectedDateStr) {
         const dayElement = calendarEl.querySelector(`.calendar-day[data-date="${selectedDateStr}"]`);
         if (dayElement) {
             dayElement.classList.add("selected");
         }
     }
}

function moveMonth(direction) {
    selectedDateStr = null; 
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    
    if (currentUserForDetailView) {
        startListeningForUserLogs(currentUserForDetailView, currentCalendarDate, (logs) => {
            selectedUserLogs = logs;
            renderCalendar();
            handleMonthClick(); 
        });
    } else {
         console.error("Cannot move month, currentUserForDetailView is not set.");
    }
}

function handleDayClick(event) {
    const dayElement = event.currentTarget;
    const date = dayElement?.dataset?.date;
    if (!date) return;

    selectedDateStr = date;

    calendarEl?.querySelectorAll(".calendar-day.selected").forEach((el) => el.classList.remove("selected"));
    dayElement.classList?.add("selected");

    showDailyLogs(
        date,
        selectedUserLogs, 
        authLevel,
        currentUserForDetailView,
        currentUserName,
        detailsTitleEl,
        detailsContentEl
    );
}

function handleMonthClick() {
    selectedDateStr = null;
    calendarEl?.querySelectorAll(".calendar-day.selected").forEach((el) => el.classList.remove("selected"));

    showMonthlyLogs(
        currentCalendarDate,
        selectedUserLogs,
        detailsTitleEl,
        detailsContentEl,
        monthYearEl
    );
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

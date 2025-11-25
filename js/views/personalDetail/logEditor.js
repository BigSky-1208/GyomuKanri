// js/views/personalDetail/logEditor.js (編集ロジック 担当)

import { db, allTaskObjects, updateGlobalTaskObjects } from "../../main.js";
import { doc, updateDoc, writeBatch, getDocs, collection, query, where, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { escapeHtml } from "../../utils.js";

// --- Module State (for editing) ---
let currentEditingLogId = null;
let currentEditingContribution = {};

// --- DOM Element References (fetched inside handlers) ---

/**
 * Handles clicks on the timeline (event delegation).
 * @param {HTMLElement} target - The clicked element.
 * @param {Array} selectedUserLogs - The logs for the current month.
 * @param {string} currentUserForDetailView - The name of the user being viewed.
 * @param {object} modalElements - References to modal HTMLElements.
 */
export function handleTimelineClick(target, selectedUserLogs, currentUserForDetailView, modalElements) {
    if (target.classList.contains('edit-log-btn')) {
        handleEditLogClick(target, modalElements.editLogModal);
    } else if (target.classList.contains('edit-memo-btn')) {
        handleEditMemoClick(target, modalElements.editMemoModal);
    } else if (target.classList.contains('edit-contribution-btn')) {
         handleEditContributionClick(target, selectedUserLogs, currentUserForDetailView, modalElements.editContributionModal);
    }
}

/**
 * Handles the click on the "時間修正" (Edit Time) button.
 * @param {HTMLElement} button - The button element that was clicked.
 * @param {HTMLElement} editLogModal - The modal element.
 */
function handleEditLogClick(button, editLogModal) {
    currentEditingLogId = button.dataset.logId;
    const duration = parseInt(button.dataset.duration || "0", 10);
    const taskName = button.dataset.taskName;

    const editLogTaskNameEl = document.getElementById("edit-log-task-name");
    const editHoursInput = document.getElementById("edit-hours-input");
    const editMinutesInput = document.getElementById("edit-minutes-input");
    const editLogErrorEl = document.getElementById("edit-log-error");

    if (isNaN(duration) || !currentEditingLogId || !editLogModal || !editHoursInput || !editMinutesInput || !editLogTaskNameEl || !editLogErrorEl) {
         console.error("Missing data or elements for editing log time.");
         return;
    }

    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);

    editLogTaskNameEl.textContent = `「${escapeHtml(taskName || '不明')}」の時間を修正`;
    editHoursInput.value = hours;
    editMinutesInput.value = minutes;
    editLogErrorEl.textContent = "";

    editLogModal.classList.remove("hidden");
}

/**
 * Saves the updated duration for a work log entry.
 */
export async function handleSaveLogDuration() {
    const editHoursInput = document.getElementById("edit-hours-input");
    const editMinutesInput = document.getElementById("edit-minutes-input");
    const editLogErrorEl = document.getElementById("edit-log-error");
    const editLogModal = document.getElementById("edit-log-modal");

    if (!currentEditingLogId || !editHoursInput || !editMinutesInput || !editLogErrorEl || !editLogModal) {
         console.error("Missing data or elements for saving log duration.");
         return;
    }

    const hours = parseInt(editHoursInput.value, 10) || 0;
    const minutes = parseInt(editMinutesInput.value, 10) || 0;

    if (hours < 0 || minutes < 0 || minutes > 59) {
        editLogErrorEl.textContent = "時間(0以上)、分(0～59)を正しく入力してください。";
        return;
    }
     editLogErrorEl.textContent = "";

    const newDuration = hours * 3600 + minutes * 60;
    const logRef = doc(db, "work_logs", currentEditingLogId);

    try {
        await updateDoc(logRef, { duration: newDuration });
        console.log(`Log ${currentEditingLogId} duration updated to ${newDuration} seconds.`);
        editLogModal.classList.add("hidden");
        currentEditingLogId = null;
        // The onSnapshot listener in personalDetail.js will automatically refresh the details pane.
    } catch (error) {
        console.error(`Error updating log duration for ${currentEditingLogId}:`, error);
        editLogErrorEl.textContent = "保存中にエラーが発生しました。";
    }
}

/**
 * Handles the click on the "メモ修正" (Edit Memo) button.
 * @param {HTMLElement} button - The button element that was clicked.
 * @param {HTMLElement} editMemoModal - The modal element.
 */
function handleEditMemoClick(button, editMemoModal) {
    currentEditingLogId = button.dataset.logId;
    const memo = button.dataset.memo || "";

    const editMemoTextarea = document.getElementById("edit-memo-textarea");

    if (!currentEditingLogId || !editMemoModal || !editMemoTextarea) {
        console.error("Missing data or elements for editing log memo.");
        return;
    }

    editMemoTextarea.value = memo;
    editMemoModal.classList.remove("hidden");
    editMemoTextarea.focus();
}

/**
 * Saves the updated memo for a work log entry.
 */
export async function handleSaveMemo() {
    const editMemoTextarea = document.getElementById("edit-memo-textarea");
    const editMemoModal = document.getElementById("edit-memo-modal");

    if (!currentEditingLogId || !editMemoTextarea || !editMemoModal) {
         console.error("Missing data or elements for saving log memo.");
         return;
    }

    const newMemo = editMemoTextarea.value.trim();
    const logRef = doc(db, "work_logs", currentEditingLogId);

    try {
        await updateDoc(logRef, { memo: newMemo });
        console.log(`Log ${currentEditingLogId} memo updated.`);
        editMemoModal.classList.add("hidden");
        currentEditingLogId = null;
        // The onSnapshot listener will automatically refresh the details pane.
    } catch (error) {
        console.error(`Error updating log memo for ${currentEditingLogId}:`, error);
        alert("メモの保存中にエラーが発生しました。");
    }
}

/**
 * Handles the click on the "修正" (Edit) button for goal contributions.
 * @param {HTMLElement} btn - The button element that was clicked.
 * @param {Array} selectedUserLogs - The logs for the current month.
 * @param {string} currentUserForDetailView - The name of the user being viewed.
 * @param {HTMLElement} editContributionModal - The modal element.
 */
function handleEditContributionClick(btn, selectedUserLogs, currentUserForDetailView, editContributionModal) {
    const { userName, goalId, taskName, goalTitle, date } = btn.dataset;

    const editContributionTitleEl = document.getElementById("edit-contribution-title");
    const editContributionInput = document.getElementById("edit-contribution-input");
    const editContributionErrorEl = document.getElementById("edit-contribution-error");

    if (!userName || !goalId || !taskName || !goalTitle || !date || !editContributionModal || !editContributionTitleEl || !editContributionInput || !editContributionErrorEl) {
        console.error("Missing data or elements for editing contribution.");
        return;
    }

    // Find all goal logs for this specific user, goal, and date
    const relevantLogs = selectedUserLogs.filter(
        (log) =>
            log.type === "goal" &&
            log.userName === userName &&
            log.goalId === goalId &&
            log.date === date
    );

    const currentTotal = relevantLogs.reduce(
        (sum, log) => sum + (log.contribution || 0),
        0
    );

    // Store context needed for saving
    currentEditingContribution = {
        userName,
        goalId,
        date,
        taskName,
        goalTitle,
        logIds: relevantLogs.map((log) => log.id),
        oldTotal: currentTotal
    };

    editContributionTitleEl.textContent = `[${escapeHtml(taskName)}] ${escapeHtml(goalTitle)} - ${escapeHtml(userName)}`;
    editContributionInput.value = currentTotal;
    editContributionErrorEl.textContent = "";
    editContributionModal.classList.remove("hidden");
    editContributionInput.focus();
}

/**
 * Saves the updated total contribution for a specific user, goal, and date.
 */
export async function handleSaveContribution() {
    const editContributionInput = document.getElementById("edit-contribution-input");
    const editContributionErrorEl = document.getElementById("edit-contribution-error");
    const editContributionModal = document.getElementById("edit-contribution-modal");

     if (!currentEditingContribution.goalId || !editContributionInput || !editContributionErrorEl || !editContributionModal) {
         console.error("Missing context or elements for saving contribution.");
         return;
     }

    const newTotal = parseInt(editContributionInput.value, 10);

    if (isNaN(newTotal) || newTotal < 0) {
        editContributionErrorEl.textContent = "合計件数として、0以上の数値を入力してください。";
        return;
    }
     editContributionErrorEl.textContent = "";

    const { userName, goalId, date, taskName, goalTitle, logIds, oldTotal } = currentEditingContribution;
    const diff = newTotal - oldTotal;

    // --- Update Overall Goal Progress ---
    if (!allTaskObjects) {
        console.error("allTaskObjects is not available.");
        alert("タスクデータの読み込みエラーが発生しました。");
        return;
    }

    const taskIndex = allTaskObjects.findIndex((t) => t.name === taskName);
    if (taskIndex !== -1 && allTaskObjects[taskIndex].goals) {
        const goalIndex = allTaskObjects[taskIndex].goals.findIndex((g) => g.id === goalId);
        if (goalIndex !== -1) {
            const updatedTasks = JSON.parse(JSON.stringify(allTaskObjects));
            const currentGoalProgress = updatedTasks[taskIndex].goals[goalIndex].current || 0;
            updatedTasks[taskIndex].goals[goalIndex].current = Math.max(0, currentGoalProgress + diff);

            const tasksRef = doc(db, "settings", "tasks");
            try {
                await updateDoc(tasksRef, { list: updatedTasks });
                console.log(`Overall progress for goal ${goalId} updated by ${diff}.`);
                 if (typeof updateGlobalTaskObjects === 'function') {
                    // main.js の onSnapshot が検知して更新するのが理想だが、
                    // 即時反映のためにグローバルstateも更新する
                    updateGlobalTaskObjects(updatedTasks);
                 }
            } catch (error) {
                 console.error("Error updating overall goal progress:", error);
                 alert("工数全体の進捗更新中にエラーが発生しました。");
                 return;
            }
        }
    }
    // --- End Update Overall Goal Progress ---

    // --- Replace Daily Contribution Logs ---
    const batch = writeBatch(db);

    logIds.forEach((id) => {
        batch.delete(doc(db, "work_logs", id));
    });

    if (newTotal > 0) {
        let editedUserId = "unknown";
        const profileQuery = query(collection(db, "user_profiles"), where("name", "==", userName));
        try {
            const profileSnapshot = await getDocs(profileQuery);
            if (!profileSnapshot.empty) {
                editedUserId = profileSnapshot.docs[0].id;
            } else {
                 console.warn(`User ID not found for userName "${userName}"`);
            }
        } catch(error) {
             console.error(`Error fetching userId for ${userName}:`, error);
        }

        const newLogEntry = {
            type: "goal",
            userId: editedUserId,
            userName: userName,
            task: taskName,
            goalId: goalId,
            goalTitle: goalTitle,
            contribution: newTotal,
            date: date,
            startTime: Timestamp.now(),
            memo: "[編集による合計値]",
        };
        batch.set(doc(collection(db, "work_logs")), newLogEntry);
    }

    try {
        await batch.commit();
        console.log(`Contribution logs for ${userName}, goal ${goalId} on ${date} updated to ${newTotal}.`);
        editContributionModal.classList.add("hidden");
        currentEditingContribution = {};
        // The onSnapshot listener in personalDetail.js will refresh the details pane.
    } catch (error) {
        console.error("Error committing contribution log changes:", error);
        editContributionErrorEl.textContent = "貢献ログの更新中にエラーが発生しました。";
    }
    // --- End Replace Daily Contribution Logs ---
}

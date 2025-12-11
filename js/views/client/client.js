// js/views/client/timer.js - ストップウォッチ機能と状態管理

import { db, userId, userName, allTaskObjects, showView, VIEWS } from "../../main.js";
import { doc, updateDoc, getDoc, setDoc, Timestamp, addDoc, collection, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { formatDuration, getJSTDateString } from "../../utils.js";
import { listenForColleagues, stopColleaguesListener } from "./colleagues.js";
// ★修正: 新しい通知関数を追加インポート
import { triggerEncouragementNotification, triggerReservationNotification, triggerBreakNotification } from "../../components/notification.js";
import { userDisplayPreferences } from "../../main.js";

// --- Module State ---
let timerInterval = null;
let startTime = null;
let currentTask = null;
let currentGoalId = null;
let currentGoalTitle = null;
let preBreakTask = null; // 休憩前のタスク情報
let midnightStopTimer = null; // 深夜0時の自動停止タイマー

let hasContributedToCurrentGoal = false;

// --- DOM Elements ---
const timerDisplay = document.getElementById("timer-display");
const currentTaskDisplay = document.getElementById("current-task-display");
const startBtn = document.getElementById("start-btn");
const breakBtn = document.getElementById("break-btn");
const changeWarningMessage = document.getElementById("change-warning-message");

// --- Exported Getters/Setters ---
export const getCurrentTask = () => currentTask;
export const getCurrentGoalId = () => currentGoalId;
export const getIsWorking = () => !!currentTask && !!startTime;
export const getStartTime = () => startTime;

export function setHasContributed(value) {
    hasContributedToCurrentGoal = value;
}
export function getHasContributed() {
    return hasContributedToCurrentGoal;
}

/**
 * Restores the client state from Firestore on initialization.
 */
export async function restoreClientState() {
    if (!userId) return;
    const statusRef = doc(db, "work_status", userId);
    const docSnap = await getDoc(statusRef);

    if (docSnap.exists() && docSnap.data().isWorking) {
        const data = docSnap.data();
        const localStartTime = data.startTime.toDate();
        const now = new Date();

        // Check if the date has changed since start
        const startTimeStr = getJSTDateString(localStartTime);
        const todayStr = getJSTDateString(now);

        if (startTimeStr !== todayStr) {
            // Auto-stop if across midnight (fallback logic)
            const endOfStartTimeDay = new Date(localStartTime);
            endOfStartTimeDay.setHours(23, 59, 59, 999);
            
            await stopCurrentTaskCore(true, endOfStartTimeDay, {
                task: data.currentTask,
                goalId: data.currentGoalId,
                goalTitle: data.currentGoalTitle,
                startTime: localStartTime,
                memo: "（自動退勤処理）"
            });
            await updateDoc(statusRef, { needsCheckoutCorrection: true });
            
            const { checkForCheckoutCorrection } = await import("../../utils.js");
            checkForCheckoutCorrection(userId);
            
            resetClientState();
            return;
        }

        // Restore state
        startTime = localStartTime;
        currentTask = data.currentTask;
        
        localStorage.setItem('currentTaskName', currentTask);

        currentGoalId = data.currentGoalId || null;
        currentGoalTitle = data.currentGoalTitle || null;
        preBreakTask = data.preBreakTask || null;
        hasContributedToCurrentGoal = false; 

        updateUIForActiveTask();
        startTimerLoop();
        listenForColleagues(currentTask);

    } else {
        resetClientState();
    }
}

function updateUIForActiveTask() {
    if (startBtn) startBtn.textContent = "業務変更";
    if (currentTaskDisplay) {
        currentTaskDisplay.textContent = currentGoalTitle
            ? `${currentTask} (${currentGoalTitle})`
            : currentTask;
    }
    if (breakBtn) {
        breakBtn.disabled = false;
        if (currentTask === "休憩") {
            breakBtn.textContent = "休憩前の業務に戻る";
            breakBtn.classList.replace("bg-yellow-500", "bg-cyan-600");
            breakBtn.classList.replace("hover:bg-yellow-600", "hover:bg-cyan-700");
        } else {
            breakBtn.textContent = "休憩開始";
            breakBtn.classList.replace("bg-cyan-600", "bg-yellow-500");
            breakBtn.classList.replace("hover:bg-cyan-700", "hover:bg-yellow-600");
        }
    }
    // Select dropdown values
    const taskSelect = document.getElementById("task-select");
    const goalSelect = document.getElementById("goal-select");
    
    import("./clientUI.js").then(({ updateTaskDisplaysForSelection }) => {
        if (taskSelect) {
            taskSelect.value = currentTask;
            updateTaskDisplaysForSelection(); 
            if (currentGoalId && goalSelect) {
                goalSelect.value = currentGoalId;
                import("./clientUI.js").then(({ handleGoalSelectionChange }) => handleGoalSelectionChange());
            }
        }
    });
}

function resetClientState() {
    stopTimerLoop();
    currentTask = null;
    currentGoalId = null;
    currentGoalTitle = null;
    startTime = null;
    preBreakTask = null;
    hasContributedToCurrentGoal = false; 

    if (timerDisplay) timerDisplay.textContent = "00:00:00";
    if (currentTaskDisplay) currentTaskDisplay.textContent = "未開始";
    if (startBtn) {
        startBtn.textContent = "業務開始";
        startBtn.classList.remove("animate-pulse-scale");
    }
    if (document.getElementById("task-memo-input")) document.getElementById("task-memo-input").value = "";
    if (changeWarningMessage) changeWarningMessage.classList.add("hidden");
    
    if (breakBtn) {
        breakBtn.textContent = "休憩開始";
        breakBtn.disabled = true; 
        breakBtn.classList.remove("bg-cyan-600", "hover:bg-cyan-700");
        breakBtn.classList.add("bg-yellow-500", "hover:bg-yellow-600");
    }
    
    stopColleaguesListener();
}

function startTimerLoop() {
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        if (!startTime) return;
        const now = new Date();
        const elapsed = Math.floor((now - startTime) / 1000);
        if (timerDisplay) timerDisplay.textContent = formatDuration(elapsed);

        // ★追加: 休憩中の定期通知 (30分 = 1800秒 ごと)
        if (currentTask === "休憩" && elapsed > 0 && elapsed % 1800 === 0) {
            triggerBreakNotification(elapsed);
        }

        // 通常業務のお褒め・息抜き通知
        if (userDisplayPreferences && userDisplayPreferences.notificationIntervalMinutes > 0) {
            const intervalSeconds = userDisplayPreferences.notificationIntervalMinutes * 60;
            if (elapsed > 0 && elapsed % intervalSeconds === 0) {
                triggerEncouragementNotification(elapsed, "breather", currentTask);
            }
        }

    }, 1000);
}

function stopTimerLoop() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
}

// --- Action Handlers ---

export async function handleStartClick() {
    const taskSelect = document.getElementById("task-select");
    const goalSelect = document.getElementById("goal-select");
    
    const newTask = taskSelect.value;
    if (!newTask) {
        alert("業務を選択してください。");
        return;
    }
    if (newTask === "休憩") {
        alert("休憩は「休憩開始」ボタンを使用してください。");
        taskSelect.value = currentTask || "";
        return;
    }

    const newGoalId = goalSelect.value || null;
    const newGoalTitle = newGoalId ? goalSelect.options[goalSelect.selectedIndex].text : null;

    if (currentGoalId && !hasContributedToCurrentGoal && currentTask !== newTask) {
        const { showConfirmationModal, hideConfirmationModal } = await import("../../components/modal.js");
        showConfirmationModal(
            `「${currentGoalTitle}」の進捗(件数)が入力されていません。\nこのまま業務を変更しますか？`,
            async () => {
                hideConfirmationModal();
                await startTask(newTask, newGoalId, newGoalTitle);
            },
            hideConfirmationModal
        );
        return;
    }

    await startTask(newTask, newGoalId, newGoalTitle);
}

export async function handleStopClick(isAuto = false) {
    if (!isAuto) {
        const { cancelAllReservations } = await import("./reservations.js");
        await cancelAllReservations();
    }
    if (!currentTask) return;

    if (currentGoalId && !hasContributedToCurrentGoal) {
        const { showConfirmationModal, hideConfirmationModal } = await import("../../components/modal.js");
        showConfirmationModal(
            `「${currentGoalTitle}」の進捗(件数)が入力されていません。\nこのまま終了（帰宅）しますか？`,
            async () => {
                hideConfirmationModal();
                await stopCurrentTask(true);
            },
            hideConfirmationModal
        );
        return;
    }

    await stopCurrentTask(true);
    
    // ★追加: 予約実行時の通知
    if (isAuto) {
        triggerReservationNotification("帰宅");
    }
}

export async function handleBreakClick(isAuto = false) {
    if (!isAuto) {
        const { cancelAllReservations } = await import("./reservations.js");
        await cancelAllReservations();
    }

    const statusRef = doc(db, "work_status", userId);
    const docSnap = await getDoc(statusRef);
    if (!docSnap.exists() || !docSnap.data().isWorking) return;
    
    const statusData = docSnap.data();
    const currentDbTask = statusData.currentTask;

    if (currentDbTask === "休憩") {
        // End Break
        await stopCurrentTask(false);
        const taskToReturnTo = statusData.preBreakTask;
        resetClientState(); // Clear UI

        if (taskToReturnTo) {
            await startTask(taskToReturnTo.task, taskToReturnTo.goalId, taskToReturnTo.goalTitle);
        } else {
            await updateDoc(statusRef, { isWorking: false, currentTask: null });
        }
    } else {
        // Start Break
        if (currentGoalId && !hasContributedToCurrentGoal) {
            const { showConfirmationModal, hideConfirmationModal } = await import("../../components/modal.js");
            showConfirmationModal(
                `「${currentGoalTitle}」の進捗(件数)が入力されていません。\n休憩に入りますか？`,
                async () => {
                    hideConfirmationModal();
                    preBreakTask = {
                        task: currentTask,
                        goalId: currentGoalId,
                        goalTitle: currentGoalTitle
                    };
                    await startTask("休憩", null, null);
                    // ★追加: 予約実行時の通知（確認モーダル経由）
                    if (isAuto) triggerReservationNotification("休憩");
                },
                hideConfirmationModal
            );
            return;
        }

        preBreakTask = {
            task: currentTask,
            goalId: currentGoalId,
            goalTitle: currentGoalTitle
        };
        await startTask("休憩", null, null);
        // ★追加: 予約実行時の通知
        if (isAuto) triggerReservationNotification("休憩");
    }
}


// --- Core Logic ---

async function startTask(newTask, newGoalId, newGoalTitle, forcedStartTime = null) {
    const { processReservations } = await import("./reservations.js");
    processReservations();
    
    if (!userId) return;

    if (midnightStopTimer) {
        clearTimeout(midnightStopTimer);
        midnightStopTimer = null;
    }

    if (currentTask && newTask === currentTask && newGoalId === currentGoalId) {
        return;
    }

    if (currentTask && startTime) {
        await stopCurrentTaskCore(false);
    }

    hasContributedToCurrentGoal = false;

    currentTask = newTask;
    localStorage.setItem('currentTaskName', currentTask);

    currentGoalId = newGoalId || null;
    currentGoalTitle = newGoalTitle || null;
    startTime = forcedStartTime || new Date();

    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const timeUntilMidnight = endOfDay.getTime() - now.getTime();
    
    if (timeUntilMidnight > 0) {
        midnightStopTimer = setTimeout(async () => {
            if (currentTask) {
                const forceEndTime = new Date(); 
                forceEndTime.setHours(23, 59, 59, 999);
                await stopCurrentTaskCore(true, forceEndTime, {
                    task: currentTask,
                    goalId: currentGoalId,
                    goalTitle: currentGoalTitle,
                    startTime: startTime,
                    memo: "（自動退勤処理）"
                });
                const statusRef = doc(db, "work_status", userId);
                await updateDoc(statusRef, { needsCheckoutCorrection: true });
            }
        }, timeUntilMidnight);
    }

    const statusRef = doc(db, "work_status", userId);
    await setDoc(statusRef, {
        userId,
        userName,
        currentTask,
        currentGoalId,
        currentGoalTitle,
        startTime,
        isWorking: true,
        onlineStatus: true,
        preBreakTask: preBreakTask || null
    }, { merge: true });

    updateUIForActiveTask();
    startTimerLoop();
    listenForColleagues(newTask);
}

async function stopCurrentTask(isLeaving) {
    await stopCurrentTaskCore(isLeaving);
    if (isLeaving) {
        resetClientState();
    }
}

async function stopCurrentTaskCore(isLeaving, forcedEndTime = null, taskDataOverride = null) {
    if (midnightStopTimer) {
        clearTimeout(midnightStopTimer);
        midnightStopTimer = null;
    }
    stopTimerLoop();

    const taskToLog = taskDataOverride?.task || currentTask;
    const goalIdToLog = taskDataOverride?.goalId || currentGoalId;
    const goalTitleToLog = taskDataOverride?.goalTitle || currentGoalTitle;
    const taskStartTime = taskDataOverride?.startTime || startTime;
    let memo = taskDataOverride?.memo;

    if (!taskStartTime || !taskToLog) {
        if (isLeaving && userId) {
             await updateDoc(doc(db, "work_status", userId), { isWorking: false });
        }
        return;
    }

    const endTime = forcedEndTime || new Date();
    const duration = Math.floor((endTime - taskStartTime) / 1000);

    if (!memo) {
        const memoInput = document.getElementById("task-memo-input");
        if (memoInput) {
            memo = memoInput.value.trim();
            if (!isLeaving) memoInput.value = ""; 
        } else {
            memo = "";
        }
    }

    if (duration > 0) {
        await addDoc(collection(db, "work_logs"), {
            userId,
            userName,
            task: taskToLog,
            goalId: goalIdToLog,
            goalTitle: goalTitleToLog,
            date: getJSTDateString(taskStartTime),
            duration,
            startTime: taskStartTime,
            endTime,
            memo
        });
    }

    if (isLeaving && userId) {
        await updateDoc(doc(db, "work_status", userId), {
            isWorking: false,
            currentTask: null,
            preBreakTask: null,
            currentGoalId: null,
            currentGoalTitle: null,
            startTime: null
        });
    }
}

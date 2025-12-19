// js/views/client/timer.js - ストップウォッチ機能と状態管理（最適化版）

import { db, userId, userName, showView, VIEWS, userDisplayPreferences } from "../../main.js";
import { doc, updateDoc, getDoc, setDoc, Timestamp, addDoc, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { formatDuration, getJSTDateString } from "../../utils.js";
import { listenForColleagues, stopColleaguesListener } from "./colleagues.js";
import { triggerEncouragementNotification, triggerReservationNotification, triggerBreakNotification } from "../../components/notification.js";

// --- Module State ---
let timerInterval = null;
let startTime = null;
let currentTask = null;
let currentGoalId = null;
let currentGoalTitle = null;
let preBreakTask = null; 
let midnightStopTimer = null; 
let hasContributedToCurrentGoal = false;

// ローカル保存用のキー
const LOCAL_STATUS_KEY = "gyomu_timer_current_status";

// 手動操作中かどうかを判定するフラグ（通知抑制用）
let isManualStateChange = false;

// 通知カウンター
let lastBreakNotificationTime = 0; 
let lastEncouragementTime = 0; 

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
 * 【最適化版】
 * ローカルストレージを優先し、データがない場合のみFirestoreから1回取得して状態を復元する
 */
export async function restoreClientState() {
    if (!userId) return;

    let data = null;

    // 1. まずローカルストレージから復元を試みる
    const savedStatus = localStorage.getItem(LOCAL_STATUS_KEY);
    if (savedStatus) {
        try {
            data = JSON.parse(savedStatus);
            // 文字列化された日付をDateオブジェクトに戻す
            if (data.startTime) data.startTime = new Date(data.startTime);
            console.log("Status restored from localStorage.");
        } catch (e) {
            console.error("Failed to parse local status:", e);
        }
    }

    // 2. ローカルになければFirestoreから1回だけ取得（getDoc）
    if (!data || !data.isWorking) {
        console.log("No local status found. Fetching from Firestore (getDoc)...");
        const statusRef = doc(db, "work_status", userId);
        try {
            const docSnap = await getDoc(statusRef);
            if (docSnap.exists()) {
                const fsData = docSnap.data();
                if (fsData.isWorking) {
                    data = fsData;
                    if (data.startTime) data.startTime = data.startTime.toDate(); // Timestamp -> Date
                    // 次回リロードのためにローカルにも保存
                    localStorage.setItem(LOCAL_STATUS_KEY, JSON.stringify(data));
                }
            }
        } catch (error) {
            console.error("Error fetching work status:", error);
        }
    }

    // 3. 取得したデータがあればUIに反映
    if (data && data.isWorking) {
        const now = new Date();
        const localStartTime = data.startTime || now;

        // 日付跨ぎチェック
        const startTimeStr = getJSTDateString(localStartTime);
        const todayStr = getJSTDateString(now);

        if (startTimeStr !== todayStr) {
            console.log("Data is from a previous day. Triggering auto-checkout.");
            const endOfStartTimeDay = new Date(localStartTime);
            endOfStartTimeDay.setHours(23, 59, 59, 999);
            
            await stopCurrentTaskCore(true, endOfStartTimeDay, {
                task: data.currentTask,
                goalId: data.currentGoalId,
                goalTitle: data.currentGoalTitle,
                startTime: localStartTime,
                memo: "（自動退勤処理）"
            });

            // ★追加: Firebase側に修正が必要なフラグを立てる
            const statusRef = doc(db, "work_status", userId);
            await updateDoc(statusRef, { needsCheckoutCorrection: true });
            
            // ★追加: ユーティリティを呼んでダイアログ等を表示する
            const { checkForCheckoutCorrection } = await import("../../utils.js");
            checkForCheckoutCorrection(userId);
            
            localStorage.removeItem(LOCAL_STATUS_KEY);
            resetClientState();
            return;
        }

        // 変数への適用
        startTime = localStartTime;
        currentTask = data.currentTask || null;
        currentGoalId = data.currentGoalId || null;
        currentGoalTitle = data.currentGoalTitle || null;
        preBreakTask = data.preBreakTask || null;

        // 通知カウンターのズレ補正
        const elapsed = Math.floor((now - startTime) / 1000);
        const breakInterval = 1800;
        lastBreakNotificationTime = Math.floor(elapsed / breakInterval) * breakInterval;
        
        const intervalMinutes = userDisplayPreferences?.notificationIntervalMinutes || 5;
        const intervalSeconds = intervalMinutes * 60;
        lastEncouragementTime = Math.floor(elapsed / intervalSeconds) * intervalSeconds;

        updateUIForActiveTask();
        startTimerLoop();
        listenForColleagues(currentTask);
        setupMidnightTimer();
    } else {
        resetClientState();
    }
}

/**
 * リスナー停止用（常時監視しなくなったので主にループ停止用）
 */
export function stopStatusListener() {
    stopTimerLoop();
}

/**
 * アクティブなタスクに合わせてUIを更新
 */
export function updateUIForActiveTask() {
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
    
    if (changeWarningMessage) changeWarningMessage.classList.add("hidden");

    const taskSelect = document.getElementById("task-select");
    const goalSelect = document.getElementById("goal-select");
    
    import("./clientUI.js").then(({ updateTaskDisplaysForSelection, handleGoalSelectionChange }) => {
        if (taskSelect) {
            taskSelect.value = currentTask;
            updateTaskDisplaysForSelection(); 
            if (currentGoalId && goalSelect) {
                goalSelect.value = currentGoalId;
                handleGoalSelectionChange();
            }
        }
    });
}

function resetClientState() {
    stopTimerLoop();
    localStorage.removeItem(LOCAL_STATUS_KEY);

    currentTask = null;
    currentGoalId = null;
    currentGoalTitle = null;
    startTime = null;
    preBreakTask = null;
    hasContributedToCurrentGoal = false; 
    
    lastBreakNotificationTime = 0;
    lastEncouragementTime = 0;

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

function setupMidnightTimer() {
    if (midnightStopTimer) {
        clearTimeout(midnightStopTimer);
        midnightStopTimer = null;
    }
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
                
                localStorage.removeItem(LOCAL_STATUS_KEY);
                triggerReservationNotification("帰宅（深夜自動停止）");
            }
        }, timeUntilMidnight);
    }
}

function startTimerLoop() {
    if (timerInterval) clearInterval(timerInterval);
    
    import("./clientUI.js").then(({ renderTaskOptions, renderTaskDisplaySettings }) => {
        renderTaskOptions();
        renderTaskDisplaySettings(); 
    });

    timerInterval = setInterval(() => {
        if (!startTime) return;
        const now = new Date();
        const elapsed = Math.floor((now - startTime) / 1000);
        if (timerDisplay) timerDisplay.textContent = formatDuration(elapsed);

        // 休憩通知（30分経過）
        if (currentTask === "休憩" && elapsed > 0) {
            const breakInterval = 1800;
            if (elapsed - lastBreakNotificationTime >= breakInterval) {
                lastBreakNotificationTime = Math.floor(elapsed / breakInterval) * breakInterval;
                triggerBreakNotification(elapsed);
            }
        }

        // 継続通知
        if (userDisplayPreferences && userDisplayPreferences.notificationIntervalMinutes > 0) {
            const intervalSeconds = userDisplayPreferences.notificationIntervalMinutes * 60;
            if (elapsed > 0) {
                if (elapsed - lastEncouragementTime >= intervalSeconds) {
                    lastEncouragementTime = Math.floor(elapsed / intervalSeconds) * intervalSeconds;
                    triggerEncouragementNotification(elapsed, "breather", currentTask);
                }
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
    
    let newTask = taskSelect.value;
    if (!newTask) {
        alert("業務を選択してください。");
        return;
    }
    if (newTask === "休憩") {
        alert("休憩は「休憩開始」ボタンを使用してください。");
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
                await stopCurrentTaskCore(false);
                await startTask(newTask, newGoalId, newGoalTitle);
            },
            hideConfirmationModal
        );
        return;
    }

    await stopCurrentTaskCore(false);
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
}

export async function handleBreakClick(isAuto = false) {
    if (!isAuto) {
        const { cancelAllReservations } = await import("./reservations.js");
        await cancelAllReservations();
    }

    // 1回取得に変更して状態チェック
    const statusRef = doc(db, "work_status", userId);
    const docSnap = await getDoc(statusRef);
    if (!docSnap.exists() || !docSnap.data().isWorking) return;

    const statusData = docSnap.data();
    const currentDbTask = statusData.currentTask;

    if (currentDbTask === "休憩") {
        await stopCurrentTask(false);
        const taskToReturnTo = statusData.preBreakTask;
        resetClientState(); 

        if (taskToReturnTo && taskToReturnTo.task) {
            await startTask(taskToReturnTo.task, taskToReturnTo.goalId, taskToReturnTo.goalTitle);
        }
    } else {
        preBreakTask = { task: currentTask, goalId: currentGoalId, goalTitle: currentGoalTitle };
        await stopCurrentTaskCore(false);
        await startTask("休憩", null, null);
    }
}

// --- Core Logic ---

async function startTask(newTask, newGoalId, newGoalTitle, forcedStartTime = null) {
    if (!userId) return;

    currentTask = newTask;
    currentGoalId = newGoalId || null;
    currentGoalTitle = newGoalTitle || null;
    startTime = forcedStartTime || new Date();
    hasContributedToCurrentGoal = false;
    
    // ローカルストレージとFirestoreの更新 (既存)
    const statusToSave = {
        currentTask, currentGoalId, currentGoalTitle, startTime,
        isWorking: true, preBreakTask: preBreakTask || null
    };
    localStorage.setItem(LOCAL_STATUS_KEY, JSON.stringify(statusToSave));

    updateUIForActiveTask();
    startTimerLoop();

    const statusRef = doc(db, "work_status", userId);
    await setDoc(statusRef, {
        ...statusToSave,
        userId, userName, onlineStatus: true
    }, { merge: true });

    // --- 【追加】D1のステータスも同期する ---
    const WORKER_URL = "https://muddy-night-4bd4.sora-yamashita.workers.dev";
    try {
        await fetch(`${WORKER_URL}/update-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                userName: userName,
                isWorking: 1,
                currentTask: newTask,
                startTime: startTime.toISOString()
            })
        });
    } catch (e) {
        console.error("D1 Sync Error:", e);
    }
    // ------------------------------------

    listenForColleagues(currentTask);
    setupMidnightTimer();
}

async function stopCurrentTask(isLeaving) {
    await stopCurrentTaskCore(isLeaving);

    if (isLeaving) {
        localStorage.removeItem(LOCAL_STATUS_KEY);
        if (userId) {
             await updateDoc(doc(db, "work_status", userId), { isWorking: false, currentTask: null });
        }
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
    const taskStartTime = taskDataOverride?.startTime || startTime;

    if (!taskStartTime || !taskToLog) return;

    const endTime = forcedEndTime || new Date();
    const duration = Math.floor((endTime - taskStartTime) / 1000);

    let memo = taskDataOverride?.memo || document.getElementById("task-memo-input")?.value.trim() || "";

    if (duration > 0) {
        try {
            await addDoc(collection(db, "work_logs"), {
                userId, userName, task: taskToLog,
                goalId: taskDataOverride?.goalId || currentGoalId,
                goalTitle: taskDataOverride?.goalTitle || currentGoalTitle,
                date: getJSTDateString(taskStartTime),
                duration, startTime: taskStartTime, endTime, memo
            });
            console.log("Log saved successfully.");

            // ★追加: D1のステータスも「未稼働」に更新する
const WORKER_URL = "https://muddy-night-4bd4.sora-yamashita.workers.dev";
await fetch(`${WORKER_URL}/update-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        userId: userId,
        userName: userName,
        isWorking: 0,           // 終了なので0
        currentTask: null,      // タスクなし
        startTime: null
    })
});
console.log("D1ステータスを同期しました");

            
        } catch (e) {
            console.error("Firestore save error:", e);
        }
    }
}

window.debugTimer = {
    getStatus: () => ({ currentTask, startTime, isWorking: !!startTime })
};

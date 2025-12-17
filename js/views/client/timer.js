// js/views/client/timer.js - ストップウォッチ機能と状態管理

import { db, userId, userName, showView, VIEWS, userDisplayPreferences } from "../../main.js";
import { doc, updateDoc, getDoc, setDoc, Timestamp, addDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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

// ★追加: 手動操作中かどうかを判定するフラグ（通知抑制用）
let isManualStateChange = false;

// リスナー解除関数
let statusUnsubscribe = null;

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
 * Firestoreの状態をリアルタイムで監視・復元する
 */
export async function restoreClientState() {
    if (!userId) return;

    if (statusUnsubscribe) {
        statusUnsubscribe();
        statusUnsubscribe = null;
    }

    const statusRef = doc(db, "work_status", userId);

    statusUnsubscribe = onSnapshot(statusRef, async (docSnap) => {
        // データが存在するか確認
        const data = docSnap.exists() ? docSnap.data() : null;
        const newIsWorking = data ? data.isWorking : false;
        const newTask = (data && data.currentTask !== undefined) ? data.currentTask : null;

        // ★修正: 手動操作中(!isManualStateChange)の場合のみ通知判定を行う
        if (!isManualStateChange && currentTask && startTime) { // 現在稼働中の場合のみチェック
            if (newIsWorking) {
                // 稼働継続中だが、タスクが「休憩」に変わった場合
                if (currentTask !== "休憩" && newTask === "休憩") {
                    triggerReservationNotification("休憩");
                }
            } else {
                // 稼働中だったのに、未稼働（帰宅）になった場合
                triggerReservationNotification("帰宅");
            }
        }

        if (newIsWorking) {
            const localStartTime = data.startTime ? data.startTime.toDate() : new Date();
            const now = new Date();

            // 日付跨ぎチェック
            const startTimeStr = getJSTDateString(localStartTime);
            const todayStr = getJSTDateString(now);

            if (startTimeStr !== todayStr) {
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

            // 状態同期
            startTime = localStartTime;
            currentTask = (data.currentTask !== undefined) ? data.currentTask : null;
            localStorage.setItem('currentTaskName', currentTask);

            currentGoalId = data.currentGoalId || null;
            currentGoalTitle = data.currentGoalTitle || null;
            preBreakTask = data.preBreakTask || null;
            
            // 初回読み込み時の通知抑制＆カウンター初期化
            const elapsed = Math.floor((now - startTime) / 1000);
            if (lastBreakNotificationTime === 0) lastBreakNotificationTime = elapsed;
            if (lastEncouragementTime === 0) lastEncouragementTime = elapsed;

            updateUIForActiveTask();
            startTimerLoop();
            listenForColleagues(currentTask);
            setupMidnightTimer();

        } else {
            resetClientState();
        }
    }, (error) => {
        console.error("Error listening to work status:", error);
    });
}

/**
 * リスナー停止用
 */
export function stopStatusListener() {
    if (statusUnsubscribe) {
        statusUnsubscribe();
        statusUnsubscribe = null;
    }
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
    // ★追加: 点滅アニメーションも削除する
    if (startBtn) startBtn.classList.remove("animate-pulse-scale");

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
    // ★変更: Workerと競合するため、クライアント側の自動停止は無効化
    console.log("深夜自動停止はWorkerに任せるため、クライアント側では何もしません"); 
    /* if (midnightStopTimer) {
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
                
                triggerReservationNotification("帰宅（深夜自動停止）");
            }
        }, timeUntilMidnight);
    }
    */
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

        if (currentTask === "休憩" && elapsed > 0) {
            if (elapsed - lastBreakNotificationTime >= 1800) {
                triggerBreakNotification(elapsed);
                lastBreakNotificationTime = elapsed;
            }
        }

        if (userDisplayPreferences && userDisplayPreferences.notificationIntervalMinutes > 0) {
            const intervalSeconds = userDisplayPreferences.notificationIntervalMinutes * 60;
            if (elapsed > 0) {
                if (elapsed - lastEncouragementTime >= intervalSeconds) {
                    triggerEncouragementNotification(elapsed, "breather", currentTask);
                    lastEncouragementTime = elapsed;
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
        // 休憩終了
        await stopCurrentTask(false);
        const taskToReturnTo = statusData.preBreakTask;
        resetClientState(); 

        if (taskToReturnTo && taskToReturnTo.task) {
            await startTask(taskToReturnTo.task, taskToReturnTo.goalId, taskToReturnTo.goalTitle);
        } else {
            console.log("No valid pre-break task found. Resetting status.");
            await updateDoc(statusRef, { isWorking: false, currentTask: null });
        }
    } else {
        // 休憩開始
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
                    await stopCurrentTaskCore(false);
                    await startTask("休憩", null, null);
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
        await stopCurrentTaskCore(false);
        await startTask("休憩", null, null);
        if (isAuto) triggerReservationNotification("休憩");
    }
}

// --- Core Logic ---

async function startTask(newTask, newGoalId, newGoalTitle, forcedStartTime = null) {
    if (!userId) return;

    if (newTask === undefined) {
        console.warn("startTask called with undefined task. Defaulting to null.");
        newTask = null;
    }

    currentTask = newTask;
    currentGoalId = newGoalId || null;
    currentGoalTitle = newGoalTitle || null;
    startTime = forcedStartTime || new Date();
    hasContributedToCurrentGoal = false;
    
    updateUIForActiveTask();
    startTimerLoop();

    // ★修正: 手動操作フラグをON
    isManualStateChange = true;

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

    // ★修正: 少し待ってから手動操作フラグをOFF（通知重複防止のため）
    setTimeout(() => { isManualStateChange = false; }, 500);

    listenForColleagues(newTask);
    setupMidnightTimer();
}

async function stopCurrentTask(isLeaving) {
    // 1. 変数が消される前に、まずログを保存する！
    await stopCurrentTaskCore(isLeaving);

    if (isLeaving) {
        // ★修正: 手動操作フラグをON
        isManualStateChange = true;

        // 2. 次にFirestore上のステータスを更新する
        if (userId) {
             await updateDoc(doc(db, "work_status", userId), { isWorking: false, currentTask: null });
        }
        
        // 3. 最後にローカルの状態をリセット（表示をクリア）する
        resetClientState();

        // ★修正: 少し待ってから手動操作フラグをOFF
        setTimeout(() => { isManualStateChange = false; }, 500);
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

    // --- デバッグログ ---
    console.group("stopCurrentTaskCore Debug");
    console.log("Attempting to save log...");
    console.log("taskToLog:", taskToLog);
    console.log("taskStartTime:", taskStartTime);
    console.log("isLeaving:", isLeaving);
    // -------------------

    if (!taskStartTime || !taskToLog) {
        console.error("❌ 保存中止: タスク名または開始時間がありません");
        console.log("理由 -> taskToLog:", taskToLog, " taskStartTime:", taskStartTime);
        console.groupEnd();
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
        try {
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
            console.log("✅ 保存成功");

            // ★追加: ログ保存が成功したので、一時保存していたメモを削除する
            localStorage.removeItem("tempTaskMemo");

        } catch (e) {
            console.error("❌ Firestore保存エラー:", e);
        }
    } else {
        console.warn("⚠️ 経過時間が0秒のため保存しませんでした");
    }
    console.groupEnd();
}

// --- DEBUG UTILITY ---
window.debugTimer = {
    getStatus: () => {
        console.log("=== Timer Internal Status ===");
        console.log("currentTask:", currentTask);
        console.log("startTime:", startTime);
        return "Check completed";
    }
};

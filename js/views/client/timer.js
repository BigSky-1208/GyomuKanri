// js/views/client/timer.js - ストップウォッチ機能と状態管理（完全同期版）

import { db, userId, userName, showView, VIEWS, userDisplayPreferences } from "../../main.js";
import { doc, updateDoc, getDoc, setDoc, addDoc, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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

// 定数
const LOCAL_STATUS_KEY = "gyomu_timer_current_status";
const WORKER_URL = "https://muddy-night-4bd4.sora-yamashita.workers.dev"; // あなたのWorker URL

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
 * 【重要・修正版】クライアント状態の復元
 * Worker（予約）による変更を反映するため、Firestoreの状態を最優先で復元します。
 */
export async function restoreClientState() {
    if (!userId) return;

    let data = null;

    // 1. まずサーバー(Firestore)から最新の状態を取得
    console.log("Restoring status from Firestore...");
    const statusRef = doc(db, "work_status", userId);
    try {
        const docSnap = await getDoc(statusRef);
        if (docSnap.exists()) {
            const fsData = docSnap.data();
            // サーバー側で稼働中（休憩含む）であれば、それを優先して採用
            if (fsData.isWorking) {
                data = fsData;
                // 日付型の変換 (Timestamp or String -> Date)
                if (data.startTime && data.startTime.toDate) {
                    data.startTime = data.startTime.toDate();
                } else if (data.startTime) {
                    data.startTime = new Date(data.startTime);
                }
                // ローカルストレージも最新状態に更新しておく
                localStorage.setItem(LOCAL_STATUS_KEY, JSON.stringify(data));
            }
        }
    } catch (error) {
        console.error("Error fetching work status from Firestore:", error);
    }

    // 2. Firestoreにデータがない（または通信エラーの）場合のみ、ローカルストレージを確認
    if (!data) {
        const savedStatus = localStorage.getItem(LOCAL_STATUS_KEY);
        if (savedStatus) {
            try {
                data = JSON.parse(savedStatus);
                if (data.startTime) data.startTime = new Date(data.startTime);
            } catch (e) {
                console.error("Failed to parse local status:", e);
            }
        }
    }

    // 3. 取得したデータをUIに反映
    if (data && data.isWorking) {
        const now = new Date();
        const localStartTime = data.startTime || now;

        // 日付跨ぎチェック（前日のままなら自動退勤）
        const startTimeStr = getJSTDateString(localStartTime);
        const todayStr = getJSTDateString(now);

        if (startTimeStr !== todayStr) {
            console.log("Auto-checkout for previous day.");
            const endOfStartTimeDay = new Date(localStartTime);
            endOfStartTimeDay.setHours(23, 59, 59, 999);
            
            await stopCurrentTaskCore(true, endOfStartTimeDay, {
                task: data.currentTask,
                goalId: data.currentGoalId,
                goalTitle: data.currentGoalTitle,
                startTime: localStartTime,
                memo: "（自動退勤処理）"
            });

            // 修正フラグを立てる
            const sRef = doc(db, "work_status", userId);
            await updateDoc(sRef, { needsCheckoutCorrection: true });
            
            // ダイアログ表示
            const { checkForCheckoutCorrection } = await import("../../utils.js");
            checkForCheckoutCorrection(userId);
            
            localStorage.removeItem(LOCAL_STATUS_KEY);
            resetClientState();
            return;
        }

        // 状態を復元
        startTime = localStartTime;
        currentTask = data.currentTask || null;
        currentGoalId = data.currentGoalId || null;
        currentGoalTitle = data.currentGoalTitle || null;
        preBreakTask = data.preBreakTask || null;

        // UI更新・タイマー開始
        updateUIForActiveTask();
        startTimerLoop();
        listenForColleagues(currentTask);
        setupMidnightTimer();
    } else {
        resetClientState();
    }
}

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

    import("./clientUI.js").then(({ updateTaskDisplaysForSelection, handleGoalSelectionChange }) => {
        const taskSelect = document.getElementById("task-select");
        const goalSelect = document.getElementById("goal-select");
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
    
    if (endOfDay.getTime() > now.getTime()) {
        midnightStopTimer = setTimeout(async () => {
            if (currentTask) {
                // 自動停止処理
                const forceEndTime = new Date(); 
                forceEndTime.setHours(23, 59, 59, 999);
                await stopCurrentTask(true); // 下の関数でD1同期も行われる
                triggerReservationNotification("帰宅（深夜自動停止）");
                
                // 修正必要フラグ
                const statusRef = doc(db, "work_status", userId);
                await updateDoc(statusRef, { needsCheckoutCorrection: true });
            }
        }, endOfDay.getTime() - now.getTime());
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

        // 各種通知ロジック
        if (currentTask === "休憩" && elapsed > 0) {
            const breakInterval = 1800;
            if (elapsed - lastBreakNotificationTime >= breakInterval) {
                lastBreakNotificationTime = Math.floor(elapsed / breakInterval) * breakInterval;
                triggerBreakNotification(elapsed);
            }
        }
        if (userDisplayPreferences && userDisplayPreferences.notificationIntervalMinutes > 0) {
            const intervalSeconds = userDisplayPreferences.notificationIntervalMinutes * 60;
            if (elapsed > 0 && elapsed - lastEncouragementTime >= intervalSeconds) {
                lastEncouragementTime = Math.floor(elapsed / intervalSeconds) * intervalSeconds;
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
    
    let newTask = taskSelect.value;
    if (!newTask) return alert("業務を選択してください。");
    if (newTask === "休憩") return alert("休憩は「休憩開始」ボタンを使用してください。");

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

    const statusRef = doc(db, "work_status", userId);
    const docSnap = await getDoc(statusRef);
    if (!docSnap.exists() || !docSnap.data().isWorking) return;

    const statusData = docSnap.data();
    const currentDbTask = statusData.currentTask;

    if (currentDbTask === "休憩") {
        await stopCurrentTask(false);
        
        // --- 【重要】JSON文字列として保存されている場合のパース処理 ---
        let taskToReturnTo = statusData.preBreakTask;
        if (typeof taskToReturnTo === 'string') {
            try {
                taskToReturnTo = JSON.parse(taskToReturnTo);
            } catch (e) {
                taskToReturnTo = null;
            }
        }
        // --------------------------------------------------------

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
    
    const statusToSave = {
        currentTask, currentGoalId, currentGoalTitle, startTime,
        isWorking: true, preBreakTask: preBreakTask || null
    };
    localStorage.setItem(LOCAL_STATUS_KEY, JSON.stringify(statusToSave));

    updateUIForActiveTask();
    startTimerLoop();

    // Firestore更新
    const statusRef = doc(db, "work_status", userId);
    await setDoc(statusRef, {
        ...statusToSave,
        userId, userName, onlineStatus: true
    }, { merge: true });

    // --- 【重要】D1ステータス同期 ---
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
    // ----------------------------

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

            // --- 【重要】D1のステータスも「未稼働」に同期 ---
            await fetch(`${WORKER_URL}/update-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userId,
                    userName: userName,
                    isWorking: 0,
                    currentTask: null,
                    startTime: null
                })
            });
            console.log("D1 status synced (stopped).");
            // ---------------------------------------------
            
        } catch (e) {
            console.error("Firestore save error:", e);
        }
    }
}

window.debugTimer = {
    getStatus: () => ({ currentTask, startTime, isWorking: !!startTime })
};

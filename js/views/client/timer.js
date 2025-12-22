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

// ★ここが抜けていました（通知用カウンター）
let lastBreakNotificationTime = 0;
let lastEncouragementTime = 0;

// 定数
const LOCAL_STATUS_KEY = "gyomu_timer_current_status";
const WORKER_URL = "https://muddy-night-4bd4.sora-yamashita.workers.dev"; // あなたのWorker URL

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
 * LocalStorageの情報を元に画面表示を最新の状態に復元する
 */
export async function restoreClientState() {
    const isWorking = localStorage.getItem("isWorking") === "1";
    const savedTask = localStorage.getItem("currentTask");
    const savedGoal = localStorage.getItem("currentGoal");
    const savedStartTime = localStorage.getItem("startTime");

    if (isWorking && savedTask && savedStartTime) {
        // メモリ変数に復元
        currentTask = savedTask;
        currentGoalTitle = savedGoal;
        startTime = new Date(savedStartTime);

        // UI表示
        const startBtn = document.getElementById("start-btn");
        if (startBtn) {
            startBtn.classList.remove("animate-pulse", "animate-pulse-scale");
            startBtn.textContent = "業務を変更する";
            if (startBtn.classList.contains("bg-indigo-600")) {
                startBtn.classList.replace("bg-indigo-600", "bg-green-600");
            }
        }
        
        updateUIForActiveTask();
        startTimerLoop();
        import("./colleagues.js").then(m => m.listenForColleagues(currentTask));
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
    
    // メモリ上の currentTask を優先して表示
    if (currentTaskDisplay) {
        const displayTaskName = currentTask || localStorage.getItem("currentTask") || "未開始";
        const displayGoalName = currentGoalTitle || localStorage.getItem("currentGoal");
        
        currentTaskDisplay.textContent = (displayGoalName && displayGoalName !== "なし")
            ? `${displayTaskName} (${displayGoalName})`
            : displayTaskName;
    }

    if (breakBtn) {
        breakBtn.disabled = false;
        // 休憩ボタンのトグル処理（既存のまま）
        if (currentTask === "休憩") {
            breakBtn.textContent = "休憩前の業務に戻る";
            breakBtn.classList.replace("bg-yellow-500", "bg-cyan-600");
        } else {
            breakBtn.textContent = "休憩開始";
            breakBtn.classList.replace("bg-cyan-600", "bg-yellow-500");
        }
    }
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
    
    // 変数のリセット
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

        // --- 通知ロジックの修正 ---
        // ★修正: メモリの currentTask ではなく、LocalStorage から最新のタスク名を取得
        const activeTaskName = localStorage.getItem("currentTask") || currentTask || "業務";

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
                // ★修正: activeTaskName を渡す
                triggerEncouragementNotification(elapsed, "breather", activeTaskName);
            }
        }
    }, 1000);
}

function stopTimerLoop() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
}

// --- Action Handlers ---

// 【修正箇所】handleStartClick 関数の中
export async function handleStartClick() {
    const taskSelect = document.getElementById("task-select");
    const goalSelect = document.getElementById("goal-select");
    const otherTaskInput = document.getElementById("other-task-input");

    const selectedTask = taskSelect.value === "その他" ? otherTaskInput.value : taskSelect.value;
    const selectedGoalTitle = goalSelect ? goalSelect.options[goalSelect.selectedIndex]?.text : null;
    const selectedGoalId = goalSelect ? goalSelect.value : null;

    if (!selectedTask) {
        alert("業務内容を選択または入力してください。");
        return;
    }

    const data = {
        userId: userId,
        userName: userName,
        isWorking: 1,
        currentTask: selectedTask,
        currentGoal: selectedGoalTitle,
        startTime: new Date().toISOString()
    };

    try {
        const response = await fetch(`${WORKER_URL}/start-work`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            // --- 1. メモリ変数を即座に更新（これが「未開始」を防ぐ鍵です） ---
            currentTask = data.currentTask;
            currentGoalTitle = data.currentGoal;
            currentGoalId = selectedGoalId;
            startTime = new Date(data.startTime);

            // --- 2. LocalStorage を更新 ---
            localStorage.setItem("isWorking", "1");
            localStorage.setItem("currentTask", currentTask);
            localStorage.setItem("currentGoal", currentGoalTitle || "");
            localStorage.setItem("startTime", data.startTime);

            // --- 3. UIの即時反映（alertは削除） ---
            const startBtn = document.getElementById("start-btn");
            if (startBtn) {
                startBtn.classList.remove("animate-pulse", "animate-pulse-scale");
                startBtn.textContent = "業務を変更する";
                startBtn.classList.replace("bg-indigo-600", "bg-green-600");
            }

            // タイマーと表示を更新
            updateUIForActiveTask();
            startTimerLoop();
            
            // 同僚リスト更新
            import("./colleagues.js").then(m => m.listenForColleagues(currentTask));
        }
    } catch (error) {
        console.error("業務開始エラー:", error);
    }
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

    // --- 【修正】D1ステータス同期 ---
    try {
        await fetch(`${WORKER_URL}/update-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                userName: userName,
                isWorking: 1,
                currentTask: newTask,
                startTime: startTime.toISOString(),
                currentGoal: currentGoalTitle // ★工数（タイトル）を送信に追加
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
                    startTime: null,
                    currentGoal: null // ★終了時は工数もクリアする
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

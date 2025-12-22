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
    // ★修正: 常にLocalStorageを最優先で読み込む
    const isWorking = localStorage.getItem("isWorking") === "1";
    const currentTask = localStorage.getItem("currentTask");
    const currentGoal = localStorage.getItem("currentGoal");

    const startBtn = document.getElementById("start-btn");
    const stopBtn = document.getElementById("stop-btn");
    const breakBtn = document.getElementById("break-btn");

    if (isWorking) {
        // 稼働中の表示
        if (startBtn) {
            startBtn.classList.remove("animate-pulse"); // 拡縮停止
            startBtn.textContent = "業務を変更する";
            startBtn.classList.replace("bg-indigo-600", "bg-green-600"); // 色の変更
        }
        if (stopBtn) stopBtn.disabled = false;
        if (breakBtn) breakBtn.disabled = false;

        // 同僚リストの監視を開始（先ほどD1化したもの）
        import("./colleagues.js").then(m => m.listenForColleagues(currentTask));
    } else {
        // 未稼働（停止中）の表示
        if (startBtn) {
            startBtn.classList.add("animate-pulse"); // 停止中のみ拡縮させる
            startBtn.textContent = "業務を開始する";
            startBtn.classList.replace("bg-green-600", "bg-indigo-600");
        }
        if (stopBtn) stopBtn.disabled = true;
        if (breakBtn) breakBtn.disabled = true;
        
        import("./colleagues.js").then(m => m.stopColleaguesListener());
    }

    // プルダウン等の選択状態をLocalStorageに合わせる（clientUI.js側の関数）
    import("./clientUI.js").then(m => m.updateTaskDisplaysForSelection());
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
            // 1. 業務に合わせた工数リストを生成
            updateTaskDisplaysForSelection(); 
            
            // 2. 【修正】DOMの更新を待ってから工数をセットする
            setTimeout(() => {
                if (currentGoalId && goalSelect) {
                    goalSelect.value = currentGoalId;
                    handleGoalSelectionChange();
                }
            }, 50); // わずかなディレイを入れて確実にOptionが生成された後にセット
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
    const otherTaskInput = document.getElementById("other-task-input");

    const selectedTask = taskSelect.value === "その他" ? otherTaskInput.value : taskSelect.value;
    const selectedGoal = goalSelect ? goalSelect.value : null;

    if (!selectedTask) {
        alert("業務内容を選択または入力してください。");
        return;
    }

    const data = {
        userId: userId,
        userName: userName,
        isWorking: 1,
        currentTask: selectedTask,
        currentGoal: selectedGoal,
        startTime: new Date().toISOString()
    };

    try {
        const response = await fetch(`${WORKER_URL}/start-work`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            // ★重要: Firebaseの反映を待たず、LocalStorageを即座に正解として上書きする
            localStorage.setItem("isWorking", "1");
            localStorage.setItem("currentTask", data.currentTask);
            localStorage.setItem("currentGoal", data.currentGoal || "");
            localStorage.setItem("startTime", data.startTime);

            // ★重要: 即座にボタンの拡縮アニメーションを止める
            const startBtn = document.getElementById("start-btn");
            if (startBtn) {
                startBtn.classList.remove("animate-pulse"); // アニメーションを解除
                startBtn.textContent = "業務を変更する";      // テキストも確定させる
            }

            // UI全体をLocalStorageの状態に同期
            await restoreClientState();
            alert(`業務を「${data.currentTask}」に変更しました。`);
        }
    } catch (error) {
        console.error("業務開始エラー:", error);
        alert("接続に失敗しました。");
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

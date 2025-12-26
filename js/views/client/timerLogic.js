// js/views/client/timerLogic.js

import { db, userId, userName, userDisplayPreferences } from "../../main.js";
import { doc, setDoc, addDoc, updateDoc, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { formatDuration, getJSTDateString } from "../../utils.js";
import { triggerEncouragementNotification, triggerReservationNotification, triggerBreakNotification } from "../../components/notification.js";
import { listenForColleagues, stopColleaguesListener } from "./colleagues.js";

// Stateからインポート
import * as State from "./timerState.js";

// DOM要素の参照ヘルパー
const getEl = (id) => document.getElementById(id);

/**
 * 実際の業務開始・変更処理（共通化）
 */
export async function executeStartTask(selectedTask, selectedGoalId, selectedGoalTitle) {
    const data = {
        userId, userName,
        isWorking: 1,
        currentTask: selectedTask,
        currentGoal: selectedGoalTitle,
        currentGoalId: selectedGoalId,
        startTime: new Date().toISOString()
    };

    try {
        const response = await fetch(`${State.WORKER_URL}/start-work`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            // State更新
            State.setCurrentTask(data.currentTask);
            State.setCurrentGoalTitle(data.currentGoal);
            State.setCurrentGoalId(selectedGoalId);
            State.setStartTime(new Date(data.startTime));
            State.setLastEncouragementTime(0);
            State.setLastBreakNotificationTime(0);
            State.setHasContributed(false);

            // ★ここでフラグをリセット（falseにする）
            // これにより、新しい業務でも「登録」ボタンを押すまでチェックが行われるようになります
            State.setHasContributed(false);

            // LocalStorage更新
            localStorage.setItem("isWorking", "1");
            localStorage.setItem("currentTask", State.getCurrentTask());
            localStorage.setItem("currentGoal", State.getCurrentGoalTitle() || "");
            localStorage.setItem("currentGoalId", State.getCurrentGoalId() || "");
            localStorage.setItem("startTime", data.startTime);

            const warningMessage = getEl("change-warning-message");
            if (warningMessage) warningMessage.classList.add("hidden");

            // Firestore更新
            try {
                const statusRef = doc(db, "work_status", userId);
                await setDoc(statusRef, {
                    currentTask: State.getCurrentTask(),
                    currentGoalId: State.getCurrentGoalId() || null,
                    currentGoalTitle: State.getCurrentGoalTitle() || null,
                    currentGoal: State.getCurrentGoalTitle() || null,
                    startTime: data.startTime,
                    isWorking: true,
                    preBreakTask: State.getPreBreakTask() || null,
                    userId, userName, onlineStatus: true
                }, { merge: true });
                console.log(`Firestore status synced for ${userId}`);
            } catch (err) {
                console.error("Firestore status sync error:", err);
            }

            // UI更新
            const startBtn = getEl("start-btn");
            if (startBtn) {
                startBtn.classList.remove("animate-pulse", "animate-pulse-scale");
                startBtn.textContent = "業務を変更する";
                startBtn.classList.remove("bg-indigo-600");
                startBtn.classList.add("bg-green-600");
            }

            updateUIForActiveTask();
            startTimerLoop();
            setupMidnightTimer();

            listenForColleagues(State.getCurrentTask());
        }
    } catch (error) {
        console.error("業務開始エラー:", error);
    }
}

export async function stopCurrentTask(isLeaving) {
    await stopCurrentTaskCore(isLeaving);

    if (isLeaving) {
        localStorage.removeItem(State.LOCAL_STATUS_KEY);
        if (userId) {
             await updateDoc(doc(db, "work_status", userId), { isWorking: false, currentTask: null });
        }
        resetClientState();
    }
}

export async function stopCurrentTaskCore(isLeaving, forcedEndTime = null, taskDataOverride = null) {
    if (State.getMidnightStopTimer()) {
        clearTimeout(State.getMidnightStopTimer());
        State.setMidnightStopTimer(null);
    }
    stopTimerLoop();

    const taskToLog = taskDataOverride?.task || State.getCurrentTask();
    const taskStartTime = taskDataOverride?.startTime || State.getStartTime();

    if (!taskStartTime || !taskToLog) return;

    const endTime = forcedEndTime || new Date();
    const duration = Math.floor((endTime - taskStartTime) / 1000);
    let memo = taskDataOverride?.memo || getEl("task-memo-input")?.value.trim() || "";

    if (duration > 0) {
        try {
            await addDoc(collection(db, "work_logs"), {
                userId, userName, task: taskToLog,
                goalId: taskDataOverride?.goalId || State.getCurrentGoalId(),
                goalTitle: taskDataOverride?.goalTitle || State.getCurrentGoalTitle(),
                date: getJSTDateString(taskStartTime),
                duration, startTime: taskStartTime, endTime, memo
            });
            console.log("Log saved successfully.");

            await fetch(`${State.WORKER_URL}/update-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId, userName,
                    isWorking: 0,
                    currentTask: null,
                    startTime: null,
                    currentGoal: null
                })
            });
            console.log("D1 status synced (stopped).");
        } catch (e) {
            console.error("Firestore save error:", e);
        }
    }
}

export async function syncReservations() {
    if (!userId) return;
    try {
        const resp = await fetch(`${State.WORKER_URL}/get-user-reservations?userId=${userId}`);
        if (resp.ok) {
            State.setActiveReservations(await resp.json());
            console.log("予約リストを同期しました:", State.getActiveReservations());
        }
    } catch (e) {
        console.error("予約同期エラー:", e);
    }
}

// UI更新系
export function updateUIForActiveTask() {
    const startBtn = getEl("start-btn");
    const currentTaskDisplay = getEl("current-task-display");
    const breakBtn = getEl("break-btn");
    const currentTask = State.getCurrentTask();

if (currentTask === '休憩') {
        // ここで必要な要素を取得
        const taskSelect = getEl("task-select");
        const goalSelect = getEl("goal-select");
        const currentGoalTitle = getEl("currentGoalTitle"); // IDがHTMLと合っているか確認してください

        // 休憩中であることを表示
        if (currentTaskDisplay) {
            currentTaskDisplay.textContent = "休憩中";
        }

        if (taskSelect) taskSelect.value = '休憩';
        
        // 工数プルダウンをリセット
        if (goalSelect) {
            goalSelect.value = ""; 
            goalSelect.disabled = true; 
        }
        
        // 目標タイトル表示をクリア
        if (currentGoalTitle) {
            currentGoalTitle.innerText = ""; 
            currentGoalTitle.style.display = "none";
        }

        // 休憩ボタンの表示切替（休憩中→業務に戻る）
        if (breakBtn) {
            breakBtn.disabled = false;
            breakBtn.textContent = "休憩前の業務に戻る";
            breakBtn.classList.remove("bg-yellow-500");
            breakBtn.classList.add("bg-cyan-600");
        }

        // 休憩中はこれ以降の処理（工数IDのマッチングなど）を行わずに抜ける
        return; 
    }
    // ■■■ 追加終了 ■■■
    if (startBtn) startBtn.textContent = "業務変更";
    
    if (currentTaskDisplay) {
        const displayTaskName = State.getCurrentTask() || localStorage.getItem("currentTask") || "未開始";
        const displayGoalName = State.getCurrentGoalTitle() || localStorage.getItem("currentGoal");
        
        if (displayGoalName && displayGoalName !== "なし" && displayGoalName !== "工数を選択 (任意)") {
            currentTaskDisplay.textContent = `${displayTaskName} (${displayGoalName})`;
        } else {
            currentTaskDisplay.textContent = displayTaskName;
        }
    }
    
    if (breakBtn) {
        breakBtn.disabled = false;
        if (State.getCurrentTask() === "休憩") {
            breakBtn.textContent = "休憩前の業務に戻る";
            breakBtn.classList.replace("bg-yellow-500", "bg-cyan-600");
        } else {
            breakBtn.textContent = "休憩開始";
            breakBtn.classList.replace("bg-cyan-600", "bg-yellow-500");
        }
    }

    import("./clientUI.js").then(({ updateTaskDisplaysForSelection, handleGoalSelectionChange }) => {
        const taskSelect = getEl("task-select");
        const goalSelect = getEl("goal-select");

        // ■■■ 追加修正: 休憩以外なら、まずプルダウンのロックを解除する ■■■
        if (goalSelect) {
            goalSelect.disabled = false;
        }
        // ■■■ 追加終了 ■■■
        
        if (taskSelect && State.getCurrentTask()) {
            taskSelect.value = State.getCurrentTask();
            updateTaskDisplaysForSelection(); 
            
            // ★修正: タイムアウト時間を 100ms -> 300ms に延ばし、確実にセットする
            setTimeout(() => {
                const targetGoalId = State.getCurrentGoalId() || localStorage.getItem("currentGoalId");
                
                if (targetGoalId && goalSelect) {
                    goalSelect.value = targetGoalId;
                    
                    // 値が正しくセットされたか確認（選択肢に存在する場合のみイベント発火）
                    if (goalSelect.value === targetGoalId) {
                        handleGoalSelectionChange();
                    } else {
                        // 念のため、値が見つからなかった場合（ID不一致など）のログ
                        console.warn("復元対象の工数IDがリストにありません:", targetGoalId);
                    }
                }
            }, 300);
        }
    });
}

export function startTimerLoop() {
    if (State.getTimerInterval()) clearInterval(State.getTimerInterval());
    
    import("./clientUI.js").then(({ renderTaskOptions, renderTaskDisplaySettings }) => {
        renderTaskOptions();
        renderTaskDisplaySettings(); 
    });

    const interval = setInterval(async () => {
        const startTime = State.getStartTime();
        if (!startTime) return;
        
        const now = new Date();
        const elapsed = Math.floor((now - startTime) / 1000);
        const timerDisplay = getEl("timer-display");
        if (timerDisplay) timerDisplay.textContent = formatDuration(elapsed);

        // 通知ロジック
        const activeTaskName = localStorage.getItem("currentTask") || State.getCurrentTask() || "業務";

        if (State.getCurrentTask() === "休憩" && elapsed > 0) {
            const breakInterval = 1800;
            if (elapsed - State.getLastBreakNotificationTime() >= breakInterval) {
                State.setLastBreakNotificationTime(Math.floor(elapsed / breakInterval) * breakInterval);
                triggerBreakNotification(elapsed);
            }
        }
        
        if (userDisplayPreferences && userDisplayPreferences.notificationIntervalMinutes > 0) {
            const intervalSeconds = userDisplayPreferences.notificationIntervalMinutes * 60;
            if (elapsed > 0 && elapsed - State.getLastEncouragementTime() >= intervalSeconds) {
                State.setLastEncouragementTime(Math.floor(elapsed / intervalSeconds) * intervalSeconds);
                triggerEncouragementNotification(elapsed, "breather", activeTaskName);
            }
        }
    }, 1000);

    State.setTimerInterval(interval);
}

export function stopTimerLoop() {
    if (State.getTimerInterval()) clearInterval(State.getTimerInterval());
    State.setTimerInterval(null);
}

export function setupMidnightTimer() {
    if (State.getMidnightStopTimer()) {
        clearTimeout(State.getMidnightStopTimer());
        State.setMidnightStopTimer(null);
    }
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    
    if (endOfDay.getTime() > now.getTime()) {
        const timer = setTimeout(async () => {
            if (State.getCurrentTask()) {
                await stopCurrentTask(true); 
                triggerReservationNotification("帰宅（深夜自動停止）");
                const statusRef = doc(db, "work_status", userId);
                await updateDoc(statusRef, { needsCheckoutCorrection: true });
            }
        }, endOfDay.getTime() - now.getTime());
        State.setMidnightStopTimer(timer);
    }
}

export function resetClientState() {
    stopTimerLoop();
    localStorage.removeItem(State.LOCAL_STATUS_KEY);
    localStorage.removeItem("isWorking");
    localStorage.removeItem("currentTask");
    localStorage.removeItem("currentGoal");
    localStorage.removeItem("currentGoalId");
    localStorage.removeItem("startTime");
    localStorage.removeItem("preBreakTask");

    State.resetStateVariables();

    const timerDisplay = getEl("timer-display");
    const currentTaskDisplay = getEl("current-task-display");
    const startBtn = getEl("start-btn");
    const breakBtn = getEl("break-btn");
    const warningMessage = getEl("change-warning-message");

    if (timerDisplay) timerDisplay.textContent = "00:00:00";
    if (currentTaskDisplay) currentTaskDisplay.textContent = "未開始";
    if (startBtn) {
        startBtn.textContent = "業務開始";
        startBtn.classList.remove("animate-pulse-scale");
    }
    if (getEl("task-memo-input")) getEl("task-memo-input").value = "";
    if (warningMessage) warningMessage.classList.add("hidden");
    
    if (breakBtn) {
        breakBtn.textContent = "休憩開始";
        breakBtn.disabled = true; 
        breakBtn.classList.remove("bg-cyan-600", "hover:bg-cyan-700");
        breakBtn.classList.add("bg-yellow-500", "hover:bg-yellow-600");
    }
    
    stopColleaguesListener();
}

export async function restoreClientState() {
    const isWorking = localStorage.getItem("isWorking") === "1";
    const savedTask = localStorage.getItem("currentTask");
    const savedGoal = localStorage.getItem("currentGoal");
    const savedGoalId = localStorage.getItem("currentGoalId");
    const savedStartTime = localStorage.getItem("startTime");
    await syncReservations(); 

    if (isWorking && savedTask && savedStartTime) {
        State.setCurrentTask(savedTask);
        State.setCurrentGoalTitle(savedGoal);
        State.setCurrentGoalId(savedGoalId);
        State.setStartTime(new Date(savedStartTime));

        const startBtn = getEl("start-btn");
        if (startBtn) {
            startBtn.classList.remove("animate-pulse", "animate-pulse-scale");
            startBtn.textContent = "業務を変更する";
            if (startBtn.classList.contains("bg-indigo-600")) {
                startBtn.classList.replace("bg-indigo-600", "bg-green-600");
            }
        }
        
        updateUIForActiveTask();
        startTimerLoop();
        import("./colleagues.js").then(m => m.listenForColleagues(savedTask));
    } else {
        resetClientState();
    }
}

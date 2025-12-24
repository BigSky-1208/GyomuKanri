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
let activeReservations = []; // 現在の予約リストをメモリに保持

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
    await syncReservations(); // ★これを追加！
    const savedGoalId = localStorage.getItem("currentGoalId");

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
    
    if (currentTaskDisplay) {
        // ★修正：メモリ上の変数(currentTask)を最優先、次にLocalStorageを見る
        const displayTaskName = currentTask || localStorage.getItem("currentTask") || "未開始";
        const displayGoalName = currentGoalTitle || localStorage.getItem("currentGoal");
        
        if (displayGoalName && displayGoalName !== "なし" && displayGoalName !== "工数を選択 (任意)") {
            currentTaskDisplay.textContent = `${displayTaskName} (${displayGoalName})`;
        } else {
            currentTaskDisplay.textContent = displayTaskName;
        }
    }
    
    // 休憩ボタンの表示切替も、最新の currentTask に基づいて行う
    if (breakBtn) {
        breakBtn.disabled = false;
        if (currentTask === "休憩") {
            breakBtn.textContent = "休憩前の業務に戻る";
            breakBtn.classList.replace("bg-yellow-500", "bg-cyan-600");
        } else {
            breakBtn.textContent = "休憩開始";
            breakBtn.classList.replace("bg-cyan-600", "bg-yellow-500");
        }
    }

    // 【不具合修正】プルダウンの内容がリセットされるのを防ぐ
    import("./clientUI.js").then(({ updateTaskDisplaysForSelection, handleGoalSelectionChange }) => {
        const taskSelect = document.getElementById("task-select");
        const goalSelect = document.getElementById("goal-select");
        
        if (taskSelect && currentTask) {
            taskSelect.value = currentTask;
            // オプションを再描画
            updateTaskDisplaysForSelection(); 
            
            // オプション生成後に工数を選択状態にする
            setTimeout(() => {
                const targetGoalId = currentGoalId || localStorage.getItem("currentGoalId");
                if (targetGoalId && goalSelect) {
                    goalSelect.value = targetGoalId;
                    handleGoalSelectionChange();
                }
            }, 100); // 確実に描画が終わるよう少し長めに待機
        }
    });
}

function resetClientState() {
    stopTimerLoop();
    localStorage.removeItem(LOCAL_STATUS_KEY);
    localStorage.removeItem("isWorking");
    localStorage.removeItem("currentTask");
    localStorage.removeItem("currentGoal");
    localStorage.removeItem("currentGoalId");
    localStorage.removeItem("startTime");
    localStorage.removeItem("preBreakTask");

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

    timerInterval = setInterval(async () => { // ★asyncを追加
        if (!startTime) return;
        const now = new Date();
        const elapsed = Math.floor((now - startTime) / 1000);
        if (timerDisplay) timerDisplay.textContent = formatDuration(elapsed);

        // --- 【マージ】★追加: 予約の即時実行チェック ---
        const nowIso = now.toISOString();
        
        if (typeof activeReservations !== 'undefined' && activeReservations.length > 0) {
            const dueReservation = activeReservations.find(res => 
                res.status === 'reserved' && res.scheduledTime <= nowIso
            );

if (dueReservation) {
            console.log("予約実行時間になりました:", dueReservation.action);
            activeReservations = activeReservations.filter(r => r.id !== dueReservation.id);
            
            if (dueReservation.action === 'break') {

                // ★追加: 休憩に切り替わる前に、現在の業務情報を保存する
                const preTaskData = { 
                        task: currentTask, 
                        goalId: currentGoalId, 
                        goalTitle: currentGoalTitle 
                    };
                    localStorage.setItem("preBreakTask", JSON.stringify(preTaskData));
                
                // --- 【解決策】リセットして即座に再始動するロジック ---
                
                const breakStartTime = new Date();

                // 1. メモリ変数を「休憩」でリセット
                currentTask = "休憩";
                currentGoalTitle = null;
                currentGoalId = null;
                startTime = breakStartTime; // ここでタイマー開始時間が「今」になる
                hasContributedToCurrentGoal = false;

                // 2. LocalStorage を「休憩」でリセット
                localStorage.setItem("isWorking", "1");
                localStorage.setItem("currentTask", "休憩");
                localStorage.setItem("currentGoal", "");
                localStorage.setItem("startTime", breakStartTime.toISOString());
                localStorage.setItem(LOCAL_STATUS_KEY, JSON.stringify({
                    currentTask: "休憩",
                    currentGoalId: null,
                    currentGoalTitle: null,
                    startTime: breakStartTime.toISOString(),
                    isWorking: true
                }));

                // 3. UIを即座に更新（表示を「休憩」に変える）
                updateUIForActiveTask();

                // 4. バックエンド処理（前の業務のログ保存とD1更新）
                // handleBreakClick(true) を呼ぶとタイマーが止まってしまうので、
                // 必要な処理だけを順番に実行します
                try {
                    // 前の業務の終了を記録（この中で一瞬タイマーが止まります）
                    await stopCurrentTaskCore(false); 

                    // D1のステータスを「休憩」に更新
                    fetch(`${WORKER_URL}/update-status`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: userId,
                            userName: userName,
                            isWorking: 1,
                            currentTask: "休憩",
                            startTime: breakStartTime.toISOString(),
                            currentGoal: null
                        })
                    });

                    // 5. ★ここが最重要：止まったタイマーを「休憩」として再始動させる
                    startTimerLoop(); 
                    
                    triggerReservationNotification("休憩開始");
                } catch (e) {
                    console.error("休憩予約実行エラー:", e);
                }

            } else if (dueReservation.action === 'stop') {
                // 帰宅（こちらは止まったままで正解）
                currentTask = null;
                startTime = null;
                localStorage.removeItem("isWorking");
                localStorage.removeItem("currentTask");
                localStorage.removeItem(LOCAL_STATUS_KEY);
                resetClientState();
                await handleStopClick(true);
            }
            
            if (typeof syncReservations === 'function') await syncReservations();
        }
        } // ← 【修正ポイント】この閉じカッコが不足していたためエラーが出ていました

        // --- 通知ロジック ---
        // ★修正: LocalStorageから最新のタスク名を取得（ズレ防止）
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

export async function handleStartClick() {
    // 1. 新しく選択された値を取得
    const taskSelect = document.getElementById("task-select");
    const goalSelect = document.getElementById("goal-select");
    const otherTaskInput = document.getElementById("other-task-input");

    const selectedTask = taskSelect.value === "その他" ? otherTaskInput.value : taskSelect.value;
    const selectedGoalId = goalSelect ? goalSelect.value : null;
    let selectedGoalTitle = goalSelect ? goalSelect.options[goalSelect.selectedIndex]?.text : null;
    
    if (selectedGoalTitle === "工数を選択 (任意)" || selectedGoalTitle === "なし" || !selectedGoalId) {
        selectedGoalTitle = null;
    }

    if (!selectedTask) {
        alert("業務内容を選択または入力してください。");
        return;
    }

    // --- ★追加: 業務変更時の未入力チェック ---
    const isWorking = localStorage.getItem("isWorking") === "1";
    
    // 現在稼働中 且つ 目標が設定されている 且つ 進捗が未入力の場合
    if (isWorking && currentGoalId && !hasContributedToCurrentGoal) {
        const { showConfirmationModal, hideConfirmationModal } = await import("../../components/modal/index.js");
        
        showConfirmationModal(
            `「${currentGoalTitle}」の進捗(件数)が入力されていません。\nこのまま業務を変更しますか？`,
            async () => {
                // OKが押されたらモーダルを閉じて、業務変更を実行
                hideConfirmationModal();
                await executeStartTask(selectedTask, selectedGoalId, selectedGoalTitle);
            },
            hideConfirmationModal // キャンセルなら何もしない
        );
        return; // 一旦処理を抜ける
    }

    // まだ稼働していない、またはチェック不要な場合はそのまま実行
    await executeStartTask(selectedTask, selectedGoalId, selectedGoalTitle);
}

/**
 * 実際の業務開始・変更処理（共通化）
 */
async function executeStartTask(selectedTask, selectedGoalId, selectedGoalTitle) {
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
            // メモリ変数を更新
            currentTask = data.currentTask;
            currentGoalTitle = data.currentGoal;
            currentGoalId = selectedGoalId;
            startTime = new Date(data.startTime);
            
            // 重要: 通知と進捗フラグをリセット
            lastEncouragementTime = 0;
            lastBreakNotificationTime = 0;
            hasContributedToCurrentGoal = false; 

            // LocalStorage を更新
            localStorage.setItem("isWorking", "1");
            localStorage.setItem("currentTask", currentTask);
            localStorage.setItem("currentGoal", currentGoalTitle || "");
            localStorage.setItem("currentGoalId", currentGoalId || "");
            localStorage.setItem("startTime", data.startTime);

            if (changeWarningMessage) changeWarningMessage.classList.add("hidden");

            // --- Firestoreのステータス更新 ---
            try {
                const statusRef = doc(db, "work_status", userId);
                await setDoc(statusRef, {
                    currentTask, 
                    currentGoalId: currentGoalId || null, 
                    currentGoalTitle: currentGoalTitle || null, 
                    currentGoal: currentGoalTitle || null,
                    startTime: data.startTime,
                    isWorking: true, 
                    preBreakTask: preBreakTask || null,
                    userId, userName, onlineStatus: true
                }, { merge: true });
                console.log(`Firestore status synced for ${userId}`);
            } catch (err) {
                console.error("Firestore status sync error:", err);
            }
            // ---------------------------------

            // ★ここから下が抜けていました！★

            // UI更新
            const startBtn = document.getElementById("start-btn");
            if (startBtn) {
                startBtn.classList.remove("animate-pulse", "animate-pulse-scale");
                startBtn.textContent = "業務を変更する";
                startBtn.classList.remove("bg-indigo-600");
                startBtn.classList.add("bg-green-600");
            }

            updateUIForActiveTask();
            startTimerLoop();
            
            // 深夜自動停止タイマーをセット
            setupMidnightTimer();

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
        const { showConfirmationModal, hideConfirmationModal } = await import("../../components/modal/index.js");
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

/**
 * 休憩ボタンが押された時の処理
 */
export async function handleBreakClick(isAuto = false) {
    if (!isAuto) {
        const { cancelAllReservations } = await import("./reservations.js");
        await cancelAllReservations();
    }

    // ★修正: Firebase(getDoc)ではなくLocalStorageから現在の状態を判断
    const isWorking = localStorage.getItem("isWorking") === "1";
    const nowTask = localStorage.getItem("currentTask");

    if (!isWorking) return;

    if (nowTask === "休憩") {
        // --- 休憩から戻る処理 ---
        await stopCurrentTaskCore(false); // 「休憩」のログを記録
        
        // LocalStorageに保存しておいた「休憩前の業務」を読み出す
        let taskToReturnTo = null;
        try {
            const savedPreTask = localStorage.getItem("preBreakTask");
            taskToReturnTo = savedPreTask ? JSON.parse(savedPreTask) : null;
        } catch (e) {
            console.error("休憩前タスクの復元失敗:", e);
        }

        if (taskToReturnTo && taskToReturnTo.task) {
            // 前の業務に戻る
            await executeStartTask(taskToReturnTo.task, taskToReturnTo.goalId, taskToReturnTo.goalTitle);
        } else {
            // 万が一戻り先が不明なら停止状態にする
            await stopCurrentTask(true);
        }
    } else {
        // --- 休憩を開始する処理 ---
        // 1. 休憩前のタスク情報をLocalStorageに退避
        const preTaskData = { 
            task: currentTask, 
            goalId: currentGoalId, 
            goalTitle: currentGoalTitle 
        };
        localStorage.setItem("preBreakTask", JSON.stringify(preTaskData));

        // 2. 今の業務のログを記録
        await stopCurrentTaskCore(false);

        // 3. 「休憩」を開始（UI更新もこの中で行われる）
        await executeStartTask("休憩", null, null);
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

/**
 * D1から最新の予約リストを取得してメモリに同期する
 */
export async function syncReservations() {
    if (!userId) return;
    try {
        const resp = await fetch(`${WORKER_URL}/get-user-reservations?userId=${userId}`);
        if (resp.ok) {
            activeReservations = await resp.json();
            console.log("予約リストを同期しました:", activeReservations);
        }
    } catch (e) {
        console.error("予約同期エラー:", e);
    }
}

window.debugTimer = {
    getStatus: () => ({ currentTask, startTime, isWorking: !!startTime })
};

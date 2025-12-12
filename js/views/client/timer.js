// js/views/client/timer.js - ストップウォッチ機能と状態管理 (リアルタイム監視版)

import { db, userId, userName, allTaskObjects, showView, VIEWS } from "../../main.js";
import { doc, updateDoc, setDoc, addDoc, collection, onSnapshot, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { formatDuration, getJSTDateString } from "../../utils.js";
import { listenForColleagues, stopColleaguesListener } from "./colleagues.js";
import { triggerEncouragementNotification, triggerReservationNotification, triggerBreakNotification } from "../../components/notification.js";
import { userDisplayPreferences } from "../../main.js";

// --- Module State ---
let timerInterval = null;
let statusUnsubscribe = null; // ★追加: 自分のステータス監視用

let startTime = null;
let currentTask = null;
let currentGoalId = null;
let currentGoalTitle = null;
let preBreakTask = null; 
let midnightStopTimer = null; 

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
 * 画面初期化時に呼ばれる関数
 * Firestoreの work_status をリアルタイム監視し、他(Workerなど)からの変更を即座に反映します。
 */
export async function restoreClientState() {
    if (!userId) return;

    // 以前のリスナーがあれば解除
    if (statusUnsubscribe) {
        statusUnsubscribe();
    }

    const statusRef = doc(db, "work_status", userId);

    // ★変更: onSnapshotを使って常に最新の状態を監視する
    statusUnsubscribe = onSnapshot(statusRef, async (docSnap) => {
        if (docSnap.exists() && docSnap.data().isWorking) {
            // --- 稼働中の場合 ---
            const data = docSnap.data();
            const localStartTime = data.startTime ? data.startTime.toDate() : new Date();
            
            // 日付またぎチェック (念のため)
            const now = new Date();
            const startTimeStr = getJSTDateString(localStartTime);
            const todayStr = getJSTDateString(now);

            if (startTimeStr !== todayStr) {
                // 日付が変わっていたら強制退勤処理へ（Workerが失敗していた場合の保険）
                // ただし、ここはループを防ぐため、単純にローカルリセットだけに留めるか、
                // あるいはWorkerに任せる設計にします。今回は表示更新を優先します。
            }

            // 内部変数を最新のDB値で更新
            // (Workerが休憩に切り替えて startTime を更新した場合、ここも更新される)
            startTime = localStartTime;
            currentTask = data.currentTask;
            localStorage.setItem('currentTaskName', currentTask);

            currentGoalId = data.currentGoalId || null;
            currentGoalTitle = data.currentGoalTitle || null;
            preBreakTask = data.preBreakTask || null;
            
            // UIとタイマーを更新
            updateUIForActiveTask();
            startTimerLoop();
            listenForColleagues(currentTask);

        } else {
            // --- 退勤済み（またはデータなし）の場合 ---
            // Workerが退勤処理をした場合もここに来ます
            resetClientState();
        }
    }, (error) => {
        console.error("ステータス監視エラー:", error);
    });
}

/**
 * 画面から離れるときに監視を停止する（必要なら呼ぶ）
 */
export function stopStatusListener() {
    if (statusUnsubscribe) {
        statusUnsubscribe();
        statusUnsubscribe = null;
    }
    stopTimerLoop();
    stopColleaguesListener();
}

function updateUIForActiveTask() {
    if (startBtn) startBtn.textContent = "業務変更";
    
    // タスク名表示
    if (currentTaskDisplay) {
        currentTaskDisplay.textContent = currentGoalTitle
            ? `${currentTask} (${currentGoalTitle})`
            : currentTask;
    }

    // 休憩ボタンの表示切り替え
    if (breakBtn) {
        breakBtn.disabled = false;
        if (currentTask === "休憩") {
            // 現在が休憩中なら「戻る」ボタンに
            breakBtn.textContent = "休憩前の業務に戻る";
            breakBtn.classList.replace("bg-yellow-500", "bg-cyan-600");
            breakBtn.classList.replace("hover:bg-yellow-600", "hover:bg-cyan-700");
        } else {
            // 通常業務中なら「休憩」ボタンに
            breakBtn.textContent = "休憩開始";
            breakBtn.classList.replace("bg-cyan-600", "bg-yellow-500");
            breakBtn.classList.replace("hover:bg-cyan-700", "hover:bg-yellow-600");
        }
    }

    // ドロップダウンの選択状態を同期
    const taskSelect = document.getElementById("task-select");
    const goalSelect = document.getElementById("goal-select");
    
    // UIモジュールを動的に読んで更新
    import("./clientUI.js").then(({ updateTaskDisplaysForSelection, handleGoalSelectionChange }) => {
        if (taskSelect && taskSelect.value !== currentTask) {
            taskSelect.value = currentTask;
            updateTaskDisplaysForSelection(); 
        }
        if (currentGoalId && goalSelect && goalSelect.value !== currentGoalId) {
            goalSelect.value = currentGoalId;
            handleGoalSelectionChange();
        }
    });
}

function resetClientState() {
    stopTimerLoop();
    
    // 変数リセット
    currentTask = null;
    currentGoalId = null;
    currentGoalTitle = null;
    startTime = null;
    preBreakTask = null;
    hasContributedToCurrentGoal = false; 

    // UIリセット
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
    
    // 即時更新
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        updateTimerDisplay();
    }, 1000);
}

function updateTimerDisplay() {
    if (!startTime) return;
    const now = new Date();
    const elapsed = Math.floor((now - startTime) / 1000);
    
    if (timerDisplay) timerDisplay.textContent = formatDuration(elapsed);

    // 休憩中の通知など
    if (currentTask === "休憩" && elapsed > 0 && elapsed % 1800 === 0) {
        triggerBreakNotification(elapsed);
    }
    // 通常業務の通知
    if (userDisplayPreferences && userDisplayPreferences.notificationIntervalMinutes > 0) {
        const intervalSeconds = userDisplayPreferences.notificationIntervalMinutes * 60;
        if (elapsed > 0 && elapsed % intervalSeconds === 0) {
            triggerEncouragementNotification(elapsed, "breather", currentTask);
        }
    }
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
    const statusRef = doc(db, "work_status", userId);
    // FirestoreのデータはonSnapshotで常に最新を持っているため、
    // ここでgetDocする必要性は薄いが、アクション直前の確実なチェックとして残しても良い
    // 今回はローカルの currentTask を信頼してもOKですが、念のためDBを見ます
    
    // ...が、onSnapshotを入れたので、基本的には currentTask 変数で判断可能です。
    
    if (currentTask === "休憩") {
        // End Break (戻る)
        await stopCurrentTask(false);
        // preBreakTask は restoreClientState で読み込まれているはず
        
        if (preBreakTask) {
            await startTask(preBreakTask.task, preBreakTask.goalId, preBreakTask.goalTitle);
        } else {
            // 戻り先がない場合（エラー回避）
            await updateDoc(statusRef, { isWorking: false, currentTask: null });
        }
    } else {
        // Start Break (休憩開始)
        if (currentGoalId && !hasContributedToCurrentGoal) {
            const { showConfirmationModal, hideConfirmationModal } = await import("../../components/modal.js");
            showConfirmationModal(
                `「${currentGoalTitle}」の進捗(件数)が入力されていません。\n休憩に入りますか？`,
                async () => {
                    hideConfirmationModal();
                    // preBreakTask情報は startTask 内ではなく、ここで保存処理が必要だが
                    // startTask("休憩") を呼ぶと、Workerではなくクライアント処理になるため
                    // ここで preBreakTask をセットしてから startTask を呼ぶ
                    preBreakTask = {
                        task: currentTask,
                        goalId: currentGoalId,
                        goalTitle: currentGoalTitle
                    };
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
        await startTask("休憩", null, null);
        if (isAuto) triggerReservationNotification("休憩");
    }
}


// --- Core Logic ---

async function startTask(newTask, newGoalId, newGoalTitle, forcedStartTime = null) {
    if (!userId) return;

    if (midnightStopTimer) {
        clearTimeout(midnightStopTimer);
        midnightStopTimer = null;
    }

    if (currentTask && newTask === currentTask && newGoalId === currentGoalId) {
        return;
    }

    // 以前のタスクがあればログ保存
    if (currentTask && startTime) {
        await stopCurrentTaskCore(false);
    }

    hasContributedToCurrentGoal = false;

    // ※注意: ここでローカル変数を更新しても、直後の setDoc によって onSnapshot が発火し、
    // 再度 restoreClientState 内で更新されます。
    // 無駄な再描画を防ぐため、ここは「DB更新」に専念するのがベターですが、
    // 応答性を良くするためローカルも更新しておきます。
    
    currentTask = newTask;
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

    // onSnapshotが検知して updateUIForActiveTask 等を呼ぶので、ここは明示的に呼ばなくても良いが、
    // ラグを無くすために呼んでもOK
}

async function stopCurrentTask(isLeaving) {
    await stopCurrentTaskCore(isLeaving);
    // isLeaving の場合、DBの isWorking が false になり、onSnapshot が検知して resetClientState します。
}

async function stopCurrentTaskCore(isLeaving, forcedEndTime = null, taskDataOverride = null) {
    if (midnightStopTimer) {
        clearTimeout(midnightStopTimer);
        midnightStopTimer = null;
    }
    // ここではタイマーを止めない（onSnapshot側で管理するため）
    
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

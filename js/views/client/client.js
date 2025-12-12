// js/views/client/client.js

import { handleClockIn, handleClockOut, handleTaskChange, handleBreakStart, handleBreakEnd } from "./clientActions.js";
import { updateTimerDisplay } from "./timer.js";
import { updateGoalOptions, toggleTaskChangeAlert } from "./clientUI.js";

// 状態管理
let currentStatus = null;
let timerInterval = null;

// DOM要素
const taskSelect = document.getElementById("task-select");
const goalSelect = document.getElementById("goal-select");
const clockInBtn = document.getElementById("clock-in-btn");
const clockOutBtn = document.getElementById("clock-out-btn");
const taskChangeBtn = document.getElementById("task-change-btn");
const breakStartBtn = document.getElementById("break-start-btn");
const breakEndBtn = document.getElementById("break-end-btn");
const taskChangeAlert = document.getElementById("task-change-alert");

/**
 * クライアント画面の初期化
 */
export function initializeClientView(status) {
    console.log("Initializing Client View...", status);
    currentStatus = status;
    
    // UIの初期更新（ボタン状態など）
    updateClientUI(status);
    
    // タイマー開始
    startTimer();
}

/**
 * クライアント画面の終了処理
 */
export function cleanupClientView() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

/**
 * ステータス更新時の処理 (main.jsから呼ばれる)
 */
export function updateClientStatus(newStatus) {
    currentStatus = newStatus;
    updateClientUI(newStatus);
}

/**
 * UIの更新
 */
function updateClientUI(status) {
    if (!status) return;

    const isWorking = status.isWorking;
    const isBreak = status.currentTask === "休憩";

    // 1. ボタンの表示制御
    if (clockInBtn) clockInBtn.disabled = isWorking;
    if (clockOutBtn) clockOutBtn.disabled = !isWorking || isBreak; // 休憩中は退勤できない
    if (taskChangeBtn) taskChangeBtn.disabled = !isWorking || isBreak;
    if (breakStartBtn) breakStartBtn.disabled = !isWorking || isBreak;
    if (breakEndBtn) breakEndBtn.disabled = !isBreak; // 休憩中のみ有効

    // ボタンのスタイル（無効時は薄くする等）はCSSまたはTailwindクラスで制御
    // ここではdisabled属性のみ操作

    // 2. プルダウンの同期（現在のタスクを選択状態にする）
    if (taskSelect && status.currentTask && status.currentTask !== "休憩") {
        taskSelect.value = status.currentTask;
        // ゴール選択肢も更新
        updateGoalOptions(status.currentTask);
        
        // ゴールの選択
        if (goalSelect) {
             // currentGoalId は index ではなく ID string の可能性があるため、
             // valueのマッチングを行う
             goalSelect.value = status.currentGoalId || "";
        }
    }
    
    // アラートは初期状態では隠す
    if (taskChangeAlert) taskChangeAlert.classList.add("hidden");
}

/**
 * イベントリスナーの設定
 */
export function setupClientEventListeners() {
    console.log("Setting up Client event listeners...");

    // 打刻系
    clockInBtn?.addEventListener("click", handleClockIn);
    clockOutBtn?.addEventListener("click", handleClockOut);
    breakStartBtn?.addEventListener("click", handleBreakStart);
    breakEndBtn?.addEventListener("click", handleBreakEnd);

    // 業務変更ボタン
    taskChangeBtn?.addEventListener("click", () => {
        const taskName = taskSelect.value;
        const goalId = goalSelect.value;
        handleTaskChange(taskName, goalId);
    });

    // タスクプルダウン変更時
    taskSelect?.addEventListener("change", () => {
        const selectedTask = taskSelect.value;
        updateGoalOptions(selectedTask);

        // ★修正: 現在の業務と同じなら警告を出さない
        checkSelectionChanged();
    });

    // ゴールプルダウン変更時
    goalSelect?.addEventListener("change", () => {
        // ★修正: ゴールが変わった場合もチェック
        checkSelectionChanged();
    });
}

/**
 * 現在の選択状態が、稼働中のステータスと異なるかチェックし、
 * 警告の表示/非表示を切り替える関数
 */
function checkSelectionChanged() {
    if (!currentStatus || !currentStatus.isWorking) return;
    if (!taskChangeAlert) return;

    const selectedTask = taskSelect.value;
    const selectedGoal = goalSelect.value;

    const currentTask = currentStatus.currentTask;
    // currentGoalIdは文字列、selectedGoalも文字列として比較
    // (null/undefined対策で空文字にして比較)
    const currentGoal = currentStatus.currentGoalId || ""; 
    const targetGoal = selectedGoal || "";

    // タスクが一致し、かつ ゴールも一致する場合は「変更なし」とみなす
    // ※ゴールがない業務の場合は targetGoal, currentGoal 共に "" になるはず
    if (selectedTask === currentTask && targetGoal === currentGoal) {
        taskChangeAlert.classList.add("hidden");
    } else {
        taskChangeAlert.classList.remove("hidden");
    }
}

/**
 * タイマー処理
 */
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    // 即時実行
    updateTimerDisplay(currentStatus);

    timerInterval = setInterval(() => {
        updateTimerDisplay(currentStatus);
    }, 1000);
}

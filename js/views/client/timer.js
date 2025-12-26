// js/views/client/timer.js

import { showConfirmationModal, hideConfirmationModal } from "../../components/modal/index.js";
import * as Logic from "./timerLogic.js";
import * as State from "./timerState.js";

// 他のファイルがこれらの関数を使っているため再エクスポート
export const getCurrentTask = State.getCurrentTask;
export const getCurrentGoalId = State.getCurrentGoalId;
export const getIsWorking = State.getIsWorking;
export const getStartTime = State.getStartTime;
export const setHasContributed = State.setHasContributed;
export const getHasContributed = State.getHasContributed;
export const restoreClientState = Logic.restoreClientState;
export const stopStatusListener = Logic.stopTimerLoop;

// --- Action Handlers ---

export async function handleStartClick() {
    const taskSelect = document.getElementById("task-select");
    const goalSelect = document.getElementById("goal-select");
    const otherTaskInput = document.getElementById("other-task-input");

    // 1. タスク名の取得
    const selectedTask = taskSelect.value === "その他" ? otherTaskInput.value : taskSelect.value;

    // 2. 目標IDとタイトルの取得（ここを単純化しました）
    // セレクトボックスの value には ID が入っているはずなので、それをそのまま信用して使います
    let selectedGoalId = goalSelect ? goalSelect.value : null;
    let selectedGoalTitle = goalSelect ? goalSelect.options[goalSelect.selectedIndex]?.text : null;

    // 「工数を選択」などのデフォルト値が選ばれている場合は null 扱いにする
    if (selectedGoalId === "" || selectedGoalTitle === "工数を選択 (任意)" || selectedGoalTitle === "なし") {
        selectedGoalId = null;
        selectedGoalTitle = null;
    }

    // ★重要: もし「タイトルはあるのにIDが空」という異常な状態なら、D1にゴミを送らないようここで止める
    if (selectedGoalTitle && !selectedGoalId) {
        alert("エラー: 目標IDが取得できませんでした。");
        return; 
    }

    if (!selectedTask) {
        alert("業務内容を選択または入力してください。");
        return;
    }

    // --- ここから下は送信フロー ---

    const isWorking = localStorage.getItem("isWorking") === "1";
    
    // 進捗未入力チェック
    if (isWorking && State.getCurrentGoalId() && !State.getHasContributed()) {
        showConfirmationModal(
            `「${State.getCurrentGoalTitle()}」の進捗(件数)が入力されていません。\nこのまま業務を変更しますか？`,
            async () => {
                hideConfirmationModal();
                await Logic.stopCurrentTaskCore(false); 
                // IDをそのまま渡す

console.log("🚀【休憩復帰】D1送信直前ログ:", {
    task: taskToReturnTo.task,       // 正しくは taskToReturnTo の中身
    goalId: taskToReturnTo.goalId,
    title: taskToReturnTo.goalTitle
});                        
                await Logic.executeStartTask(selectedTask, selectedGoalId, selectedGoalTitle);
            },
            hideConfirmationModal
        );
        return; 
    }

    // 業務変更（通常）
    if (isWorking) {
        await Logic.stopCurrentTaskCore(false);
    }

    // IDをそのまま渡す（これがD1への送信命令です）
    await Logic.executeStartTask(selectedTask, selectedGoalId, selectedGoalTitle);
}

export async function handleStopClick(isAuto = false) {
    if (!isAuto) {
        const { cancelAllReservations } = await import("./reservations.js");
        await cancelAllReservations();
    }
    if (!State.getCurrentTask()) return;

    if (State.getCurrentGoalId() && !State.getHasContributed()) {
        showConfirmationModal(
            `「${State.getCurrentGoalTitle()}」の進捗(件数)が入力されていません。\nこのまま終了（帰宅）しますか？`,
            async () => {
                hideConfirmationModal();
                await Logic.stopCurrentTask(true);
            },
            hideConfirmationModal
        );
        return;
    }

    await Logic.stopCurrentTask(true);
}

export async function handleBreakClick(isAuto = false) {
    if (!isAuto) {
        const { cancelAllReservations } = await import("./reservations.js");
        await cancelAllReservations();
    }

    const isWorking = localStorage.getItem("isWorking") === "1";
    const nowTask = localStorage.getItem("currentTask");

    if (!isWorking) return;

    if (nowTask === "休憩") {
        // --- 休憩から戻る ---
        
         await Logic.stopCurrentTaskCore(false); 
        
        let taskToReturnTo = null;
        try {
            const savedPreTask = localStorage.getItem("preBreakTask");
            if (savedPreTask) {
                taskToReturnTo = JSON.parse(savedPreTask);

                // ★修正ポイント: 二重エンコード対策
                // もしパースした結果がまだ「文字列」だったら、もう一回パースしてオブジェクトにする
                if (typeof taskToReturnTo === 'string') {
                    taskToReturnTo = JSON.parse(taskToReturnTo);
                }
            }
        } catch (e) {
            console.error("休憩前タスクの復元失敗:", e);
        }

        // これで taskToReturnTo が正しくオブジェクトになっているはずです
        if (taskToReturnTo && taskToReturnTo.task) {

            console.log("🚀【確認ダイアログ経由】D1送信直前ログ:", {
                    task: selectedTask,
                    goalId: selectedGoalId,    // ← ここに値が入っているか見てください
                    title: selectedGoalTitle
            });
                        
            // executeStartTask が「休憩の終了」と「業務の開始」を両方やってくれます
            await Logic.executeStartTask(taskToReturnTo.task, taskToReturnTo.goalId, taskToReturnTo.goalTitle);
        } else {
            console.warn("休憩前のタスク情報が破損しているため、停止処理を行います。");
            await Logic.stopCurrentTask(true);
        }
    } else {
        
        // --- 休憩を開始する ---

// ▼▼▼ 追加: StateにIDが入っていない場合、画面のプルダウンから強制的に取得する ▼▼▼
        let currentGoalId = State.getCurrentGoalId();
        if (!currentGoalId) {
            const goalSelect = document.getElementById("goal-select");
            if (goalSelect) {
                currentGoalId = goalSelect.value;
                console.log("⚠️ StateからgoalIdが取れないため、画面から取得しました:", currentGoalId);
            }
        }
        
        const preTaskData = { 
            task: State.getCurrentTask(), 
            goalId: currentGoalId, // ★修正: ここを currentGoalId に変更
            goalTitle: State.getCurrentGoalTitle() 
        };
        
        // オブジェクトを文字列化して保存
        localStorage.setItem("preBreakTask", JSON.stringify(preTaskData));
        State.setPreBreakTask(preTaskData);

        await Logic.stopCurrentTaskCore(false); 

        await Logic.executeStartTask("休憩", null, null);
    }
}

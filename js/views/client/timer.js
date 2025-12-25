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

    const isWorking = localStorage.getItem("isWorking") === "1";
    
    if (isWorking && State.getCurrentGoalId() && !State.getHasContributed()) {
        showConfirmationModal(
            `「${State.getCurrentGoalTitle()}」の進捗(件数)が入力されていません。\nこのまま業務を変更しますか？`,
            async () => {
                hideConfirmationModal();
                // 業務変更: 前の業務を終了(ログ保存)してから新しい業務を開始
                await Logic.stopCurrentTaskCore(false); 
                await Logic.executeStartTask(selectedTask, selectedGoalId, selectedGoalTitle);
            },
            hideConfirmationModal
        );
        return; 
    }

    // 業務変更（通常）: 前の業務を終了してから開始
    if (isWorking) {
        await Logic.stopCurrentTaskCore(false);
    }

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
        
        // 【修正】ここにあった stopCurrentTaskCore を削除します
        // await Logic.stopCurrentTaskCore(false); 
        
        let taskToReturnTo = null;
        try {
            const savedPreTask = localStorage.getItem("preBreakTask");
            taskToReturnTo = savedPreTask ? JSON.parse(savedPreTask) : null;
        } catch (e) {
            console.error("休憩前タスクの復元失敗:", e);
        }

        if (taskToReturnTo && taskToReturnTo.task) {
            // executeStartTask が「休憩の終了」と「業務の開始」を両方やってくれます
            await Logic.executeStartTask(taskToReturnTo.task, taskToReturnTo.goalId, taskToReturnTo.goalTitle);
        } else {
            await Logic.stopCurrentTask(true);
        }
    } else {
        // --- 休憩を開始する ---
        const preTaskData = { 
            task: State.getCurrentTask(), 
            goalId: State.getCurrentGoalId(), 
            goalTitle: State.getCurrentGoalTitle() 
        };
        localStorage.setItem("preBreakTask", JSON.stringify(preTaskData));
        State.setPreBreakTask(preTaskData);

        // 【修正】ここも同様に重複する可能性が高いので削除推奨です
        // await Logic.stopCurrentTaskCore(false); 

        await Logic.executeStartTask("休憩", null, null);
    }
}

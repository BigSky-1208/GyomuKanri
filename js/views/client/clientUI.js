// js/views/client/clientUI.js

import { allTaskObjects, userDisplayPreferences, userId, db, escapeHtml } from "../../main.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getCurrentTask, getCurrentGoalId } from "./timer.js";

// ★分割したファイルをインポート
import { injectMessageHistoryButton } from "./messageHistory.js";
import { setupWordOfTheDayListener } from "./statusUI.js";

// ★他のファイルからも使えるように再エクスポート
export * from "./messageHistory.js";
export * from "./statusUI.js";

// --- DOM Elements ---
const taskSelect = document.getElementById("task-select");
const goalSelect = document.getElementById("goal-select");
const goalSelectContainer = document.getElementById("goal-select-container");
const otherTaskContainer = document.getElementById("other-task-container");
const otherTaskInput = document.getElementById("other-task-input");
const taskDescriptionDisplay = document.getElementById("task-description-display");
const startBtn = document.getElementById("start-btn");
const warningMessage = document.getElementById("change-warning-message");
const taskDisplaySettingsList = document.getElementById("task-display-settings-list");
const notificationIntervalInput = document.getElementById("notification-interval-input");

/**
 * 従業員画面のUIセットアップ
 */
export function setupClientUI() {
    renderTaskOptions();
    renderTaskDisplaySettings();
    setupWordOfTheDayListener(); // statusUI.js から
    injectMessageHistoryButton(); // messageHistory.js から
}

/**
 * 業務プルダウンの選択肢を描画
 */
export function renderTaskOptions() {
    if (!taskSelect) return;
    const currentValue = taskSelect.value;
    taskSelect.innerHTML = '<option value="">業務を選択...</option>';

    const hiddenTasks = userDisplayPreferences?.hiddenTasks || [];

    const dropdownTasks = allTaskObjects.filter(
        (task) => task.name !== "休憩" && !hiddenTasks.includes(task.name)
    );

    dropdownTasks.sort((a, b) => a.name.localeCompare(b.name, "ja"));

    dropdownTasks.forEach(
        (task) =>
        (taskSelect.innerHTML += `<option value="${escapeHtml(task.name)}">${escapeHtml(task.name)}</option>`)
    );

    taskSelect.value = currentValue;
    updateTaskDisplaysForSelection();
}

/**
 * 表示設定（チェックボックス、ミニ表示ボタンなど）を描画
 */
export function renderTaskDisplaySettings() {
    if (!taskDisplaySettingsList) return;

    taskDisplaySettingsList.innerHTML = "";

    // 1. ミニ表示ボタンの追加
    const miniDisplayDiv = document.createElement("div");
    miniDisplayDiv.className = "mb-4 border-b pb-4";
    miniDisplayDiv.innerHTML = `
        <div class="flex items-center justify-between">
            <div>
                <span class="font-bold text-gray-700 block text-sm">ミニ表示モード</span>
                <span class="text-xs text-gray-500">常に最前面に小さなタイマーを表示します</span>
            </div>
            <button id="toggle-mini-display-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1 px-3 rounded shadow text-xs transition">
                起動
            </button>
        </div>
    `;
    taskDisplaySettingsList.appendChild(miniDisplayDiv);

    // 2. 業務の表示/非表示設定
    const configurableTasks = allTaskObjects.filter(
        (task) => task.name !== "休憩"
    );

    if (configurableTasks.length === 0) {
        const p = document.createElement("p");
        p.className = "text-sm text-gray-500";
        p.textContent = "設定可能な業務がありません。";
        taskDisplaySettingsList.appendChild(p);
    } else {
        configurableTasks.forEach((task) => {
            const isHidden =
                userDisplayPreferences.hiddenTasks?.includes(task.name) || false;
            const isChecked = !isHidden;

            const label = document.createElement("label");
            label.className =
                "flex items-center p-2 rounded-md hover:bg-gray-100 cursor-pointer";
            label.innerHTML = `
                <input type="checkbox" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-3" data-task-name="${escapeHtml(task.name)}" ${isChecked ? "checked" : ""}>
                <span class="text-gray-700 text-sm">${escapeHtml(task.name)}</span>
            `;

            taskDisplaySettingsList.appendChild(label);
        });
    }

    // 3. 通知間隔設定の初期値を反映
    if (notificationIntervalInput) {
        notificationIntervalInput.value = userDisplayPreferences.notificationIntervalMinutes || 0;
        notificationIntervalInput.onchange = handleNotificationIntervalChange;
    }
}

/**
 * 業務選択変更時の処理
 */
export function handleTaskSelectionChange() {
    updateTaskDisplaysForSelection();
    checkIfWarningIsNeeded();
}

/**
 * 工数選択変更時の処理
 */
export function handleGoalSelectionChange() {
    const selectedTaskName = taskSelect.value;
    const selectedGoalId = goalSelect.value;

    const selectedTask = allTaskObjects.find(
        (t) => t.name === selectedTaskName
    );

    import("./goalProgress.js").then(({ renderSingleGoalDisplay }) => {
        if (selectedTask && selectedGoalId) {
            renderSingleGoalDisplay(selectedTask, selectedGoalId);
        } else {
            const goalProgressContainer = document.getElementById("goal-progress-container");
            if (goalProgressContainer) {
                goalProgressContainer.innerHTML = "";
                goalProgressContainer.classList.add("hidden");
            }
        }
    });

    checkIfWarningIsNeeded();
}

/**
 * 表示設定変更時の処理
 */
export async function handleDisplaySettingChange(event) {
    if (event.target.type !== "checkbox") return;

    const taskName = event.target.dataset.taskName;
    const isChecked = event.target.checked;

    let hiddenTasks = userDisplayPreferences.hiddenTasks || [];

    if (isChecked) {
        hiddenTasks = hiddenTasks.filter((name) => name !== taskName);
    } else {
        if (!hiddenTasks.includes(taskName)) {
            hiddenTasks.push(taskName);
        }
    }

    await updateDisplayPreferences({ hiddenTasks });
    renderTaskOptions(); 
}

// 通知間隔設定の変更ハンドラ
async function handleNotificationIntervalChange(event) {
    const minutes = parseInt(event.target.value, 10);
    if (isNaN(minutes) || minutes < 0) return;

    await updateDisplayPreferences({ notificationIntervalMinutes: minutes });
    console.log(`Notification interval set to ${minutes} minutes.`);
}

async function updateDisplayPreferences(newPrefs) {
    if (!userId) return;
    const prefRef = doc(db, `user_profiles/${userId}/preferences/display`);
    Object.assign(userDisplayPreferences, newPrefs);
    await setDoc(prefRef, newPrefs, { merge: true });
}

/**
 * 選択中の業務に合わせてUI（工数、メモ等）を更新
 */
export function updateTaskDisplaysForSelection() {
    if (!taskSelect || !goalSelect) return;
    
    const selectedTaskName = taskSelect.value;
    
    // UIリセット
    if(otherTaskContainer) otherTaskContainer.classList.add("hidden");
    if(taskDescriptionDisplay) {
        taskDescriptionDisplay.classList.add("hidden");
        taskDescriptionDisplay.innerHTML = "";
    }
    if(goalSelectContainer) goalSelectContainer.classList.add("hidden");
    
    goalSelect.innerHTML = '<option value="">工数を選択 (任意)</option>';

    const goalProgressContainer = document.getElementById("goal-progress-container");
    if (goalProgressContainer) {
        goalProgressContainer.innerHTML = "";
        goalProgressContainer.classList.add("hidden");
    }

    if (!selectedTaskName) return;

    // 「その他」の処理
    if (selectedTaskName === "その他") {
        if(otherTaskContainer) otherTaskContainer.classList.remove("hidden");
        return;
    } else if (selectedTaskName.startsWith("その他")) {
        // DBから復元された値が "その他_XXX" の場合
        if(otherTaskContainer) {
             otherTaskContainer.classList.remove("hidden");
             if(otherTaskInput) otherTaskInput.value = selectedTaskName.replace("その他_", "");
        }
        return;
    }

    const selectedTask = allTaskObjects.find(
        (task) => task.name === selectedTaskName
    );

    if (!selectedTask) return;

    // メモ表示
    if (selectedTask.memo && taskDescriptionDisplay) {
        taskDescriptionDisplay.innerHTML = `<p class="text-sm p-3 bg-gray-100 rounded-lg whitespace-pre-wrap text-gray-600">${escapeHtml(selectedTask.memo)}</p>`;
        taskDescriptionDisplay.classList.remove("hidden");
    }

    // 工数（ゴール）表示
    const activeGoals = (selectedTask.goals || []).filter((g) => !g.isComplete);
    if (activeGoals.length > 0) {
        selectedTask.goals.forEach((goal) => {
            if (!goal.isComplete) {
                const option = document.createElement("option");
                option.value = goal.id || goal.title; // IDがあればID、なければタイトル
                option.textContent = `${escapeHtml(goal.title)} (目標: ${goal.target})`;
                goalSelect.appendChild(option);
            }
        });
        if(goalSelectContainer) goalSelectContainer.classList.remove("hidden");
    }
}

/**
 * 変更警告の表示・非表示を切り替える
 */
export function checkIfWarningIsNeeded() {
    if (!startBtn || !warningMessage) return;

    const currentTask = getCurrentTask();
    
    // 未稼働または休憩中は警告なし
    if (!currentTask || currentTask === "休憩") {
        startBtn.classList.remove("animate-pulse-scale");
        warningMessage.classList.add("hidden");
        return;
    }

    const selectedTask = taskSelect.value;
    const selectedGoal = goalSelect.value;
    
    let currentGoalId = getCurrentGoalId();
    if (currentGoalId === null) currentGoalId = "";
    
    // 文字列として比較
    const isTaskMatch = selectedTask === currentTask;
    const isGoalMatch = String(selectedGoal) === String(currentGoalId);

    // 「その他」の比較ロジック
    let isOtherMatch = false;
    if (currentTask.startsWith("その他") && selectedTask === "その他") {
         // 入力値まで比較
         const inputVal = otherTaskInput ? otherTaskInput.value : "";
         if (currentTask === `その他_${inputVal}`) {
             isOtherMatch = true;
         }
    }

    if ((isTaskMatch && isGoalMatch) || isOtherMatch) {
        // 一致する場合（変更なし）
        startBtn.classList.remove("animate-pulse-scale");
        warningMessage.classList.add("hidden");
    } else {
        // 変更がある場合
        startBtn.classList.add("animate-pulse-scale");
        warningMessage.classList.remove("hidden");
    }
}

// js/views/client/clientUI.js - 従業員画面のUI操作

import { allTaskObjects, userDisplayPreferences, userId, db, escapeHtml } from "../../main.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getCurrentTask, getCurrentGoalId } from "./timer.js";

// --- DOM Elements ---
const taskSelect = document.getElementById("task-select");
const goalSelect = document.getElementById("goal-select");
const goalSelectContainer = document.getElementById("goal-select-container");
const otherTaskContainer = document.getElementById("other-task-container");
const taskDescriptionDisplay = document.getElementById("task-description-display");
const startBtn = document.getElementById("start-btn");
const warningMessage = document.getElementById("change-warning-message");
const taskDisplaySettingsList = document.getElementById("task-display-settings-list");
// ★追加: 通知間隔設定インプット
const notificationIntervalInput = document.getElementById("notification-interval-input");

/**
 * Renders the task options in the dropdown, filtering based on preferences.
 */
export function renderTaskOptions() {
    if (!taskSelect) return;
    const currentValue = taskSelect.value;
    taskSelect.innerHTML = '<option value="">業務を選択...</option>';

    const hiddenTasks = userDisplayPreferences?.hiddenTasks || [];

    const dropdownTasks = allTaskObjects.filter(
        (task) => task.name !== "休憩" && !hiddenTasks.includes(task.name)
    );

    // ソート（名前順、ただし「その他」は最後にしたい等の要件があればここで調整）
    dropdownTasks.sort((a, b) => a.name.localeCompare(b.name, "ja"));

    dropdownTasks.forEach(
        (task) =>
        (taskSelect.innerHTML += `<option value="${escapeHtml(task.name)}">${escapeHtml(task.name)}</option>`)
    );

    // "その他" タスクが存在し、hiddenでないなら追加 (allTaskObjectsに含まれている前提だが、念のため)
    // ここでは allTaskObjects に "その他" が含まれていない場合でも手動で追加するロジックは入れず、
    // allTaskObjects に依存させる。

    taskSelect.value = currentValue;
    updateTaskDisplaysForSelection();
}

/**
 * Renders the checkboxes for task display settings.
 */
// ★追加: ミニ表示ボタンのロジック
export function renderTaskDisplaySettings() {
    const container = document.getElementById("task-display-settings-list");
    if (!container) return;

    // 既存の設定項目（チェックボックスなど）があればそれを維持しつつ、ボタンを追加する形にします
    // もし既存の中身をクリアしているなら以下のままでOK
    
    container.innerHTML = "";

    // 1. ミニ表示ボタンの追加
    const miniDisplayLi = document.createElement("li");
    miniDisplayLi.className = "mb-4 border-b pb-4";
    miniDisplayLi.innerHTML = `
        <div class="flex items-center justify-between">
            <div>
                <span class="font-bold text-gray-700 block">ミニ表示モード</span>
                <span class="text-xs text-gray-500">常に最前面に小さなタイマーを表示します</span>
            </div>
            <button id="toggle-mini-display-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded shadow text-sm transition">
                起動
            </button>
        </div>
    `;
    container.appendChild(miniDisplayLi);

    // ... (以下、既存の表示設定：息抜き通知設定などが続く場合はここに追加)
    // 既存コードにある notificationIntervalMinutes の設定UIなどは消さないように注意してください。
    // もし既存コードが `innerHTML = ""` していたなら、そのロジックをここに統合する必要があります。
    
    // ↓ 既存の「息抜き通知設定」などの再描画コードをここに続けて記述してください
    // （前回のコード内容に基づくと以下のような設定項目がありました）
    import("../../main.js").then(module => {
        const prefs = module.userDisplayPreferences || {};
        
        const settingsLi = document.createElement("li");
        settingsLi.innerHTML = `
             <div class="flex flex-col gap-2">
                <label class="font-bold text-gray-700">息抜き通知の間隔 (分)</label>
                <input type="number" id="notification-interval-input" 
                    class="border rounded p-2 w-full" 
                    min="0" step="10" 
                    placeholder="0で無効 (例: 60)"
                    value="${prefs.notificationIntervalMinutes || 0}">
                <p class="text-xs text-gray-500">※0に設定すると通知しません</p>
             </div>
        `;
        container.appendChild(settingsLi);
    });
}

/**
 * Handles task selection change. Updates goal dropdown and other UI elements.
 */
export function handleTaskSelectionChange() {
    updateTaskDisplaysForSelection();
    checkIfWarningIsNeeded();
}

/**
 * Handles goal selection change. Updates goal details (if any) and warnings.
 */
export function handleGoalSelectionChange() {
    const selectedTaskName = taskSelect.value;
    const selectedGoalId = goalSelect.value;

    const selectedTask = allTaskObjects.find(
        (t) => t.name === selectedTaskName
    );

    // Import dynamically to avoid circular dependency with goalProgress.js
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
 * Handles changes in display setting checkboxes.
 */
export async function handleDisplaySettingChange(event) {
    if (event.target.type !== "checkbox") return;

    const taskName = event.target.dataset.taskName;
    const isChecked = event.target.checked;

    let hiddenTasks = userDisplayPreferences.hiddenTasks || [];

    if (isChecked) {
        // Show task (remove from hidden list)
        hiddenTasks = hiddenTasks.filter((name) => name !== taskName);
    } else {
        // Hide task (add to hidden list)
        if (!hiddenTasks.includes(taskName)) {
            hiddenTasks.push(taskName);
        }
    }

    // Update Firestore
    await updateDisplayPreferences({ hiddenTasks });
    renderTaskOptions(); // Refresh dropdown
}

// ★追加: 通知間隔設定の変更ハンドラ
async function handleNotificationIntervalChange(event) {
    const minutes = parseInt(event.target.value, 10);
    if (isNaN(minutes) || minutes < 0) return;

    await updateDisplayPreferences({ notificationIntervalMinutes: minutes });
    console.log(`Notification interval set to ${minutes} minutes.`);
}

async function updateDisplayPreferences(newPrefs) {
    if (!userId) return;
    const prefRef = doc(db, `user_profiles/${userId}/preferences/display`);
    // userDisplayPreferences ローカル変数も更新しておく（リスナーが来るまでのラグ対策）
    Object.assign(userDisplayPreferences, newPrefs);
    await setDoc(prefRef, newPrefs, { merge: true });
}


/**
 * Updates the UI based on the currently selected task.
 * Shows/hides goal dropdown, memo, "other" input, etc.
 */
export function updateTaskDisplaysForSelection() {
    if (!taskSelect || !goalSelect) return;
    
    const selectedTaskName = taskSelect.value;
    
    // Reset UI
    if(otherTaskContainer) otherTaskContainer.classList.add("hidden");
    if(taskDescriptionDisplay) {
        taskDescriptionDisplay.classList.add("hidden");
        taskDescriptionDisplay.innerHTML = "";
    }
    if(goalSelectContainer) goalSelectContainer.classList.add("hidden");
    
    goalSelect.innerHTML = '<option value="">工数を選択 (任意)</option>';

    // Hide goal progress container when task changes
    const goalProgressContainer = document.getElementById("goal-progress-container");
    if (goalProgressContainer) {
        goalProgressContainer.innerHTML = "";
        goalProgressContainer.classList.add("hidden");
    }

    if (!selectedTaskName) return;

    if (selectedTaskName === "その他") {
        if(otherTaskContainer) otherTaskContainer.classList.remove("hidden");
        return;
    }

    const selectedTask = allTaskObjects.find(
        (task) => task.name === selectedTaskName
    );

    if (!selectedTask) return;

    // Show Memo
    if (selectedTask.memo && taskDescriptionDisplay) {
        taskDescriptionDisplay.innerHTML = `<p class="text-sm p-3 bg-gray-100 rounded-lg whitespace-pre-wrap text-gray-600">${escapeHtml(selectedTask.memo)}</p>`;
        taskDescriptionDisplay.classList.remove("hidden");
    }

    // Show Goals
    const activeGoals = (selectedTask.goals || []).filter((g) => !g.isComplete);
    if (activeGoals.length > 0) {
        activeGoals.forEach((goal) => {
            const option = document.createElement("option");
            option.value = goal.id;
            option.textContent = escapeHtml(goal.title);
            goalSelect.appendChild(option);
        });
        if(goalSelectContainer) goalSelectContainer.classList.remove("hidden");
    }
}

export function checkIfWarningIsNeeded() {
    if (!startBtn || !warningMessage) return;

    const currentTask = getCurrentTask(); // Import getters
    const currentGoalId = getCurrentGoalId();

    if (!currentTask) return;

    const selectedTask = taskSelect.value;
    const selectedGoalId = goalSelect.value === "" ? null : goalSelect.value;

    // Handle "Other" task comparison
    let comparableCurrentTask = currentTask;
    // Assuming "その他_XXX" format for custom tasks, but UI selects "その他"
    // Logic depends on how custom tasks are stored.
    // If simple string match:
    if (currentTask && currentTask.startsWith("その他") && selectedTask === "その他") {
         comparableCurrentTask = "その他"; 
    }

    const isDifferent =
        comparableCurrentTask !== selectedTask || currentGoalId !== selectedGoalId;

    if (isDifferent) {
        startBtn.classList.add("animate-pulse-scale");
        warningMessage.classList.remove("hidden");
    } else {
        startBtn.classList.remove("animate-pulse-scale");
        warningMessage.classList.add("hidden");
    }
}

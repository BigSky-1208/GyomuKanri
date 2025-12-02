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
export function renderTaskDisplaySettings() {
    if (!taskDisplaySettingsList) return;

    const configurableTasks = allTaskObjects.filter(
        (task) => task.name !== "休憩"
    );

    taskDisplaySettingsList.innerHTML = "";

    if (configurableTasks.length === 0) {
        taskDisplaySettingsList.innerHTML =
            '<p class="text-sm text-gray-500">設定可能な業務がありません。</p>';
        return;
    }

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

    // ★追加: 通知間隔設定の初期値を反映
    if (notificationIntervalInput) {
        notificationIntervalInput.value = userDisplayPreferences.notificationIntervalMinutes || 0;
        // イベントリスナーを追加（ここで追加するか、client.jsで追加するかだが、
        // renderのたびに追加されるのを防ぐため、本当は一度だけが良い。
        // 今回はonchange属性を使わず、client.jsのsetupで一括管理したいが、
        // notificationIntervalInputへの参照が必要。
        // client.jsで設定済みであればOKだが、値変更時のハンドラが必要。
        // 簡易的にここでonchangeを設定してしまう。
        notificationIntervalInput.onchange = handleNotificationIntervalChange;
    }
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

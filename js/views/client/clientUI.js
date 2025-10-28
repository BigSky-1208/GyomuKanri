// js/views/client/clientUI.js
import { allTaskObjects, userDisplayPreferences, updateGlobalTaskObjects } from "../../main.js"; // Import global state and config
import { currentTask, currentGoalId, clearTimerInterval } from "./timer.js"; // Import state/functions from timer module
import { renderSingleGoalDisplay } from "./goalProgress.js"; // Import goal display function
import { updateReservationDisplay } from "./reservations.js"; // Import reservation display function
import { stopColleaguesListener } from "./colleagues.js"; // Import colleague listener stop function
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Firestore functions
import { db, userId } from "../../main.js"; // Import Firestore db instance and userId


// --- DOM Element references ---
const timerDisplay = document.getElementById("timer-display");
const currentTaskDisplay = document.getElementById("current-task-display");
const taskSelect = document.getElementById("task-select");
const goalSelect = document.getElementById("goal-select");
const taskMemoInput = document.getElementById("task-memo-input");
const startBtn = document.getElementById("start-btn");
const breakBtn = document.getElementById("break-btn");
const otherTaskContainer = document.getElementById("other-task-container");
const otherTaskInput = document.getElementById("other-task-input");
const taskDescriptionDisplay = document.getElementById("task-description-display");
const goalProgressContainer = document.getElementById("goal-progress-container");
const goalSelectContainer = document.getElementById("goal-select-container");
const changeWarningMessage = document.getElementById("change-warning-message");
const taskDisplaySettingsList = document.getElementById("task-display-settings-list");


/**
 * Resets the client view UI elements to their default (non-working) state.
 */
export function resetClientStateUI() {
    clearTimerInterval(); // Clear timer interval from timer.js

    // Reset task and goal displays
    if (currentTaskDisplay) currentTaskDisplay.textContent = "未開始";
    if (startBtn) startBtn.textContent = "業務開始";
    if (taskMemoInput) taskMemoInput.value = "";

    // Hide optional containers
    if (otherTaskContainer) otherTaskContainer.classList.add("hidden");
    if (otherTaskInput) otherTaskInput.value = "";
    if (goalSelectContainer) goalSelectContainer.classList.add("hidden");
    if (goalProgressContainer) goalProgressContainer.classList.add("hidden");
    if (taskDescriptionDisplay) taskDescriptionDisplay.classList.add("hidden");

    // Stop listening for colleagues (handled in timer.js stop function, but good to ensure here too)
    // stopColleaguesListener();

    // Reset warning indicators
    if (startBtn) startBtn.classList.remove("animate-pulse-scale");
    if (changeWarningMessage) changeWarningMessage.classList.add("hidden");

    // Reset break button state
    updateBreakButton(false); // Update button for non-working state
    if (breakBtn) breakBtn.disabled = true; // Disable break button when not working

    // Reset dropdowns
    if (taskSelect) taskSelect.value = "";
    if (goalSelect) goalSelect.innerHTML = '<option value="">工数を選択 (任意)</option>';

     // Ensure reservation display is also updated to reflect non-working state if necessary
     updateReservationDisplay(); // Call update from reservations.js
     renderTaskDisplaySettings(); // Ensure display settings checkboxes are rendered
}


/**
 * Updates the goal dropdown, task description, and goal progress display
 * based on the currently selected task in the task dropdown.
 */
export function updateTaskDisplaysForSelection() {
    // Ensure elements exist
    if (!taskSelect || !otherTaskContainer || !taskDescriptionDisplay || !goalProgressContainer || !goalSelectContainer || !goalSelect) {
        console.warn("Missing UI elements for task display update.");
        return;
    }

    const selectedTaskName = taskSelect.value;

    // Reset displays before updating
    otherTaskContainer.classList.add("hidden");
    if(otherTaskInput) otherTaskInput.value = ""; // Clear other input specifically
    taskDescriptionDisplay.classList.add("hidden");
    taskDescriptionDisplay.innerHTML = "";
    goalProgressContainer.innerHTML = "";
    goalProgressContainer.classList.add("hidden");
    goalSelectContainer.classList.add("hidden");
    goalSelect.innerHTML = '<option value="">工数を選択 (任意)</option>'; // Reset goal dropdown with default

    // Exit if no task is selected
    if (!selectedTaskName) {
        checkIfWarningIsNeeded();
        return;
    }

    // Handle "Other" task selection
    if (selectedTaskName === "その他") {
        otherTaskContainer.classList.remove("hidden");
        checkIfWarningIsNeeded();
        return; // No description or goals for "Other" meta-task
    }

    // Find the selected task data
    const selectedTask = allTaskObjects.find((task) => task.name === selectedTaskName);

    if (!selectedTask) {
        console.warn("Selected task data not found:", selectedTaskName);
        checkIfWarningIsNeeded();
        return; // Exit if task data not found
    }

    // Display task memo (description) if it exists
    if (selectedTask.memo) {
        taskDescriptionDisplay.innerHTML = `<p class="text-sm p-3 bg-gray-100 rounded-lg whitespace-pre-wrap">${escapeHtml(selectedTask.memo)}</p>`;
        taskDescriptionDisplay.classList.remove("hidden");
    }

    // Populate goal dropdown with active (not completed) goals for this task
    const activeGoals = (selectedTask.goals || []).filter((g) => !g.isComplete);

    if (activeGoals.length > 0) {
        activeGoals.sort((a,b) => (a.title || "").localeCompare(b.title || "", "ja")); // Sort goals by title
        activeGoals.forEach((goal) => {
            const option = document.createElement("option");
            option.value = goal.id;
            option.textContent = goal.title;
            goalSelect.appendChild(option);
        });
        goalSelectContainer.classList.remove("hidden"); // Show goal dropdown
    }

    // Check if a warning needs to be displayed after updating UI
    checkIfWarningIsNeeded();
}

/**
 * Handles changes in the task selection dropdown.
 * Updates related UI elements and clears/updates goal details.
 */
export function handleTaskSelectionChange() {
    updateTaskDisplaysForSelection(); // Update goal dropdown, memo, etc.
    handleGoalSelectionChange(); // Clear or update goal details display
}

/**
 * Handles changes in the goal selection dropdown.
 * Renders the details for the selected goal or clears the display.
 */
export function handleGoalSelectionChange() {
    if(!taskSelect || !goalSelect) return;

    const selectedTaskName = taskSelect.value;
    const selectedGoalId = goalSelect.value;

    const selectedTask = allTaskObjects.find((t) => t.name === selectedTaskName);

    // If a valid task and goal are selected, render the goal progress display
    if (selectedTask && selectedGoalId) {
        renderSingleGoalDisplay(selectedTask, selectedGoalId); // Call function from goalProgress.js
    } else {
        // Otherwise, hide the goal progress container
        if(goalProgressContainer) {
            goalProgressContainer.innerHTML = ""; // Clear content
            goalProgressContainer.classList.add("hidden"); // Hide container
        }
    }

    // Check if warning is needed after goal selection change
    checkIfWarningIsNeeded();
}

/**
 * Checks if the currently selected task/goal in the UI differs from the actively running task/goal.
 * Shows or hides a warning message and applies/removes animation accordingly.
 */
export function checkIfWarningIsNeeded() {
    // Ensure elements exist
    if (!startBtn || !changeWarningMessage || !taskSelect || !goalSelect) {
        // console.warn("Missing elements for warning check.");
        return;
    }

    // If no task is currently running (check state from timer.js), no warning needed
    if (!currentTask || !startTime) { // Use imported state
        startBtn.classList.remove("animate-pulse-scale");
        changeWarningMessage.classList.add("hidden");
        return;
    }

    // Get currently selected values from UI
    let selectedTaskValue = taskSelect.value;
    const selectedGoalId = goalSelect.value === "" ? null : goalSelect.value; // Treat empty string as null

    // Handle "Other" task selection in UI for comparison purposes
    if (selectedTaskValue === "その他") {
        const otherDetail = otherTaskInput?.value.trim();
        // If other detail is provided, use the internal format for comparison
        if (otherDetail) {
            selectedTaskValue = `その他_${otherDetail}`;
        }
        // If other detail is empty, treat selection as incomplete (different from a running task unless currentTask is also just "その他")
        // Note: The timer module should ideally prevent starting "その他" without detail.
    }


    // Compare selected values with currently running task/goal state (imported from timer.js)
    const isDifferent =
        currentTask !== selectedTaskValue || currentGoalId !== selectedGoalId;

    // Show/hide warning and animation based on comparison
    if (isDifferent) {
        startBtn.classList.add("animate-pulse-scale"); // Add pulse animation to button
        changeWarningMessage.classList.remove("hidden"); // Show warning message
    } else {
        startBtn.classList.remove("animate-pulse-scale"); // Remove animation
        changeWarningMessage.classList.add("hidden"); // Hide warning message
    }
}

/**
 * Renders the task options in the main task dropdown, respecting user display preferences.
 */
export function renderTaskOptions() {
    if (!taskSelect) return; // Exit if dropdown doesn't exist

    const currentValue = taskSelect.value; // Preserve current selection if possible
    taskSelect.innerHTML = '<option value="">業務を選択...</option>'; // Clear existing options, add default

    // Get hidden tasks from preferences (default to empty array if undefined/null)
    const hiddenTasks = userDisplayPreferences?.hiddenTasks || [];

    // Filter tasks: exclude "休憩" and tasks marked as hidden in preferences
    const dropdownTasks = allTaskObjects
        .filter(task => task.name !== "休憩" && !hiddenTasks.includes(task.name))
        .sort((a,b) => (a.name || "").localeCompare(b.name || "", "ja")); // Sort alphabetically

    // Add filtered tasks to the dropdown
    dropdownTasks.forEach(task => {
        const option = document.createElement("option");
        option.value = task.name;
        option.textContent = task.name;
        taskSelect.appendChild(option);
    });

    // Add "Other" option manually at the end
    const otherOption = document.createElement("option");
    otherOption.value = "その他";
    otherOption.textContent = "その他...";
    taskSelect.appendChild(otherOption);

    // Try to restore previous selection, otherwise keep default "業務を選択..."
    // Check if the previously selected value exists among the new options
    let valueExists = false;
    for (let i = 0; i < taskSelect.options.length; i++) {
        if (taskSelect.options[i].value === currentValue) {
            valueExists = true;
            break;
        }
    }
    // Restore selection only if the value still exists in the options
    if (valueExists) {
        taskSelect.value = currentValue;
    } else {
        taskSelect.value = ""; // Reset to default if previous selection is no longer valid
    }
}

/**
 * Updates the appearance and text of the break button based on the current state.
 * @param {boolean} isOnBreak - Indicates if the user is currently on break.
 */
export function updateBreakButton(isOnBreak) {
    if (!breakBtn) return;

    breakBtn.disabled = false; // Generally enabled when a task/break is active

    if (isOnBreak) {
        breakBtn.textContent = "休憩前の業務に戻る";
        breakBtn.classList.replace("bg-yellow-500", "bg-cyan-600");
        breakBtn.classList.replace("hover:bg-yellow-600", "hover:bg-cyan-700");
    } else {
        breakBtn.textContent = "休憩開始";
        breakBtn.classList.replace("bg-cyan-600", "bg-yellow-500");
        breakBtn.classList.replace("hover:bg-cyan-700", "hover:bg-yellow-600");
    }
}

// --- Task Display Preferences ---

/**
 * Renders the checkboxes for task display preferences in the settings section.
 */
export function renderTaskDisplaySettings() {
    if (!taskDisplaySettingsList) return;

    // Filter out "休憩" as it shouldn't be hidden/shown via preferences
    const configurableTasks = allTaskObjects
        .filter(task => task.name !== "休憩")
        .sort((a,b) => (a.name || "").localeCompare(b.name || "", "ja")); // Sort for consistent order


    taskDisplaySettingsList.innerHTML = ""; // Clear current list

    if (configurableTasks.length === 0) {
        taskDisplaySettingsList.innerHTML = '<p class="text-sm text-gray-500">設定可能な業務がありません。</p>';
        return;
    }

    configurableTasks.forEach((task) => {
        // Determine if task is currently hidden based on preferences
        const isHidden = userDisplayPreferences?.hiddenTasks?.includes(task.name) || false;
        const isChecked = !isHidden; // Checkbox is checked if the task is *not* hidden

        const label = document.createElement("label");
        label.className = "flex items-center p-2 rounded-md hover:bg-gray-100 cursor-pointer";
        label.innerHTML = `
            <input type="checkbox" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-3 task-display-checkbox" data-task-name="${escapeHtml(task.name)}" ${isChecked ? "checked" : ""}>
            <span class="text-gray-700">${escapeHtml(task.name)}</span>
        `;

        taskDisplaySettingsList.appendChild(label);
    });
}

/**
 * Handles changes to the task display preference checkboxes.
 * Updates the user's preferences in Firestore and re-renders the main task dropdown.
 * @param {Event} event - The change event from the checkbox.
 */
export async function handleDisplaySettingChange(event) {
    if (event.target.type !== "checkbox" || !event.target.classList.contains('task-display-checkbox') || !userId) return;

    const taskName = event.target.dataset.taskName;
    const isChecked = event.target.checked; // Checked means "show", unchecked means "hide"

    // Ensure preferences object and hiddenTasks array exist
    const currentPreferences = { ...(userDisplayPreferences || { hiddenTasks: [] }) };
    if (!currentPreferences.hiddenTasks) {
        currentPreferences.hiddenTasks = [];
    }

    let updatedHiddenTasks;
    if (isChecked) {
        // Show task: remove from hiddenTasks array
        updatedHiddenTasks = currentPreferences.hiddenTasks.filter(name => name !== taskName);
    } else {
        // Hide task: add to hiddenTasks array if not already present
        if (!currentPreferences.hiddenTasks.includes(taskName)) {
            updatedHiddenTasks = [...currentPreferences.hiddenTasks, taskName];
        } else {
            updatedHiddenTasks = currentPreferences.hiddenTasks; // Already hidden, no change needed
        }
    }

    // Only update if the array actually changed
    if (JSON.stringify(updatedHiddenTasks) !== JSON.stringify(currentPreferences.hiddenTasks)) {
        const newPreferences = { ...currentPreferences, hiddenTasks: updatedHiddenTasks };

        // Save updated preferences to Firestore
        const prefRef = doc(db, `user_profiles/${userId}/preferences/display`);
        try {
            await setDoc(prefRef, newPreferences, { merge: true }); // Use merge:true to avoid overwriting other potential preferences
            console.log(`Display preferences updated for task: ${taskName}, Hidden: ${!isChecked}`);

            // Update local state (assuming updateGlobalTaskObjects doesn't handle preferences)
            // Ideally, main.js listener should update userDisplayPreferences,
            // but for immediate UI response, we update it here too.
            // Be cautious about potential race conditions if main.js listener is slow.
             // userDisplayPreferences = newPreferences; // Direct update (use with caution)
             // OR trigger a refresh/re-fetch of preferences if using a more complex state management

             // Re-render the task dropdown immediately to reflect the change
            renderTaskOptions();


        } catch (error) {
            console.error("Error saving display preferences:", error);
            alert("表示設定の保存中にエラーが発生しました。");
            // Revert checkbox state on error
            event.target.checked = !isChecked;
        }
    }
}

/**
 * Simple HTML escaping function to prevent XSS.
 * @param {string} unsafe - The potentially unsafe string.
 * @returns {string} The escaped string.
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

// js/views/client/goalProgress.js
import { db, userId, userName, allTaskObjects, updateGlobalTaskObjects } from "../../main.js"; // Import global state and config, including update function
import { addDoc, collection, doc, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Import Firestore functions
import { showConfirmationModal, hideConfirmationModal } from "../../components/modal.js"; // Import modal functions
import { getJSTDateString } from "../../utils.js"; // Import utility functions

// --- DOM Element references ---
const goalProgressContainer = document.getElementById("goal-progress-container");

/**
 * Renders the detailed progress display for a single selected goal in the client view.
 * @param {object} task - The task object containing the goal.
 * @param {string} goalId - The ID of the goal to display.
 */
export function renderSingleGoalDisplay(task, goalId) {
    if (!goalProgressContainer) return; // Exit if container element not found
    goalProgressContainer.innerHTML = ""; // Clear previous content

    const goal = (task.goals || []).find((g) => g.id === goalId && !g.isComplete);

    if (!goal) {
        goalProgressContainer.classList.add("hidden"); // Hide if goal not found or completed
        return;
    }

    goalProgressContainer.classList.remove("hidden"); // Show container

    // Calculate progress percentage (0-100), ensuring it doesn't exceed 100% visually if current > target
    const progress = goal.target > 0 ? Math.min(100, Math.max(0, (goal.current / goal.target) * 100)) : 0;

    const div = document.createElement("div");
    div.className = "p-3 border rounded-lg mb-4"; // Styling for the goal display box

    div.innerHTML = `
        <div class="font-semibold text-gray-700">${goal.title || "無題の工数"}</div>
        <p class="text-xs text-gray-500 mt-1">納期: ${goal.deadline || "未設定"}</p>
        <p class="text-xs text-gray-500 mt-1">工数納期: ${goal.effortDeadline || "未設定"}</p>
        <p class="text-xs text-gray-600 mt-1 whitespace-pre-wrap">${goal.memo || ""}</p>
        <div class="w-full bg-gray-200 rounded-full h-4 my-2" title="${goal.current || 0} / ${goal.target || 0}">
            <div class="bg-blue-600 h-4 rounded-full text-center text-white text-xs leading-4" style="width: ${progress}%">${Math.round(progress)}%</div>
        </div>
        <div class="text-sm text-right text-gray-500">${goal.current || 0} / ${goal.target || 0}</div>
        <div class="mt-2 flex gap-2">
            <input type="number" class="w-24 p-2 border border-gray-300 rounded-md text-center goal-contribution-input" placeholder="件数" min="0">
            <button class="add-goal-progress-btn bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600">加算</button>
        </div>
    `;

    // Add event listener to the "加算" (Add) button
    const addButton = div.querySelector(".add-goal-progress-btn");
    const contributionInput = div.querySelector(".goal-contribution-input");

    if (addButton && contributionInput) {
        addButton.addEventListener("click", () => {
            handleUpdateGoalProgress(task.name, goal.id, contributionInput);
        });
        // Optional: Add Enter key listener to input
        contributionInput.addEventListener("keypress", (e) => {
            if (e.key === 'Enter') {
                handleUpdateGoalProgress(task.name, goal.id, contributionInput);
            }
        });
    }


    goalProgressContainer.appendChild(div); // Add the goal display to the container
}

/**
 * Handles adding progress (contribution) to a goal.
 * Updates the local state and Firestore, then logs the contribution.
 * @param {string} taskName - The name of the task the goal belongs to.
 * @param {string} goalId - The ID of the goal to update.
 * @param {HTMLInputElement} inputElement - The input element containing the contribution value.
 */
async function handleUpdateGoalProgress(taskName, goalId, inputElement) {
    if (!userId || !userName) {
        console.error("User not identified, cannot update goal progress.");
        showConfirmationModal("ユーザー情報が見つかりません。ページを再読み込みしてください。", hideConfirmationModal);
        return;
    }

    const contribution = parseInt(inputElement.value, 10);

    // Validate input
    if (isNaN(contribution) || contribution <= 0) {
        showConfirmationModal("加算する件数として、0より大きい数値を入力してください。", hideConfirmationModal);
        inputElement.focus(); // Focus the input for correction
        return;
    }

    // Find the task and goal indices in the current global state
    const taskIndex = allTaskObjects.findIndex((t) => t.name === taskName);
    if (taskIndex === -1) {
        console.error("Task not found for goal update:", taskName);
        showConfirmationModal("対象の業務が見つかりません。", hideConfirmationModal);
        return;
    }

    // Ensure the task object has a 'goals' array
    if (!allTaskObjects[taskIndex].goals) {
        console.error("Task object is missing 'goals' array:", taskName);
        showConfirmationModal("工数データの形式が正しくありません。", hideConfirmationModal);
        return;
    }


    const goalIndex = allTaskObjects[taskIndex].goals.findIndex((g) => g.id === goalId);
    if (goalIndex === -1) {
        console.error("Goal not found for goal update:", goalId, "in task", taskName);
        showConfirmationModal("対象の工数が見つかりません。", hideConfirmationModal);
        return; // Exit if goal not found
    }

    // --- Create Updated State (Deep Copy) ---
    // Create a deep copy to avoid direct mutation issues and ensure Firestore gets clean data
    const updatedTasks = JSON.parse(JSON.stringify(allTaskObjects));
    const task = updatedTasks[taskIndex]; // Reference to the task in the copy
    const goal = task.goals[goalIndex]; // Reference to the goal in the copy
    const currentProgress = goal.current || 0; // Ensure current is a number
    goal.current = currentProgress + contribution; // Add contribution to current progress in the copy

    // --- Update Firestore and Log ---
    try {
        // 1. Save the entire updated task list to Firestore's 'settings/tasks' document
        const tasksRef = doc(db, "settings", "tasks");
        // Using updateDoc might be safer if the document structure is complex,
        // but setDoc with merge:false or overwriting is common for list updates.
        // Let's use updateDoc for targeted update of the 'list' field.
        await updateDoc(tasksRef, { list: updatedTasks });
        console.log(`Updated goal ${goalId} progress in Firestore.`);

        // 2. Log the contribution event in `work_logs` collection
        await addDoc(collection(db, `work_logs`), {
            type: "goal", // Differentiate this log from time tracking logs
            userId,
            userName,
            task: taskName,
            goalId: goal.id,
            goalTitle: goal.title,
            contribution: contribution, // Log the amount added in this event
            date: getJSTDateString(new Date()), // Log date of contribution
            startTime: Timestamp.fromDate(new Date()), // Log timestamp of contribution
            // endTime and duration are not applicable here
        });
        console.log(`Logged contribution of ${contribution} for goal ${goalId}.`);

        // 3. Update the global state *after* successful Firestore updates
        updateGlobalTaskObjects(updatedTasks); // Use the function imported from main.js

        // 4. Update UI: Clear input and re-render the goal display
        inputElement.value = ""; // Clear the input field
        renderSingleGoalDisplay(task, goal.id); // Re-render the specific goal display using the updated data

    } catch (error) {
        console.error("Error updating goal progress in Firestore or logging:", error);
        showConfirmationModal("進捗の更新中にエラーが発生しました。しばらくしてから再試行してください。", hideConfirmationModal);
        // Do not update global state or UI on error to maintain consistency
    }
}

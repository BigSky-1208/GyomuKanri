// js/views/taskSettings.js
import { db, allTaskObjects, authLevel, updateGlobalTaskObjects, handleGoBack, showView, VIEWS, allUserLogs, fetchAllUserLogs } from "../../main.js"; // Import global state and functions
import { doc, setDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Import Firestore functions
import { showConfirmationModal, hideConfirmationModal, openGoalModal, showHelpModal } from "../../components/modal.js"; // Import modal functions
import { formatHoursMinutes } from "../utils.js"; // Import utility functions

// --- DOM Element references ---
const taskListEditor = document.getElementById("task-list-editor");
const addTaskForm = document.getElementById("add-task-form");
const newTaskInput = document.getElementById("new-task-input");
const addTaskButton = document.getElementById("add-task-btn");
const backButton = document.getElementById("back-to-selection-from-settings");
const viewProgressButton = document.getElementById("view-progress-from-settings-btn");
const helpButton = document.querySelector('#task-settings-view .help-btn');

/**
 * Initializes the Task Settings view. Renders the task editor.
 */
export function initializeTaskSettingsView() {
    console.log("Initializing Task Settings View...");
    renderTaskEditor(); // Render the main editor content
    if(newTaskInput) newTaskInput.value = ''; // Clear the add task input
}

/**
 * Sets up event listeners for the Task Settings view.
 */
export function setupTaskSettingsEventListeners() {
    console.log("Setting up Task Settings event listeners...");
    addTaskButton?.addEventListener("click", handleAddTask);
    // Use event delegation for buttons within the dynamic list
    taskListEditor?.addEventListener("click", handleTaskEditorClick);
    backButton?.addEventListener("click", handleGoBack); // Use global go back handler

    viewProgressButton?.addEventListener('click', () => {
         // Set read-only flag to false when navigating from settings
         window.isProgressViewReadOnly = false; // TODO: Refactor global state if needed
         showView(VIEWS.PROGRESS);
    });

     helpButton?.addEventListener('click', () => showHelpModal('taskSettings'));

     // Optional: Add Enter key listener to add task input
     newTaskInput?.addEventListener('keypress', (event) => {
         if (event.key === 'Enter') {
             handleAddTask();
         }
     });

    console.log("Task Settings event listeners set up complete.");
}

/**
 * Renders the task editor list based on the global `allTaskObjects`.
 * Adjusts UI elements based on the current `authLevel`.
 */
function renderTaskEditor() {
    if (!taskListEditor || !addTaskForm) {
        console.error("Task editor elements not found.");
        return;
    }

    // Show/Hide Add Task form based on admin privileges
    if (authLevel === "admin") {
        addTaskForm.style.display = "flex";
    } else {
        addTaskForm.style.display = "none";
    }

    taskListEditor.innerHTML = ""; // Clear existing editor content

    // Sort tasks alphabetically (Japanese locale), keeping "休憩" at the end if desired
    const sortedTasks = [...allTaskObjects].sort((a, b) => {
         if (a.name === "休憩") return 1; // "休憩" always comes last
         if (b.name === "休憩") return -1;
        return (a.name || "").localeCompare(b.name || "", "ja");
    });


    if (sortedTasks.length === 0) {
        taskListEditor.innerHTML = '<p class="text-gray-500 p-4">業務が登録されていません。</p>';
        return;
    }


    sortedTasks.forEach((task) => {
        const div = document.createElement("div");
        div.className = "p-4 bg-gray-100 rounded-lg shadow-sm mb-4 task-item"; // Added mb-4 and task-item class
        div.dataset.taskName = task.name; // Add task name to dataset for easier selection

        // --- Task Header (Name and Delete Button) ---
        // Delete button only shown to admins and not for "休憩" task
        const deleteButtonHtml = (authLevel === "admin" && task.name !== "休憩")
            ? `<button class="delete-task-btn bg-red-500 text-white text-xs font-bold py-1 px-2 rounded-full hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400" data-task-name="${escapeHtml(task.name)}" title="業務「${escapeHtml(task.name)}」を削除">削除</button>`
            : "";

        // --- Memo Input ---
        // Memo editing disabled for "休憩" task
        const memoInputHtml = `
            <div class="mt-2">
                <label for="memo-${escapeHtml(task.name)}" class="block text-sm font-medium text-gray-600 mb-1">業務メモ:</label>
                <input type="text" id="memo-${escapeHtml(task.name)}" value="${escapeHtml(task.memo || "")}" placeholder="業務の補足情報 (例: 定例会議用の資料)" class="task-memo-editor w-full p-1 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500" ${task.name === "休憩" ? 'disabled' : ''}>
            </div>
        `;

        // --- Save Memo Button ---
        // Save button disabled for "休憩" task
        const saveMemoButtonHtml = task.name !== "休憩" ? `
            <div class="text-right mt-2">
                <button class="save-task-btn bg-blue-500 text-white text-xs font-bold py-1 px-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400" data-task-name="${escapeHtml(task.name)}">メモを保存</button>
            </div>
        ` : '';

        // --- Add Goal Button ---
        // Add goal button hidden for "休憩" task
        const addGoalButtonHtml = task.name !== "休憩" ? `
            <div class="mt-3 border-t pt-3">
                <button class="add-goal-btn bg-green-500 text-white text-xs font-bold py-1 px-3 rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400" data-task-name="${escapeHtml(task.name)}">この業務に工数を追加 +</button>
            </div>
        ` : '<div class="mt-3 border-t pt-3"><p class="text-xs text-gray-500">「休憩」には工数を追加できません。</p></div>';

        // --- Members List Toggle ---
        const membersToggleHtml = `
             <div class="mt-3 border-t pt-3">
                 <button class="toggle-members-btn text-sm font-semibold text-gray-600 hover:text-blue-600 focus:outline-none" data-task-name="${escapeHtml(task.name)}">
                     担当者別 合計時間 [+]
                 </button>
                 <div class="members-list-container hidden mt-2 pl-4 border-l-2 border-gray-200 space-y-1 text-sm">
                     <!-- Member list loads here -->
                     <p class="text-gray-400">読み込み中...</p>
                 </div>
             </div>
        `;


        // Combine all parts
        div.innerHTML = `
            <div class="flex justify-between items-center">
                <span class="font-semibold text-lg text-gray-800">${escapeHtml(task.name)}</span>
                ${deleteButtonHtml}
            </div>
            ${memoInputHtml}
            ${saveMemoButtonHtml}
            ${addGoalButtonHtml}
            ${membersToggleHtml}
        `;
        taskListEditor.appendChild(div);
    });
}

/**
 * Handles clicks within the task editor list using event delegation.
 * @param {Event} event - The click event object.
 */
async function handleTaskEditorClick(event) {
    const target = event.target;
    const taskItem = target.closest('.task-item'); // Find parent task item
    const taskName = taskItem?.dataset.taskName; // Get task name from parent

    if (!taskName) return; // Exit if click wasn't within a task item or on a button with data

    // --- Button Actions ---
    if (target.classList.contains("delete-task-btn") && authLevel === "admin") {
        handleDeleteTask(taskName);
    } else if (target.classList.contains("save-task-btn")) {
        handleSaveTaskMemo(taskName, taskItem); // Pass taskItem for easier input finding
    } else if (target.classList.contains("add-goal-btn")) {
        openGoalModal("add", taskName); // From modal.js
    } else if (target.classList.contains("toggle-members-btn")) {
        await toggleMembersList(target, taskName); // Make async for log fetching
    }
}

/**
 * Handles adding a new task.
 */
async function handleAddTask() {
    if (!newTaskInput) return;
    const newTaskName = newTaskInput.value.trim();

    // Basic validation
    if (!newTaskName) {
        alert("業務名を入力してください。");
        newTaskInput.focus();
        return;
    }
    if (newTaskName === "休憩") {
        alert("「休憩」は特別なタスク名のため追加できません。");
         newTaskInput.value = "";
        return;
    }
     if (/\s/.test(newTaskName)) { // Check for whitespace
         alert("業務名に空白は使用できません。");
         newTaskInput.focus();
         return;
     }

    // Check if task name already exists (case-sensitive)
    if (allTaskObjects.some((t) => t.name === newTaskName)) {
        alert(`業務「${escapeHtml(newTaskName)}」は既に追加されています。`);
        newTaskInput.select();
        return;
    }

    // Add new task object to the local state
    const newTask = { name: newTaskName, memo: "", goals: [] };
    const updatedTasks = [...allTaskObjects, newTask];

    // Save updated list to Firestore
    try {
        await saveAllTasksToFirestore(updatedTasks);
        console.log(`Task "${newTaskName}" added successfully.`);
        newTaskInput.value = ""; // Clear input on success
        // The Firestore listener in main.js/firebase.js should trigger updateGlobalTaskObjects and re-render.
        // If not, manually call:
        // updateGlobalTaskObjects(updatedTasks);
        // renderTaskEditor();
    } catch (error) {
         console.error("Error adding task:", error);
         alert("業務の追加中にエラーが発生しました。");
    }

}

/**
 * Handles saving the memo for a specific task.
 * @param {string} taskName - The name of the task to update.
 * @param {HTMLElement} taskItemElement - The parent div element of the task being edited.
 */
async function handleSaveTaskMemo(taskName, taskItemElement) {
    const memoInput = taskItemElement?.querySelector(".task-memo-editor");
    if (!memoInput) {
         console.error("Memo input not found for task:", taskName);
         return;
    }
    const newMemo = memoInput.value.trim();

    // Find task index
    const taskIndex = allTaskObjects.findIndex((task) => task.name === taskName);
    if (taskIndex === -1) {
         console.error("Task not found for saving memo:", taskName);
         return;
    }

     // Only update if memo changed
     if (allTaskObjects[taskIndex].memo === newMemo) {
         console.log("Memo unchanged for task:", taskName);
         // Optionally provide feedback that no changes were made
         // alert("メモに変更はありませんでした。");
         return;
     }


    // Create updated tasks list (deep copy recommended if goals exist)
    const updatedTasks = JSON.parse(JSON.stringify(allTaskObjects)); // Deep copy
    updatedTasks[taskIndex].memo = newMemo; // Update memo in the copied array

    // Save updated list to Firestore
    try {
        await saveAllTasksToFirestore(updatedTasks);
        console.log(`Memo saved for task "${taskName}".`);
         // Update global state *after* successful save
         updateGlobalTaskObjects(updatedTasks);
         // Optionally provide success feedback
         alert(`業務「${escapeHtml(taskName)}」のメモを保存しました。`);
         // Re-rendering might happen via listener, or call renderTaskEditor() if needed.
    } catch(error) {
         console.error("Error saving task memo:", error);
         alert("メモの保存中にエラーが発生しました。");
         // Optionally revert input value on error
         // memoInput.value = allTaskObjects[taskIndex].memo || "";
    }
}

/**
 * Handles deleting a task after confirmation.
 * @param {string} taskNameToDelete - The name of the task to delete.
 */
function handleDeleteTask(taskNameToDelete) {
    if (!taskNameToDelete || taskNameToDelete === "休憩") return; // Cannot delete "休憩"

    showConfirmationModal(
        `業務「${escapeHtml(taskNameToDelete)}」を削除しますか？\n\nこの業務に紐づく工数も全て削除されます。\n（関連する業務ログは削除されません）\n\nこの操作は元に戻せません。`,
        async () => {
            hideConfirmationModal(); // Hide modal immediately

            // Filter out the task to delete
            const updatedTasks = allTaskObjects.filter(
                (task) => task.name !== taskNameToDelete
            );

            // Save updated list to Firestore
             try {
                await saveAllTasksToFirestore(updatedTasks);
                console.log(`Task "${taskNameToDelete}" deleted successfully.`);
                 // Update global state *after* successful save
                 updateGlobalTaskObjects(updatedTasks);
                 renderTaskEditor(); // Re-render the editor immediately
                 alert(`業務「${escapeHtml(taskNameToDelete)}」を削除しました。`);

            } catch(error) {
                 console.error("Error deleting task:", error);
                 alert("業務の削除中にエラーが発生しました。");
            }

        },
        () => {
             console.log(`Deletion of task "${taskNameToDelete}" cancelled.`);
        }
    );
}

/**
 * Toggles the visibility of the members list for a task and fetches/renders the data.
 * @param {HTMLElement} button - The button element that was clicked.
 * @param {string} taskName - The name of the task.
 */
async function toggleMembersList(button, taskName) {
    const container = button.nextElementSibling; // The div containing the list
    if (!container) return;

    const isHidden = container.classList.contains("hidden");

    if (isHidden) {
        // --- Show List ---
        button.textContent = "担当者別 合計時間 [-]";
        container.innerHTML = '<p class="text-gray-400">集計中...</p>'; // Loading indicator
        container.classList.remove("hidden");

        // Fetch logs ONLY for this task if allUserLogs isn't fresh enough or too large
        // Option 1: Use globally fetched logs (simpler if fresh)
        // await fetchAllUserLogs(); // Ensure global logs are up-to-date
        // const logsForTask = allUserLogs.filter(log => log.task === taskName && log.type !== 'goal' && log.userName);

        // Option 2: Query Firestore specifically for this task (more targeted)
         let logsForTask = [];
         try {
             const logsQuery = query(
                 collection(db, "work_logs"),
                 where("task", "==", taskName)
                 // Optionally add date range filters if needed
             );
             const logsSnapshot = await getDocs(logsQuery);
             logsForTask = logsSnapshot.docs
                 .map((doc) => doc.data())
                 .filter((log) => log.type !== "goal" && log.userName); // Filter out goal logs and logs without username
         } catch (error) {
             console.error(`Error fetching logs for task ${taskName}:`, error);
             container.innerHTML = '<p class="text-red-500">時間データの取得エラー</p>';
             return; // Stop processing on error
         }


        // Aggregate durations by user
        const memberSummary = logsForTask.reduce((acc, log) => {
            if (!acc[log.userName]) {
                acc[log.userName] = 0;
            }
            acc[log.userName] += (log.duration || 0);
            return acc;
        }, {});

        // Sort members by total duration (descending)
        const sortedMembers = Object.entries(memberSummary)
            .filter(([, duration]) => duration > 0) // Only show members with time > 0
            .sort((a, b) => b[1] - a[1]); // Sort by duration descending

        // Render the list
        if (sortedMembers.length > 0) {
            container.innerHTML = sortedMembers
                .map(
                    ([name, duration]) =>
                        `<div class="flex justify-between hover:bg-gray-200 px-1 rounded"><span>${escapeHtml(name)}</span><span class="font-mono">${formatHoursMinutes(duration)}</span></div>`
                )
                .join("");
        } else {
            container.innerHTML = '<p class="text-gray-500">この業務の稼働記録はまだありません。</p>';
        }

    } else {
        // --- Hide List ---
        button.textContent = "担当者別 合計時間 [+]";
        container.classList.add("hidden");
        // No need to clear innerHTML, it will be replaced on next toggle
    }
}

/**
 * Saves the entire list of tasks (and their goals) to Firestore.
 * @param {Array} tasksToSave - The array of task objects to save.
 */
async function saveAllTasksToFirestore(tasksToSave) {
    if (!tasksToSave) {
         console.error("Attempted to save undefined tasks list.");
         throw new Error("Invalid task list provided for saving."); // Throw error to indicate failure
    }
    const tasksRef = doc(db, "settings", "tasks");
    // Ensure goals are properly formatted before saving (e.g., Timestamps if needed)
    // The current structure seems to use date strings which is fine for Firestore.
    // If Timestamps were used, conversion logic would be needed here.
    await setDoc(tasksRef, { list: tasksToSave }); // Overwrite the entire list
}

/**
 * Simple HTML escaping function to prevent XSS.
 * @param {string | null | undefined} unsafe - The potentially unsafe string.
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

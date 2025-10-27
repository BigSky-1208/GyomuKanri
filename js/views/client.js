// js/views/client.js
import { db, userId, userName, allTaskObjects, userDisplayPreferences } from "../main.js"; // Import global state and config
import { addDoc, collection, doc, getDoc, setDoc, Timestamp, updateDoc, onSnapshot, query, where, writeBatch, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Import Firestore functions
import { formatDuration, getJSTDateString } from "../utils.js"; // Import utility functions
import { showConfirmationModal, hideConfirmationModal, openBreakReservationModal, breakReservationModal } from "../components/modal.js"; // Import modal functions

// Client view specific state
let timerInterval = null;
let currentTask = null;
let currentGoalId = null;
let currentGoalTitle = null;
let startTime = null;
let preBreakTask = null; // Store task before break
let colleaguesListenerUnsubscribe = null; // Unsubscribe function for colleague listener
let midnightStopTimer = null; // Timer for automatic stop at midnight
let reservationTimers = []; // Holds active setTimeout IDs for reservations
let userReservations = []; // Holds reservations from Firestore
let reservationsUnsubscribe = null; // Firestore listener for reservations

// DOM Element references specific to client view
const timerDisplay = document.getElementById("timer-display");
const currentTaskDisplay = document.getElementById("current-task-display");
const taskSelect = document.getElementById("task-select");
const goalSelect = document.getElementById("goal-select");
const taskMemoInput = document.getElementById("task-memo-input");
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const breakBtn = document.getElementById("break-btn");
const otherTaskContainer = document.getElementById("other-task-container");
const otherTaskInput = document.getElementById("other-task-input");
const taskDescriptionDisplay = document.getElementById("task-description-display");
const goalProgressContainer = document.getElementById("goal-progress-container");
const goalSelectContainer = document.getElementById("goal-select-container");
const changeWarningMessage = document.getElementById("change-warning-message");
const colleaguesContainer = document.getElementById("colleagues-on-task-container");
const colleaguesList = document.getElementById("colleagues-list");
const tomuraStatusDisplay = document.getElementById("tomura-status-display");
const tomuraStatusText = document.getElementById("tomura-status-text");

// --- Client View Initialization and State Management ---

// Restore client state (e.g., running timer) when switching back to this view
export async function restoreClientState() {
    if (!userId) return; // Exit if user ID is not available
    listenForUserReservations(); // Start listening for reservations
    renderTaskOptions(); // Render task options based on preferences
    listenForTomuraStatus(); // Update Tomura's status display

    const statusRef = doc(db, "work_status", userId);
    try {
        const docSnap = await getDoc(statusRef);

        if (docSnap.exists() && docSnap.data().isWorking) {
            const data = docSnap.data();
            const localStartTime = data.startTime.toDate();
            const now = new Date();

            const startTimeStr = getJSTDateString(localStartTime);
            const todayStr = getJSTDateString(now);

            // Check if the timer was started on a previous day
            if (startTimeStr !== todayStr) {
                // If the start date is not today, automatically stop the task at the end of the start day
                const endOfStartTimeDay = new Date(localStartTime);
                endOfStartTimeDay.setHours(23, 59, 59, 999);

                // Stop the task, marking it as ended at the end of the previous day
                await stopCurrentTask(true, endOfStartTimeDay, {
                    task: data.currentTask,
                    goalId: data.currentGoalId,
                    goalTitle: data.currentGoalTitle,
                    startTime: localStartTime,
                    memo: "（自動退勤処理）", // Add a note indicating automatic stop
                });
                // Set a flag indicating the user needs to correct the checkout time
                await updateDoc(statusRef, { needsCheckoutCorrection: true });
                 // Show a modal to inform the user about the automatic checkout
                showConfirmationModal(
                    "前回の退勤が自動処理されました。正しい退勤時刻を「退勤忘れを修正」ボタンから登録してください。",
                    hideConfirmationModal
                );
                resetClientStateUI(); // Reset the UI to the default state
                return; // Stop further processing for this state restoration
            }

            // Restore state if the timer was started today
            startTime = localStartTime;
            currentTask = data.currentTask;
            currentGoalId = data.currentGoalId || null;
            currentGoalTitle = data.currentGoalTitle || null;
            preBreakTask = data.preBreakTask || null; // Restore pre-break task info

            // Update UI elements to reflect the restored state
            if (taskSelect) {
                // Set the task dropdown to the current task
                taskSelect.value = currentTask.startsWith("その他_") ? "その他" : currentTask;
                 // If it's an "Other" task, show the input field and populate it
                if (currentTask.startsWith("その他_")) {
                    otherTaskContainer.classList.remove("hidden");
                    otherTaskInput.value = currentTask.substring(4); // Remove "その他_" prefix
                } else {
                    otherTaskContainer.classList.add("hidden");
                    otherTaskInput.value = "";
                }
                updateTaskDisplaysForSelection(); // Update goal dropdown and memo display

                // Select the current goal in the dropdown if applicable
                if (currentGoalId && goalSelect) {
                    goalSelect.value = currentGoalId;
                     // Trigger update for goal details display
                    handleGoalSelectionChange();
                }
            }

            // Update button texts and styles
            startBtn.textContent = "業務変更"; // Change button text from "業務開始"
            currentTaskDisplay.textContent = currentGoalTitle
                ? `${currentTask} (${currentGoalTitle})`
                : currentTask; // Display current task (with goal title if applicable)

            breakBtn.disabled = false; // Enable the break button
             // Adjust break button text and style based on whether currently on break
            if (currentTask === "休憩") {
                breakBtn.textContent = "休憩前の業務に戻る";
                breakBtn.classList.replace("bg-yellow-500", "bg-cyan-600");
                breakBtn.classList.replace("hover:bg-yellow-600", "hover:bg-cyan-700");
            } else {
                breakBtn.textContent = "休憩開始";
                breakBtn.classList.replace("bg-cyan-600", "bg-yellow-500");
                breakBtn.classList.replace("hover:bg-cyan-700", "hover:bg-yellow-600");
            }

            // Restart the timer display interval
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                const elapsed = Math.floor((new Date() - startTime) / 1000);
                if (timerDisplay) timerDisplay.textContent = formatDuration(elapsed);
            }, 1000);

             // Start listening for colleagues working on the same task
            listenForColleagues(currentTask);
             // Set up the automatic midnight stop timer
            setupMidnightStopTimer();

        } else {
            // If Firestore shows not working, ensure UI is reset
            resetClientStateUI();
        }
    } catch (error) {
        console.error("Error restoring client state:", error);
        resetClientStateUI(); // Reset UI in case of error
    }
     // Process any pending reservations immediately
    processReservations();
}


// Reset client state variables and UI elements
export function resetClientStateUI() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    if (midnightStopTimer) clearTimeout(midnightStopTimer);
    midnightStopTimer = null;

    currentTask = null;
    currentGoalId = null;
    currentGoalTitle = null;
    startTime = null;
    preBreakTask = null;

    if (timerDisplay) timerDisplay.textContent = "00:00:00";
    if (currentTaskDisplay) currentTaskDisplay.textContent = "未開始";
    if (startBtn) startBtn.textContent = "業務開始";
    if (taskMemoInput) taskMemoInput.value = "";
    if (otherTaskContainer) otherTaskContainer.classList.add("hidden");
    if (otherTaskInput) otherTaskInput.value = "";
    if (goalSelectContainer) goalSelectContainer.classList.add("hidden");
    if (goalProgressContainer) goalProgressContainer.classList.add("hidden");
    if (taskDescriptionDisplay) taskDescriptionDisplay.classList.add("hidden");


    stopColleaguesListener(); // Stop listening for colleagues

    if (startBtn) startBtn.classList.remove("animate-pulse-scale"); // Remove warning animation
    if (changeWarningMessage) changeWarningMessage.classList.add("hidden"); // Hide warning message

    if (breakBtn) {
        breakBtn.textContent = "休憩開始";
        breakBtn.disabled = true; // Disable break button when not working
        breakBtn.classList.remove("bg-cyan-600", "hover:bg-cyan-700");
        breakBtn.classList.add("bg-yellow-500", "hover:bg-yellow-600");
    }

    // Reset dropdowns if they exist
    if (taskSelect) taskSelect.value = "";
    if (goalSelect) goalSelect.innerHTML = '<option value="">工数を選択 (任意)</option>';

}


// --- Task Start/Stop/Break Logic ---

// Handle starting or changing a task
export async function handleStart() {
    let newTask = taskSelect.value;
    let newGoalId = goalSelect.value;
    let newGoalTitle = newGoalId ? goalSelect.options[goalSelect.selectedIndex].text : null;

    // Handle "Other" task input
    if (newTask === "その他") {
        const otherDetail = otherTaskInput.value.trim();
        if (!otherDetail) {
            showConfirmationModal("具体的な業務内容を入力してください。", hideConfirmationModal);
            return;
        }
        // Prepend "その他_" to distinguish it internally, but display without prefix
        newTask = `その他_${otherDetail}`;
         // "Other" tasks don't have goals associated in the dropdown
        newGoalId = null;
        newGoalTitle = null;
    }


    if (!newTask) {
        showConfirmationModal("業務を選択してください。", hideConfirmationModal);
        return;
    }

    // Prevent starting "休憩" directly using this button
    if (newTask === "休憩") {
        showConfirmationModal("休憩は「休憩開始」ボタンを使用してください。", hideConfirmationModal);
        taskSelect.value = currentTask || ""; // Revert selection
        return;
    }

    // Start the new task
    await startTask(newTask, newGoalId, newGoalTitle);
}

// Core function to start a task timer and update status
async function startTask(newTask, newGoalId, newGoalTitle, forcedStartTime = null) {
    if (!userId) return; // Exit if user ID is not available

     // Clear any existing midnight timer before starting a new task
    if (midnightStopTimer) {
        clearTimeout(midnightStopTimer);
        midnightStopTimer = null;
    }

     // --- Determine the actual task name to log and display ---
    let taskNameToLog = newTask;
    let taskNameToDisplay = newTask;
    if (newTask.startsWith("その他_")) {
        taskNameToDisplay = newTask.substring(4); // Remove prefix for display
    } else if (newTask === "その他" && otherTaskInput.value.trim()) {
         // This case might happen if user selects "その他" then immediately starts without blurring input
        taskNameToLog = `その他_${otherTaskInput.value.trim()}`;
        taskNameToDisplay = otherTaskInput.value.trim();
    }
     // Don't restart if the effective task and goal are the same
    if (
        currentTask &&
        taskNameToLog === currentTask &&
        (newGoalId || null) === (currentGoalId || null) // Compare nulls properly
    ) {
        // If only the "Other" description changed, just update the display and status
        if (taskNameToLog.startsWith("その他_") && taskNameToDisplay !== currentTaskDisplay.textContent) {
             currentTaskDisplay.textContent = taskNameToDisplay; // Update display immediately
             const statusRef = doc(db, `work_status`, userId);
             await updateDoc(statusRef, { currentTask: taskNameToLog }); // Update Firestore
        }
        checkIfWarningIsNeeded(); // Remove warning if selection matches now
        return; // No need to stop/start timer
    }


    // Stop the current task before starting the new one
    if (currentTask && startTime) {
        await stopCurrentTask(false); // `false` indicates it's not the final stop (leaving work)
    }

    // Store the previous task details if starting a break
    if (newTask === "休憩" && currentTask !== "休憩" && currentTask) {
        preBreakTask = {
            task: currentTask, // Store the task name logged before break
            goalId: currentGoalId,
            goalTitle: currentGoalTitle,
        };
    } else if (newTask !== "休憩") {
        preBreakTask = null; // Clear pre-break task if starting a regular task
    }

    // Update global state variables for the new task
    currentTask = taskNameToLog; // Use the internal name (e.g., "その他_detail")
    currentGoalId = newGoalId || null;
    currentGoalTitle = newGoalTitle || null;
    startTime = forcedStartTime || new Date(); // Use provided start time or current time

     // Set up automatic stop at midnight
    setupMidnightStopTimer();


    // --- Update UI elements (only if the client view is active) ---
     if (document.getElementById('client-view').classList.contains('active-view')) {
        startBtn.classList.remove("animate-pulse-scale"); // Remove warning animation
        changeWarningMessage.classList.add("hidden"); // Hide warning message
        startBtn.textContent = "業務変更"; // Update button text
         // Update the display for the current task
        currentTaskDisplay.textContent = currentGoalTitle
            ? `${taskNameToDisplay} (${currentGoalTitle})` // Display without "その他_" prefix
            : taskNameToDisplay;

        breakBtn.disabled = false; // Enable the break button
        // Update break button text and style
        if (currentTask === "休憩") {
            breakBtn.textContent = "休憩前の業務に戻る";
            breakBtn.classList.replace("bg-yellow-500", "bg-cyan-600");
            breakBtn.classList.replace("hover:bg-yellow-600", "hover:bg-cyan-700");
        } else {
            breakBtn.textContent = "休憩開始";
            breakBtn.classList.replace("bg-cyan-600", "bg-yellow-500");
            breakBtn.classList.replace("hover:bg-cyan-700", "hover:bg-yellow-600");
        }

         // Start/Restart the timer display interval
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (startTime) { // Ensure startTime is set
                 const elapsed = Math.floor((new Date() - startTime) / 1000);
                 if (timerDisplay) timerDisplay.textContent = formatDuration(elapsed);
            }
        }, 1000);

         // Update task selection UI if necessary (might be redundant if called via UI interaction)
         if (taskSelect.value !== (newTask.startsWith("その他_") ? "その他" : newTask)) {
            taskSelect.value = newTask.startsWith("その他_") ? "その他" : newTask;
            updateTaskDisplaysForSelection();
         }
         if (goalSelect.value !== (newGoalId || "")) {
             goalSelect.value = newGoalId || "";
             handleGoalSelectionChange();
         }

     } // --- End of UI Updates ---


    // Update Firestore status document
    const statusRef = doc(db, `work_status`, userId);
    await setDoc(
        statusRef,
        {
            userId, // Include userId for potential queries
            userName, // Include userName for display in host view
            currentTask: taskNameToLog, // Store internal task name
            currentGoalId,
            currentGoalTitle,
            startTime,
            isWorking: true,
            onlineStatus: true, // Keep online status true
            preBreakTask: preBreakTask || null, // Store pre-break info in Firestore
        },
        { merge: true } // Merge to avoid overwriting other fields like wordOfTheDay
    );

     // Start listening for colleagues on the new task
    listenForColleagues(taskNameToLog);
     // Re-evaluate reservations based on the new state
    processReservations();
}

// Stop the currently running task and log its duration
async function stopCurrentTask(isLeaving, forcedEndTime = null, taskData = {}) {
    // Clear the midnight timer if the task is stopped manually or automatically
    if (midnightStopTimer) {
        clearTimeout(midnightStopTimer);
        midnightStopTimer = null;
    }

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;

    // Use provided task data (from restore state) or current global state
    const taskToLog = taskData.task || currentTask;
    const goalIdToLog = taskData.goalId || currentGoalId;
    const goalTitleToLog = taskData.goalTitle || currentGoalTitle;
    const taskStartTime = taskData.startTime || startTime;

    // If there's no start time or task name, nothing to log
    if (!taskStartTime || !taskToLog) {
         // If leaving, still update status to not working
        if (isLeaving && userId) {
             await updateDoc(doc(db, `work_status`, userId), {
                 isWorking: false,
                 currentTask: null, // Clear task details
                 currentGoalId: null,
                 currentGoalTitle: null,
                 startTime: null,
                 preBreakTask: null,
             });
            resetClientStateUI(); // Reset UI if leaving
        }
        return; // Exit if nothing to log
    }

    const endTime = forcedEndTime || new Date(); // Use forced end time or current time
    const duration = Math.max(0, Math.floor((endTime - taskStartTime) / 1000)); // Ensure duration is not negative

    // Get memo from taskData (for auto-stop) or from the input field
    let memo = "";
    if (taskData.memo !== undefined) {
        memo = taskData.memo;
    } else if (taskMemoInput) {
        memo = taskMemoInput.value.trim();
    }

    // Log the work duration if it's greater than 0 seconds
    if (duration > 0) {
        try {
            await addDoc(collection(db, `work_logs`), {
                userId,
                userName,
                task: taskToLog, // Log the internal task name
                goalId: goalIdToLog,
                goalTitle: goalTitleToLog,
                date: getJSTDateString(taskStartTime), // Log date based on start time
                duration,
                startTime: Timestamp.fromDate(taskStartTime), // Store as Firestore Timestamp
                endTime: Timestamp.fromDate(endTime),       // Store as Firestore Timestamp
                memo,
            });
        } catch (error) {
            console.error("Error logging work duration:", error);
            // Optionally show an error to the user
        }
    }

    // If leaving work (final stop), update status and reset state/UI
    if (isLeaving && userId) {
        try {
            await updateDoc(doc(db, `work_status`, userId), {
                isWorking: false,
                currentTask: null,
                currentGoalId: null,
                currentGoalTitle: null,
                startTime: null, // Clear start time
                preBreakTask: null,
            });
        } catch (error) {
            console.error("Error updating status on leave:", error);
        }
         // Only reset UI if the client view is currently active
        if (document.getElementById('client-view').classList.contains('active-view')) {
            resetClientStateUI();
        }
    } else if (!isLeaving) {
         // If just changing tasks (not leaving), only clear the memo input
         if (taskMemoInput && document.getElementById('client-view').classList.contains('active-view')) {
            taskMemoInput.value = "";
        }
        // Keep currentTask, startTime etc. populated until the next startTask call
    }
}


// Handle the "帰宅" (Stop/Leave) button click
export async function handleStop(isAuto = false) {
     // If triggered manually, cancel all pending reservations
    if (!isAuto) {
        await cancelAllReservations();
    }
    // If no task is currently running, do nothing
    if (!currentTask && !startTime) return;
    // Stop the current task, marking it as the final stop for the session
    await stopCurrentTask(true); // `true` indicates the user is leaving
}


// Handle the "休憩" (Break) button click
export async function handleBreak(isAuto = false) {
    if (!userId) return; // Exit if user ID is not available

    // If triggered manually by the button, cancel all other pending reservations
    if (!isAuto) {
        await cancelAllReservations();
    }

    // Fetch the latest status from Firestore to ensure consistency
    const statusRef = doc(db, "work_status", userId);
    let currentDbTask = null;
    let dbPreBreakTask = null;
    let dbGoalId = null;
    let dbGoalTitle = null;
    let dbStartTime = null;

    try {
        const docSnap = await getDoc(statusRef);
        if (docSnap.exists() && docSnap.data().isWorking) {
             const statusData = docSnap.data();
             currentDbTask = statusData.currentTask;
             dbPreBreakTask = statusData.preBreakTask || null;
             dbGoalId = statusData.currentGoalId || null;
             dbGoalTitle = statusData.currentGoalTitle || null;
             dbStartTime = statusData.startTime?.toDate(); // Convert timestamp to Date

        } else {
             // If Firestore shows not working, log and exit
            console.log("Break action ignored: User is not currently working according to Firestore.");
            // Optionally, force UI reset if it's out of sync
            if (currentTask || startTime) {
                resetClientStateUI();
            }
            return;
        }
    } catch (error) {
        console.error("Error fetching status before break action:", error);
        return; // Exit on error
    }


    // Sync local state with Firestore state before proceeding
    currentTask = currentDbTask;
    preBreakTask = dbPreBreakTask;
    currentGoalId = dbGoalId;
    currentGoalTitle = dbGoalTitle;
    startTime = dbStartTime;


    if (isAuto) {
         // Automatic break triggered by reservation
        // Only start break if not already on break
        if (currentTask !== "休憩") {
             // Start the break task (stopCurrentTask is called within startTask)
            console.log("Executing automatic break reservation.");
            await startTask("休憩", null, null);
        } else {
            console.log("Automatic break skipped: Already on break.");
        }
    } else {
        // Manual break button click
        if (currentTask === "休憩") {
             // --- End Break ---
            console.log("Ending break manually.");
             // Stop the "休憩" task log
             await stopCurrentTask(false);

             // Restore the task that was active before the break
             const taskToReturnTo = preBreakTask;
              // Reset local state *before* starting the next task
             currentTask = null;
             startTime = null;
             preBreakTask = null; // Clear preBreakTask after using it

             if (taskToReturnTo && taskToReturnTo.task) {
                 // Start the previous task
                await startTask(
                    taskToReturnTo.task,
                    taskToReturnTo.goalId,
                    taskToReturnTo.goalTitle
                );
            } else {
                // If there was no task before break (shouldn't happen if break started correctly)
                // or if preBreakTask is corrupted, just stop working.
                console.warn("No pre-break task found, stopping work.");
                await updateDoc(statusRef, {
                    isWorking: false,
                    currentTask: null,
                    startTime: null,
                    preBreakTask: null,
                    currentGoalId: null,
                    currentGoalTitle: null,
                 });
                resetClientStateUI();
            }
        } else {
            // --- Start Break ---
            console.log("Starting break manually.");
            // Start the break task (stopCurrentTask is called within startTask)
            await startTask("休憩", null, null);
        }
    }
     // Process reservations again after state change
    processReservations();
}


// --- UI Update Functions ---

// Update goal dropdown, description, and progress based on selected task
export function updateTaskDisplaysForSelection() {
    const selectedTaskName = taskSelect.value;

    // Reset displays
    otherTaskContainer.classList.add("hidden");
    otherTaskInput.value = ""; // Clear other input
    taskDescriptionDisplay.classList.add("hidden");
    taskDescriptionDisplay.innerHTML = "";
    goalProgressContainer.innerHTML = "";
    goalProgressContainer.classList.add("hidden");
    goalSelectContainer.classList.add("hidden");
    goalSelect.innerHTML = '<option value="">工数を選択 (任意)</option>'; // Reset goal dropdown


    if (!selectedTaskName) {
        checkIfWarningIsNeeded(); // Check if a warning needed (e.g., switched away from active task)
        return; // Exit if no task is selected
    }

    // Handle "Other" task selection
    if (selectedTaskName === "その他") {
        otherTaskContainer.classList.remove("hidden");
        // Don't auto-fill otherTaskInput here, let user type or restoreClientState handle it
        checkIfWarningIsNeeded();
        return; // No description or goals for "Other" meta-task
    }


    const selectedTask = allTaskObjects.find((task) => task.name === selectedTaskName);

    if (!selectedTask) {
        console.warn("Selected task not found in allTaskObjects:", selectedTaskName);
        checkIfWarningIsNeeded();
        return; // Exit if task data not found
    }

    // Display task memo (description)
    if (selectedTask.memo) {
        taskDescriptionDisplay.innerHTML = `<p class="text-sm p-3 bg-gray-100 rounded-lg whitespace-pre-wrap">${selectedTask.memo}</p>`;
        taskDescriptionDisplay.classList.remove("hidden");
    }

    // Populate goal dropdown with active (not completed) goals for this task
    const activeGoals = (selectedTask.goals || []).filter((g) => !g.isComplete);

    if (activeGoals.length > 0) {
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

// Handle changes in the task selection dropdown
export function handleTaskSelectionChange() {
    updateTaskDisplaysForSelection(); // Update goal dropdown, memo, etc.
    handleGoalSelectionChange(); // Clear or update goal details display
}

// Handle changes in the goal selection dropdown
export function handleGoalSelectionChange() {
    const selectedTaskName = taskSelect.value;
    const selectedGoalId = goalSelect.value;

    const selectedTask = allTaskObjects.find((t) => t.name === selectedTaskName);

    // If a valid task and goal are selected, render the goal progress display
    if (selectedTask && selectedGoalId) {
        renderSingleGoalDisplay(selectedTask, selectedGoalId);
    } else {
        // Otherwise, hide the goal progress container
        goalProgressContainer.innerHTML = ""; // Clear content
        goalProgressContainer.classList.add("hidden"); // Hide container
    }

    // Check if warning is needed after goal selection change
    checkIfWarningIsNeeded();
}

// Render the progress display for a single selected goal
function renderSingleGoalDisplay(task, goalId) {
    goalProgressContainer.innerHTML = ""; // Clear previous content

    const goal = (task.goals || []).find((g) => g.id === goalId && !g.isComplete);

    if (!goal) {
        goalProgressContainer.classList.add("hidden"); // Hide if goal not found or completed
        return;
    }

    goalProgressContainer.classList.remove("hidden"); // Show container

    const progress = goal.target > 0 ? Math.min(100, Math.max(0, (goal.current / goal.target) * 100)) : 0; // Calculate progress percentage (0-100)

    const div = document.createElement("div");
    div.className = "p-3 border rounded-lg mb-4"; // Styling for the goal display box

    div.innerHTML = `
        <div class="font-semibold text-gray-700">${goal.title || ""}</div>
        <p class="text-xs text-gray-500 mt-1">納期: ${goal.deadline || "未設定"}</p>
        <p class="text-xs text-gray-500 mt-1">工数納期: ${goal.effortDeadline || "未設定"}</p>
        <p class="text-xs text-gray-600 mt-1 whitespace-pre-wrap">${goal.memo || ""}</p>
        <div class="w-full bg-gray-200 rounded-full h-4 my-2">
            <div class="bg-blue-600 h-4 rounded-full text-center text-white text-xs leading-4" style="width: ${progress}%">${Math.round(progress)}%</div>
        </div>
        <div class="text-sm text-right text-gray-500">${goal.current || 0} / ${goal.target || 0}</div>
        <div class="mt-2 flex gap-2">
            <input type="number" class="w-24 p-2 border border-gray-300 rounded-md text-center goal-contribution-input" placeholder="件数" min="0">
            <button class="add-goal-progress-btn bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600">加算</button>
        </div>
    `;

    // Add event listener to the "加算" (Add) button
    div.querySelector(".add-goal-progress-btn").addEventListener("click", (e) => {
        const input = e.currentTarget.previousElementSibling;
        handleUpdateGoalProgress(task.name, goal.id, input);
    });

    goalProgressContainer.appendChild(div); // Add the goal display to the container
}


// --- Goal Progress Update ---

// Handle adding progress (contribution) to a goal
async function handleUpdateGoalProgress(taskName, goalId, inputElement) {
    const contribution = parseInt(inputElement.value, 10);

    // Validate input
    if (isNaN(contribution) || contribution <= 0) {
        showConfirmationModal("正の数値を入力してください。", hideConfirmationModal);
        return;
    }

    // Find the task and goal indices in the global state
    const taskIndex = allTaskObjects.findIndex((t) => t.name === taskName);
    if (taskIndex === -1) return; // Exit if task not found

    const goalIndex = allTaskObjects[taskIndex].goals.findIndex((g) => g.id === goalId);
    if (goalIndex === -1) return; // Exit if goal not found

    // --- Update Local State and Firestore ---
    // 1. Update local `allTaskObjects` state
    // Create a deep copy to avoid direct mutation issues if `allTaskObjects` is passed around
    const updatedTasks = JSON.parse(JSON.stringify(allTaskObjects));
    const task = updatedTasks[taskIndex];
    const goal = task.goals[goalIndex];
    const currentProgress = goal.current || 0;
    goal.current = currentProgress + contribution; // Add contribution to current progress

     // Update the global state
     // This assignment might trigger listeners if `allTaskObjects` is reactive,
     // otherwise, manually trigger UI updates if necessary.
    // allTaskObjects = updatedTasks; // Directly assigning might not be ideal if listeners expect specific update patterns. Consider a dedicated state update function if using a framework/library.

    try {
        // 2. Save the entire updated task list to Firestore
        // This overwrites the existing list with the new one containing the updated goal progress.
        const tasksRef = doc(db, "settings", "tasks");
        await updateDoc(tasksRef, { list: updatedTasks });

        // 3. Log the contribution event in `work_logs`
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
             // No endTime or duration needed for contribution logs
        });

        // 4. Update UI: Clear input and re-render the goal display
        inputElement.value = ""; // Clear the input field
         // Manually update the global state *after* successful Firestore updates
        allTaskObjects = updatedTasks;
        renderSingleGoalDisplay(task, goal.id); // Re-render the specific goal display

    } catch (error) {
        console.error("Error updating goal progress:", error);
         // Optionally, revert local state changes or inform the user
        showConfirmationModal("進捗の更新中にエラーが発生しました。", hideConfirmationModal);
    }
}

// --- Colleague and Status Display ---

// Start listening for colleagues working on the same task
function listenForColleagues(task) {
    stopColleaguesListener(); // Stop any previous listener
    if (!userName || !task) return; // Exit if no user or task

    // Query for work_status documents where isWorking is true and currentTask matches
    const q = query(
        collection(db, "work_status"),
        where("isWorking", "==", true),
        where("currentTask", "==", task)
    );

    colleaguesListenerUnsubscribe = onSnapshot(q, (snapshot) => {
        colleaguesList.innerHTML = ""; // Clear current list

        // Filter out the current user and map data
        const colleagues = snapshot.docs
            .map((doc) => doc.data())
            .filter((data) => data.userName && data.userName !== userName)
             .sort((a,b) => (a.userName || "").localeCompare(b.userName || "", "ja")); // Sort by name

        if (colleagues.length > 0) {
             // Render list of colleagues
            colleagues.forEach((data) => {
                const li = document.createElement("li");
                li.className = "p-3 bg-gray-100 rounded-md";
                // Display word of the day if available
                const wordDisplay = data.wordOfTheDay
                    ? `<p class="text-sm text-gray-600 mt-1 pl-2 border-l-2 border-gray-300">「${data.wordOfTheDay}」</p>`
                    : "";
                li.innerHTML = `<p class="font-semibold">${data.userName}</p>${wordDisplay}`;
                colleaguesList.appendChild(li);
            });
            colleaguesContainer.classList.remove("hidden"); // Show the container
        } else {
            colleaguesContainer.classList.add("hidden"); // Hide if no colleagues
        }
    }, (error) => {
        console.error("Error listening for colleagues:", error);
        colleaguesContainer.classList.add("hidden"); // Hide on error
    });
}

// Stop the colleague listener
function stopColleaguesListener() {
    if (colleaguesListenerUnsubscribe) {
        colleaguesListenerUnsubscribe();
        colleaguesListenerUnsubscribe = null;
    }
     // Always hide the container when stopping the listener
    if (colleaguesContainer) colleaguesContainer.classList.add("hidden");
    if (colleaguesList) colleaguesList.innerHTML = "";
}

// Listen for Tomura's status updates
function listenForTomuraStatus() {
    const statusRef = doc(db, "settings", "tomura_status");
    // Define STATUS_CLASSES locally or import if defined elsewhere
    const STATUS_CLASSES = {
      '声掛けOK': ['bg-green-100', 'text-green-800'],
      '急用ならOK': ['bg-yellow-100', 'text-yellow-800'],
      '声掛けNG': ['bg-red-100', 'text-red-800'],
    };

    onSnapshot(statusRef, async (docSnap) => {
      const todayStr = new Date().toISOString().split("T")[0];
      let status = "声掛けNG"; // Default to NG

      if (docSnap.exists() && docSnap.data().date === todayStr) {
        // If doc exists and date is today, use the stored status
        status = docSnap.data().status;
      } else {
        // If doc doesn't exist, or date is not today, reset it to default '声掛けNG'.
        // Check if we need to write to prevent potential infinite loops if already default.
        if (
          !docSnap.exists() ||
          docSnap.data().status !== "声掛けNG" ||
          docSnap.data().date !== todayStr
        ) {
           try {
               await setDoc(statusRef, { status: "声掛けNG", date: todayStr }, { merge: true });
               status = "声掛けNG"; // Ensure status variable reflects the reset
           } catch (error) {
               console.error("Error resetting Tomura's status:", error);
               // Keep the default '声掛けNG' in case of error
           }
        } else {
             // If already default and today's date, no write needed
             status = "声掛けNG";
        }
      }

      // Update UI based on the determined 'status'
      if(tomuraStatusText) tomuraStatusText.textContent = status;

      // Apply appearance classes
      if (tomuraStatusDisplay) {
           // Remove all possible status classes first
           Object.values(STATUS_CLASSES).flat().forEach(cls => tomuraStatusDisplay.classList.remove(cls));
           // Add the classes for the current status
           if (STATUS_CLASSES[status]) {
               tomuraStatusDisplay.classList.add(...STATUS_CLASSES[status]);
           }
      }

    }, (error) => {
        console.error("Error listening for Tomura's status:", error);
         // Optionally set UI to a default/error state
        if(tomuraStatusText) tomuraStatusText.textContent = "取得エラー";
        if (tomuraStatusDisplay) {
             Object.values(STATUS_CLASSES).flat().forEach(cls => tomuraStatusDisplay.classList.remove(cls));
             tomuraStatusDisplay.classList.add('bg-gray-100', 'text-gray-800'); // Default gray style
        }
    });
}


// --- Utility and Warning Functions ---

// Check if the selected task/goal differs from the currently running one and show/hide warning
export function checkIfWarningIsNeeded() {
    if (!startBtn || !changeWarningMessage) return; // Exit if elements not found

    // If no task is currently running, no warning needed
    if (!currentTask || !startTime) {
        startBtn.classList.remove("animate-pulse-scale");
        changeWarningMessage.classList.add("hidden");
        return;
    }

    // Get currently selected values from UI
    let selectedTask = taskSelect.value;
    const selectedGoalId = goalSelect.value === "" ? null : goalSelect.value; // Treat empty string as null

    // Handle "Other" task selection in UI
    if (selectedTask === "その他") {
        const otherDetail = otherTaskInput.value.trim();
        // If other detail is provided, use the internal format for comparison
        if (otherDetail) {
            selectedTask = `その他_${otherDetail}`;
        }
        // If other detail is empty, treat selection as incomplete (different from a running task)
    }


    // Compare selected values with currently running task/goal state
    const isDifferent =
        currentTask !== selectedTask || currentGoalId !== selectedGoalId;

    // Show/hide warning and animation based on comparison
    if (isDifferent) {
        startBtn.classList.add("animate-pulse-scale"); // Add pulse animation to button
        changeWarningMessage.classList.remove("hidden"); // Show warning message
    } else {
        startBtn.classList.remove("animate-pulse-scale"); // Remove animation
        changeWarningMessage.classList.add("hidden"); // Hide warning message
    }
}

// Set up a timer to automatically stop the task at midnight
function setupMidnightStopTimer() {
    // Clear any existing timer first
    if (midnightStopTimer) {
        clearTimeout(midnightStopTimer);
        midnightStopTimer = null;
    }

    // Only set timer if a task is actually running
    if (!currentTask || !startTime) {
        return;
    }

    const now = new Date();
    const endOfDay = new Date(now);
    // Set to 23:59:59.999 of the current day
    endOfDay.setHours(23, 59, 59, 999);

    const timeUntilMidnight = endOfDay.getTime() - now.getTime();

    // If midnight hasn't passed yet today
    if (timeUntilMidnight > 0) {
        midnightStopTimer = setTimeout(async () => {
            // Check again if a task is *still* running when the timer fires
            if (currentTask && startTime) {
                console.log("Midnight auto-stop triggered.");
                 // Stop the task, forcing the end time to the end of the day it started
                const endOfStartTimeDay = new Date(startTime); // Use the actual start time's date
                endOfStartTimeDay.setHours(23, 59, 59, 999);

                await stopCurrentTask(true, endOfStartTimeDay, { // Pass true for isLeaving
                     task: currentTask, // Pass current state explicitly
                     goalId: currentGoalId,
                     goalTitle: currentGoalTitle,
                     startTime: startTime,
                     memo: "（自動退勤処理）",
                 });
                 // Set flag for checkout correction
                 const statusRef = doc(db, "work_status", userId);
                 await updateDoc(statusRef, { needsCheckoutCorrection: true });
                 // Show modal *after* state update if the view is active
                  if (document.getElementById('client-view').classList.contains('active-view')) {
                     showConfirmationModal(
                         "前回の退勤が自動処理されました。正しい退勤時刻を「退勤忘れを修正」ボタンから登録してください。",
                         hideConfirmationModal
                     );
                 }
            }
        }, timeUntilMidnight);
    }
}

// --- Reservation Logic (Copied and adapted from main.js, now specific to client view) ---

// Listener for Firestore reservation changes
function listenForUserReservations() {
    if (reservationsUnsubscribe) reservationsUnsubscribe(); // Unsubscribe previous listener
    if (!userId) return; // Need user ID

    const q = query(collection(db, `user_profiles/${userId}/reservations`));

    reservationsUnsubscribe = onSnapshot(q, (snapshot) => {
        userReservations = snapshot.docs.map((d) => {
            const data = d.data();
             // Convert Firestore Timestamp back to "HH:MM" string if necessary
            // This might not be needed if storing as string initially
            if (data.time && typeof data.time !== 'string' && data.time.toDate) {
                const date = data.time.toDate();
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                data.time = `${hours}:${minutes}`;
            }
            return { id: d.id, ...data };
        });
        processReservations(); // Process reservations whenever they change
    }, (error) => {
        console.error("Error listening for reservations:", error);
        // Optionally clear local state or show error
        userReservations = [];
        reservationTimers.forEach(clearTimeout);
        reservationTimers = [];
        updateReservationDisplay();
    });
}

// Process reservations and set timers
async function processReservations() {
     // Clear existing timers before setting new ones
    reservationTimers.forEach(clearTimeout);
    reservationTimers = [];

    const now = new Date();
    const todayStr = getJSTDateString(now); // "YYYY-MM-DD"

    for (const res of userReservations) {
         // Skip if already executed today
        if (res.lastExecutedDate === todayStr) {
            continue;
        }

        // Validate time format (should be "HH:MM")
        if (!res.time || typeof res.time !== "string" || !/^\d{2}:\d{2}$/.test(res.time)) {
             console.warn("Skipping reservation with invalid time:", res);
            continue;
        }

        // Calculate today's execution time
        const [hours, minutes] = res.time.split(":");
        const executionTime = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            parseInt(hours, 10),
            parseInt(minutes, 10),
            0 // Seconds = 0
        );

        // Check if the time has passed or is in the future
        if (executionTime <= now) {
            // Time has passed today, execute immediately if not yet done
             console.log(`Executing past reservation (${res.action} at ${res.time})`);
             // Execute action (handleBreak/handleStop will check if user is working)
            await executeAutoAction(res.action, executionTime, res.id);

        } else {
             // Time is in the future, set a timer
            const delay = executionTime.getTime() - now.getTime();
            console.log(`Setting timer for future reservation (${res.action} at ${res.time} in ${delay}ms)`);
            const timerId = setTimeout(async () => {
                await executeAutoAction(res.action, executionTime, res.id);
            }, delay);
            reservationTimers.push(timerId); // Store timer ID to allow cancellation
        }
    }

    // Update the UI display for reservations
    updateReservationDisplay();
}

// Execute the automatic action (break or stop) triggered by a reservation
async function executeAutoAction(action, executionTime, reservationId) {
    if (!userId) return; // Should not happen if reservations are processed correctly

    console.log(`Attempting auto action: ${action} for reservation ${reservationId}`);

    // Fetch the CURRENT status right before executing
    const statusRef = doc(db, "work_status", userId);
    try {
        const docSnap = await getDoc(statusRef);

        if (docSnap.exists() && docSnap.data().isWorking) {
             // Only execute if the user is currently working
            console.log(`User is working, executing ${action}.`);
            if (action === "break") {
                await handleBreak(true); // Pass true to indicate automatic trigger
            } else if (action === "stop") {
                await handleStop(true); // Pass true to indicate automatic trigger
            }

            // Mark reservation as executed for today ONLY if action was performed
             if (reservationId) {
                 const todayStr = getJSTDateString(new Date());
                 const resRef = doc(db, `user_profiles/${userId}/reservations`, reservationId);
                 // Use updateDoc to avoid overwriting other potential fields
                 await updateDoc(resRef, { lastExecutedDate: todayStr });
                 console.log(`Reservation ${reservationId} marked as executed for ${todayStr}.`);
             }
        } else {
             // If user is not working, log that the action was skipped
            console.log(`Auto action skipped: ${action} (User not working at execution time)`);
             // Do NOT mark as executed, it should try again if user starts working later
        }
    } catch (error) {
        console.error(`Error during automatic action execution (${action}):`, error);
    }
    // No need to call processReservations() here, as it's called on state changes
}


// Cancel all reservations (e.g., when manually starting/stopping/breaking)
async function cancelAllReservations() {
    if (!userId) return;

    console.log("Cancelling all future reservation timers and resetting execution state.");

     // 1. Clear local timers
    reservationTimers.forEach(clearTimeout);
    reservationTimers = [];

     // 2. Reset lastExecutedDate in Firestore for ALL reservations for this user
     //    This ensures they become eligible for execution again today if needed.
     if (userReservations.length > 0) {
        const batch = writeBatch(db);
        userReservations.forEach(res => {
            // Only reset if it *has* a lastExecutedDate (it might be null)
            if (res.lastExecutedDate) {
                 const resRef = doc(db, `user_profiles/${userId}/reservations`, res.id);
                 batch.update(resRef, { lastExecutedDate: null });
            }
        });
        try {
            await batch.commit();
            console.log("Reset lastExecutedDate for all reservations in Firestore.");
             // Manually update local state after successful commit
            userReservations = userReservations.map(res => ({ ...res, lastExecutedDate: null }));
             // Re-process to set new timers if applicable (e.g., if a break was cancelled before its time)
             processReservations();
        } catch (error) {
            console.error("Error resetting lastExecutedDate in Firestore:", error);
        }
    } else {
         // If no reservations exist locally, still call processReservations to ensure display is correct
         processReservations();
    }
}


// Update the UI display for break and stop reservations
function updateReservationDisplay() {
     // Ensure elements exist before manipulating
    const breakList = document.getElementById("break-reservation-list");
    const stopSetter = document.getElementById("stop-reservation-setter");
    const stopStatus = document.getElementById("stop-reservation-status");
    const stopStatusText = document.getElementById("stop-reservation-status-text");
    const stopTimeInput = document.getElementById("stop-reservation-time-input"); // Get input element

    if (!breakList || !stopSetter || !stopStatus || !stopStatusText || !stopTimeInput) {
        console.warn("Reservation UI elements not found. Skipping display update.");
        return;
    }


    // --- Update Break Reservations List ---
    breakList.innerHTML = ""; // Clear existing list
    const breakReservations = userReservations
        .filter((r) => r.action === "break")
        .sort((a, b) => (a.time || "").localeCompare(b.time || "")); // Sort by time

    if (breakReservations.length > 0) {
        breakReservations.forEach((res) => {
            const div = document.createElement("div");
            div.className = "break-reservation-item flex justify-between items-center p-2 bg-gray-100 rounded-lg";
            div.dataset.id = res.id;
            div.innerHTML = `
                <span class="font-mono text-lg">${res.time || "??:??"}</span>
                <div>
                    <button class="edit-break-reservation-btn text-xs bg-blue-500 text-white font-bold py-1 px-2 rounded hover:bg-blue-600" data-id="${res.id}">編集</button>
                    <button class="delete-break-reservation-btn text-xs bg-red-500 text-white font-bold py-1 px-2 rounded hover:bg-red-600" data-id="${res.id}">削除</button>
                </div>
            `;
            breakList.appendChild(div);
        });
         // Add event listeners after appending elements
        breakList.querySelectorAll('.edit-break-reservation-btn').forEach(btn => {
            btn.onclick = () => openBreakReservationModal(btn.dataset.id);
        });
        breakList.querySelectorAll('.delete-break-reservation-btn').forEach(btn => {
            btn.onclick = () => deleteReservation(btn.dataset.id); // Call deleteReservation directly
        });

    } else {
        breakList.innerHTML = '<p class="text-center text-sm text-gray-500">休憩予約はありません</p>';
    }

    // --- Update Stop Reservation Display ---
    const stopReservation = userReservations.find((r) => r.action === "stop");

    if (stopReservation) {
        stopStatusText.textContent = `予約時刻: ${stopReservation.time || "??:??"}`;
        stopSetter.classList.add("hidden"); // Hide the input/set button
        stopStatus.classList.remove("hidden"); // Show the status display
    } else {
         stopTimeInput.value = ""; // Clear input when no reservation exists
        stopSetter.classList.remove("hidden"); // Show the input/set button
        stopStatus.classList.add("hidden"); // Hide the status display
    }
}

// Function to delete a reservation from Firestore
async function deleteReservation(id) {
    if (!userId || !id) return;
    console.log(`Attempting to delete reservation ${id}`);
    const resRef = doc(db, `user_profiles/${userId}/reservations`, id);
    try {
        await deleteDoc(resRef);
        console.log(`Reservation ${id} deleted successfully.`);
         // Timers will be cleared and UI updated automatically by the onSnapshot listener triggering processReservations()
    } catch (error) {
        console.error(`Error deleting reservation ${id}:`, error);
        // Optionally show error to user
    }
}

// --- Event Listeners specific to client view ---
export function setupClientEventListeners() {
    startBtn?.addEventListener("click", handleStart);
    stopBtn?.addEventListener("click", () => handleStop(false)); // Pass false for manual stop
    breakBtn?.addEventListener("click", () => handleBreak(false)); // Pass false for manual break
    taskSelect?.addEventListener("change", handleTaskSelectionChange);
    goalSelect?.addEventListener("change", handleGoalSelectionChange);
     // Add listener for the "Other" task input to check for warnings on blur/change
    otherTaskInput?.addEventListener("change", checkIfWarningIsNeeded);
    otherTaskInput?.addEventListener("blur", checkIfWarningIsNeeded);

     // Reservation UI Listeners (ensure they exist)
     document.getElementById("add-break-reservation-btn")?.addEventListener("click", () => openBreakReservationModal());
     document.getElementById("set-stop-reservation-btn")?.addEventListener("click", handleSetStopReservation);
     document.getElementById("cancel-stop-reservation-btn")?.addEventListener("click", handleCancelStopReservation);

      // Listener for break reservation modal save
     document.getElementById("break-reservation-save-btn")?.addEventListener("click", handleSaveBreakReservation);


}

async function handleSaveBreakReservation() {
    const timeInputVal = document.getElementById("break-reservation-time-input")?.value;
    const id = document.getElementById("break-reservation-id")?.value;

    if (!timeInputVal) {
        alert("時間を指定してください。");
        return;
    }
     // Validate HH:MM format
     if (!/^\d{2}:\d{2}$/.test(timeInputVal)) {
        alert("時間は HH:MM 形式で入力してください。");
        return;
    }


    const reservationData = {
        time: timeInputVal, // Store as "HH:MM" string
        action: "break",
        lastExecutedDate: null, // Always reset execution date on save/update
    };

    try {
        if (id) {
             // Edit existing reservation
            const resRef = doc(db, `user_profiles/${userId}/reservations`, id);
            await updateDoc(resRef, reservationData);
            console.log(`Break reservation ${id} updated.`);
        } else {
            // Add new reservation
            const resCol = collection(db, `user_profiles/${userId}/reservations`);
            await addDoc(resCol, reservationData);
            console.log(`New break reservation added at ${timeInputVal}.`);
        }
         // Close modal after successful save
         if(breakReservationModal) breakReservationModal.classList.add("hidden");
         // The onSnapshot listener will handle UI updates and timer resets via processReservations()
    } catch (error) {
        console.error("Error saving break reservation:", error);
        alert("予約の保存中にエラーが発生しました。");
    }
}

// Render task options based on all tasks and user preferences
function renderTaskOptions() {
    if (!taskSelect) return; // Exit if dropdown doesn't exist

    const currentValue = taskSelect.value; // Preserve current selection if possible
    taskSelect.innerHTML = '<option value="">業務を選択...</option>'; // Clear existing options

    // Get hidden tasks from preferences (default to empty array if undefined)
    const hiddenTasks = userDisplayPreferences?.hiddenTasks || [];

    // Filter tasks: exclude "休憩" and tasks marked as hidden
    const dropdownTasks = allTaskObjects.filter(
        (task) => task.name !== "休憩" && !hiddenTasks.includes(task.name)
    );

    // Add filtered tasks to the dropdown
    dropdownTasks.forEach(
        (task) =>
            (taskSelect.innerHTML += `<option value="${task.name}">${task.name}</option>`)
    );

    // Add "Other" option manually at the end
    taskSelect.innerHTML += `<option value="その他">その他...</option>`;


    // Try to restore previous selection, otherwise keep default "業務を選択..."
    // Check if the previously selected value exists in the new options
    let valueExists = false;
    for (let i = 0; i < taskSelect.options.length; i++) {
        if (taskSelect.options[i].value === currentValue) {
            valueExists = true;
            break;
        }
    }
    if (valueExists) {
        taskSelect.value = currentValue;
    } else {
         // If previous value doesn't exist (e.g., it was hidden), reset selection
         taskSelect.value = "";
    }


}

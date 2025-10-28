// js/views/client/timer.js
import { db, userId, userName } from "../../main.js"; // Import global state
import { addDoc, collection, doc, getDoc, setDoc, Timestamp, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Import Firestore functions
import { formatDuration, getJSTDateString } from "../../utils.js"; // Import utility functions
import { showConfirmationModal, hideConfirmationModal } from "../../components/modal.js"; // Import modal functions
// Import functions from other client modules (will be created later)
import { processReservations, cancelAllReservations } from "./reservations.js";
import { listenForColleagues, stopColleaguesListener } from "./colleagues.js";
import { updateTaskDisplaysForSelection, checkIfWarningIsNeeded, resetClientStateUI, updateBreakButton } from "./clientUI.js";

// --- State variables managed by this module ---
// Exporting them allows other client modules to read, but modification should ideally happen via functions in this module.
export let timerInterval = null;
export let currentTask = null;
export let currentGoalId = null;
export let currentGoalTitle = null;
export let startTime = null;
export let preBreakTask = null; // Store task before break
export let midnightStopTimer = null; // Timer for automatic stop at midnight

// --- DOM Element references (assuming global access for now) ---
const timerDisplay = document.getElementById("timer-display");
const currentTaskDisplay = document.getElementById("current-task-display");
const taskSelect = document.getElementById("task-select");
const goalSelect = document.getElementById("goal-select");
const taskMemoInput = document.getElementById("task-memo-input");
const startBtn = document.getElementById("start-btn");
// const stopBtn = document.getElementById("stop-btn"); // Referenced in client.js event listener setup
// const breakBtn = document.getElementById("break-btn"); // Referenced in client.js event listener setup
const otherTaskInput = document.getElementById("other-task-input");


// --- Core Timer and Task Management Functions ---

/**
 * Starts or changes the current task.
 * Logs the previous task duration if applicable.
 * Updates Firestore status.
 * Starts the timer display.
 * Sets up the midnight auto-stop timer.
 * @param {string} newTask - The name of the task to start (internal name, e.g., "その他_detail").
 * @param {string|null} newGoalId - The ID of the associated goal, or null.
 * @param {string|null} newGoalTitle - The title of the associated goal, or null.
 * @param {Date|null} [forcedStartTime=null] - Optional start time (used for state restoration).
 */
export async function startTask(newTask, newGoalId, newGoalTitle, forcedStartTime = null) {
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
    } else if (newTask === "その他" && otherTaskInput?.value.trim()) {
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
        if (taskNameToLog.startsWith("その他_") && currentTaskDisplay && taskNameToDisplay !== currentTaskDisplay.textContent) {
            currentTaskDisplay.textContent = taskNameToDisplay; // Update display immediately
            const statusRef = doc(db, `work_status`, userId);
            try {
                await updateDoc(statusRef, { currentTask: taskNameToLog }); // Update Firestore
            } catch (error) {
                console.error("Error updating 'Other' task name in Firestore:", error);
            }
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

    // Update state variables for the new task
    currentTask = taskNameToLog; // Use the internal name (e.g., "その他_detail")
    currentGoalId = newGoalId || null;
    currentGoalTitle = newGoalTitle || null;
    startTime = forcedStartTime || new Date(); // Use provided start time or current time

    // Set up automatic stop at midnight
    setupMidnightStopTimer();

    // --- Update UI elements (only if the client view is active) ---
    if (document.getElementById('client-view')?.classList.contains('active-view')) {
        updateBreakButton(currentTask === "休憩"); // Update break button based on new state
        if (startBtn) startBtn.textContent = "業務変更"; // Update button text
        // Update the display for the current task
        if (currentTaskDisplay) {
            currentTaskDisplay.textContent = currentGoalTitle
                ? `${taskNameToDisplay} (${currentGoalTitle})` // Display without "その他_" prefix
                : taskNameToDisplay;
        }

        // Start/Restart the timer display interval
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (startTime && timerDisplay) { // Ensure startTime and element exist
                const elapsed = Math.floor((new Date() - startTime) / 1000);
                timerDisplay.textContent = formatDuration(elapsed);
            } else if (!startTime && timerInterval){ // Clean up interval if startTime becomes null somehow
                 clearInterval(timerInterval);
                 timerInterval = null;
                 if(timerDisplay) timerDisplay.textContent = "00:00:00";
            }
        }, 1000);
         // Update the timer immediately
         if (startTime && timerDisplay) {
             const elapsed = Math.floor((new Date() - startTime) / 1000);
             timerDisplay.textContent = formatDuration(elapsed);
         }


        // Ensure UI dropdowns reflect the current state (important for programmatic changes like break end)
         if (taskSelect && taskSelect.value !== (newTask.startsWith("その他_") ? "その他" : newTask)) {
            taskSelect.value = newTask.startsWith("その他_") ? "その他" : newTask;
            updateTaskDisplaysForSelection(); // Update goal dropdown and memo
         }
         if (goalSelect && goalSelect.value !== (newGoalId || "")) {
             goalSelect.value = newGoalId || "";
             // handleGoalSelectionChange(); // This might cause redundant updates, call specific UI part if needed
             checkIfWarningIsNeeded(); // Check warning after potential goal change
         } else {
             checkIfWarningIsNeeded(); // Check warning even if goal didn't change (task might have)
         }


    } // --- End of UI Updates ---

    // Update Firestore status document
    const statusRef = doc(db, `work_status`, userId);
    try {
        await setDoc(
            statusRef,
            {
                userId, // Include userId for potential queries
                userName, // Include userName for display in host view
                currentTask: taskNameToLog, // Store internal task name
                currentGoalId,
                currentGoalTitle,
                startTime: Timestamp.fromDate(startTime), // Store as Firestore Timestamp
                isWorking: true,
                onlineStatus: true, // Keep online status true
                preBreakTask: preBreakTask || null, // Store pre-break info in Firestore
            },
            { merge: true } // Merge to avoid overwriting other fields like wordOfTheDay
        );
    } catch (error) {
        console.error("Error updating Firestore status on task start:", error);
        // Consider how to handle this error - maybe revert state?
    }


    // Start listening for colleagues on the new task
    listenForColleagues(taskNameToLog);
    // Re-evaluate reservations based on the new state (might cancel/set timers)
    processReservations();
}


/**
 * Stops the currently running task, logs its duration, and updates Firestore status.
 * Can be called when changing tasks, stopping for the day, or automatically at midnight.
 * @param {boolean} isLeaving - True if this is the final stop for the session (going home).
 * @param {Date|null} [forcedEndTime=null] - Optional end time (used for midnight stop or corrections).
 * @param {object} [taskData={}] - Optional data override (used for midnight stop/state restoration).
 */
export async function stopCurrentTask(isLeaving, forcedEndTime = null, taskData = {}) {
    // Clear the midnight timer if the task is stopped manually or automatically
    if (midnightStopTimer) {
        clearTimeout(midnightStopTimer);
        midnightStopTimer = null;
    }

    // Stop the display timer interval
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }


    // Use provided task data (from restore state/midnight) or current global state
    const taskToLog = taskData.task || currentTask;
    const goalIdToLog = taskData.goalId || currentGoalId;
    const goalTitleToLog = taskData.goalTitle || currentGoalTitle;
    const taskStartTime = taskData.startTime || startTime;

    // --- Log Work Duration ---
    if (taskStartTime && taskToLog) { // Only log if there's a task and start time
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
    } // --- End Logging ---


    // --- Update Firestore Status and Local State ---
    if (isLeaving && userId) {
        // Final stop for the session
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
        // Reset local state *after* successful Firestore update (or timeout)
        currentTask = null;
        currentGoalId = null;
        currentGoalTitle = null;
        startTime = null;
        preBreakTask = null;

        // Only reset UI if the client view is currently active
        if (document.getElementById('client-view')?.classList.contains('active-view')) {
            resetClientStateUI();
        }
        stopColleaguesListener(); // Stop listening for colleagues when leaving
    } else if (!isLeaving) {
        // Just changing tasks, not leaving
        // Clear the memo input *if* the client view is active
         if (taskMemoInput && document.getElementById('client-view')?.classList.contains('active-view')) {
            taskMemoInput.value = "";
        }
         // Keep currentTask, startTime etc. populated locally until the next startTask call overwrites them.
         // Firestore status will be updated by the subsequent startTask call.
         stopColleaguesListener(); // Stop listener for the old task
    } else {
         // Case where isLeaving is false but no userId? Unlikely, but reset state just in case.
         currentTask = null;
         currentGoalId = null;
         currentGoalTitle = null;
         startTime = null;
         preBreakTask = null;
         if (document.getElementById('client-view')?.classList.contains('active-view')) {
             resetClientStateUI();
         }
         stopColleaguesListener();
    }


}

/**
 * Handles the "業務変更" / "業務開始" button click.
 * Reads selected task/goal from UI and calls startTask.
 */
export async function handleStartClick() {
    let newTask = taskSelect?.value;
    let newGoalId = goalSelect?.value;
    let newGoalTitle = newGoalId ? goalSelect.options[goalSelect.selectedIndex]?.text : null;

    // Handle "Other" task input
    if (newTask === "その他") {
        const otherDetail = otherTaskInput?.value.trim();
        if (!otherDetail) {
            showConfirmationModal("具体的な業務内容を入力してください。", hideConfirmationModal);
            return;
        }
        newTask = `その他_${otherDetail}`; // Use internal format
        newGoalId = null; // "Other" tasks don't have goals from dropdown
        newGoalTitle = null;
    }


    if (!newTask) {
        showConfirmationModal("業務を選択してください。", hideConfirmationModal);
        return;
    }

    // Prevent starting "休憩" directly using this button
    if (newTask === "休憩") {
        showConfirmationModal("休憩は「休憩開始」ボタンを使用してください。", hideConfirmationModal);
        if (taskSelect) { // Revert selection if taskSelect exists
             const taskToRevert = currentTask?.startsWith("その他_") ? "その他" : currentTask;
             taskSelect.value = taskToRevert || "";
        }
        return;
    }

    // Start the new task
    await startTask(newTask, newGoalId, newGoalTitle);
}

/**
 * Handles the "帰宅" (Stop/Leave) button click.
 * Cancels reservations and calls stopCurrentTask with isLeaving=true.
 * @param {boolean} [isAuto=false] - True if triggered automatically (e.g., reservation).
 */
export async function handleStopClick(isAuto = false) {
    // If triggered manually, cancel all pending reservations
    if (!isAuto) {
        await cancelAllReservations();
    }
    // If no task is currently running, do nothing
    if (!currentTask && !startTime) {
        console.log("Stop clicked, but no task is running.");
         // Ensure UI/State is reset if somehow out of sync
        resetClientStateUI();
        await updateDoc(doc(db, `work_status`, userId), { isWorking: false, currentTask: null, startTime: null, preBreakTask: null, currentGoalId: null, currentGoalTitle: null });
        return;
    }
    // Stop the current task, marking it as the final stop for the session
    await stopCurrentTask(true); // `true` indicates the user is leaving
}

/**
 * Handles the "休憩" (Break) button click or automatic break trigger.
 * Fetches latest status, then either starts the "休憩" task or ends it and restores the previous task.
 * @param {boolean} [isAuto=false] - True if triggered automatically (e.g., reservation).
 */
export async function handleBreakClick(isAuto = false) {
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

             // --- State Synchronization ---
             // Force local state to match Firestore state before proceeding
             currentTask = currentDbTask;
             preBreakTask = dbPreBreakTask;
             currentGoalId = dbGoalId;
             currentGoalTitle = dbGoalTitle;
             startTime = dbStartTime;
             // --- End State Synchronization ---

        } else {
             // If Firestore shows not working, log and exit
            console.log("Break action ignored: User is not currently working according to Firestore.");
            // Force UI reset if it's out of sync
            if (currentTask || startTime) { // Check local state
                resetClientStateUI();
            }
            return;
        }
    } catch (error) {
        console.error("Error fetching status before break action:", error);
        return; // Exit on error
    }


    if (isAuto) {
         // Automatic break triggered by reservation
        // Only start break if not already on break (based on synced state)
        if (currentTask !== "休憩") {
            console.log("Executing automatic break reservation.");
            await startTask("休憩", null, null); // Start the break task
        } else {
            console.log("Automatic break skipped: Already on break.");
        }
    } else {
        // Manual break button click
        if (currentTask === "休憩") {
             // --- End Break ---
            console.log("Ending break manually.");
             // Stop the "休憩" task log
             await stopCurrentTask(false); // isLeaving = false

             // Restore the task that was active before the break
             // Use the PRE-BREAK task info synced from Firestore just before this function call
             const taskToReturnTo = preBreakTask;

              // Reset local state *before* starting the next task
             currentTask = null; // Will be set by startTask
             startTime = null; // Will be set by startTask
             preBreakTask = null; // Clear preBreakTask after using it

             if (taskToReturnTo && taskToReturnTo.task) {
                 // Start the previous task
                await startTask(
                    taskToReturnTo.task,
                    taskToReturnTo.goalId,
                    taskToReturnTo.goalTitle
                );
            } else {
                // If there was no task before break or preBreakTask is corrupted, stop working.
                console.warn("No pre-break task found or preBreakTask invalid, stopping work.");
                try {
                    await updateDoc(statusRef, {
                        isWorking: false,
                        currentTask: null,
                        startTime: null,
                        preBreakTask: null,
                        currentGoalId: null,
                        currentGoalTitle: null,
                    });
                } catch (error) {
                    console.error("Error updating status when ending break without preBreakTask:", error);
                }
                resetClientStateUI(); // Reset UI to stopped state
            }
        } else {
            // --- Start Break ---
            console.log("Starting break manually.");
            // Start the break task (stopCurrentTask for previous task is called within startTask)
            await startTask("休憩", null, null);
        }
    }
     // Process reservations again after state change (e.g., to potentially cancel future breaks if manually stopped)
     // This call might be redundant if startTask also calls it, but ensures it happens.
    processReservations();
}

/**
 * Sets up a timer to automatically stop the current task at midnight (23:59:59.999).
 * Logs the task duration ending at midnight and sets the needsCheckoutCorrection flag.
 */
export function setupMidnightStopTimer() {
    // Clear any existing timer first
    if (midnightStopTimer) {
        clearTimeout(midnightStopTimer);
        midnightStopTimer = null;
    }

    // Only set timer if a task is actually running and startTime is valid
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
        console.log(`Setting midnight timer for ${timeUntilMidnight}ms`);
        midnightStopTimer = setTimeout(async () => {
            console.log("Midnight auto-stop triggered.");
            // Check again if a task is *still* running when the timer fires
            // Need to read the *current* state again directly before stopping
            const currentStartTimeForStop = startTime; // Capture state at time of firing
            const currentTaskForStop = currentTask;
            const currentGoalIdForStop = currentGoalId;
            const currentGoalTitleForStop = currentGoalTitle;


            if (currentTaskForStop && currentStartTimeForStop) {
                console.log(`Stopping task "${currentTaskForStop}" automatically at midnight.`);
                 // Stop the task, forcing the end time to the end of the day it started
                const endOfStartTimeDay = new Date(currentStartTimeForStop); // Use the actual start time's date
                endOfStartTimeDay.setHours(23, 59, 59, 999);

                await stopCurrentTask(true, endOfStartTimeDay, { // Pass true for isLeaving
                     task: currentTaskForStop, // Pass captured state explicitly
                     goalId: currentGoalIdForStop,
                     goalTitle: currentGoalTitleForStop,
                     startTime: currentStartTimeForStop,
                     memo: "（自動退勤処理）",
                 });
                 // Set flag for checkout correction after stopping the task
                 const statusRef = doc(db, "work_status", userId);
                 try {
                     await updateDoc(statusRef, { needsCheckoutCorrection: true });
                 } catch (error) {
                     console.error("Error setting needsCheckoutCorrection flag:", error);
                 }

                 // Show modal *after* state update only if the client view is currently active
                 if (document.getElementById('client-view')?.classList.contains('active-view')) {
                     showConfirmationModal(
                         "前回の退勤が自動処理されました。正しい退勤時刻を「退勤忘れを修正」ボタンから登録してください。",
                         hideConfirmationModal
                     );
                 }
            } else {
                 console.log("Midnight timer fired, but no task was running.");
            }
             // Ensure local timer variable is cleared after execution
             midnightStopTimer = null;
        }, timeUntilMidnight);
    } else {
         console.log("Midnight has already passed for today, no timer set.");
    }
}

/**
 * Clears the timer interval display.
 */
export function clearTimerInterval() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
     if (timerDisplay) {
        timerDisplay.textContent = "00:00:00";
    }
}

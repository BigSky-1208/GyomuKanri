// js/views/host/statusDisplay.js
import { db } from "../../firebase.js"; // Import Firestore instance
import { collection, query, onSnapshot, getDoc, doc, writeBatch, Timestamp, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Import Firestore functions
import { formatDuration, getJSTDateString } from "../../utils.js"; // Import utility functions
import { showConfirmationModal, hideConfirmationModal } from "../../components/modal.js"; // Import modal functions

// --- Module State ---
let statusListenerUnsubscribe = null; // Firestore listener unsubscribe function
let hostViewIntervals = []; // Array to store timer interval IDs for cleanup
let currentAllStatuses = []; // Local cache of the latest statuses

// --- DOM Element references ---
const statusListContainer = document.getElementById("status-list"); // Container for individual employee status
const taskSummaryContainer = document.getElementById("task-summary-list"); // Container for task summary

/**
 * Starts the Firestore listener for real-time work status updates.
 * Updates the UI whenever status changes.
 */
export function startListeningForStatusUpdates() {
    stopListeningForStatusUpdates(); // Stop previous listener if any

    if (!statusListContainer || !taskSummaryContainer) {
        console.error("Host view status display elements not found.");
        return;
    }

    console.log("Starting listener for work status updates...");
    const q = query(collection(db, `work_status`));

    statusListenerUnsubscribe = onSnapshot(q, (snapshot) => {
        // Clear existing timers before processing new data
        hostViewIntervals.forEach(clearInterval);
        hostViewIntervals = [];
        // Clear UI containers
        statusListContainer.innerHTML = "";
        taskSummaryContainer.innerHTML = "";

        // Store current statuses locally
        currentAllStatuses = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        // Filter for currently working clients
        const workingClientsData = currentAllStatuses.filter(
            (data) => data.isWorking && data.userName // Ensure user is working and has a name
        );

        // Sort working clients by task name (Japanese locale)
        workingClientsData.sort((a, b) => {
            const taskA = a.currentTask || "";
            const taskB = b.currentTask || "";
            return taskA.localeCompare(taskB, "ja");
        });

        // --- Render UI ---
        if (workingClientsData.length === 0) {
            statusListContainer.innerHTML = '<p class="text-gray-500">稼働中の従業員はいません。</p>';
            taskSummaryContainer.innerHTML = '<p class="text-gray-500">稼働中の業務はありません。</p>';
        } else {
            renderTaskSummary(workingClientsData); // Render task summary section
            renderWorkingClientList(workingClientsData); // Render individual client status cards
        }
         // Re-attach event listener for force stop buttons after rendering
         setupForceStopListeners();


    }, (error) => {
        console.error("Error listening for status updates:", error);
        statusListContainer.innerHTML = '<p class="text-red-500">ステータスの読み込み中にエラーが発生しました。</p>';
        taskSummaryContainer.innerHTML = '';
        currentAllStatuses = []; // Clear local cache on error
        // Clean up intervals on error too
        hostViewIntervals.forEach(clearInterval);
        hostViewIntervals = [];
    });
}

/**
 * Stops the Firestore listener for work status updates.
 */
export function stopListeningForStatusUpdates() {
    if (statusListenerUnsubscribe) {
        console.log("Stopping listener for work status updates.");
        statusListenerUnsubscribe();
        statusListenerUnsubscribe = null;
    }
    // Clear any running timers associated with the host view display
    hostViewIntervals.forEach(clearInterval);
    hostViewIntervals = [];
    // Optionally clear the display when stopping listener
    // if (statusListContainer) statusListContainer.innerHTML = '';
    // if (taskSummaryContainer) taskSummaryContainer.innerHTML = '';
}

/**
 * Renders the summary section showing tasks and counts of people working on them.
 * @param {Array} workingClientsData - Array of status objects for working clients.
 */
function renderTaskSummary(workingClientsData) {
    if (!taskSummaryContainer) return;
    taskSummaryContainer.innerHTML = ""; // Clear previous summary

    const taskSummary = {}; // { "Task Name (Goal Title)": count }

    // Aggregate counts per task/goal combo
    workingClientsData.forEach((data) => {
        const taskDisplayKey = data.currentGoalTitle
            ? `${data.currentTask} (${data.currentGoalTitle})`
            : data.currentTask || "未定義の業務"; // Handle undefined task

         // Handle "Other" task display
         let displayKeyClean = taskDisplayKey;
         if (displayKeyClean.startsWith("その他_")) {
            displayKeyClean = displayKeyClean.substring(4); // Remove prefix for display
         }


        if (!taskSummary[displayKeyClean]) {
            taskSummary[displayKeyClean] = 0;
        }
        taskSummary[displayKeyClean]++;
    });

    // Sort tasks alphabetically (Japanese locale)
    const sortedTasks = Object.keys(taskSummary).sort((a, b) => a.localeCompare(b, "ja"));

    // Create and append HTML for each task summary item
    sortedTasks.forEach((taskKey) => {
        const count = taskSummary[taskKey];
        const summaryItem = document.createElement("div");
        summaryItem.className = "flex justify-between items-center text-sm";
        summaryItem.innerHTML = `<span class="font-semibold text-gray-600">${escapeHtml(taskKey)}</span><span class="font-mono bg-gray-200 px-2 py-1 rounded-md text-gray-800">${count}人</span>`;
        taskSummaryContainer.appendChild(summaryItem);
    });
}

/**
 * Renders the list of individual working client status cards.
 * @param {Array} workingClientsData - Array of status objects for working clients.
 */
function renderWorkingClientList(workingClientsData) {
    if (!statusListContainer) return;
    statusListContainer.innerHTML = ""; // Clear previous list

    workingClientsData.forEach((data) => {
        const userId = data.userId || data.id; // Use userId field if available, fallback to doc ID
        const userName = data.userName || "不明なユーザー";
        const taskDisplayKey = data.currentGoalTitle
            ? `${data.currentTask} (${data.currentGoalTitle})`
            : data.currentTask || "未定義の業務";

        // Handle "Other" task display
        let displayKeyClean = taskDisplayKey;
        if (displayKeyClean.startsWith("その他_")) {
           displayKeyClean = displayKeyClean.substring(4); // Remove prefix for display
        }


        const card = document.createElement("div");
        card.className = "p-4 bg-gray-50 rounded-lg border";
        card.id = `status-card-${userId}`; // Add unique ID for potential updates

        card.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <div>
                    <p class="font-semibold text-blue-600">${escapeHtml(displayKeyClean)}</p>
                    <p class="text-sm text-gray-500 mt-1">${escapeHtml(userName)}</p>
                </div>
                <p id="timer-${userId}" class="font-mono text-lg text-green-600">--:--:--</p>
            </div>
            <div class="text-right">
                <button class="force-stop-btn bg-red-600 text-white font-bold py-1 px-3 text-xs rounded-lg hover:bg-red-700 transition" data-user-id="${userId}" data-user-name="${escapeHtml(userName)}">
                    強制停止
                </button>
            </div>`;

        statusListContainer.appendChild(card);

        // --- Set up Timer Display ---
        const timerElement = document.getElementById(`timer-${userId}`);
        const startTime = data.startTime?.toDate(); // Convert Firestore Timestamp to JS Date

        if (startTime && timerElement) {
            const updateTimer = () => {
                const now = new Date();
                // Ensure startTime is valid before calculation
                if (startTime instanceof Date && !isNaN(startTime)) {
                    const elapsed = Math.max(0, Math.floor((now - startTime) / 1000)); // Prevent negative duration display briefly
                     // Check if element still exists before updating (might be removed by snapshot update)
                    const currentTimerElement = document.getElementById(`timer-${userId}`);
                    if (currentTimerElement) {
                       currentTimerElement.textContent = formatDuration(elapsed);
                    } else {
                        // If element is gone, clear this specific interval
                         const intervalIndex = hostViewIntervals.findIndex(id => id === intervalId);
                         if (intervalIndex > -1) {
                             clearInterval(hostViewIntervals[intervalIndex]);
                             hostViewIntervals.splice(intervalIndex, 1);
                         }
                    }
                } else {
                     timerElement.textContent = "--:--:--"; // Display placeholder if startTime is invalid
                }
            };

            updateTimer(); // Update immediately
            const intervalId = setInterval(updateTimer, 1000); // Update every second
            hostViewIntervals.push(intervalId); // Store interval ID for cleanup
        } else if (timerElement) {
             timerElement.textContent = "--:--:--"; // Display placeholder if startTime is missing/invalid
        }
        // --- End Timer Display Setup ---
    });
}

/**
 * Sets up event listeners for the 'Force Stop' buttons using event delegation.
 */
function setupForceStopListeners() {
     if (!statusListContainer) return;

     // Remove previous listener if exists (safer than multiple additions)
     // statusListContainer.removeEventListener('click', handleForceStopClick); // Consider if needed

     // Add single listener to the container
     statusListContainer.addEventListener('click', handleForceStopClick);
 }

 /**
  * Handles clicks within the status list container, specifically for 'Force Stop' buttons.
  * @param {Event} event - The click event.
  */
 function handleForceStopClick(event) {
     if (event.target.classList.contains("force-stop-btn")) {
         const button = event.target;
         const userIdToStop = button.dataset.userId;
         const userNameToStop = button.dataset.userName;

         if (!userIdToStop || !userNameToStop) {
             console.error("Missing user ID or name for force stop.");
             return;
         }

         showConfirmationModal(
             `${userNameToStop}さんの業務を強制的に停止（帰宅処理）します。よろしいですか？`,
             async () => { // Make the confirmation callback async
                 await forceStopUser(userIdToStop, userNameToStop); // Call async forceStopUser
                 hideConfirmationModal();
             }
         );
     }
 }


/**
 * Forces a user's task to stop, logs the duration, and updates their status.
 * @param {string} userIdToStop - The Firestore document ID (or derived ID) of the user to stop.
 * @param {string} userNameToStop - The name of the user for confirmation messages.
 */
export async function forceStopUser(userIdToStop, userNameToStop) {
    console.log(`Attempting to force stop user: ${userNameToStop} (${userIdToStop})`);
    const statusRef = doc(db, "work_status", userIdToStop);

    try {
        const statusSnap = await getDoc(statusRef);

        if (!statusSnap.exists() || !statusSnap.data().isWorking) {
            alert(`${userNameToStop}さんは現在稼働中ではありません。`);
            console.log(`Force stop skipped: ${userNameToStop} is not working.`);
            return;
        }

        const statusData = statusSnap.data();
        const taskStartTime = statusData.startTime?.toDate(); // Get start time as Date object

        // Check if startTime is valid before proceeding
        if (!taskStartTime || !(taskStartTime instanceof Date) || isNaN(taskStartTime)) {
             console.error(`Invalid startTime found for user ${userNameToStop}. Cannot log duration.`);
             // Proceed to update status to not working, but skip logging.
        } else {
            // --- Log the work duration ---
            const endTime = new Date(); // Current time as end time
            const duration = Math.max(0, Math.floor((endTime - taskStartTime) / 1000));

             // Create log data only if duration is positive
             if(duration > 0) {
                 const logData = {
                     userId: userIdToStop,
                     userName: statusData.userName,
                     task: statusData.currentTask || "不明な業務",
                     goalId: statusData.currentGoalId || null,
                     goalTitle: statusData.currentGoalTitle || null,
                     date: getJSTDateString(taskStartTime), // Base date on start time
                     startTime: Timestamp.fromDate(taskStartTime), // Store as Timestamp
                     endTime: Timestamp.fromDate(endTime),       // Store as Timestamp
                     duration: duration,
                     memo: (statusData.memo || "") + " [管理者による強制停止]",
                 };
                  // Add log entry using a batch (though only one log entry here)
                 const batch = writeBatch(db);
                 const logsCollectionRef = collection(db, "work_logs");
                 batch.set(doc(logsCollectionRef), logData); // Add new log document
                 await batch.commit(); // Commit the log write immediately
                 console.log(`Work log created for ${userNameToStop} (forced stop).`);
             } else {
                 console.log(`Skipping log for ${userNameToStop} (duration <= 0).`);
             }

        } // --- End Logging ---


        // --- Update User Status ---
        // Always update status to not working, regardless of logging success/failure
        await updateDoc(statusRef, {
            isWorking: false,
            currentTask: null,
            currentGoalId: null,
            currentGoalTitle: null,
            startTime: null, // Clear start time
            preBreakTask: null, // Clear pre-break task info
            // Keep onlineStatus as is, don't force offline
        });
        console.log(`Status updated to not working for ${userNameToStop}.`);
        alert(`${userNameToStop}さんの業務を停止しました。`); // Notify admin

        // The UI will update automatically via the onSnapshot listener reacting to the status change.

    } catch (error) {
        console.error(`Error forcing stop for user ${userNameToStop}:`, error);
        alert(`ユーザー ${userNameToStop} の強制停止中にエラーが発生しました。`);
    }
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

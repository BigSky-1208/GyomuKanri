// js/views/client/reservations.js
import { db, userId } from "../../main.js"; // Import global state (db, userId)
import { collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc, writeBatch, getDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Import Firestore functions
import { getJSTDateString } from "../../utils.js"; // Import utility functions
import { handleBreakClick, handleStopClick } from "./timer.js"; // Import action execution functions
import { openBreakReservationModal, breakReservationModal } from "../../components/modal.js"; // Import modal functions/elements

// --- State variables managed by this module ---
let userReservations = []; // Holds reservation data from Firestore {id, time:"HH:MM", action:"break"|"stop", lastExecutedDate:"YYYY-MM-DD"|null}
let reservationTimers = []; // Holds active setTimeout IDs
let reservationsUnsubscribe = null; // Firestore listener unsubscribe function

// --- DOM Element references ---
const breakList = document.getElementById("break-reservation-list");
const stopSetter = document.getElementById("stop-reservation-setter");
const stopStatus = document.getElementById("stop-reservation-status");
const stopStatusText = document.getElementById("stop-reservation-status-text");
const stopTimeInput = document.getElementById("stop-reservation-time-input");

/**
 * Sets up the Firestore listener for user reservations.
 */
export function listenForUserReservations() {
    if (reservationsUnsubscribe) reservationsUnsubscribe(); // Unsubscribe previous listener
    if (!userId) {
        console.log("Cannot listen for reservations: userId is null.");
         userReservations = [];
         processReservations(); // Clear timers and update UI if userId becomes null
        return;
    }

    const q = query(collection(db, `user_profiles/${userId}/reservations`));

    console.log("Starting listener for reservations for user:", userId);
    reservationsUnsubscribe = onSnapshot(q, (snapshot) => {
        userReservations = snapshot.docs.map((d) => {
            const data = d.data();
            // Convert Firestore Timestamp back to "HH:MM" string if stored as Timestamp
            // It's better to store as "HH:MM" string directly for simplicity here.
            if (data.time && typeof data.time !== 'string' && data.time.toDate) {
                const date = data.time.toDate();
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                data.time = `${hours}:${minutes}`;
            }
            return { id: d.id, ...data };
        });
        console.log("Reservations updated:", userReservations);
        processReservations(); // Process reservations whenever Firestore data changes
    }, (error) => {
        console.error("Error listening for reservations:", error);
        // Clear local state on error
        userReservations = [];
        reservationTimers.forEach(clearTimeout);
        reservationTimers = [];
        updateReservationDisplay(); // Update UI to show no reservations
    });
}

/**
 * Processes all current reservations.
 * Clears existing timers, checks execution status for today,
 * and sets new timers for future reservations or executes past ones immediately.
 */
export async function processReservations() {
    // 1. Clear currently set timers
    reservationTimers.forEach(clearTimeout);
    reservationTimers = [];
    console.log("Processing reservations, clearing existing timers.");

    const now = new Date();
    const todayStr = getJSTDateString(now); // "YYYY-MM-DD"

    // 2. Iterate through reservations loaded from Firestore
    for (const res of userReservations) {
        // 3. Skip if already executed today
        if (res.lastExecutedDate === todayStr) {
            console.log(`Reservation ${res.id} (${res.action}@${res.time}) already executed today.`);
            continue; // Move to the next reservation
        }

        // 4. Validate time format (should be "HH:MM")
        if (!res.time || typeof res.time !== "string" || !/^\d{2}:\d{2}$/.test(res.time)) {
            console.warn("Skipping reservation with invalid time format:", res);
            continue;
        }

        // 5. Calculate today's execution time as a Date object
        const [hours, minutes] = res.time.split(":");
        const executionTime = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            parseInt(hours, 10),
            parseInt(minutes, 10),
            0 // Seconds = 0
        );

        // 6. Compare execution time with current time
        if (executionTime <= now) {
            // Reservation time has passed today, execute immediately
            console.log(`Executing past reservation (${res.action} at ${res.time})`);
            await executeAutoAction(res.action, executionTime, res.id); // Execute and mark as done
        } else {
            // Reservation time is in the future, set a timer
            const delay = executionTime.getTime() - now.getTime();
            console.log(`Setting timer for future reservation (${res.action} at ${res.time}) in ${delay}ms`);
            const timerId = setTimeout(async () => {
                // When timer fires, execute the action
                await executeAutoAction(res.action, executionTime, res.id);
            }, delay);
            reservationTimers.push(timerId); // Store timer ID for potential cancellation
        }
    }

    // 7. Update the UI display based on the processed reservations
    updateReservationDisplay();
}

/**
 * Executes the automatic action (break or stop) and marks the reservation as executed for today.
 * Checks Firestore status to ensure the user is working before executing.
 * @param {string} action - "break" or "stop".
 * @param {Date} executionTime - The calculated execution time.
 * @param {string} reservationId - The Firestore document ID of the reservation.
 */
async function executeAutoAction(action, executionTime, reservationId) {
    if (!userId || !reservationId) return;

    console.log(`Attempting auto action: ${action} for reservation ${reservationId}`);

    // Fetch the CURRENT status right before executing to ensure user is working
    const statusRef = doc(db, "work_status", userId);
    try {
        const docSnap = await getDoc(statusRef);

        if (docSnap.exists() && docSnap.data().isWorking) {
            // Only execute if the user is currently working
            console.log(`User is working, executing ${action}.`);
            if (action === "break") {
                await handleBreakClick(true); // Call break function from timer.js (pass true for auto)
            } else if (action === "stop") {
                await handleStopClick(true); // Call stop function from timer.js (pass true for auto)
            }

            // Mark reservation as executed for today ONLY if action was attempted (even if internally skipped by handleBreak/Stop)
            const todayStr = getJSTDateString(new Date());
            const resRef = doc(db, `user_profiles/${userId}/reservations`, reservationId);
            await updateDoc(resRef, { lastExecutedDate: todayStr });
            console.log(`Reservation ${reservationId} marked as executed for ${todayStr}.`);

             // Find and update the local state too, to prevent re-execution before next snapshot
             const resIndex = userReservations.findIndex(r => r.id === reservationId);
             if (resIndex !== -1) {
                 userReservations[resIndex].lastExecutedDate = todayStr;
             }


        } else {
            // If user is not working, log that the action was skipped
            console.log(`Auto action skipped: ${action} (User not working at execution time ${executionTime.toLocaleTimeString()})`);
            // Do NOT mark as executed; it should try again if the user starts working later today and processReservations is called.
        }
    } catch (error) {
        console.error(`Error during automatic action execution (${action}, ID: ${reservationId}):`, error);
        // Avoid marking as executed on error to allow potential retry
    }
     // No need to call processReservations() here, it's called by state changes (like handleBreak/Stop) or Firestore snapshot
     updateReservationDisplay(); // Update UI in case execution status changed visibility
}


/**
 * Cancels all pending reservation timers for the current session
 * and resets the `lastExecutedDate` field in Firestore for all reservations,
 * making them eligible for execution again today if their time comes.
 */
export async function cancelAllReservations() {
    if (!userId) return;

    console.log("Cancelling all future reservation timers and resetting execution state for today.");

    // 1. Clear local timers immediately
    reservationTimers.forEach(clearTimeout);
    reservationTimers = [];
    console.log("Cleared local reservation timers.");

    // 2. Reset lastExecutedDate in Firestore for ALL reservations for this user
    if (userReservations.length > 0) {
        const batch = writeBatch(db);
        let requiresCommit = false;
        userReservations.forEach(res => {
            // Only reset if it *has* a lastExecutedDate (it might be null or undefined)
            if (res.lastExecutedDate) {
                const resRef = doc(db, `user_profiles/${userId}/reservations`, res.id);
                batch.update(resRef, { lastExecutedDate: null });
                requiresCommit = true;
            }
        });

        if (requiresCommit) {
            try {
                await batch.commit();
                console.log("Reset lastExecutedDate for relevant reservations in Firestore.");
                // Manually update local state after successful commit to reflect the reset
                userReservations = userReservations.map(res => ({ ...res, lastExecutedDate: null }));
            } catch (error) {
                console.error("Error resetting lastExecutedDate in Firestore:", error);
                // If Firestore update fails, local state might be out of sync.
                // A subsequent snapshot update should eventually correct it.
            }
        } else {
             console.log("No reservations needed Firestore reset for lastExecutedDate.");
        }

    } else {
        console.log("No local reservations to reset.");
    }

    // 3. Re-process reservations AFTER resetting Firestore.
    // This ensures timers are correctly set based on the now-reset execution status.
    // For example, if a break at 10:00 was executed, and user manually stops break at 09:50,
    // resetting lastExecutedDate makes the 10:00 break eligible again.
    // If user starts a new task before 10:00, processReservations will set the timer.
    processReservations(); // This will also update the display
}

/**
 * Deletes a specific reservation from Firestore.
 * @param {string} id - The Firestore document ID of the reservation to delete.
 */
export async function deleteReservation(id) {
    if (!userId || !id) return;
    console.log(`Attempting to delete reservation ${id}`);
    const resRef = doc(db, `user_profiles/${userId}/reservations`, id);
    try {
        await deleteDoc(resRef);
        console.log(`Reservation ${id} deleted successfully.`);
        // The onSnapshot listener will automatically update local state (`userReservations`)
        // and trigger `processReservations()` which clears timers and updates UI.
    } catch (error) {
        console.error(`Error deleting reservation ${id}:`, error);
        alert("予約の削除中にエラーが発生しました。"); // Notify user
    }
}

// --- Reservation UI Management Functions ---

/**
 * Updates the reservation display sections in the client view UI
 * based on the current `userReservations` state.
 */
export function updateReservationDisplay() {
    // Ensure elements exist before manipulating
    if (!breakList || !stopSetter || !stopStatus || !stopStatusText || !stopTimeInput) {
        // console.warn("Reservation UI elements not found. Skipping display update.");
        return; // Silently return if elements aren't present (e.g., view not active)
    }

    // --- Update Break Reservations List ---
    breakList.innerHTML = ""; // Clear existing list
    const breakReservations = userReservations
        .filter((r) => r.action === "break")
        .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99")); // Sort by time, handle nulls

    if (breakReservations.length > 0) {
        breakReservations.forEach((res) => {
            const div = document.createElement("div");
            div.className = "break-reservation-item flex justify-between items-center p-2 bg-gray-100 rounded-lg";
            div.dataset.id = res.id; // Store ID for event listeners
            div.innerHTML = `
                <span class="font-mono text-lg">${res.time || "??:??"}</span>
                <div>
                    <button class="edit-break-reservation-btn text-xs bg-blue-500 text-white font-bold py-1 px-2 rounded hover:bg-blue-600" data-id="${res.id}">編集</button>
                    <button class="delete-break-reservation-btn text-xs bg-red-500 text-white font-bold py-1 px-2 rounded hover:bg-red-600" data-id="${res.id}">削除</button>
                </div>
            `;
            breakList.appendChild(div);
        });
        // Add event listeners using event delegation on the parent list for efficiency
        // (This is handled in client.js's setupClientEventListeners)

    } else {
        breakList.innerHTML = '<p class="text-center text-sm text-gray-500">休憩予約はありません</p>';
    }

    // --- Update Stop Reservation Display ---
    const stopReservation = userReservations.find((r) => r.action === "stop");

    if (stopReservation) {
        stopStatusText.textContent = `予約時刻: ${stopReservation.time || "??:??"}`;
        stopSetter.classList.add("hidden"); // Hide the input/set button section
        stopStatus.classList.remove("hidden"); // Show the status display section
    } else {
        stopTimeInput.value = ""; // Clear input when no reservation exists
        stopSetter.classList.remove("hidden"); // Show the input/set button section
        stopStatus.classList.add("hidden"); // Hide the status display section
    }
}

/**
 * Handles saving or updating a break reservation. Called by the modal save button.
 */
export async function handleSaveBreakReservation() {
    // Find the modal elements within this scope or ensure they are passed/imported
    const timeInputElem = document.getElementById("break-reservation-time-input");
    const idInputElem = document.getElementById("break-reservation-id");

    if(!timeInputElem || !idInputElem) {
        console.error("Break reservation modal elements not found.");
        return;
    }

    const timeInputVal = timeInputElem.value;
    const id = idInputElem.value; // Will be empty string if adding new

    if (!timeInputVal) {
        alert("時間を指定してください。");
        return;
    }
    // Validate HH:MM format
    if (!/^\d{2}:\d{2}$/.test(timeInputVal)) {
        alert("時間は HH:MM 形式 (例: 09:30) で入力してください。");
        return;
    }

    // Prepare reservation data, always reset lastExecutedDate on save/update
    const reservationData = {
        time: timeInputVal, // Store as "HH:MM" string
        action: "break",
        lastExecutedDate: null, // Reset execution status
    };

    try {
        if (id) {
            // Edit existing reservation
            const resRef = doc(db, `user_profiles/${userId}/reservations`, id);
            await updateDoc(resRef, reservationData);
            console.log(`Break reservation ${id} updated to ${timeInputVal}.`);
        } else {
            // Add new reservation
            const resCol = collection(db, `user_profiles/${userId}/reservations`);
            await addDoc(resCol, reservationData);
            console.log(`New break reservation added at ${timeInputVal}.`);
        }
        // Close modal after successful save
        if(breakReservationModal) breakReservationModal.classList.add("hidden");
        // Firestore listener will trigger processReservations and UI update.

    } catch (error) {
        console.error("Error saving break reservation:", error);
        alert("予約の保存中にエラーが発生しました。");
    }
}

/**
 * Handles setting the stop reservation time. Deletes existing stop reservations first.
 */
export async function handleSetStopReservation() {
    if (!stopTimeInput) return;
    const timeInputVal = stopTimeInput.value;

    if (!timeInputVal) {
        alert("時間を指定してください。");
        return;
    }
     // Validate HH:MM format
    if (!/^\d{2}:\d{2}$/.test(timeInputVal)) {
        alert("時間は HH:MM 形式 (例: 17:30) で入力してください。");
        return;
    }


    const batch = writeBatch(db);

    // Find and delete any existing stop reservations for this user
    const stopReservations = userReservations.filter((r) => r.action === "stop");
    stopReservations.forEach((res) => {
        const resRef = doc(db, `user_profiles/${userId}/reservations`, res.id);
        batch.delete(resRef);
    });

    // Add the new stop reservation
    const newReservation = {
        time: timeInputVal, // Store as "HH:MM" string
        action: "stop",
        lastExecutedDate: null, // Reset execution status
    };
    const resCol = collection(db, `user_profiles/${userId}/reservations`);
    const newResRef = doc(resCol); // Auto-generate ID
    batch.set(newResRef, newReservation);

    try {
        await batch.commit();
        console.log(`Stop reservation set to ${timeInputVal}.`);
        // Firestore listener will trigger processReservations and UI update.
    } catch (error) {
        console.error("Error setting stop reservation:", error);
        alert("帰宅予約の設定中にエラーが発生しました。");
    }
}

/**
 * Handles canceling the stop reservation.
 */
export async function handleCancelStopReservation() {
    const stopReservation = userReservations.find((r) => r.action === "stop");

    if (stopReservation) {
        await deleteReservation(stopReservation.id); // Use the common delete function
    } else {
        console.log("No stop reservation found to cancel.");
        // Ensure UI is updated even if nothing was deleted (e.g., if local state was stale)
        updateReservationDisplay();
    }
}

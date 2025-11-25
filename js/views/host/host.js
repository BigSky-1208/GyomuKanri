// js/views/host.js
// Main coordinator for the Host (Admin) View.
// Imports functionalities from specialized modules like statusDisplay and userManagement.

import { db, showView, VIEWS } from "../../main.js"; // Import global state and functions
import { doc, setDoc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Import necessary Firestore functions (e.g., for Tomura status)
import { openAddUserModal, showHelpModal } from "../../components/modal.js"; // Import modal functions
import { openExportExcelModal } from "../excelExport.js"; // Import Excel export modal function

// Import functions from the host view submodules
import { startListeningForStatusUpdates, stopListeningForStatusUpdates, forceStopUser } from "./statusDisplay.js";
import { startListeningForUsers, stopListeningForUsers, handleUserDetailClick, handleAddNewUser, handleDeleteAllLogs, updateStatusesCache } from "./userManagement.js";

// --- DOM Element references for event listeners ---
const backButton = document.getElementById("back-to-selection-host");
const exportExcelButton = document.getElementById("export-excel-btn");
const viewProgressButton = document.getElementById("view-progress-btn");
const viewReportButton = document.getElementById("view-report-btn");
const openAddUserModalButton = document.getElementById("open-add-user-modal-btn");
const addUserModalSaveButton = document.getElementById("add-user-modal-save-btn"); // Listener in userManagement.js? No, modal handler is separate. Attach here.
const deleteAllLogsButton = document.getElementById("delete-all-logs-btn");
const userListContainer = document.getElementById("summary-list"); // For event delegation
const helpButton = document.querySelector('#host-view .help-btn');
const tomuraStatusRadios = document.querySelectorAll('input[name="tomura-status"]');

// --- Host View Initialization and Cleanup ---

/**
 * Initializes the Host view when it becomes active.
 * Starts Firestore listeners for statuses and user profiles.
 * Initializes Tomura status display.
 */
export function initializeHostView() {
    console.log("Initializing Host View...");
    startListeningForStatusUpdates(); // Start listener in statusDisplay.js
    startListeningForUsers();      // Start listener in userManagement.js
    listenForTomuraStatus();       // Start listener for Tomura's status display/control
    // Initial rendering will happen automatically when listeners receive data.
}

/**
 * Cleans up the Host view when it becomes inactive.
 * Stops Firestore listeners.
 */
export function cleanupHostView() {
    console.log("Cleaning up Host View...");
    stopListeningForStatusUpdates(); // Stop listener in statusDisplay.js
    stopListeningForUsers();      // Stop listener in userManagement.js
    // No need to stop Tomura status listener if it's managed globally or always needed
}

// --- Event Listener Setup ---

/**
 * Sets up all event listeners for the Host view.
 * Should be called once when the application initializes.
 */
export function setupHostEventListeners() {
    console.log("Setting up Host View event listeners...");

    // Navigation Buttons
    backButton?.addEventListener("click", () => showView(VIEWS.MODE_SELECTION));
    viewProgressButton?.addEventListener("click", () => {
        // Assuming isProgressViewReadOnly needs global scope or different management
        window.isProgressViewReadOnly = false; // TODO: Refactor global state if needed
        showView(VIEWS.PROGRESS);
    });
    viewReportButton?.addEventListener("click", () => showView(VIEWS.REPORT));

    // Admin Action Buttons
    exportExcelButton?.addEventListener("click", openExportExcelModal); // From excelExport.js
    openAddUserModalButton?.addEventListener("click", openAddUserModal); // From modal.js
    addUserModalSaveButton?.addEventListener("click", handleAddNewUser); // From userManagement.js
    deleteAllLogsButton?.addEventListener("click", handleDeleteAllLogs); // From userManagement.js

    // Tomura Status Radio Buttons
    tomuraStatusRadios.forEach((radio) => {
        radio.addEventListener("change", handleTomuraStatusChange);
    });

    // Event Delegation for User List clicks (details)
    userListContainer?.addEventListener("click", (event) => {
        // Pass the clicked element to the handler in userManagement.js
        handleUserDetailClick(event.target);
    });

    // Help Button
    helpButton?.addEventListener('click', () => showHelpModal('host'));

    console.log("Host View event listeners set up complete.");
    // Note: Force stop button listeners are handled within statusDisplay.js
}


// --- Specific Event Handlers (Managed by host.js) ---

/**
 * Handles changes to the Tomura status radio buttons.
 * Updates the status in Firestore.
 * @param {Event} event - The change event object.
 */
async function handleTomuraStatusChange(event) {
    const newStatus = event.target.value;
    console.log("Tomura status changed to:", newStatus);
    const statusRef = doc(db, "settings", "tomura_status");
    const todayStr = new Date().toISOString().split("T")[0]; // Use ISO string date for consistency
    try {
        // Update Firestore with the new status and today's date
        await setDoc(statusRef, {
            status: newStatus,
            date: todayStr, // Store date to reset daily if needed
        }, { merge: true }); // Merge to avoid overwriting unrelated settings if they exist
        console.log("Tomura status updated in Firestore.");
    } catch (error) {
        console.error("Error updating Tomura status in Firestore:", error);
        alert("戸村さんステータスの更新中にエラーが発生しました。");
        // Optionally revert radio button state here
    }
}

/**
 * Listens for changes in Tomura's status setting in Firestore and updates the radio buttons.
 * Resets status to default if the date stored is not today.
 */
function listenForTomuraStatus() {
    const statusRef = doc(db, "settings", "tomura_status");
    const todayStr = new Date().toISOString().split("T")[0];
    const defaultStatus = "声掛けNG"; // Default status

    // Using onSnapshot to react to changes made elsewhere (though primarily set here)
    onSnapshot(statusRef, async (docSnap) => {
        let statusToSet = defaultStatus;

        if (docSnap.exists() && docSnap.data().date === todayStr) {
            // If doc exists and date is today, use the stored status
            statusToSet = docSnap.data().status || defaultStatus;
        } else {
            // If doc doesn't exist, or date is not today, reset it to default '声掛けNG'.
            // Check if we need to write to prevent potential infinite loops if already default.
            if (
                !docSnap.exists() ||
                docSnap.data().status !== defaultStatus ||
                docSnap.data().date !== todayStr
            ) {
                try {
                    console.log("Resetting Tomura status to default for today.");
                    await setDoc(statusRef, { status: defaultStatus, date: todayStr }, { merge: true });
                    // statusToSet remains defaultStatus
                } catch (error) {
                    console.error("Error resetting Tomura's status:", error);
                    // Keep the default status in case of error
                }
            }
            // If already default and today's date, statusToSet remains defaultStatus
        }

        // Update the radio buttons in the Host view UI
        const currentRadio = document.querySelector(`input[name="tomura-status"][value="${statusToSet}"]`);
        if (currentRadio) {
            currentRadio.checked = true;
        } else {
             // Fallback if status value is somehow invalid, check the default
             const defaultRadio = document.querySelector(`input[name="tomura-status"][value="${defaultStatus}"]`);
             if (defaultRadio) defaultRadio.checked = true;
        }

    }, (error) => {
        console.error("Error listening for Tomura's status:", error);
        // Set UI to default on error
        const defaultRadio = document.querySelector(`input[name="tomura-status"][value="${defaultStatus}"]`);
        if (defaultRadio) defaultRadio.checked = true;
    });
}

// js/views/client.js
// This file acts as the main coordinator for the client view,
// importing functionalities from specialized modules.

import { showView, VIEWS } from "../../main.js"; // Import view management
import { handleStartClick, handleStopClick, handleBreakClick, restoreClientState as restoreTimerState } from "./client/timer.js"; // Import timer actions
import { listenForUserReservations, handleSaveBreakReservation, handleSetStopReservation, handleCancelStopReservation, deleteReservation } from "./client/reservations.js"; // Import reservation actions
// goalProgress functions are mainly called by clientUI, so direct import might not be needed here unless for specific setup
// import {} from './client/goalProgress.js';
// colleagues functions are mainly called by timer (startTask), so direct import might not be needed here
// import {} from './client/colleagues.js';
import { handleTaskSelectionChange, handleGoalSelectionChange, handleDisplaySettingChange, renderTaskOptions, renderTaskDisplaySettings } from "./client/clientUI.js"; // Import UI update handlers

// --- DOM Element references ---
// Get references to elements whose event listeners are set up here
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const breakBtn = document.getElementById("break-btn");
const taskSelect = document.getElementById("task-select");
const goalSelect = document.getElementById("goal-select");
const otherTaskInput = document.getElementById("other-task-input"); // Needed for warning check on change/blur
const taskDisplaySettingsList = document.getElementById("task-display-settings-list");

// Reservation UI elements (listeners attached here or in reservations.js setup)
const addBreakReservationBtn = document.getElementById("add-break-reservation-btn");
const breakReservationList = document.getElementById("break-reservation-list"); // For delegation
const breakReservationSaveBtn = document.getElementById("break-reservation-save-btn"); // Modal button
const setStopReservationBtn = document.getElementById("set-stop-reservation-btn");
const cancelStopReservationBtn = document.getElementById("cancel-stop-reservation-btn");

// Navigation/Other buttons
const backButton = document.getElementById("back-to-selection-client");
const myRecordsButton = document.getElementById("my-records-btn");
const viewMyProgressButton = document.getElementById("view-my-progress-btn");
const fixCheckoutButton = document.getElementById("fix-yesterday-checkout-btn");

// Help Button
const helpButton = document.querySelector('#client-view .help-btn');

// Modal Elements (Imported from modal.js, but might need references if listeners set here)
import { openBreakReservationModal, fixCheckoutModal, showHelpModal } from "../../components/modal.js";
import { userName } from "../../main.js"; // Needed for my-records button


/**
 * Initializes the client view when it becomes active.
 * Restores the timer state and sets up listeners.
 */
export async function initializeClientView() {
    console.log("Initializing Client View...");
    await restoreTimerState(); // Restore timer, running task, etc. from timer.js
    listenForUserReservations(); // Start listening for reservation changes
    // UI elements like task options and display settings are likely rendered
    // within restoreTimerState or triggered by state changes it causes.
    // If not, explicitly call them here:
    // renderTaskOptions();
    // renderTaskDisplaySettings();
}

/**
 * Sets up all event listeners for the client view.
 * Should be called once when the application initializes.
 */
export function setupClientEventListeners() {
    console.log("Setting up Client View event listeners...");

    // Timer control buttons
    startBtn?.addEventListener("click", handleStartClick); // From timer.js
    stopBtn?.addEventListener("click", () => handleStopClick(false)); // From timer.js (false = manual)
    breakBtn?.addEventListener("click", () => handleBreakClick(false)); // From timer.js (false = manual)

    // Task and Goal selection
    taskSelect?.addEventListener("change", handleTaskSelectionChange); // From clientUI.js
    goalSelect?.addEventListener("change", handleGoalSelectionChange); // From clientUI.js

    // Other task input (for warning check)
    otherTaskInput?.addEventListener("change", handleTaskSelectionChange); // Trigger general update/check
    otherTaskInput?.addEventListener("blur", handleTaskSelectionChange);   // Trigger general update/check

    // Task display preferences
    taskDisplaySettingsList?.addEventListener("change", handleDisplaySettingChange); // From clientUI.js

    // --- Reservation UI Listeners ---
    addBreakReservationBtn?.addEventListener("click", () => openBreakReservationModal()); // From modal.js

    // Event delegation for edit/delete buttons within the break list
    breakReservationList?.addEventListener("click", (event) => {
         const target = event.target;
         const id = target.dataset.id;
         if (!id) return; // Ignore clicks not on buttons with data-id

         if (target.classList.contains("edit-break-reservation-btn")) {
            openBreakReservationModal(id); // Open modal for editing
         } else if (target.classList.contains("delete-break-reservation-btn")) {
             deleteReservation(id); // Call delete function from reservations.js
         }
    });

    breakReservationSaveBtn?.addEventListener("click", handleSaveBreakReservation); // From reservations.js
    setStopReservationBtn?.addEventListener("click", handleSetStopReservation);     // From reservations.js
    cancelStopReservationBtn?.addEventListener("click", handleCancelStopReservation); // From reservations.js

    // --- Navigation and Other Buttons ---
    backButton?.addEventListener("click", () => showView(VIEWS.MODE_SELECTION)); // Use imported showView

    myRecordsButton?.addEventListener("click", () => {
         if (userName) {
            showView(VIEWS.PERSONAL_DETAIL, { userName: userName }); // Pass current user's name
         } else {
             console.error("Cannot show personal records: userName is not defined.");
             // Optionally show an error message to the user
         }
    });

    viewMyProgressButton?.addEventListener("click", () => {
        // Assuming isProgressViewReadOnly needs to be set globally or managed differently now
        // This might need adjustment based on where isProgressViewReadOnly is defined/imported
         // For now, directly call showView
         // TODO: Refactor isProgressViewReadOnly handling if necessary
         window.isProgressViewReadOnly = true; // Temporary global scope, refactor later
         showView(VIEWS.PROGRESS);
    });

    fixCheckoutButton?.addEventListener("click", () => {
         // Assuming fixCheckoutModal is globally accessible or imported correctly
         if (fixCheckoutModal) {
             const dateInput = fixCheckoutModal.querySelector("#fix-checkout-date-input");
             if (dateInput) {
                 const yesterday = new Date();
                 yesterday.setDate(yesterday.getDate() - 1);
                 dateInput.value = yesterday.toISOString().split("T")[0];
             }
            fixCheckoutModal.classList.remove("hidden");
         } else {
             console.error("Fix checkout modal not found.");
         }
    });

     // Help Button
     helpButton?.addEventListener('click', () => showHelpModal('client'));

     console.log("Client View event listeners set up complete.");

}

// Optional: Function to clean up when leaving the client view (e.g., stop listeners not handled elsewhere)
// export function cleanupClientView() {
//     console.log("Cleaning up Client View...");
//     // Stop colleagues listener specifically if not handled by stopCurrentTask
//     // stopColleaguesListener();
//     // Stop reservation listener? Maybe not, if needed globally or handled by auth state change
//     // if(reservationsUnsubscribe) reservationsUnsubscribe();
// }


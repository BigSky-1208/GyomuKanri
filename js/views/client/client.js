// js/views/client/client.js

import { showView, VIEWS } from "../../main.js"; 
import { handleStartClick, handleStopClick, handleBreakClick, restoreClientState as restoreTimerState } from "./timer.js"; 
import { listenForUserReservations, handleSaveBreakReservation, handleSetStopReservation, handleCancelStopReservation, deleteReservation } from "./reservations.js"; 
import { handleTaskSelectionChange, handleGoalSelectionChange, handleDisplaySettingChange } from "./clientUI.js"; 
// ★追加: 退勤修正アクションをインポート
import { handleFixCheckout } from "./clientActions.js";

// --- DOM Element references ---
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const breakBtn = document.getElementById("break-btn");
const taskSelect = document.getElementById("task-select");
const goalSelect = document.getElementById("goal-select");
const otherTaskInput = document.getElementById("other-task-input"); 
const taskDisplaySettingsList = document.getElementById("task-display-settings-list");

// Reservation UI elements
const addBreakReservationBtn = document.getElementById("add-break-reservation-btn");
const breakReservationList = document.getElementById("break-reservation-list"); 
const breakReservationSaveBtn = document.getElementById("break-reservation-save-btn"); 
const setStopReservationBtn = document.getElementById("set-stop-reservation-btn");
const cancelStopReservationBtn = document.getElementById("cancel-stop-reservation-btn");

// Navigation/Other buttons
const backButton = document.getElementById("back-to-selection-client");
const myRecordsButton = document.getElementById("my-records-btn");
const viewMyProgressButton = document.getElementById("view-my-progress-btn");
const fixCheckoutButton = document.getElementById("fix-yesterday-checkout-btn");
// ★追加: 退勤修正保存ボタン
const fixCheckoutSaveBtn = document.getElementById("fix-checkout-save-btn");

// Help Button
const helpButton = document.querySelector('#client-view .help-btn');

import { openBreakReservationModal, fixCheckoutModal, showHelpModal } from "../../components/modal.js";
import { userName } from "../../main.js"; 


/**
 * Initializes the client view when it becomes active.
 */
export async function initializeClientView() {
    console.log("Initializing Client View...");
    await restoreTimerState(); 
    listenForUserReservations(); 
}

/**
 * Sets up all event listeners for the client view.
 */
export function setupClientEventListeners() {
    console.log("Setting up Client View event listeners...");

    // Timer control buttons
    startBtn?.addEventListener("click", handleStartClick); 
    stopBtn?.addEventListener("click", () => handleStopClick(false)); 
    breakBtn?.addEventListener("click", () => handleBreakClick(false)); 

    // Task and Goal selection
    taskSelect?.addEventListener("change", handleTaskSelectionChange); 
    goalSelect?.addEventListener("change", handleGoalSelectionChange); 

    // Other task input
    otherTaskInput?.addEventListener("change", handleTaskSelectionChange); 
    otherTaskInput?.addEventListener("blur", handleTaskSelectionChange);   

    // Task display preferences
    taskDisplaySettingsList?.addEventListener("change", handleDisplaySettingChange); 

    // --- Reservation UI Listeners ---
    addBreakReservationBtn?.addEventListener("click", () => openBreakReservationModal()); 

    breakReservationList?.addEventListener("click", (event) => {
         const target = event.target;
         const id = target.dataset.id;
         if (!id) return; 

         if (target.classList.contains("edit-break-reservation-btn")) {
            openBreakReservationModal(id); 
         } else if (target.classList.contains("delete-break-reservation-btn")) {
             deleteReservation(id); 
         }
    });

    breakReservationSaveBtn?.addEventListener("click", handleSaveBreakReservation); 
    setStopReservationBtn?.addEventListener("click", handleSetStopReservation);     
    cancelStopReservationBtn?.addEventListener("click", handleCancelStopReservation); 

    // --- Navigation and Other Buttons ---
    backButton?.addEventListener("click", () => showView(VIEWS.MODE_SELECTION)); 

    myRecordsButton?.addEventListener("click", () => {
         if (userName) {
            showView(VIEWS.PERSONAL_DETAIL, { userName: userName }); 
         } else {
             console.error("Cannot show personal records: userName is not defined.");
         }
    });

    viewMyProgressButton?.addEventListener("click", () => {
         window.isProgressViewReadOnly = true; 
         showView(VIEWS.PROGRESS);
    });

    fixCheckoutButton?.addEventListener("click", () => {
         if (fixCheckoutModal) {
             const dateInput = fixCheckoutModal.querySelector("#fix-checkout-date-input");
             // 手動で開くときはキャンセルボタンを表示する
             const cancelBtn = fixCheckoutModal.querySelector("#fix-checkout-cancel-btn");
             if (cancelBtn) cancelBtn.style.display = "inline-block";

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

    // ★追加: 退勤修正保存ボタンのリスナー
    fixCheckoutSaveBtn?.addEventListener("click", handleFixCheckout);

     // Help Button
     helpButton?.addEventListener('click', () => showHelpModal('client'));

     console.log("Client View event listeners set up complete.");
}

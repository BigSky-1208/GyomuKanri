// js/views/host/host.js

import { db, showView, VIEWS } from "../../main.js"; 
import { doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; 
import { showHelpModal } from "../../components/modal.js"; 
import { openExportExcelModal } from "../../excelExport.js"; 

import { startListeningForStatusUpdates, stopListeningForStatusUpdates, forceStopUser } from "./statusDisplay.js";
import { startListeningForUsers, stopListeningForUsers, handleUserDetailClick, handleDeleteAllLogs } from "./userManagement.js";

// --- DOM Element references for event listeners ---
const backButton = document.getElementById("back-to-selection-host");
const exportExcelButton = document.getElementById("export-excel-btn");
const viewProgressButton = document.getElementById("view-progress-btn");
const viewReportButton = document.getElementById("view-report-btn");
// ★削除: openAddUserModalButton の取得を削除
// const openAddUserModalButton = document.getElementById("open-add-user-modal-btn");
const addUserModalSaveButton = document.getElementById("add-user-modal-save-btn"); 
const deleteAllLogsButton = document.getElementById("delete-all-logs-btn");
const userListContainer = document.getElementById("summary-list"); 
const helpButton = document.querySelector('#host-view .help-btn');
const tomuraStatusRadios = document.querySelectorAll('input[name="tomura-status"]');

/**
 * Initializes the Host view when it becomes active.
 */
export function initializeHostView() {
    console.log("Initializing Host View...");
    startListeningForStatusUpdates(); 
    startListeningForUsers();      
    listenForTomuraStatus();       
}

/**
 * Cleans up the Host view when it becomes inactive.
 */
export function cleanupHostView() {
    console.log("Cleaning up Host View...");
    stopListeningForStatusUpdates(); 
    stopListeningForUsers();      
}

// --- Event Listener Setup ---

/**
 * Sets up all event listeners for the Host view.
 */
export function setupHostEventListeners() {
    console.log("Setting up Host View event listeners...");

    // Navigation Buttons
    backButton?.addEventListener("click", () => showView(VIEWS.MODE_SELECTION));
    viewProgressButton?.addEventListener("click", () => {
        window.isProgressViewReadOnly = false; 
        showView(VIEWS.PROGRESS);
    });
    viewReportButton?.addEventListener("click", () => showView(VIEWS.REPORT));

    // Admin Action Buttons
    exportExcelButton?.addEventListener("click", openExportExcelModal); 
    
    // ★削除: ユーザー追加モーダルを開くボタンのリスナーを削除
    // openAddUserModalButton?.addEventListener("click", openAddUserModal);

    // ★維持: handleAddNewUser は userManagement.js に残っているため、このリスナーは残しておくが
    // UI上ボタンが押せなくなるため実質動作しない（整合性のため残す）
    // addUserModalSaveButton?.addEventListener("click", handleAddNewUser); 
    
    deleteAllLogsButton?.addEventListener("click", handleDeleteAllLogs); 

    // Tomura Status Radio Buttons
    tomuraStatusRadios.forEach((radio) => {
        radio.addEventListener("change", handleTomuraStatusChange);
    });

    // Event Delegation for User List clicks (details)
    userListContainer?.addEventListener("click", (event) => {
        handleUserDetailClick(event.target);
    });

    // Help Button
    helpButton?.addEventListener('click', () => showHelpModal('host'));

    console.log("Host View event listeners set up complete.");
}


// --- Specific Event Handlers (Managed by host.js) ---

async function handleTomuraStatusChange(event) {
    const newStatus = event.target.value;
    console.log("Tomura status changed to:", newStatus);
    const statusRef = doc(db, "settings", "tomura_status");
    const todayStr = new Date().toISOString().split("T")[0]; 
    try {
        await setDoc(statusRef, {
            status: newStatus,
            date: todayStr, 
        }, { merge: true }); 
        console.log("Tomura status updated in Firestore.");
    } catch (error) {
        console.error("Error updating Tomura status in Firestore:", error);
        alert("戸村さんステータスの更新中にエラーが発生しました。");
    }
}

function listenForTomuraStatus() {
    const statusRef = doc(db, "settings", "tomura_status");
    const todayStr = new Date().toISOString().split("T")[0];
    const defaultStatus = "声掛けNG"; 

    onSnapshot(statusRef, async (docSnap) => {
        let statusToSet = defaultStatus;

        if (docSnap.exists() && docSnap.data().date === todayStr) {
            statusToSet = docSnap.data().status || defaultStatus;
        } else {
            if (
                !docSnap.exists() ||
                docSnap.data().status !== defaultStatus ||
                docSnap.data().date !== todayStr
            ) {
                try {
                    console.log("Resetting Tomura status to default for today.");
                    await setDoc(statusRef, { status: defaultStatus, date: todayStr }, { merge: true });
                } catch (error) {
                    console.error("Error resetting Tomura's status:", error);
                }
            }
        }

        const currentRadio = document.querySelector(`input[name="tomura-status"][value="${statusToSet}"]`);
        if (currentRadio) {
            currentRadio.checked = true;
        } else {
             const defaultRadio = document.querySelector(`input[name="tomura-status"][value="${defaultStatus}"]`);
             if (defaultRadio) defaultRadio.checked = true;
        }

    }, (error) => {
        console.error("Error listening for Tomura's status:", error);
        const defaultRadio = document.querySelector(`input[name="tomura-status"][value="${defaultStatus}"]`);
        if (defaultRadio) defaultRadio.checked = true;
    });
}

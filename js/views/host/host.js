// js/views/host/host.js

import { db, showView, VIEWS } from "../../main.js"; 
import { doc, setDoc, onSnapshot, collection, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; 
import { showHelpModal } from "../../components/modal.js"; 
import { openExportExcelModal } from "../../excelExport.js"; 

import { startListeningForStatusUpdates, stopListeningForStatusUpdates, forceStopUser } from "./statusDisplay.js";
import { startListeningForUsers, stopListeningForUsers, handleUserDetailClick, handleDeleteAllLogs } from "./userManagement.js";

const backButton = document.getElementById("back-to-selection-host");
const exportExcelButton = document.getElementById("export-excel-btn");
const viewProgressButton = document.getElementById("view-progress-btn");
const viewReportButton = document.getElementById("view-report-btn");
const deleteAllLogsButton = document.getElementById("delete-all-logs-btn");
const userListContainer = document.getElementById("summary-list"); 
const helpButton = document.querySelector('#host-view .help-btn');
const tomuraStatusRadios = document.querySelectorAll('input[name="tomura-status"]');

// ★追加: 承認画面ボタンの挿入とバッジ監視
function injectApprovalButton() {
    const container = document.querySelector("#host-view .flex.flex-wrap.gap-2.mb-6");
    if (!container || document.getElementById("view-approval-btn")) return;

    const btn = document.createElement("button");
    btn.id = "view-approval-btn";
    btn.className = "bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded shadow relative";
    btn.innerHTML = `
        業務時間追加変更承認
        <span id="approval-badge" class="absolute top-0 right-0 -mt-1 -mr-1 px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-full hidden">0</span>
    `;
    btn.onclick = () => showView(VIEWS.APPROVAL);
    container.insertBefore(btn, viewReportButton); // レポートボタンの前に追加

    // 未承認件数の監視
    const q = query(collection(db, "work_log_requests"), where("status", "==", "pending"));
    onSnapshot(q, (snap) => {
        const badge = document.getElementById("approval-badge");
        if (snap.size > 0) {
            badge.textContent = snap.size;
            badge.classList.remove("hidden");
        } else {
            badge.classList.add("hidden");
        }
    });
}

export function initializeHostView() {
    console.log("Initializing Host View...");
    startListeningForStatusUpdates(); 
    startListeningForUsers();      
    listenForTomuraStatus();
    
    // ★追加
    injectApprovalButton();
}

export function cleanupHostView() {
    console.log("Cleaning up Host View...");
    stopListeningForStatusUpdates(); 
    stopListeningForUsers();      
}

export function setupHostEventListeners() {
    console.log("Setting up Host View event listeners...");

    backButton?.addEventListener("click", () => showView(VIEWS.MODE_SELECTION));
    viewProgressButton?.addEventListener("click", () => {
        window.isProgressViewReadOnly = false; 
        showView(VIEWS.PROGRESS);
    });
    viewReportButton?.addEventListener("click", () => showView(VIEWS.REPORT));
    exportExcelButton?.addEventListener("click", openExportExcelModal); 
    deleteAllLogsButton?.addEventListener("click", handleDeleteAllLogs); 

    tomuraStatusRadios.forEach((radio) => {
        radio.addEventListener("change", handleTomuraStatusChange);
    });

    userListContainer?.addEventListener("click", (event) => {
        handleUserDetailClick(event.target);
    });

    helpButton?.addEventListener('click', () => showHelpModal('host'));
    console.log("Host View event listeners set up complete.");
}

async function handleTomuraStatusChange(event) {
    const newStatus = event.target.value;
    const statusRef = doc(db, "settings", "tomura_status");
    const todayStr = new Date().toISOString().split("T")[0]; 
    try {
        await setDoc(statusRef, {
            status: newStatus,
            date: todayStr, 
        }, { merge: true }); 
    } catch (error) {
        console.error("Error updating Tomura status:", error);
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
             // 日付が変わっている等の場合はリセット
             if (!docSnap.exists() || docSnap.data().date !== todayStr) {
                setDoc(statusRef, { status: defaultStatus, date: todayStr }, { merge: true }).catch(console.error);
             }
        }
        const currentRadio = document.querySelector(`input[name="tomura-status"][value="${statusToSet}"]`);
        if (currentRadio) currentRadio.checked = true;
    }, console.error);
}

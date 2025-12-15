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

function injectApprovalButton() {
    // すでに作成済みなら何もしない
    if (document.getElementById("view-approval-container")) return;

    // 基準となる「レポート表示」ボタンを探す
    const referenceBtn = document.getElementById("view-report-btn");
    
    if (referenceBtn) {
        // ボタンが並んでいるコンテナ（親要素）を取得
        const buttonGroup = referenceBtn.parentElement;

        // 新しいボタンを入れるコンテナを作成
        const container = document.createElement("div");
        container.id = "view-approval-container";
        
        // ★修正: 線が2本になるのを防ぐため、border-b (下線) を削除しました
        // mb-6 で下のリストとの間隔を確保しています
        container.className = "mb-6 mt-2 w-full"; 

        // 承認ボタンを作成
        const btn = document.createElement("button");
        btn.id = "view-approval-btn";
        
        // ★修正: w-full で横幅いっぱいに（長く）しました
        // ★修正: py-2 px-4 rounded shadow で他のボタンとサイズ感を統一しました
        btn.className = "w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded shadow flex items-center justify-center gap-3 transition duration-150 ease-in-out";
        
        btn.innerHTML = `
            <span>📩 業務時間申請を確認・承認する</span>
            <span id="approval-badge" class="bg-white text-orange-600 text-xs font-bold px-3 py-1 rounded-full hidden border border-orange-600">0</span>
        `;
        btn.onclick = () => showView(VIEWS.APPROVAL);

        container.appendChild(btn);

        // ボタン群エリアの「直後（下）」に挿入する
        if (buttonGroup && buttonGroup.parentNode) {
            buttonGroup.parentNode.insertBefore(container, buttonGroup.nextSibling);
        }

        // 未承認件数の監視（リアルタイム更新）
        const q = query(collection(db, "work_log_requests"), where("status", "==", "pending"));
        onSnapshot(q, (snap) => {
            const badge = document.getElementById("approval-badge");
            
            if (badge) {
                if (snap.size > 0) {
                    badge.textContent = `${snap.size}件`;
                    badge.classList.remove("hidden");
                    btn.classList.add("animate-pulse"); // 未承認があるときは点滅して知らせる
                } else {
                    badge.classList.add("hidden");
                    btn.classList.remove("animate-pulse");
                }
            }
        });
    } else {
        console.warn("injectApprovalButton: Reference button 'view-report-btn' not found.");
    }
}

export function initializeHostView() {
    console.log("Initializing Host View...");
    startListeningForStatusUpdates(); 
    startListeningForUsers();      
    listenForTomuraStatus();
    
    // ボタンを追加実行
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

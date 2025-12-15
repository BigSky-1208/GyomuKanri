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

// ★追加: 勤務場所選択UIを注入する関数
function injectTomuraLocationUI() {
    if (document.getElementById("tomura-location-container")) return;

    // 既存のステータス（声掛けOK/NG）のコンテナを探す
    // index.htmlの構造上、ラジオボタンの親要素の親要素あたりを狙う
    const statusContainer = document.querySelector('#host-view input[name="tomura-status"]')?.closest('.bg-white');

    if (statusContainer) {
        const wrapper = document.createElement("div");
        wrapper.id = "tomura-location-container";
        wrapper.className = "mb-4 p-4 bg-white rounded shadow border border-gray-200";
        
        wrapper.innerHTML = `
            <h3 class="font-bold text-gray-700 mb-2 border-b pb-1">勤務場所</h3>
            <div class="flex gap-6">
                <label class="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded transition">
                    <input type="radio" name="tomura-location" value="出社" class="form-radio h-5 w-5 text-blue-600">
                    <span class="ml-2 text-gray-800 font-bold">🏢 出社</span>
                </label>
                <label class="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded transition">
                    <input type="radio" name="tomura-location" value="リモート" class="form-radio h-5 w-5 text-orange-500">
                    <span class="ml-2 text-gray-800 font-bold">🏠 リモート</span>
                </label>
            </div>
        `;

        // 既存ステータスの上に挿入
        statusContainer.parentNode.insertBefore(wrapper, statusContainer);

        // イベントリスナー登録
        const radios = wrapper.querySelectorAll('input[name="tomura-location"]');
        radios.forEach(radio => {
            radio.addEventListener("change", handleTomuraLocationChange);
        });
    }
}

// 承認ボタンの注入（前回作成したもの）
function injectApprovalButton() {
    if (document.getElementById("view-approval-container")) return;
    const referenceBtn = document.getElementById("view-report-btn");
    
    if (referenceBtn) {
        const buttonGroup = referenceBtn.parentElement;
        const container = document.createElement("div");
        container.id = "view-approval-container";
        container.className = "mb-6 mt-2 w-full"; 

        const btn = document.createElement("button");
        btn.id = "view-approval-btn";
        btn.className = "w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded shadow flex items-center justify-center gap-3 transition duration-150 ease-in-out";
        
        btn.innerHTML = `
            <span>📩 業務時間申請を確認・承認する</span>
            <span id="approval-badge" class="bg-white text-orange-600 text-xs font-bold px-3 py-1 rounded-full hidden border border-orange-600">0</span>
        `;
        btn.onclick = () => showView(VIEWS.APPROVAL);

        container.appendChild(btn);
        if (buttonGroup && buttonGroup.parentNode) {
            buttonGroup.parentNode.insertBefore(container, buttonGroup.nextSibling);
        }

        const q = query(collection(db, "work_log_requests"), where("status", "==", "pending"));
        onSnapshot(q, (snap) => {
            const badge = document.getElementById("approval-badge");
            if (badge) {
                if (snap.size > 0) {
                    badge.textContent = `${snap.size}件`;
                    badge.classList.remove("hidden");
                    btn.classList.add("animate-pulse"); 
                } else {
                    badge.classList.add("hidden");
                    btn.classList.remove("animate-pulse");
                }
            }
        });
    }
}

export function initializeHostView() {
    console.log("Initializing Host View...");
    startListeningForStatusUpdates(); 
    startListeningForUsers();      
    
    injectTomuraLocationUI(); // ★追加
    listenForTomuraStatus();
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

// 声掛けステータスの変更ハンドラ
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

// ★追加: 勤務場所の変更ハンドラ
async function handleTomuraLocationChange(event) {
    const newLocation = event.target.value;
    const statusRef = doc(db, "settings", "tomura_status");
    const todayStr = new Date().toISOString().split("T")[0]; 
    try {
        await setDoc(statusRef, {
            location: newLocation,
            date: todayStr, 
        }, { merge: true }); 
    } catch (error) {
        console.error("Error updating Tomura location:", error);
    }
}

function listenForTomuraStatus() {
    const statusRef = doc(db, "settings", "tomura_status");
    const todayStr = new Date().toISOString().split("T")[0];
    const defaultStatus = "声掛けNG"; 
    const defaultLocation = "出社"; // デフォルト

    onSnapshot(statusRef, async (docSnap) => {
        let statusToSet = defaultStatus;
        let locationToSet = defaultLocation;

        if (docSnap.exists() && docSnap.data().date === todayStr) {
            statusToSet = docSnap.data().status || defaultStatus;
            locationToSet = docSnap.data().location || defaultLocation;
        } else {
             // 日付が変わっている等の場合はリセット
             if (!docSnap.exists() || docSnap.data().date !== todayStr) {
                setDoc(statusRef, { 
                    status: defaultStatus, 
                    location: defaultLocation,
                    date: todayStr 
                }, { merge: true }).catch(console.error);
             }
        }

        // ラジオボタンの状態更新
        const statusRadio = document.querySelector(`input[name="tomura-status"][value="${statusToSet}"]`);
        if (statusRadio) statusRadio.checked = true;

        // ★追加: 場所ラジオボタンの状態更新
        const locationRadio = document.querySelector(`input[name="tomura-location"][value="${locationToSet}"]`);
        if (locationRadio) locationRadio.checked = true;

    }, console.error);
}

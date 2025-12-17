// js/views/host/host.js

import { db, showView, VIEWS } from "../../main.js"; 
import { doc, setDoc, onSnapshot, collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { openMessageModal, showHelpModal } from "../../components/modal.js"; 
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

// ★追加: 既存の「戸村さんステータス」の中に勤務地選択を挿入する関数
function injectTomuraLocationUI() {
    if (document.getElementById("tomura-location-container")) return;

    const statusRadio = document.querySelector('#host-view input[name="tomura-status"]');
    
    if (statusRadio) {
        const radioGroupParent = statusRadio.parentElement.parentElement; 

        if (radioGroupParent) {
            const wrapper = document.createElement("div");
            wrapper.id = "tomura-location-container";
            
            wrapper.innerHTML = `
                <div class="flex gap-4">
                    <label class="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded transition">
                        <input type="radio" name="tomura-location" value="出社" class="form-radio h-4 w-4 text-blue-600">
                        <span class="ml-2 text-gray-800 text-sm font-bold">🏢 出社</span>
                    </label>
                    <label class="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded transition">
                        <input type="radio" name="tomura-location" value="リモート" class="form-radio h-4 w-4 text-orange-500">
                        <span class="ml-2 text-gray-800 text-sm font-bold">🏠 リモート</span>
                    </label>
                </div>
            `;
            radioGroupParent.insertBefore(wrapper, statusRadio.parentElement);

            const radios = wrapper.querySelectorAll('input[name="tomura-location"]');
            radios.forEach(radio => {
                radio.addEventListener("change", handleTomuraLocationChange);
            });
        }
    }
}

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
    } else {
        console.warn("injectApprovalButton: Reference button 'view-report-btn' not found.");
    }
}

export function initializeHostView() {
    console.log("Initializing Host View...");
    
    injectTomuraLocationUI();
    injectApprovalButton();
    injectMessageFeature(); 

    startListeningForStatusUpdates(); 
    startListeningForUsers();      
    listenForTomuraStatus();
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
    const defaultLocation = "出社"; 

    onSnapshot(statusRef, async (docSnap) => {
        let statusToSet = defaultStatus;
        let locationToSet = defaultLocation; 

        if (docSnap.exists() && docSnap.data().date === todayStr) {
            statusToSet = docSnap.data().status || defaultStatus;
            locationToSet = docSnap.data().location || defaultLocation; 
        } else {
             if (!docSnap.exists() || docSnap.data().date !== todayStr) {
                setDoc(statusRef, { 
                    status: defaultStatus, 
                    location: defaultLocation, 
                    date: todayStr 
                }, { merge: true }).catch(console.error);
             }
        }
        
        const currentRadio = document.querySelector(`input[name="tomura-status"][value="${statusToSet}"]`);
        if (currentRadio) currentRadio.checked = true;

        const locationRadio = document.querySelector(`input[name="tomura-location"][value="${locationToSet}"]`);
        if (locationRadio) locationRadio.checked = true;

    }, console.error);
}

// ★追加: メッセージモーダルと送信ボタンを注入する関数
function injectMessageFeature() {
    // 1. モーダルHTMLの注入
    if (!document.getElementById("message-modal")) {
        const modalHtml = `
        <div id="message-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-50 p-4">
            <div class="bg-white p-6 rounded-xl shadow-lg max-w-lg w-full">
                <h2 class="text-xl font-bold mb-4 text-gray-700 border-b pb-2">📢 メッセージ送信</h2>
                
                <div class="mb-4">
                    <label class="block text-sm font-bold text-gray-700 mb-2">送信先を選択</label>
                    <div class="flex gap-4 mb-3">
                        <label class="flex items-center cursor-pointer"><input type="radio" name="message-target-type" value="individual" class="mr-1" checked>個人</label>
                        <label class="flex items-center cursor-pointer"><input type="radio" name="message-target-type" value="working" class="mr-1">現在の業務中</label>
                        <label class="flex items-center cursor-pointer"><input type="radio" name="message-target-type" value="manual" class="mr-1">手動選択</label>
                    </div>

                    <div id="message-target-individual-container">
                        <select id="message-user-select" class="w-full p-2 border rounded bg-white"></select>
                    </div>

                    <div class="hidden bg-blue-50 p-3 rounded text-blue-800 text-sm mb-2">
                        <span id="message-target-working-info"></span>
                    </div>

                    <div id="message-target-manual-container" class="hidden border rounded max-h-32 overflow-y-auto p-2 bg-gray-50">
                        <div id="message-manual-list" class="space-y-1"></div>
                    </div>
                </div>

                <div class="mb-3">
                    <label class="block text-sm font-bold text-gray-700 mb-1">タイトル</label>
                    <input type="text" id="message-title-input" class="w-full p-2 border rounded" placeholder="例: 連絡事項">
                </div>
                
                <div class="mb-6">
                    <label class="block text-sm font-bold text-gray-700 mb-1">メッセージ内容</label>
                    <textarea id="message-body-input" rows="4" class="w-full p-2 border rounded" placeholder="メッセージを入力してください"></textarea>
                </div>

                <div class="flex justify-end gap-3">
                    <button id="message-cancel-btn" class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded">キャンセル</button>
                    <button id="message-send-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded flex items-center gap-2">
                        <span>送信</span> 🚀
                    </button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // 2. 送信ボタンの注入 (承認ボタンの上)
    const approvalContainer = document.getElementById("view-approval-container");
    if (approvalContainer && !document.getElementById("open-message-modal-btn")) {
        const msgBtnContainer = document.createElement("div");
        // ★変更: mt-6 を追加して間隔を広げました
        msgBtnContainer.className = "mb-4 mt-6 w-full"; 
        msgBtnContainer.innerHTML = `
            <button id="open-message-modal-btn" class="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded shadow flex items-center justify-center gap-2 transition duration-150">
                📢 メッセージを作成・送信する
            </button>
        `;
        approvalContainer.parentNode.insertBefore(msgBtnContainer, approvalContainer);

        document.getElementById("open-message-modal-btn").addEventListener("click", handleOpenMessageModal);
    }
}

// ★追加: モーダルを開く処理（データの準備）
async function handleOpenMessageModal() {
    console.log("メッセージボタンがクリックされました。");

    // モーダル関数が読み込まれているかチェック
    if (typeof openMessageModal !== 'function') {
        alert("エラー: メッセージ機能の読み込みに失敗しました。\n(modal.js に openMessageModal が実装されていない可能性があります)");
        return;
    }

    try {
        // 1. 全ユーザー情報の取得
        const usersSnap = await getDocs(collection(db, "user_profiles"));
        const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 2. 現在稼働中ユーザーのID取得
        const activeLogsSnap = await getDocs(query(collection(db, "work_logs"), where("status", "==", "active")));
        const workingUserIds = [...new Set(activeLogsSnap.docs.map(d => d.data().userId))];

        // 3. モーダルオープン
        openMessageModal(allUsers, workingUserIds, executeSendMessage);

    } catch (error) {
        console.error("データ取得エラー:", error);
        alert("ユーザー情報の取得に失敗しました:\n" + error.message);
    }
}

// ★追加: 送信実行処理
async function executeSendMessage(targetIds, title, bodyContent) {
    if (!targetIds || targetIds.length === 0) return;

    const confirmMsg = `${targetIds.length}名にメッセージを送信しますか？`;
    if (!confirm(confirmMsg)) return;

    try {
        // 1. 履歴の保存
        const timestamp = new Date().toISOString();
        const writePromises = targetIds.map(uid => {
            return addDoc(collection(db, "user_profiles", uid, "messages"), {
                title: title,
                body: bodyContent,
                createdAt: timestamp,
                read: false,
                sender: "管理者"
            });
        });
        await Promise.all(writePromises);

        // 2. 通知の送信 (Cloudflare Workers)
        // ※環境に合わせてURLを変更してください
        const WORKER_URL = "https://gyomu-timer-worker.bigsky-1208.workers.dev/send-message"; 
        
        targetIds.forEach(uid => {
            fetch(WORKER_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetUserId: uid,
                    title: title,
                    body: bodyContent
                })
            }).catch(e => console.error(`通知送信エラー (${uid}):`, e));
        });

        alert("メッセージを送信しました！");

    } catch (error) {
        console.error("送信エラー:", error);
        alert("送信中にエラーが発生しました。");
    }
}

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

// --- 既存機能: 戸村さんステータスUI ---
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

// --- 既存機能: 承認ボタン ---
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

// --- メッセージ機能の実装 ---

function injectMessageFeature() {
    // 古いモーダルがあれば削除して作り直す
    const existingModal = document.getElementById("message-modal");
    if (existingModal) {
        existingModal.remove();
    }

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
                    <div class="mb-2 font-bold text-gray-700">対象の業務を選択:</div>
                    <select id="message-working-task-select" class="w-full p-2 border border-blue-300 rounded bg-white text-gray-800 font-bold mb-2"></select>
                    <span id="message-target-working-info" class="text-xs text-gray-500"></span>
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

    // 送信ボタンの注入
    const approvalContainer = document.getElementById("view-approval-container");
    if (approvalContainer && !document.getElementById("open-message-modal-btn")) {
        const msgBtnContainer = document.createElement("div");
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

// js/views/host/host.js 内の handleOpenMessageModal を差し替え

async function handleOpenMessageModal() {
    console.log("メッセージモーダルを起動します...");

    if (typeof openMessageModal !== 'function') {
        alert("エラー: モーダル機能が読み込めていません。");
        return;
    }

    try {
        // 1. 全ユーザー情報の取得 (手動選択用)
        // doc.id (英数字のUID) を確実に ID としてセットします
        const usersSnap = await getDocs(collection(db, "user_profiles"));
        const allUsers = usersSnap.docs.map(doc => {
            const data = doc.id === doc.data().name ? {} : doc.data(); // 安全策
            return {
                id: doc.id, // ★ここが 2rsTr... のようなUIDになる
                displayName: data.displayName || data.name || "名称未設定"
            };
        }).sort((a, b) => a.displayName.localeCompare(b.displayName, "ja"));

        // 2. 現在の稼働状況を取得 (業務別送信用)
        const statusSnap = await getDocs(collection(db, "work_status"));
        
        const workingData = {
            all: [],     // 全稼働者ID
            byTask: {}   // 業務名ごとのIDリスト
        };

        statusSnap.forEach(doc => {
            const data = doc.data();
            // 稼働中かつ休憩中でない
            if (data.isWorking && data.currentTask && data.currentTask !== "休憩") {
                const uid = doc.id; // ★ドキュメントID = ユーザーUID
                let taskName = data.currentTask;

                if (taskName.startsWith("その他_")) {
                    taskName = taskName.replace("その他_", "");
                }

                workingData.all.push(uid);

                if (!workingData.byTask[taskName]) {
                    workingData.byTask[taskName] = [];
                }
                workingData.byTask[taskName].push(uid);
            }
        });

        // 3. モーダルを表示
        // ここで渡す allUsers の各要素の 'id' が UID であることが重要です
        openMessageModal(allUsers, workingData, executeSendMessage);

    } catch (error) {
        console.error("データ取得エラー:", error);
        alert("送信先データの取得に失敗しました。");
    }
}

async function executeSendMessage(targetIds, title, bodyContent) {
    if (!targetIds || targetIds.length === 0) return;

    const confirmMsg = `${targetIds.length}名にメッセージを送信しますか？`;
    if (!confirm(confirmMsg)) return;

    try {
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

        // ★WorkerのURLを確認 (末尾 /send-message)
        const WORKER_URL = "https://muddy-night-4bd4.sora-yamashita.workers.dev/send-message"; 
        
        let errorReport = [];
        let successTotal = 0;

        const sendPromises = targetIds.map(async (uid) => {
            try {
                const response = await fetch(WORKER_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        targetUserId: uid,
                        title: title,
                        body: bodyContent
                    })
                });

                const result = await response.json();

                if (!result.success) {
                    // エラー詳細があれば追加
                    const msg = result.error || (result.errors ? result.errors.join(", ") : "不明なエラー");
                    errorReport.push(`${uid}: ${msg}`);
                } else {
                    successTotal += result.sent || 0;
                    // 一部失敗している場合
                    if (result.errors && result.errors.length > 0) {
                        errorReport.push(`${uid}: ${result.errors.join(", ")}`);
                    }
                }
            } catch (e) {
                errorReport.push(`${uid}: 通信エラー ${e.message}`);
            }
        });

        await Promise.all(sendPromises);

        if (errorReport.length > 0) {
            alert(`【送信結果】\n成功: ${successTotal}件\n失敗/警告: ${errorReport.length}件\n\n詳細:\n${errorReport.join("\n")}`);
        } else {
            alert(`送信完了！\n${successTotal}件の通知を送信しました。`);
        }

    } catch (error) {
        console.error("送信エラー:", error);
        alert("送信処理中にエラーが発生しました。");
    }
}

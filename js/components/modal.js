// js/components/modal.js 
// 全文を上書きしてください

import { allTaskObjects, escapeHtml } from "../main.js";
import { userReservations } from '../views/client/reservations.js';

// --- DOM Element References ---

export const confirmationModal = document.getElementById("confirmation-modal");
export const adminPasswordView = document.getElementById("admin-password-view");
export const editLogModal = document.getElementById("edit-log-modal");
export const fixCheckoutModal = document.getElementById("fix-checkout-modal");
export const editMemoModal = document.getElementById("edit-memo-modal");
export const helpModal = document.getElementById("help-modal");
export const goalDetailsModal = document.getElementById("goal-details-modal");
export const goalModal = document.getElementById("goal-modal");
export const exportExcelModal = document.getElementById("export-excel-modal");
export const editContributionModal = document.getElementById("edit-contribution-modal");
export const breakReservationModal = document.getElementById("break-reservation-modal");
export const addUserModal = document.getElementById("add-user-modal");

// 業務編集モーダル用の要素
export const taskModal = document.getElementById("task-modal");
const taskNameInput = document.getElementById("task-name-input");
const taskCategorySelect = document.getElementById("task-category-select");
const taskMemoInput = document.getElementById("task-memo-input");
const taskModalTitle = document.getElementById("task-modal-title");
const taskModalCancelBtn = document.getElementById("task-cancel-btn");

// Confirmation Modal Elements
const modalMessage = document.getElementById("modal-message");
let modalConfirmBtn = document.getElementById("modal-confirm-btn");
let modalCancelBtn = document.getElementById("modal-cancel-btn");

// Goal Modal Elements
const goalModalTitle = document.getElementById("goal-modal-title");
const goalModalTaskNameInput = document.getElementById("goal-modal-task-name");
const goalModalGoalIdInput = document.getElementById("goal-modal-goal-id");
const goalModalTitleInput = document.getElementById("goal-modal-title-input");
const goalModalTargetInput = document.getElementById("goal-modal-target-input");
const goalModalDeadlineInput = document.getElementById("goal-modal-deadline-input");
const goalModalEffortDeadlineInput = document.getElementById("goal-modal-effort-deadline-input");
const goalModalMemoInput = document.getElementById("goal-modal-memo-input");
const goalModalCancelBtn = document.getElementById("goal-modal-cancel-btn");

// Add User Modal Elements
const addUserModalNameInput = document.getElementById("add-user-modal-name-input");
const addUserModalError = document.getElementById("add-user-modal-error");
const addUserModalCancelBtn = document.getElementById("add-user-modal-cancel-btn");

// Help Modal Elements
const helpModalTitle = document.getElementById("help-modal-title");
const helpModalContent = document.getElementById("help-modal-content");
const helpModalCloseBtn = document.getElementById("help-modal-close-btn");

// Goal Details Modal Elements
const goalDetailsModalTitle = document.getElementById("goal-details-modal-title");
const goalDetailsModalContent = document.getElementById("goal-details-modal-content");
const goalDetailsModalCloseBtn = document.getElementById("goal-details-modal-close-btn");

// Break Reservation Modal Elements
const breakReservationModalTitle = document.getElementById("break-reservation-modal-title");
const breakReservationTimeInput = document.getElementById("break-reservation-time-input");
const breakReservationIdInput = document.getElementById("break-reservation-id");
const breakReservationCancelBtn = document.getElementById("break-reservation-cancel-btn");

// Admin Password Modal Elements
const adminPasswordCancelBtn = document.getElementById("admin-password-cancel-btn");
const adminPasswordError = document.getElementById("admin-password-error");
const adminPasswordInput = document.getElementById("admin-password-input");
const adminPasswordSubmitBtn = document.getElementById("admin-password-submit-btn");

// --- State ---
let onConfirmCallback = null;

// --- Basic Modal Functions ---

export function closeModal(modalElement) {
    if (modalElement) {
        modalElement.classList.add("hidden");
    }
}

function showModal(modalElement) {
    if (modalElement) {
        modalElement.classList.remove("hidden");
    }
}

// --- Message Modal (管理者メッセージ機能) ---

// ★修正: workingData引数を受け取り、タスク選択プルダウンを生成
export function openMessageModal(allUsers, workingData, onSendCallback) {
    const messageModal = document.getElementById("message-modal");
    if (!messageModal) {
        console.error("Message modal element not found. Make sure injectMessageFeature() runs first.");
        return;
    }

    const messageTitleInput = document.getElementById("message-title-input");
    const messageBodyInput = document.getElementById("message-body-input");
    const messageSendBtn = document.getElementById("message-send-btn");
    const messageCancelBtn = document.getElementById("message-cancel-btn");
    const messageTargetRadios = document.getElementsByName("message-target-type");
    const messageUserSelect = document.getElementById("message-user-select");
    const messageManualList = document.getElementById("message-manual-list");
    const messageTargetWorkingInfo = document.getElementById("message-target-working-info");
    const messageTargetIndividualContainer = document.getElementById("message-target-individual-container");
    const messageTargetManualContainer = document.getElementById("message-target-manual-container");
    // ★追加: 業務選択用プルダウン
    const messageWorkingTaskSelect = document.getElementById("message-working-task-select");
    const messageTargetWorkingContainer = messageTargetWorkingInfo.parentElement;

    // 入力欄リセット
    messageTitleInput.value = "";
    messageBodyInput.value = "";
    
    // ターゲット選択の初期化
    if(messageTargetRadios[0]) messageTargetRadios[0].checked = true;
    
    // UI表示切り替えヘルパー
    const updateTargetUI = (type) => {
        messageTargetIndividualContainer.classList.add("hidden");
        messageTargetWorkingContainer.classList.add("hidden");
        messageTargetManualContainer.classList.add("hidden");

        if (type === "individual") messageTargetIndividualContainer.classList.remove("hidden");
        else if (type === "working") messageTargetWorkingContainer.classList.remove("hidden");
        else if (type === "manual") messageTargetManualContainer.classList.remove("hidden");
    };

    updateTargetUI("individual");

    Array.from(messageTargetRadios).forEach(radio => {
        radio.onclick = () => updateTargetUI(radio.value);
    });

    // 1. 個人選択用プルダウン
    messageUserSelect.innerHTML = "";
    allUsers.forEach(user => {
        const option = document.createElement("option");
        option.value = user.id;
        option.textContent = user.displayName || user.name || "名称未設定";
        messageUserSelect.appendChild(option);
    });

    // 2. 稼働中情報の表示 & タスク別プルダウン生成
    const allCount = workingData.all.length;
    messageTargetWorkingInfo.textContent = `現在、${allCount}名の従業員が業務中です。送信対象とする業務を選択してください。`;

    messageWorkingTaskSelect.innerHTML = "";
    
    // 「全員」オプション
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = `全員 (${allCount}名)`;
    messageWorkingTaskSelect.appendChild(allOption);

    // 各タスクオプション
    // workingData.byTask のキー（タスク名）でループ
    const taskNames = Object.keys(workingData.byTask).sort();
    taskNames.forEach(taskName => {
        const count = workingData.byTask[taskName].length;
        const option = document.createElement("option");
        option.value = taskName;
        option.textContent = `${taskName} (${count}名)`;
        messageWorkingTaskSelect.appendChild(option);
    });

    // 3. 手動選択リスト
    messageManualList.innerHTML = "";
    allUsers.forEach(user => {
        const label = document.createElement("label");
        label.className = "flex items-center p-2 hover:bg-gray-50 border-b border-gray-100 cursor-pointer";
        label.innerHTML = `
            <input type="checkbox" value="${user.id}" class="manual-target-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded mr-2">
            <span class="text-sm text-gray-700">${user.displayName || user.name || "名称未設定"}</span>
        `;
        messageManualList.appendChild(label);
    });

    // 送信ボタン
    messageSendBtn.onclick = () => {
        const title = messageTitleInput.value.trim();
        const body = messageBodyInput.value.trim();
        if (!title || !body) {
            alert("タイトルと本文を入力してください。");
            return;
        }

        const targetType = Array.from(messageTargetRadios).find(r => r.checked)?.value;
        let targetIds = [];

        if (targetType === "individual") {
            targetIds = [messageUserSelect.value];
        } else if (targetType === "working") {
            // ★修正: 選択されたタスクに応じてターゲットIDを取得
            const selectedTask = messageWorkingTaskSelect.value;
            if (selectedTask === "all") {
                targetIds = workingData.all;
            } else {
                // 選択されたタスクのIDリストを使用
                targetIds = workingData.byTask[selectedTask] || [];
            }
        } else if (targetType === "manual") {
            const checkboxes = messageManualList.querySelectorAll(".manual-target-checkbox:checked");
            checkboxes.forEach(cb => targetIds.push(cb.value));
        }

        if (targetIds.length === 0) {
            alert("送信対象が選択されていません。");
            return;
        }

        onSendCallback(targetIds, title, body);
        closeMessageModal();
    };

    messageCancelBtn.onclick = closeMessageModal;

    showModal(messageModal);
}

export function closeMessageModal() {
    const messageModal = document.getElementById("message-modal");
    if (messageModal) closeModal(messageModal);
}


// --- Confirmation Modal ---

export function showConfirmationModal(message, onConfirm, onCancel = hideConfirmationModal) {
    if (!confirmationModal || !modalMessage || !modalConfirmBtn || !modalCancelBtn) {
        console.error("Confirmation modal elements not found.");
        if (confirm(message)) {
            if (typeof onConfirm === 'function') onConfirm();
        } else {
            if (typeof onCancel === 'function') onCancel();
        }
        return;
    }

    modalMessage.textContent = message;
    onConfirmCallback = onConfirm;

    const newConfirmBtn = modalConfirmBtn.cloneNode(true);
    modalConfirmBtn.parentNode.replaceChild(newConfirmBtn, modalConfirmBtn);
    newConfirmBtn.addEventListener('click', () => {
        if (typeof onConfirmCallback === 'function') {
            onConfirmCallback();
        }
        hideConfirmationModal();
    });
    modalConfirmBtn = newConfirmBtn;

    const newCancelBtn = modalCancelBtn.cloneNode(true);
    modalCancelBtn.parentNode.replaceChild(newCancelBtn, modalCancelBtn);
    newCancelBtn.addEventListener('click', () => {
         if (typeof onCancel === 'function') {
             onCancel();
         }
         hideConfirmationModal();
    });
    modalCancelBtn = newCancelBtn;

    showModal(confirmationModal);
}

export function hideConfirmationModal() {
    closeModal(confirmationModal);
    onConfirmCallback = null;
}

// --- パスワード入力モーダル ---
export function showPasswordModal(role, onSuccess) {
    if (!adminPasswordView || !adminPasswordInput) {
        const password = prompt(role === "host" ? "管理者パスワードを入力:" : "業務管理者パスワードを入力:");
        const isValid = (role === "host" && password === "9999") || (role === "manager" && password === "0000");
        if (isValid) onSuccess();
        else alert("パスワードが違います");
        return;
    }

    adminPasswordInput.value = "";
    if (adminPasswordError) {
        adminPasswordError.textContent = "";
        adminPasswordError.classList.add("hidden");
    }
    adminPasswordInput.classList.remove("border-red-500");
    
    showModal(adminPasswordView);
    adminPasswordInput.focus();

    const cleanup = () => {
        if (adminPasswordSubmitBtn) adminPasswordSubmitBtn.onclick = null;
        adminPasswordInput.onkeydown = null;
        closeModal(adminPasswordView);
    };

    const checkPassword = () => {
        const val = adminPasswordInput.value;
        let isValid = false;
        if (role === "host" && val === "9999") isValid = true;
        if (role === "manager" && val === "0000") isValid = true;

        if (isValid) {
            cleanup();
            onSuccess();
        } else {
            if (adminPasswordError) {
                adminPasswordError.textContent = "パスワードが違います";
                adminPasswordError.classList.remove("hidden");
            }
            adminPasswordInput.classList.add("border-red-500");
            adminPasswordInput.value = "";
        }
    };

    if (adminPasswordSubmitBtn) adminPasswordSubmitBtn.onclick = checkPassword;
    
    adminPasswordInput.onkeydown = (e) => {
        if (e.key === "Enter") checkPassword();
        if (e.key === "Escape") cleanup();
    };
}

// --- 業務編集モーダル ---
export function openTaskModal(task = null) {
    if (!taskModal) return;

    if (taskNameInput) taskNameInput.value = "";
    if (taskCategorySelect) taskCategorySelect.value = "A"; 
    if (taskMemoInput) taskMemoInput.value = "";

    if (task) {
        if (taskModalTitle) taskModalTitle.textContent = "業務を編集";
        if (taskNameInput) taskNameInput.value = task.name;
        if (taskCategorySelect) taskCategorySelect.value = task.category || "A";
        if (taskMemoInput) taskMemoInput.value = task.memo || "";
        taskModal.dataset.editingName = task.name; 
    } else {
        if (taskModalTitle) taskModalTitle.textContent = "新しい業務を追加";
        delete taskModal.dataset.editingName;
    }

    showModal(taskModal);
    if (taskNameInput) taskNameInput.focus();
}

// --- Goal Add/Edit Modal ---

export function openGoalModal(mode, taskName, goalId = null) {
    if (!goalModal || !goalModalTitle || !goalModalTaskNameInput || !goalModalGoalIdInput ||
        !goalModalTitleInput || !goalModalTargetInput || !goalModalDeadlineInput ||
        !goalModalEffortDeadlineInput || !goalModalMemoInput) {
        console.error("Goal modal elements not found.");
        alert("工数編集モーダルを開けません。");
        return;
    }

    goalModalTaskNameInput.value = taskName;
    goalModalGoalIdInput.value = goalId || "";

    goalModalTitleInput.value = "";
    goalModalTargetInput.value = "";
    goalModalDeadlineInput.value = "";
    goalModalEffortDeadlineInput.value = "";
    goalModalMemoInput.value = "";

    if (mode === 'edit' && goalId) {
        goalModalTitle.textContent = "工数の編集";
        const task = allTaskObjects.find((t) => t.name === taskName);
        const goal = task?.goals?.find((g) => g.id === goalId);

        if (goal) {
            goalModalTitleInput.value = goal.title || "";
            goalModalTargetInput.value = goal.target || "";
            goalModalDeadlineInput.value = goal.deadline || "";
            goalModalEffortDeadlineInput.value = goal.effortDeadline || "";
            goalModalMemoInput.value = goal.memo || "";
        } else {
             console.error(`Goal with ID ${goalId} not found in task ${taskName} for editing.`);
             alert("編集対象の工数が見つかりません。");
             return;
        }
    } else {
        goalModalTitle.textContent = `[${escapeHtml(taskName)}] に工数を追加`;
    }

    showModal(goalModal);
    goalModalTitleInput.focus();
}

export function closeGoalModal() {
    closeModal(goalModal);
}

// --- Add User Modal ---

export function openAddUserModal() {
     if (!addUserModal || !addUserModalNameInput || !addUserModalError) return;
    addUserModalNameInput.value = "";
    addUserModalError.textContent = "";
    showModal(addUserModal);
    addUserModalNameInput.focus();
}

export function closeAddUserModal() {
    closeModal(addUserModal);
}

// --- Help Modal ---

export function showHelpModal(pageKey) {
    if (!helpModal || !helpModalTitle || !helpModalContent) {
         console.error("Help modal elements not found.");
         return;
    }

    let title = "ヘルプ";
    let content = "<p>ヘルプコンテンツが見つかりません。</p>";

    const helpContents = {
        client: {
            title: "従業員画面ヘルプ",
            content: `
                <p class="font-semibold mb-2">従業員として業務時間を記録するためのメイン画面です。</p>
                <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>業務の記録:</strong> 「業務内容」と、必要であれば「工数」を選択し、「業務変更」ボタンを押して記録を開始・変更します。</li>
                    <li><strong>休憩/帰宅:</strong> 休憩や業務終了時に対応するボタンを押してください。</li>
                </ul>`
        },
        host: {
            title: "管理者画面ヘルプ",
            content: `
                <p class="font-semibold mb-2">チーム全体の稼働状況を把握し、管理するための画面です。</p>
                <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>メッセージ送信:</strong> 従業員に連絡事項を送信できます。</li>
                    <li><strong>稼働状況:</strong> リアルタイムで誰が何をしているか確認できます。</li>
                </ul>`
        }
        // 他のヘルプコンテンツも必要であればここに追加
    };

    if (helpContents[pageKey]) {
        title = helpContents[pageKey].title;
        content = helpContents[pageKey].content;
    } else {
        if (pageKey === 'client') title = "従業員画面ヘルプ";
        else if (pageKey === 'host') title = "管理者画面ヘルプ";
        else if (pageKey === 'taskSettings') title = "業務内容設定ヘルプ";
        else if (pageKey === 'progress') title = "業務進捗ページヘルプ";
        else if (pageKey === 'approval') title = "申請承認画面ヘルプ";
    }

    helpModalTitle.textContent = title;
    helpModalContent.innerHTML = content;
    showModal(helpModal);
}

function closeHelpModal() {
    closeModal(helpModal);
}

export function openGoalDetailsModal(title, contentHtml) {
    if(!goalDetailsModal || !goalDetailsModalTitle || !goalDetailsModalContent) return;
    goalDetailsModalTitle.textContent = title;
    goalDetailsModalContent.innerHTML = contentHtml;
    showModal(goalDetailsModal);
}

function closeGoalDetailsModal() {
    closeModal(goalDetailsModal);
}

// --- Break Reservation Modal ---
export function openBreakReservationModal(id = null) {
    if(!breakReservationModal || !breakReservationModalTitle || !breakReservationTimeInput || !breakReservationIdInput) return;

    const titleEl = breakReservationModalTitle;
    const timeInputEl = breakReservationTimeInput;
    const idInputEl = breakReservationIdInput;

    if (id) {
        titleEl.textContent = "休憩予約の編集";
         const reservation = userReservations?.find((r) => r.id === id);
        if (reservation) {
            timeInputEl.value = reservation.time || "";
            idInputEl.value = id;
        } else {
             return;
        }
    } else {
        titleEl.textContent = "休憩予約の追加";
        timeInputEl.value = "";
        idInputEl.value = "";
    }
    showModal(breakReservationModal);
    timeInputEl.focus();
}

function closeBreakReservationModal() {
    closeModal(breakReservationModal);
}

// --- Event Listener Setup ---

export function setupModalEventListeners() {
    console.log("Setting up modal event listeners...");

    const editLogCancelBtn = document.getElementById('edit-log-cancel-btn');
    const editMemoCancelBtn = document.getElementById('edit-memo-cancel-btn');
    const editContributionCancelBtn = document.getElementById('edit-contribution-cancel-btn');
    const fixCheckoutCancelBtn = document.getElementById('fix-checkout-cancel-btn');
    const exportExcelCancelBtn = document.getElementById('cancel-export-excel-btn');
    const messageCancelBtn = document.getElementById("message-cancel-btn");

    if (messageCancelBtn) messageCancelBtn.addEventListener('click', closeMessageModal);

    goalModalCancelBtn?.addEventListener('click', closeGoalModal);
    addUserModalCancelBtn?.addEventListener('click', closeAddUserModal);
    helpModalCloseBtn?.addEventListener('click', closeHelpModal);
    goalDetailsModalCloseBtn?.addEventListener('click', closeGoalDetailsModal);
    breakReservationCancelBtn?.addEventListener('click', closeBreakReservationModal);
    
    taskModalCancelBtn?.addEventListener('click', () => closeModal(taskModal));

    editLogCancelBtn?.addEventListener('click', () => closeModal(editLogModal));
    editMemoCancelBtn?.addEventListener('click', () => closeModal(editMemoModal));
    editContributionCancelBtn?.addEventListener('click', () => closeModal(editContributionModal));
    fixCheckoutCancelBtn?.addEventListener('click', () => closeModal(fixCheckoutModal));
    exportExcelCancelBtn?.addEventListener('click', () => closeModal(exportExcelModal));

    adminPasswordCancelBtn?.addEventListener("click", () => {
         closeModal(adminPasswordView);
         if(adminPasswordError) adminPasswordError.textContent = '';
         if(adminPasswordInput) adminPasswordInput.value = '';
    });

    console.log("Modal event listeners set up complete.");
}

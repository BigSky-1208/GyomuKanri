// js/components/modal.js - モーダルダイアログ管理

import { allTaskObjects, escapeHtml } from "../main.js"; // Import necessary global state/functions

// --- DOM Element References ---
// 各モーダル要素への参照を取得し、exportして他のモジュールからも参照可能にする
export const confirmationModal = document.getElementById("confirmation-modal");
export const adminPasswordView = document.getElementById("admin-password-view"); // Strictly a view, but acts like a modal
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

// Confirmation Modal Elements
const modalMessage = document.getElementById("modal-message");
const modalConfirmBtn = document.getElementById("modal-confirm-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");

// Goal Modal Elements
const goalModalTitle = document.getElementById("goal-modal-title");
const goalModalTaskNameInput = document.getElementById("goal-modal-task-name");
const goalModalGoalIdInput = document.getElementById("goal-modal-goal-id");
const goalModalTitleInput = document.getElementById("goal-modal-title-input");
const goalModalTargetInput = document.getElementById("goal-modal-target-input");
const goalModalDeadlineInput = document.getElementById("goal-modal-deadline-input");
const goalModalEffortDeadlineInput = document.getElementById("goal-modal-effort-deadline-input");
const goalModalMemoInput = document.getElementById("goal-modal-memo-input");
const goalModalSaveBtn = document.getElementById("goal-modal-save-btn"); // Save action is in taskSettings.js or progress.js
const goalModalCancelBtn = document.getElementById("goal-modal-cancel-btn");

// Add User Modal Elements
const addUserModalNameInput = document.getElementById("add-user-modal-name-input");
const addUserModalError = document.getElementById("add-user-modal-error");
const addUserModalSaveBtn = document.getElementById("add-user-modal-save-btn"); // Save action in userManagement.js
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
const breakReservationSaveBtn = document.getElementById("break-reservation-save-btn"); // Save action in reservations.js
const breakReservationCancelBtn = document.getElementById("break-reservation-cancel-btn");

// Admin Password Modal Elements (References for Cancel button)
const adminPasswordCancelBtn = document.getElementById("admin-password-cancel-btn");
const adminPasswordError = document.getElementById("admin-password-error");
const adminPasswordInput = document.getElementById("admin-password-input");

// --- State ---
let onConfirmCallback = null; // Callback function for confirmation modal

// --- Basic Modal Functions ---

/**
 * Hides the specified modal element.
 * @param {HTMLElement} modalElement - The modal element to hide.
 */
export function closeModal(modalElement) {
    if (modalElement) {
        modalElement.classList.add("hidden");
    }
}

/**
 * Shows the specified modal element.
 * @param {HTMLElement} modalElement - The modal element to show.
 */
function showModal(modalElement) {
    if (modalElement) {
        modalElement.classList.remove("hidden");
    }
}


// --- Confirmation Modal ---

/**
 * Displays a confirmation modal with a message and sets callbacks for buttons.
 * @param {string} message - The message to display in the modal.
 * @param {function} onConfirm - Function to call when the confirm button is clicked.
 * @param {function} [onCancel=hideConfirmationModal] - Function to call when cancel is clicked (defaults to hiding modal).
 */
export function showConfirmationModal(message, onConfirm, onCancel = hideConfirmationModal) {
    if (!confirmationModal || !modalMessage || !modalConfirmBtn || !modalCancelBtn) {
        console.error("Confirmation modal elements not found.");
        // Fallback to basic confirm if elements are missing
        if (confirm(message)) { // Using native confirm as a last resort fallback
            if (typeof onConfirm === 'function') onConfirm();
        } else {
            if (typeof onCancel === 'function') onCancel();
        }
        return;
    }

    modalMessage.textContent = message; // Set the message text
    onConfirmCallback = onConfirm; // Store the confirm callback

    // --- Assign Button Listeners ---
    // Remove previous listeners before adding new ones to prevent multiple calls
    const newConfirmBtn = modalConfirmBtn.cloneNode(true);
    modalConfirmBtn.parentNode.replaceChild(newConfirmBtn, modalConfirmBtn);
    newConfirmBtn.addEventListener('click', () => {
        if (typeof onConfirmCallback === 'function') {
            onConfirmCallback(); // Execute the stored callback
        }
        // hideConfirmationModal(); // Callback should handle hiding if needed, or hide here. Let's let callback handle it.
    });
    // Re-assign reference
    modalConfirmBtn = newConfirmBtn;


    const newCancelBtn = modalCancelBtn.cloneNode(true);
    modalCancelBtn.parentNode.replaceChild(newCancelBtn, modalCancelBtn);
    newCancelBtn.addEventListener('click', () => {
         if (typeof onCancel === 'function') {
             onCancel(); // Execute the cancel callback
         }
         // Ensure modal hides even if onCancel doesn't explicitly do it.
         hideConfirmationModal();
    });
    // Re-assign reference
     modalCancelBtn = newCancelBtn;
    // --- End Assign Button Listeners ---


    showModal(confirmationModal); // Show the modal
}

/**
 * Hides the confirmation modal and clears the confirm callback.
 */
export function hideConfirmationModal() {
    closeModal(confirmationModal);
    onConfirmCallback = null; // Clear the callback when hiding
}


// --- Goal Add/Edit Modal ---

/**
 * Opens the Goal Add/Edit modal and populates it based on the mode and data.
 * @param {'add' | 'edit'} mode - 'add' for new goal, 'edit' for existing.
 * @param {string} taskName - The name of the parent task.
 * @param {string} [goalId=null] - The ID of the goal to edit (null if adding).
 */
export function openGoalModal(mode, taskName, goalId = null) {
    // Ensure all required elements exist
    if (!goalModal || !goalModalTitle || !goalModalTaskNameInput || !goalModalGoalIdInput ||
        !goalModalTitleInput || !goalModalTargetInput || !goalModalDeadlineInput ||
        !goalModalEffortDeadlineInput || !goalModalMemoInput) {
        console.error("Goal modal elements not found.");
        alert("工数編集モーダルを開けません。");
        return;
    }


    goalModalTaskNameInput.value = taskName; // Store parent task name (hidden input)
    goalModalGoalIdInput.value = goalId || ""; // Store goal ID if editing (hidden input)

    // Reset fields
    goalModalTitleInput.value = "";
    goalModalTargetInput.value = "";
    goalModalDeadlineInput.value = "";
    goalModalEffortDeadlineInput.value = "";
    goalModalMemoInput.value = "";

    if (mode === 'edit' && goalId) {
        goalModalTitle.textContent = "工数の編集";
        // Find the goal data from the global state
        const task = allTaskObjects.find((t) => t.name === taskName);
        const goal = task?.goals?.find((g) => g.id === goalId);

        if (goal) {
            // Populate fields with existing goal data
            goalModalTitleInput.value = goal.title || "";
            goalModalTargetInput.value = goal.target || "";
            // Ensure deadline is formatted as YYYY-MM-DD for the date input
            goalModalDeadlineInput.value = goal.deadline || ""; // Assumes deadline is stored as YYYY-MM-DD string
            goalModalEffortDeadlineInput.value = goal.effortDeadline || ""; // Assumes effortDeadline is stored as YYYY-MM-DD string
            goalModalMemoInput.value = goal.memo || "";
        } else {
             console.error(`Goal with ID ${goalId} not found in task ${taskName} for editing.`);
             alert("編集対象の工数が見つかりません。");
             return; // Don't show modal if goal data is missing
        }
    } else {
        goalModalTitle.textContent = `[${escapeHtml(taskName)}] に工数を追加`; // Show task name in title for adding
    }

    showModal(goalModal); // Show the modal
    goalModalTitleInput.focus(); // Focus the title input
}

/**
 * Closes the Goal Add/Edit modal.
 */
export function closeGoalModal() {
    closeModal(goalModal);
}

// --- Add User Modal ---

/**
 * Opens the Add User modal.
 */
export function openAddUserModal() {
     if (!addUserModal || !addUserModalNameInput || !addUserModalError) return;
    addUserModalNameInput.value = ""; // Clear input
    addUserModalError.textContent = ""; // Clear error
    showModal(addUserModal);
    addUserModalNameInput.focus();
}

/**
 * Closes the Add User modal.
 */
export function closeAddUserModal() {
    closeModal(addUserModal);
}

// --- Help Modal ---

/**
 * Displays the help modal with content specific to the provided page key.
 * @param {string} pageKey - Key identifying the help content (e.g., 'client', 'host').
 */
export function showHelpModal(pageKey) {
    if (!helpModal || !helpModalTitle || !helpModalContent) {
         console.error("Help modal elements not found.");
         return;
    }

    let title = "ヘルプ";
    let content = "<p>ヘルプコンテンツが見つかりません。</p>";

    // Define help content (can be moved to a separate JSON or module for larger apps)
    const helpContents = {
        client: {
            title: "従業員画面ヘルプ",
            content: `
                <p class="font-semibold mb-2">従業員として業務時間を記録するためのメイン画面です。</p>
                <h4 class="font-bold mt-3 mb-1 text-base border-b">基本操作</h4>
                <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>業務の記録:</strong> 「業務内容」と、必要であれば「工数」を選択し、「業務変更」ボタン（初回は「業務開始」）を押して記録を開始・変更します。「その他」を選んだ場合は詳細を入力してください。</li>
                    <li><strong>休憩:</strong> 「休憩開始」ボタンで休憩時間を記録できます。休憩を終了する際は、ボタンが「休憩前の業務に戻る」に変わるので、それを押してください。</li>
                    <li><strong>帰宅:</strong> 1日の業務が終了したら「帰宅」ボタンを押してください。最後のタスクが保存され、タイマーがリセットされます。</li>
                    <li><strong>メモ:</strong> 現在の業務に関するメモを自由に残せます。タスクを変更するか帰宅すると、その直前の業務ログにメモが紐づけられます。</li>
                    <li><strong>警告:</strong> 選択中の業務/工数が現在記録中のものと違う場合、ボタンが点滅し警告が表示されます。「業務変更」を押して記録を更新してください。</li>
                </ul>
                <h4 class="font-bold mt-3 mb-1 text-base border-b">補助機能</h4>
                <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>工数進捗:</strong> 左カラムで工数を選択すると、右カラム上部に進捗が表示されます。達成件数を入力し「加算」ボタンでチーム全体の進捗に反映できます。</li>
                    <li><strong>予約設定:</strong> 休憩や帰宅を指定時刻に自動実行する予約を設定できます（毎日繰り返し）。手動で操作するとその日の予約はキャンセルされます。</li>
                     <li><strong>表示設定:</strong> ドロップダウンに表示したくない業務を非表示に設定できます。「休憩」は非表示にできません。</li>
                    <li><strong>同僚表示:</strong> 現在記録中の業務を、他の誰が同時に行っているかを表示します。相手の「今日の一言」も表示されます。</li>
                    <li><strong>戸村さんステータス:</strong> 管理者が設定した戸村さんの現在の状況が表示されます。</li>
                    <li><strong>個人記録/業務進捗:</strong> 各種詳細ページへ移動できます。</li>
                    <li><strong>退勤忘れを修正:</strong> 前日以前の退勤時刻を忘れた場合に、後から正しい時刻を登録できます。指定日の最後の業務終了時刻が更新され、それ以降のログは削除されます。</li>
                </ul>`
        },
        host: {
            title: "管理者画面ヘルプ",
            content: `
                <p class="font-semibold mb-2">チーム全体の稼働状況をリアルタイムで把握し、データを管理するための画面です。</p>
                <h4 class="font-bold mt-3 mb-1 text-base border-b">稼働状況の確認</h4>
                <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>リアルタイム稼働状況:</strong> どの従業員が、どの業務（工数）を、どれくらいの時間行っているかリアルタイムで表示します。業務ごとに従事している人数も分かります。</li>
                    <li><strong>強制停止:</strong> 稼働中の従業員の記録を強制的に停止（帰宅処理と同じ）させることができます。</li>
                    <li><strong>アカウントリスト:</strong> 登録されている全従業員を表示します。名前をクリックすると個人の詳細記録ページに移動します。</li>
                    <li><strong>戸村さんステータス設定:</strong> 戸村さんの現在の状況を設定し、従業員画面に表示させます（毎日リセットされます）。</li>
                </ul>
                <h4 class="font-bold mt-3 mb-1 text-base border-b">データ分析と管理</h4>
                <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>ユーザーを追加:</strong> 新しい従業員アカウントを作成します。ユーザー名は空白不可で、既存ユーザー名とは重複できません。</li>
                    <li><strong>稼働時間Excelを出力:</strong> 指定した月の全従業員の稼働記録（月次サマリー、日別サマリー）をExcelファイルでダウンロードします。</li>
                    <li><strong>業務進捗を確認:</strong> チーム全体の工数（目標）進捗や、メンバーごとの貢献度・稼働時間などを詳細に確認・管理できます。</li>
                    <li><strong>業務レポートを表示:</strong> 業務時間の割合を円グラフで視覚的に確認できます。カレンダーで日や月を指定して期間を絞り込めます。</li>
                    <li><strong>全従業員の全業務記録を削除:</strong> 全従業員の全ての業務ログ (work_logs) を削除します。ユーザープロフィールは削除されません。この操作は元に戻せません。</li>
                </ul>`
        },
         taskSettings: {
            title: "業務内容設定ヘルプ",
            content: `
                <p class="font-semibold mb-2">従業員が選択する業務内容（タスク）の管理や、各タスクに紐づく工数（目標）を設定する画面です。</p>
                <h4 class="font-bold mt-3 mb-1 text-base border-b">業務の管理</h4>
                <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>業務の追加 (管理者のみ):</strong> 新しい業務を追加します。「休憩」は追加できません。空白は含められません。</li>
                    <li><strong>業務の削除 (管理者のみ):</strong> 不要になった業務を削除します。「休憩」は削除できません。関連する工数も削除されますが、過去の業務ログは残ります。</li>
                    <li><strong>業務メモ:</strong> 各業務にルールや補足情報をメモとして残せます。このメモは従業員が業務を選択した際に表示されます。変更後は「メモを保存」ボタンを押してください。</li>
                    <li><strong>担当者別 合計時間:</strong> 「担当者別 合計時間 [+]」をクリックすると、その業務にこれまで誰がどれくらいの時間を費やしたかを通算で確認できます。</li>
                </ul>
                <h4 class="font-bold mt-3 mb-1 text-base border-b">工数（目標）設定</h4>
                <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>工数を追加:</strong> 各業務に対して「〇〇を50件完了する」といった具体的な数値目標（工数）を設定できます。「休憩」には追加できません。</li>
                    <li><strong>工数タイトル・目標値:</strong> 工数の名前と目標となる件数などを設定します。</li>
                    <li><strong>納期・工数納期:</strong> それぞれの工数に対して、最終的な「納期」（製品・サービスの納期など）と、作業時間を見積もるための目安となる「工数納期」を設定できます（任意）。</li>
                    <li><strong>メモ:</strong> 工数に関する詳細な指示などをメモとして残せます。</li>
                    <li>設定した工数（タイトル、目標値、納期、メモ）は、「業務進捗を確認」ページで編集・完了・削除の管理ができます。</li>
                </ul>`
        },
         progress: {
            title: "業務進捗ページヘルプ",
            content: `
                <p class="font-semibold mb-2">設定された工数（目標）の進捗状況や、チーム全体の業務量を詳細に確認・管理する画面です。</p>
                <h4 class="font-bold mt-3 mb-1 text-base border-b">基本的な使い方</h4>
                <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>1. 業務選択:</strong> 左上のリストから、詳細を見たい業務を選択します（進行中の工数がある業務のみ表示されます）。</li>
                    <li><strong>2. 工数選択:</strong> 右上のリストに、選択した業務に含まれる進行中の工数が表示されるので、目的のものを選択します。</li>
                    <li><strong>3. 詳細確認:</strong> 選択すると、下にその工数の詳細情報（目標値、納期、メモ、現在の進捗率）、貢献度グラフ（日別）、稼働サマリー（週別）が表示されます。</li>
                </ul>
                <h4 class="font-bold mt-3 mb-1 text-base border-b">工数の管理 (読み取り専用モードでは不可)</h4>
                <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>編集:</strong> 工数のタイトル、目標値、納期、メモなどを変更できます。「業務内容設定」画面からも編集可能です。</li>
                    <li><strong>完了:</strong> 目標が達成されたら「完了」ボタンを押してください。完了した工数はこのリストから消え、「完了した工数を見る」ページ（アーカイブ）に移動します。</li>
                    <li><strong>削除:</strong> 工数を完全に削除します。関連するログは残りますが、工数自体は復元できません。</li>
                </ul>
                <h4 class="font-bold mt-3 mb-1 text-base border-b">グラフ・サマリーの操作</h4>
                <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>グラフ種別切替:</strong> グラフ右上のボタンで「合計件数」と「時間あたり件数」の表示を切り替えられます。</li>
                    <li><strong>週/月の移動:</strong> サマリー表の上部にあるボタンで、表示する週や月を移動できます。</li>
                </ul>
                 <h4 class="font-bold mt-3 mb-1 text-base border-b">完了した工数</h4>
                 <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li>右上の「完了した工数を見る」ボタンから、完了済みの工数の一覧と、その貢献履歴を確認できます。</li>
                 </ul>`
        },
        // 他のページのヘルプコンテンツもここに追加
    };

    if (helpContents[pageKey]) {
        title = helpContents[pageKey].title;
        content = helpContents[pageKey].content;
    }

    helpModalTitle.textContent = title;
    helpModalContent.innerHTML = content; // Assuming content is safe HTML
    showModal(helpModal);
}

/**
 * Closes the Help modal.
 */
function closeHelpModal() {
    closeModal(helpModal);
}

// --- Goal Details Modal --- (Used in Archive View)
/**
 * Opens the Goal Details modal (typically used for archive view).
 * @param {string} title - The title to display in the modal header.
 * @param {string} contentHtml - The HTML content to display in the modal body.
 */
export function openGoalDetailsModal(title, contentHtml) {
    if(!goalDetailsModal || !goalDetailsModalTitle || !goalDetailsModalContent) return;
    goalDetailsModalTitle.textContent = title;
    goalDetailsModalContent.innerHTML = contentHtml; // Caller is responsible for safe HTML
    showModal(goalDetailsModal);
}

/**
 * Closes the Goal Details modal.
 */
function closeGoalDetailsModal() {
    closeModal(goalDetailsModal);
}


// --- Break Reservation Modal ---
/** Opens Break Reservation Modal */
export function openBreakReservationModal(id = null) {
    if(!breakReservationModal || !breakReservationModalTitle || !breakReservationTimeInput || !breakReservationIdInput) {
        console.error("Break reservation modal elements not found.");
        return;
    }

    const titleEl = breakReservationModalTitle;
    const timeInputEl = breakReservationTimeInput;
    const idInputEl = breakReservationIdInput;

    if (id) {
        titleEl.textContent = "休憩予約の編集";
         // Need access to userReservations state, assuming it's imported or passed
         // This implies reservations state might need to be managed more globally or passed around
         // For now, let's assume reservations.js handles finding the data
         // TODO: Refactor state access if needed
        const reservation = window.userReservations?.find((r) => r.id === id); // Temporary global access
        if (reservation) {
            timeInputEl.value = reservation.time || ""; // Use time string
            idInputEl.value = id;
        } else {
             console.error("Reservation to edit not found:", id);
             alert("編集対象の予約が見つかりません。");
             return; // Don't open if data missing
        }
    } else {
        titleEl.textContent = "休憩予約の追加";
        timeInputEl.value = ""; // Clear time
        idInputEl.value = ""; // Clear ID
    }
    showModal(breakReservationModal);
    timeInputEl.focus();
}

/** Closes Break Reservation Modal */
function closeBreakReservationModal() {
    closeModal(breakReservationModal);
}


// --- Event Listener Setup ---

/**
 * Sets up basic event listeners for modal close/cancel buttons.
 * Confirmation modal buttons are handled dynamically in `showConfirmationModal`.
 * Save/Confirm actions for other modals are typically handled in their respective view modules.
 */
export function setupModalEventListeners() {
    console.log("Setting up modal event listeners...");

    // Generic close functionality using data attributes (optional)
    // document.body.addEventListener('click', (event) => {
    //     if (event.target.matches('[data-modal-close]')) {
    //         const modalId = event.target.closest('.modal')?.id; // Find parent modal ID
    //         if (modalId) {
    //             closeModal(document.getElementById(modalId));
    //         }
    //     }
    // });

    // Specific Cancel/Close buttons
    modalCancelBtn?.addEventListener('click', hideConfirmationModal); // Confirmation cancel handled dynamically, but have a fallback
    goalModalCancelBtn?.addEventListener('click', closeGoalModal);
    addUserModalCancelBtn?.addEventListener('click', closeAddUserModal);
    helpModalCloseBtn?.addEventListener('click', closeHelpModal);
    goalDetailsModalCloseBtn?.addEventListener('click', closeGoalDetailsModal);
    breakReservationCancelBtn?.addEventListener('click', closeBreakReservationModal);

    // Other modal cancel/close buttons (if they only close the modal)
    editLogCancelBtn?.addEventListener('click', () => closeModal(editLogModal));
    editMemoCancelBtn?.addEventListener('click', () => closeModal(editMemoModal));
    editContributionCancelBtn?.addEventListener('click', () => closeModal(editContributionModal));
    // fixCheckoutCancelBtn handled in personalDetail.js or clientUI.js as it needs specific reset? Let's add here for consistency.
    document.getElementById('fix-checkout-cancel-btn')?.addEventListener('click', () => closeModal(fixCheckoutModal));
    // exportExcelCancelBtn handled in excelExport.js? Add here.
    document.getElementById('cancel-export-excel-btn')?.addEventListener('click', () => closeModal(exportExcelModal));

    // Admin Password Cancel
    adminPasswordCancelBtn?.addEventListener("click", () => {
         closeModal(adminPasswordView);
         if(adminPasswordError) adminPasswordError.textContent = ''; // Clear error on cancel
         if(adminPasswordInput) adminPasswordInput.value = ''; // Clear input
         // Reset adminLoginDestination? Depends on main.js logic.
    });


    console.log("Modal event listeners set up complete.");
}

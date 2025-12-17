// js/components/modal.js - モーダルダイアログ管理

import { allTaskObjects, escapeHtml } from "../main.js";
import { userReservations } from '../views/client/reservations.js';

// ★追加: メッセージ送信モーダル用
export const messageModal = document.getElementById("message-modal");
const messageTargetRadios = document.getElementsByName("message-target-type");
const messageTargetIndividualContainer = document.getElementById("message-target-individual-container");
const messageTargetManualContainer = document.getElementById("message-target-manual-container");
const messageTargetWorkingInfo = document.getElementById("message-target-working-info");
const messageUserSelect = document.getElementById("message-user-select");
const messageManualList = document.getElementById("message-manual-list");
const messageTitleInput = document.getElementById("message-title-input");
const messageBodyInput = document.getElementById("message-body-input");
const messageSendBtn = document.getElementById("message-send-btn");
const messageCancelBtn = document.getElementById("message-cancel-btn");

// --- DOM Element References (元のコードの定義を全て維持) ---
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

// ★追加: 業務編集モーダル用の要素 (taskSettings.jsで使用)
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
const adminPasswordSubmitBtn = document.getElementById("admin-password-submit-btn"); // 追加: 送信ボタン

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

// --- ★追加: パスワード入力モーダル (modeSelection.jsで使用) ---
// 元のHTMLにある admin-password-view を再利用して実装します
export function showPasswordModal(role, onSuccess) {
    if (!adminPasswordView || !adminPasswordInput) {
        // フォールバック
        const password = prompt(role === "host" ? "管理者パスワードを入力:" : "業務管理者パスワードを入力:");
        const isValid = (role === "host" && password === "9999") || (role === "manager" && password === "0000");
        if (isValid) onSuccess();
        else alert("パスワードが違います");
        return;
    }

    // UIリセット
    adminPasswordInput.value = "";
    if (adminPasswordError) {
        adminPasswordError.textContent = "";
        adminPasswordError.classList.add("hidden");
    }
    adminPasswordInput.classList.remove("border-red-500");
    
    // タイトルなどの変更が必要ならここで行うが、今回は共用
    
    showModal(adminPasswordView);
    adminPasswordInput.focus();

    // クリーンアップ
    const cleanup = () => {
        if (adminPasswordSubmitBtn) adminPasswordSubmitBtn.onclick = null;
        adminPasswordInput.onkeydown = null;
        closeModal(adminPasswordView);
    };

    // 認証ロジック
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
    
    // キャンセルボタンのリスナーは setupModalEventListeners で設定されているのでここでは設定しない
    // ただし、onClickを上書きする形ではないので、二重登録に注意が必要だが、
    // setupModalEventListeners は初期化時に一度だけ呼ばれる前提なのでOK。
}

// --- ★追加: 業務編集モーダル (taskSettings.jsで使用) ---
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

// --- Goal Add/Edit Modal (元のコードを維持) ---

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

// --- Add User Modal (元のコードを維持) ---

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

// --- Help Modal (元のコードを維持) ---

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
                    <li><strong>戸村さんステータス:</strong> 管理者が設定した戸村さんの現在の状況（勤務場所や声掛けの可否）が表示されます。</li>
                    <li><strong>個人記録/業務進捗:</strong> 各種詳細ページへ移動できます。</li>
                    <li><strong>退勤忘れを修正:</strong> 前日以前の退勤打刻を忘れた場合に、後から正しい時刻を登録できます。修正内容は管理者の承認が必要な場合があります。</li>
                </ul>`
        },
        host: {
            title: "管理者画面ヘルプ",
            content: `
                <p class="font-semibold mb-2">チーム全体の稼働状況をリアルタイムで把握し、データを管理するための画面です。</p>
                <h4 class="font-bold mt-3 mb-1 text-base border-b">稼働状況の確認</h4>
                <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>リアルタイム稼働状況:</strong> どの従業員が、どの業務（工数）を、どれくらいの時間行っているかリアルタイムで表示します。業務ごとに従事している人数も分かります。</li>
                    <li><strong>強制停止:</strong> 稼働中の従業員の記録を強制的に停止（帰宅処理）させることができます。</li>
                    <li><strong>アカウントリスト:</strong> 登録されている全従業員を表示します。名前をクリックすると個人の詳細記録ページに移動します。</li>
                    <li><strong>戸村さんステータス設定:</strong> 戸村さんの現在の状況（勤務場所：出社/リモート、声掛けOK/NGなど）を設定し、従業員画面に表示させます（日付変更でリセット）。</li>
                </ul>
                <h4 class="font-bold mt-3 mb-1 text-base border-b">データ分析と管理</h4>
                <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>申請を確認・承認:</strong> 従業員からの「退勤修正」などの申請を確認し、承認または却下します。</li>
                    <li><strong>ユーザーを追加:</strong> 新しい従業員アカウントを作成します。ユーザー名は空白不可で、既存ユーザー名とは重複できません。</li>
                    <li><strong>稼働時間Excelを出力:</strong> 指定した月の全従業員の稼働記録（月次サマリー、日別サマリー）をExcelファイルでダウンロードします。</li>
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
                    <li><strong>業務の追加 (管理者のみ):</strong> 新しい業務を追加します。カテゴリ（A/B/C等）の設定も可能です。</li>
                    <li><strong>業務の編集:</strong> 既存の業務名やカテゴリ、デフォルトのメモを編集できます。</li>
                    <li><strong>業務の削除 (管理者のみ):</strong> 不要になった業務を削除します。「休憩」は削除できません。関連する工数も削除されます。</li>
                    <li><strong>業務メモ:</strong> 各業務にルールや補足情報をメモとして残せます。このメモは従業員が業務を選択した際に表示されます。</li>
                </ul>
                <h4 class="font-bold mt-3 mb-1 text-base border-b">工数（目標）設定</h4>
                <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>工数を追加:</strong> 各業務に対して「〇〇を50件完了する」といった具体的な数値目標（工数）を設定できます。</li>
                    <li><strong>工数タイトル・目標値:</strong> 工数の名前と目標となる件数などを設定します。</li>
                    <li><strong>納期・工数納期:</strong> 最終的な「納期」と、作業時間の目安となる「工数納期」を設定できます。</li>
                    <li><strong>メモ:</strong> 工数に関する詳細な指示などをメモとして残せます。</li>
                </ul>`
        },
        progress: {
            title: "業務進捗ページヘルプ",
            content: `
                <p class="font-semibold mb-2">設定された工数（目標）の進捗状況や、チーム全体の業務量を詳細に確認・管理する画面です。</p>
                <h4 class="font-bold mt-3 mb-1 text-base border-b">基本的な使い方</h4>
                <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>1. 業務選択:</strong> 左上のリストから、詳細を見たい業務を選択します。</li>
                    <li><strong>2. 工数選択:</strong> 右上のリストから、目的の工数を選択します。</li>
                    <li><strong>3. 詳細確認:</strong> 選択すると、目標達成状況、貢献度グラフ、週別の稼働サマリーが表示されます。</li>
                </ul>
                <h4 class="font-bold mt-3 mb-1 text-base border-b">工数の管理</h4>
                <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>編集・完了・削除:</strong> 工数の内容変更や、完了扱いにすることができます。完了するとアーカイブに移動します。</li>
                </ul>
                <h4 class="font-bold mt-3 mb-1 text-base border-b">その他</h4>
                <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>完了した工数を見る:</strong> アーカイブされた過去の工数を確認できます。</li>
                    <li><strong>グラフ切替:</strong> 「合計件数」と「時間あたり件数」のグラフを切り替えられます。</li>
                </ul>`
        },
        approval: { // ★追加: 承認画面用のヘルプ
            title: "申請承認画面ヘルプ",
            content: `
                 <p class="font-semibold mb-2">従業員から提出された修正申請を確認・承認する画面です。</p>
                 <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>申請一覧:</strong> 「退勤忘れの修正」など、承認待ちの申請がリスト表示されます。</li>
                    <li><strong>承認:</strong> 内容を確認し、問題なければ「承認」ボタンを押してください。データが正式に更新されます。</li>
                    <li><strong>却下:</strong> 申請内容に不備がある場合は「却下」できます。データは更新されません。</li>
                 </ul>
            `
        }
    };

    if (helpContents[pageKey]) {
        title = helpContents[pageKey].title;
        content = helpContents[pageKey].content;
    }

    helpModalTitle.textContent = title;
    helpModalContent.innerHTML = content;
    showModal(helpModal);
}

// ★追加: ヘルプモーダルを閉じる関数 (元のコードにはcloseHelpModalの定義がありませんでしたが、listenerで使われていたため追加)
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

// --- Break Reservation Modal (元のコードを維持) ---
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
         const reservation = userReservations?.find((r) => r.id === id);
        if (reservation) {
            timeInputEl.value = reservation.time || "";
            idInputEl.value = id;
        } else {
             console.error("Reservation to edit not found:", id);
             alert("編集対象の予約が見つかりません。");
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

// --- Event Listener Setup (元のコードを維持 + TaskModalのリスナーを追加) ---

export function setupModalEventListeners() {
    console.log("Setting up modal event listeners...");

    const editLogCancelBtn = document.getElementById('edit-log-cancel-btn');
    const editMemoCancelBtn = document.getElementById('edit-memo-cancel-btn');
    const editContributionCancelBtn = document.getElementById('edit-contribution-cancel-btn');
    const fixCheckoutCancelBtn = document.getElementById('fix-checkout-cancel-btn');
    const exportExcelCancelBtn = document.getElementById('cancel-export-excel-btn');

    goalModalCancelBtn?.addEventListener('click', closeGoalModal);
    addUserModalCancelBtn?.addEventListener('click', closeAddUserModal);
    helpModalCloseBtn?.addEventListener('click', closeHelpModal);
    goalDetailsModalCloseBtn?.addEventListener('click', closeGoalDetailsModal);
    breakReservationCancelBtn?.addEventListener('click', closeBreakReservationModal);
    
    // ★追加: 業務編集モーダルのキャンセルボタン
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

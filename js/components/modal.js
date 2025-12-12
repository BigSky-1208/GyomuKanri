// js/components/modal.js

// --- 確認モーダル (Yes/No) ---
export function showConfirmationModal(message, onConfirm, onCancel) {
    const modal = document.getElementById("confirmation-modal");
    const msgEl = document.getElementById("confirmation-message");
    const confirmBtn = document.getElementById("confirm-btn");
    const cancelBtn = document.getElementById("cancel-btn");

    if (!modal) return;

    msgEl.textContent = message;
    modal.classList.remove("hidden");

    confirmBtn.onclick = () => {
        modal.classList.add("hidden");
        if (onConfirm) onConfirm();
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
    };

    cancelBtn.onclick = () => {
        modal.classList.add("hidden");
        if (onCancel) onCancel();
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
    };
}

export function hideConfirmationModal() {
    const modal = document.getElementById("confirmation-modal");
    if (modal) modal.classList.add("hidden");
}

// --- パスワード入力モーダル ---
export function showPasswordModal(role, onSuccess) {
    const modal = document.getElementById("password-modal");
    const input = document.getElementById("password-input");
    const submitBtn = document.getElementById("password-submit-btn");
    const cancelBtn = document.getElementById("password-cancel-btn");
    const errorMsg = document.getElementById("password-error-msg");

    if (!modal) {
        // HTMLがない場合のフォールバック
        const password = prompt(role === "host" ? "管理者パスワードを入力:" : "業務管理者パスワードを入力:");
        const isValid = (role === "host" && password === "9999") || (role === "manager" && password === "0000");
        if (isValid) onSuccess();
        else alert("パスワードが違います");
        return;
    }

    // UIリセット
    input.value = "";
    errorMsg.classList.add("hidden");
    input.classList.remove("border-red-500");
    modal.classList.remove("hidden");
    input.focus();

    const cleanup = () => {
        submitBtn.onclick = null;
        if(cancelBtn) cancelBtn.onclick = null;
        input.onkeydown = null;
        modal.classList.add("hidden");
    };

    const checkPassword = () => {
        const val = input.value;
        let isValid = false;
        if (role === "host" && val === "9999") isValid = true;
        if (role === "manager" && val === "0000") isValid = true;

        if (isValid) {
            cleanup();
            onSuccess();
        } else {
            errorMsg.classList.remove("hidden");
            input.classList.add("border-red-500");
            input.value = "";
        }
    };

    submitBtn.onclick = checkPassword;
    if (cancelBtn) cancelBtn.onclick = cleanup;
    input.onkeydown = (e) => {
        if (e.key === "Enter") checkPassword();
        if (e.key === "Escape") cleanup();
    };
}

// --- ★復元: 業務編集モーダル ---
export function openTaskModal(task = null) {
    const modal = document.getElementById("task-modal");
    const nameInput = document.getElementById("task-name-input");
    const categorySelect = document.getElementById("task-category-select");
    const memoInput = document.getElementById("task-memo-input"); // 存在する場合
    const modalTitle = document.getElementById("task-modal-title");
    const cancelBtn = document.getElementById("task-cancel-btn");

    if (!modal) return;

    // 入力リセット
    if (nameInput) nameInput.value = "";
    if (categorySelect) categorySelect.value = "A"; // デフォルト
    if (memoInput) memoInput.value = "";

    if (task) {
        // 編集モード
        if (modalTitle) modalTitle.textContent = "業務を編集";
        if (nameInput) nameInput.value = task.name;
        if (categorySelect) categorySelect.value = task.category || "A";
        if (memoInput) memoInput.value = task.memo || "";
        
        // 編集中のIDをデータ属性として保存しておく（保存処理で使用）
        modal.dataset.editingName = task.name; 
    } else {
        // 新規モード
        if (modalTitle) modalTitle.textContent = "新しい業務を追加";
        delete modal.dataset.editingName;
    }

    modal.classList.remove("hidden");
    if (nameInput) nameInput.focus();

    if (cancelBtn) {
        cancelBtn.onclick = () => {
            modal.classList.add("hidden");
            cancelBtn.onclick = null;
        };
    }
}

// --- ★復元: 目標(Goal)編集モーダル ---
export function openGoalModal(goal = null) {
    const modal = document.getElementById("goal-modal");
    const titleInput = document.getElementById("goal-title-input");
    const targetInput = document.getElementById("goal-target-input");
    const unitInput = document.getElementById("goal-unit-input"); // 単位(件, 円 etc)
    const modalTitle = document.getElementById("goal-modal-title");
    const cancelBtn = document.getElementById("goal-cancel-btn");

    if (!modal) return;

    // リセット
    if (titleInput) titleInput.value = "";
    if (targetInput) targetInput.value = "";
    if (unitInput) unitInput.value = "件";

    if (goal) {
        // 編集モード
        if (modalTitle) modalTitle.textContent = "目標を編集";
        if (titleInput) titleInput.value = goal.title;
        if (targetInput) targetInput.value = goal.target;
        if (unitInput) unitInput.value = goal.unit || "件";
        
        modal.dataset.editingId = goal.id;
    } else {
        // 新規モード
        if (modalTitle) modalTitle.textContent = "新しい目標を追加";
        delete modal.dataset.editingId;
    }

    modal.classList.remove("hidden");
    if (titleInput) titleInput.focus();

    if (cancelBtn) {
        cancelBtn.onclick = () => {
            modal.classList.add("hidden");
            cancelBtn.onclick = null;
        };
    }
}

// --- ユーザー追加モーダル ---
export function openAddUserModal() {
    const modal = document.getElementById("add-user-modal");
    if (modal) {
        modal.classList.remove("hidden");
        const cancelBtn = document.getElementById("add-user-modal-cancel-btn");
        if(cancelBtn) {
            cancelBtn.onclick = () => modal.classList.add("hidden");
        }
    }
}

// --- 休憩予約モーダル ---
export function openBreakReservationModal(editId = null) {
    const modal = document.getElementById("break-reservation-modal");
    const timeInput = document.getElementById("break-reservation-time-input");
    const cancelBtn = document.getElementById("break-reservation-cancel-btn");
    
    if (modal) {
        timeInput.value = ""; 
        modal.classList.remove("hidden");
        timeInput.focus();

        if(cancelBtn) {
            cancelBtn.onclick = () => modal.classList.add("hidden");
        }
    }
}

// --- 退勤修正モーダル用 ---
export const fixCheckoutModal = document.getElementById("fix-checkout-modal");

// --- ヘルプモーダル ---
export function showHelpModal(mode) {
    const modal = document.getElementById('help-modal');
    const content = document.getElementById('help-content');
    const closeBtn = document.getElementById('help-close-btn');

    if (!modal || !content) return;

    let html = "";
    if (mode === 'client') {
        html = `
            <h3 class="font-bold text-lg mb-2 text-indigo-600">従業員画面の使い方</h3>
            <ul class="list-disc pl-5 space-y-2 text-sm text-gray-700">
                <li><b>業務開始:</b> リストから業務を選んで「業務開始」を押します。</li>
                <li><b>休憩:</b> 「休憩開始」ボタンで休憩に入ります。戻るときは再度押します。</li>
                <li><b>退勤:</b> 「業務終了」ボタンで退勤します。</li>
                <li><b>予約機能:</b> 休憩や帰宅時間を予約できます。</li>
            </ul>
        `;
    } else if (mode === 'manager') {
        html = `
            <h3 class="font-bold text-lg mb-2 text-indigo-600">業務管理者画面の使い方</h3>
            <ul class="list-disc pl-5 space-y-2 text-sm text-gray-700">
                <li><b>業務設定:</b> 業務の種類や目標値を追加・編集できます。</li>
                <li><b>リアルタイム状況:</b> メンバーの稼働状況を確認できます。</li>
            </ul>
        `;
    } else if (mode === 'host') {
         html = `
            <h3 class="font-bold text-lg mb-2 text-indigo-600">管理者画面の使い方</h3>
            <ul class="list-disc pl-5 space-y-2 text-sm text-gray-700">
                <li><b>ユーザー管理:</b> ユーザー追加・削除・権限変更ができます。</li>
                <li><b>データ出力:</b> ログをExcel形式でダウンロードできます。</li>
            </ul>
        `;
    }

    content.innerHTML = html;
    modal.classList.remove("hidden");
    
    if (closeBtn) {
        closeBtn.onclick = () => modal.classList.add("hidden");
    }
}

// js/components/modal/core.js

// --- DOM要素の取得とエクスポート ---
export const confirmationModal = document.getElementById("confirmation-modal");
export const adminPasswordView = document.getElementById("admin-password-view");
export const editLogModal = document.getElementById("edit-log-modal");
export const editMemoModal = document.getElementById("edit-memo-modal");
export const editContributionModal = document.getElementById("edit-contribution-modal");
export const fixCheckoutModal = document.getElementById("fix-checkout-modal");
export const exportExcelModal = document.getElementById("export-excel-modal");

const modalMessage = document.getElementById("modal-message");
let modalConfirmBtn = document.getElementById("modal-confirm-btn");
let modalCancelBtn = document.getElementById("modal-cancel-btn");

// --- 基本的な開閉関数 ---

export function showModal(modalElement) {
    if (modalElement) modalElement.classList.remove("hidden");
}

export function closeModal(modalElement) {
    if (modalElement) modalElement.classList.add("hidden");
}

/**
 * 確認モーダルを閉じる
 */
export function hideConfirmationModal() {
    closeModal(confirmationModal);
}

/**
 * 確認モーダルを表示する（★exportが必須）
 */
export function showConfirmationModal(message, onConfirm, onCancel = hideConfirmationModal) {
    if (!confirmationModal || !modalMessage || !modalConfirmBtn || !modalCancelBtn) {
        // フォールバック: モーダル要素がない場合はブラウザ標準のconfirmを使用
        if (confirm(message)) {
            if (typeof onConfirm === 'function') onConfirm();
        } else {
            if (typeof onCancel === 'function') onCancel();
        }
        return;
    }

    modalMessage.textContent = message;

    // イベントリスナーの重複を防ぐためにボタンをクローンして差し替え
    const newConfirmBtn = modalConfirmBtn.cloneNode(true);
    modalConfirmBtn.parentNode.replaceChild(newConfirmBtn, modalConfirmBtn);
    modalConfirmBtn = newConfirmBtn;
    modalConfirmBtn.onclick = () => {
        if (typeof onConfirm === 'function') onConfirm();
        hideConfirmationModal();
    };

    const newCancelBtn = modalCancelBtn.cloneNode(true);
    modalCancelBtn.parentNode.replaceChild(newCancelBtn, modalCancelBtn);
    modalCancelBtn = newCancelBtn;
    modalCancelBtn.onclick = () => {
        if (typeof onCancel === 'function') onCancel();
        hideConfirmationModal();
    };

    showModal(confirmationModal);
}

/**
 * パスワード入力モーダルを表示する
 */
export function showPasswordModal(role, onSuccess) {
    const adminPasswordInput = document.getElementById("admin-password-input");
    const adminPasswordError = document.getElementById("admin-password-error");
    const adminPasswordSubmitBtn = document.getElementById("admin-password-submit-btn");

    if (!adminPasswordView || !adminPasswordInput) return;

    adminPasswordInput.value = "";
    if (adminPasswordError) {
        adminPasswordError.textContent = "";
        adminPasswordError.classList.add("hidden");
    }
    
    showModal(adminPasswordView);
    adminPasswordInput.focus();

    const checkPassword = () => {
        const val = adminPasswordInput.value;
        const isValid = (role === "host" && val === "9999") || (role === "manager" && val === "0000");

        if (isValid) {
            closeModal(adminPasswordView);
            onSuccess();
        } else {
            if (adminPasswordError) {
                adminPasswordError.textContent = "パスワードが違います";
                adminPasswordError.classList.remove("hidden");
            }
            adminPasswordInput.value = "";
        }
    };

    if (adminPasswordSubmitBtn) adminPasswordSubmitBtn.onclick = checkPassword;
    adminPasswordInput.onkeydown = (e) => {
        if (e.key === "Enter") checkPassword();
        if (e.key === "Escape") closeModal(adminPasswordView);
    };
}

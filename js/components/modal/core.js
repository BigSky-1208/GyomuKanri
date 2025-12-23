// js/components/modal/core.js 追記・修正
export const confirmationModal = document.getElementById("confirmation-modal");
export const adminPasswordView = document.getElementById("admin-password-view");
export const editLogModal = document.getElementById("edit-log-modal");          // ★追加
export const editMemoModal = document.getElementById("edit-memo-modal");        // ★追加
export const editContributionModal = document.getElementById("edit-contribution-modal"); // ★追加
export const fixCheckoutModal = document.getElementById("fix-checkout-modal");  // ★追加
export const exportExcelModal = document.getElementById("export-excel-modal");  // ★追加

const modalMessage = document.getElementById("modal-message");
let modalConfirmBtn = document.getElementById("modal-confirm-btn");
let modalCancelBtn = document.getElementById("modal-cancel-btn");

/**
 * パスワード入力モーダルを表示する
 */
export function showPasswordModal(role, onSuccess) {
    const adminPasswordInput = document.getElementById("admin-password-input");
    const adminPasswordError = document.getElementById("admin-password-error");
    const adminPasswordSubmitBtn = document.getElementById("admin-password-submit-btn");

    if (!adminPasswordView || !adminPasswordInput) return;

    adminPasswordInput.value = "";
    if (adminPasswordError) adminPasswordError.classList.add("hidden");
    
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
        }
    };

    adminPasswordSubmitBtn.onclick = checkPassword;
    adminPasswordInput.onkeydown = (e) => { if (e.key === "Enter") checkPassword(); };
}

export function hideConfirmationModal() {
    closeModal(confirmationModal);
}

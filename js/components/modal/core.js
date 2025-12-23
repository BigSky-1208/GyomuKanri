// js/components/modal/core.js
export const confirmationModal = document.getElementById("confirmation-modal");
export const adminPasswordView = document.getElementById("admin-password-view");
export const editLogModal = document.getElementById("edit-log-modal");
export const fixCheckoutModal = document.getElementById("fix-checkout-modal"); // ★ここだけに残す
export const editMemoModal = document.getElementById("edit-memo-modal");
export const helpModal = document.getElementById("help-modal");
export const goalDetailsModal = document.getElementById("goal-details-modal");
export const goalModal = document.getElementById("goal-modal");
export const exportExcelModal = document.getElementById("export-excel-modal");
export const editContributionModal = document.getElementById("edit-contribution-modal");
export const breakReservationModal = document.getElementById("break-reservation-modal");
export const addUserModal = document.getElementById("add-user-modal");
export const taskModal = document.getElementById("task-modal");

const modalMessage = document.getElementById("modal-message");
let modalConfirmBtn = document.getElementById("modal-confirm-btn");
let modalCancelBtn = document.getElementById("modal-cancel-btn");

export function showModal(modalElement) {
    if (modalElement) modalElement.classList.remove("hidden");
}

export function closeModal(modalElement) {
    if (modalElement) modalElement.classList.add("hidden");
}

export function hideConfirmationModal() {
    closeModal(confirmationModal);
}

// 元のコードの「ボタンをクローンしてリスナーを掃除する」ロジックを完全再現
export function showConfirmationModal(message, onConfirm, onCancel = hideConfirmationModal) {
    if (!confirmationModal || !modalMessage || !modalConfirmBtn || !modalCancelBtn) {
        if (confirm(message)) onConfirm?.(); else onCancel?.();
        return;
    }

    modalMessage.textContent = message;

    // 確認ボタンのクローン
    const newConfirmBtn = modalConfirmBtn.cloneNode(true);
    modalConfirmBtn.parentNode.replaceChild(newConfirmBtn, modalConfirmBtn);
    modalConfirmBtn = newConfirmBtn;
    modalConfirmBtn.addEventListener('click', () => {
        onConfirm?.();
        hideConfirmationModal();
    });

    // キャンセルボタンのクローン
    const newCancelBtn = modalCancelBtn.cloneNode(true);
    modalCancelBtn.parentNode.replaceChild(newCancelBtn, modalCancelBtn);
    modalCancelBtn = newCancelBtn;
    modalCancelBtn.addEventListener('click', () => {
        onCancel?.();
        hideConfirmationModal();
    });

    showModal(confirmationModal);
}

export function showPasswordModal(role, onSuccess) {
    const input = document.getElementById("admin-password-input");
    const error = document.getElementById("admin-password-error");
    const submitBtn = document.getElementById("admin-password-submit-btn");

    if (!adminPasswordView || !input) {
        const password = prompt(role === "host" ? "管理者パスワード:" : "業務管理者パスワード:");
        if ((role === "host" && password === "9999") || (role === "manager" && password === "0000")) onSuccess();
        else alert("パスワードが違います");
        return;
    }

    input.value = "";
    if (error) { error.textContent = ""; error.classList.add("hidden"); }
    input.classList.remove("border-red-500");
    
    showModal(adminPasswordView);
    input.focus();

    const cleanup = () => {
        if (submitBtn) submitBtn.onclick = null;
        input.onkeydown = null;
        closeModal(adminPasswordView);
    };

    const check = () => {
        const val = input.value;
        if ((role === "host" && val === "9999") || (role === "manager" && val === "0000")) {
            cleanup(); onSuccess();
        } else {
            if (error) { error.textContent = "パスワードが違います"; error.classList.remove("hidden"); }
            input.classList.add("border-red-500");
            input.value = "";
        }
    };

    if (submitBtn) submitBtn.onclick = check;
    input.onkeydown = (e) => { if (e.key === "Enter") check(); if (e.key === "Escape") cleanup(); };
}

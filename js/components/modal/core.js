// js/components/modal/core.js
export const confirmationModal = document.getElementById("confirmation-modal");
export const adminPasswordView = document.getElementById("admin-password-view");
const modalMessage = document.getElementById("modal-message");
let modalConfirmBtn = document.getElementById("modal-confirm-btn");
let modalCancelBtn = document.getElementById("modal-cancel-btn");

export function showModal(modalElement) {
    if (modalElement) modalElement.classList.remove("hidden");
}

export function closeModal(modalElement) {
    if (modalElement) modalElement.classList.add("hidden");
}

export function showConfirmationModal(message, onConfirm, onCancel = () => closeModal(confirmationModal)) {
    if (!confirmationModal || !modalMessage) {
        if (confirm(message)) onConfirm?.();
        return;
    }
    modalMessage.textContent = message;
    
    // イベントリスナーの重複登録を防ぐためのクローン
    const newConfirm = modalConfirmBtn.cloneNode(true);
    modalConfirmBtn.parentNode.replaceChild(newConfirm, modalConfirmBtn);
    modalConfirmBtn = newConfirm;
    modalConfirmBtn.onclick = () => { onConfirm?.(); closeModal(confirmationModal); };

    const newCancel = modalCancelBtn.cloneNode(true);
    modalCancelBtn.parentNode.replaceChild(newCancel, modalCancelBtn);
    modalCancelBtn = newCancel;
    modalCancelBtn.onclick = () => { onCancel?.(); closeModal(confirmationModal); };

    showModal(confirmationModal);
}

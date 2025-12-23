// js/components/modal/core.js

// 内部でのみ使用する要素
const modalMessage = document.getElementById("modal-message");
let modalConfirmBtn = document.getElementById("modal-confirm-btn");
let modalCancelBtn = document.getElementById("modal-cancel-btn");

// --- 2. 基本的な開閉関数 ---

export function showModal(modalElement) {
    if (modalElement) modalElement.classList.remove("hidden");
}

export function closeModal(modalElement) {
    if (modalElement) modalElement.classList.add("hidden");
}


    modalMessage.textContent = message;

    // ボタンをクローンして既存のイベントリスナーをリセット
    const newConfirmBtn = modalConfirmBtn.cloneNode(true);
    modalConfirmBtn.parentNode.replaceChild(newConfirmBtn, modalConfirmBtn);
    modalConfirmBtn = newConfirmBtn;
    modalConfirmBtn.onclick = () => {
        onConfirm?.();
        hideConfirmationModal();
    };

    const newCancelBtn = modalCancelBtn.cloneNode(true);
    modalCancelBtn.parentNode.replaceChild(newCancelBtn, modalCancelBtn);
    modalCancelBtn = newCancelBtn;
    modalCancelBtn.onclick = () => {
        onCancel?.();
        hideConfirmationModal();
    };

    showModal(confirmationModal);
}

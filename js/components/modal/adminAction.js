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

/**
 * 3. 確認モーダル (★最重要)
 * cloneNode を使用することで、以前のイベントリスナーが残って
 * 「1回押しただけなのに2回削除される」といったバグを完全に防いでいます。
 */
export function showConfirmationModal(message, onConfirm, onCancel = hideConfirmationModal) {
    if (!confirmationModal || !modalMessage || !modalConfirmBtn || !modalCancelBtn) {
        if (confirm(message)) onConfirm?.(); else onCancel?.();
        return;
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

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

export function hideConfirmationModal() {
    closeModal(confirmationModal);
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

/**
 * 4. パスワード入力モーダル
 * 管理者（9999）と業務管理者（0000）の判定、Enterキー対応、
 * 失敗時の赤枠エラー表示など、元の機能をすべて網羅しています。
 */
export function showPasswordModal(role, onSuccess) {
    const input = document.getElementById("admin-password-input");
    const error = document.getElementById("admin-password-error");
    const submitBtn = document.getElementById("admin-password-submit-btn");

    if (!adminPasswordView || !input) return;

    // 入力欄のリセット
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
        const isValid = (role === "host" && val === "9999") || (role === "manager" && val === "0000");

        if (isValid) {
            cleanup();
            onSuccess();
        } else {
            if (error) {
                error.textContent = "パスワードが違います";
                error.classList.remove("hidden");
            }
            input.classList.add("border-red-500");
            input.value = "";
        }
    };

    if (submitBtn) submitBtn.onclick = check;
    input.onkeydown = (e) => {
        if (e.key === "Enter") check();
        if (e.key === "Escape") cleanup();
    };
}

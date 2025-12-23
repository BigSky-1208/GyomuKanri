// js/components/modal/index.js
// 外部からはこのファイルを通して各モーダル機能を呼び出します

export * from './core.js';
export * from './taskGoal.js';
export * from './message.js';
import { closeModal, adminPasswordView } from './core.js';

/**
 * すべてのモーダルのキャンセルボタン等に一括でリスナーを設定
 */
export function setupModalEventListeners() {
    console.log("Setting up modal event listeners...");

    const closeMapping = [
        { btn: "task-cancel-btn", modal: "task-modal" },
        { btn: "goal-modal-cancel-btn", modal: "goal-modal" },
        { btn: "admin-password-cancel-btn", modal: "admin-password-view" },
        { btn: "break-reservation-cancel-btn", modal: "break-reservation-modal" },
        { btn: "message-cancel-btn", modal: "message-modal" },
        { btn: "edit-log-cancel-btn", modal: "edit-log-modal" }
    ];

    closeMapping.forEach(({ btn, modal }) => {
        const btnEl = document.getElementById(btn);
        const modalEl = document.getElementById(modal);
        if (btnEl && modalEl) {
            btnEl.onclick = () => closeModal(modalEl);
        }
    });

    console.log("Modal event listeners initialized.");
}

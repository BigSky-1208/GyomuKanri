// js/components/modal/index.js
export * from './core.js';
export * from './taskGoal.js';
export * from './message.js';
export * from './utils.js'; // 今回追加した utils.js

import { setupModalEventListeners } from './index.js'; // 内部参照用

/**
 * モーダル関連のイベントリスナーを一括設定
 * 既存の setupModalEventListeners を整理
 */
export function setupModalEventListeners() {
    console.log("Initializing all modal event listeners...");
    
    // 共通の「キャンセル・閉じる」ボタンのマッピング
    const closeButtons = [
        { id: "task-cancel-btn", modalId: "task-modal" },
        { id: "goal-modal-cancel-btn", modalId: "goal-modal" },
        { id: "help-modal-close-btn", modalId: "help-modal" },
        { id: "break-reservation-cancel-btn", modalId: "break-reservation-modal" },
        { id: "admin-password-cancel-btn", modalId: "admin-password-view" },
        { id: "message-cancel-btn", modalId: "message-modal" }
    ];

    closeButtons.forEach(({ id, modalId }) => {
        const btn = document.getElementById(id);
        const modal = document.getElementById(modalId);
        if (btn && modal) {
            btn.onclick = () => {
                modal.classList.add("hidden");
            };
        }
    });
}

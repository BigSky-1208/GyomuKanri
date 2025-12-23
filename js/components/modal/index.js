export * from './core.js';
export * from './taskGoal.js';
export * from './adminAction.js';
export * from './utils.js';

import { closeModal } from './core.js';

export function setupModalEventListeners() {
    console.log("Initializing all modal event listeners...");
    
    const closeButtons = [
        { id: "task-cancel-btn", modalId: "task-modal" },
        { id: "goal-modal-cancel-btn", modalId: "goal-modal" },
        { id: "help-modal-close-btn", modalId: "help-modal" },
        { id: "break-reservation-cancel-btn", modalId: "break-reservation-modal" },
        { id: "admin-password-cancel-btn", modalId: "admin-password-view" },
        { id: "message-cancel-btn", modalId: "message-modal" },
        { id: "add-user-modal-cancel-btn", modalId: "add-user-modal" }, // 追加
        { id: "edit-log-cancel-btn", modalId: "edit-log-modal" },     // 追加
        { id: "cancel-export-excel-btn", modalId: "export-excel-modal" }, // 追加
        { id: "goal-details-modal-close-btn", modalId: "goal-details-modal" } // 追加
    ];

    closeButtons.forEach(({ id, modalId }) => {
        const btn = document.getElementById(id);
        const modal = document.getElementById(modalId);
        if (btn && modal) {
            btn.onclick = () => closeModal(modal);
        }
    });
}

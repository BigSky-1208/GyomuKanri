// js/components/modal/index.js
export * from './core.js';
export * from './taskGoal.js';
export * from './adminAction.js';
export * from './utils.js';

// 他のファイルを star export (*) しているので、
// 各ファイルで名前が重複しているとエラーになります。
// 必ず「DOM要素の定義(export const ...)」は core.js だけにしてください。

import { closeModal } from './core.js';

export function setupModalEventListeners() {
    console.log("Initializing modal listeners...");
    const mapping = [
        { btn: 'task-cancel-btn', modalId: 'task-modal' },
        { btn: 'goal-modal-cancel-btn', modalId: 'goal-modal' },
        { btn: 'help-modal-close-btn', modalId: 'help-modal' },
        { btn: 'break-reservation-cancel-btn', modalId: 'break-reservation-modal' },
        { btn: 'admin-password-cancel-btn', modalId: 'admin-password-view' },
        { btn: 'message-cancel-btn', modalId: 'message-modal' },
        { btn: 'fix-checkout-cancel-btn', modalId: 'fix-checkout-modal' }
        // 必要に応じて追加
    ];

    mapping.forEach(({ btn, modalId }) => {
        const btnEl = document.getElementById(btn);
        const modalEl = document.getElementById(modalId);
        if (btnEl && modalEl) {
            btnEl.onclick = () => closeModal(modalEl);
        }
    });
}

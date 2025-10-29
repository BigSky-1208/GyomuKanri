// ... existing code ...

/**
 * Displays a confirmation modal with a message and sets callbacks for buttons.
 * @param {string} message - The message to display in the modal.
 * @param {function} onConfirm - Function to call when the confirm button is clicked.
 * @param {function} [onCancel=hideConfirmationModal] - Function to call when cancel is clicked (defaults to hiding modal).
 */
export function showConfirmationModal(message, onConfirm, onCancel = hideConfirmationModal) {
    // ... existing code ...

    // --- Assign Button Listeners ---
    // Remove previous listeners before adding new ones to prevent multiple calls
    const newConfirmBtn = modalConfirmBtn.cloneNode(true);
    modalConfirmBtn.parentNode.replaceChild(newConfirmBtn, modalConfirmBtn);
    newConfirmBtn.addEventListener('click', () => {
        if (typeof onConfirmCallback === 'function') {
            onConfirmCallback(); // Execute the stored callback
        }
        // hideConfirmationModal(); // Callback should handle hiding if needed, or hide here. Let's let callback handle it.
    });
    // Re-assign reference (Change const to let for modalConfirmBtn and modalCancelBtn at the top if reassignment is needed globally,
    // otherwise, shadowing like this is acceptable but avoid reassigning the original consts)
    // modalConfirmBtn = newConfirmBtn; // Avoid reassigning const


    const newCancelBtn = modalCancelBtn.cloneNode(true);
    modalCancelBtn.parentNode.replaceChild(newCancelBtn, modalCancelBtn);
    newCancelBtn.addEventListener('click', () => {
         if (typeof onCancel === 'function') {
             onCancel(); // Execute the cancel callback
         }
         // Ensure modal hides even if onCancel doesn't explicitly do it.
         hideConfirmationModal();
    });
    // Re-assign reference
    // modalCancelBtn = newCancelBtn; // Avoid reassigning const
    // --- End Assign Button Listeners ---


    showModal(confirmationModal); // Show the modal
}

// ... existing code ...

/**
 * Sets up basic event listeners for modal close/cancel buttons.
 * Confirmation modal buttons are handled dynamically in `showConfirmationModal`.
 * Save/Confirm actions for other modals are typically handled in their respective view modules.
 */
export function setupModalEventListeners() {
    // ... existing code ...

    // Specific Cancel/Close buttons
    // modalCancelBtn?.addEventListener('click', hideConfirmationModal); // Confirmation cancel handled dynamically in showConfirmationModal

    // Add references for buttons used only for closing
    const editLogCancelBtn = document.getElementById('edit-log-cancel-btn');
    const editMemoCancelBtn = document.getElementById('edit-memo-cancel-btn');
    const editContributionCancelBtn = document.getElementById('edit-contribution-cancel-btn');
    const fixCheckoutCancelBtn = document.getElementById('fix-checkout-cancel-btn');
    const exportExcelCancelBtn = document.getElementById('cancel-export-excel-btn');


    goalModalCancelBtn?.addEventListener('click', closeGoalModal);
    addUserModalCancelBtn?.addEventListener('click', closeAddUserModal);
    helpModalCloseBtn?.addEventListener('click', closeHelpModal);
    goalDetailsModalCloseBtn?.addEventListener('click', closeGoalDetailsModal);
    breakReservationCancelBtn?.addEventListener('click', closeBreakReservationModal);

    // Other modal cancel/close buttons (if they only close the modal)
    editLogCancelBtn?.addEventListener('click', () => closeModal(editLogModal));
    editMemoCancelBtn?.addEventListener('click', () => closeModal(editMemoModal));
    editContributionCancelBtn?.addEventListener('click', () => closeModal(editContributionModal));
    // fixCheckoutCancelBtn handled in personalDetail.js or clientUI.js as it needs specific reset? Let's add here for consistency.
    // document.getElementById('fix-checkout-cancel-btn')?.addEventListener('click', () => closeModal(fixCheckoutModal));
    fixCheckoutCancelBtn?.addEventListener('click', () => closeModal(fixCheckoutModal));
    // exportExcelCancelBtn handled in excelExport.js? Add here.
    // document.getElementById('cancel-export-excel-btn')?.addEventListener('click', () => closeModal(exportExcelModal));
    exportExcelCancelBtn?.addEventListener('click', () => closeModal(exportExcelModal));


    // Admin Password Cancel
    adminPasswordCancelBtn?.addEventListener("click", () => {
         closeModal(adminPasswordView);
         if(adminPasswordError) adminPasswordError.textContent = ''; // Clear error on cancel
         if(adminPasswordInput) adminPasswordInput.value = ''; // Clear input
         // Reset adminLoginDestination? Depends on main.js logic.
    });

// ... existing code ...

// js/views/personalDetail/adminActions.js (管理者機能 担当)

import { db, showView, VIEWS } from "../../main.js";
import { collection, query, where, getDocs, writeBatch, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmationModal, hideConfirmationModal } from "../../components/modal/index.js";
import { escapeHtml } from "../../utils.js";

/**
 * Handles the click on the "このユーザーのプロフィールと全記録を削除" button.
 * @param {string} currentUserForDetailView - The name of the user being viewed.
 * @param {string} authLevel - The user's auth level.
 * @param {string} currentUserName - The name of the logged-in user.
 */
export function handleDeleteUserClick(currentUserForDetailView, authLevel, currentUserName) {
    if (authLevel !== 'admin' || !currentUserForDetailView || currentUserForDetailView === currentUserName) {
        console.warn("Delete user action aborted: Insufficient permissions or invalid target.");
        return; // Only admin can delete *other* users
    }

    const userNameToDelete = currentUserForDetailView;

    showConfirmationModal(
        `本当に「${escapeHtml(userNameToDelete)}」のプロフィールと全ての業務記録（work_logs, work_status）を削除しますか？\n\nこの操作は元に戻せません。`,
        async () => {
            console.warn(`Attempting to delete user: ${userNameToDelete}`);
            hideConfirmationModal(); // Hide modal immediately

            try {
                const batch = writeBatch(db);

                // 1. Find User Profile ID
                let userIdToDelete = null;
                const qProfiles = query(collection(db, "user_profiles"), where("name", "==", userNameToDelete));
                const profileDocs = await getDocs(qProfiles);
                if (!profileDocs.empty) {
                    userIdToDelete = profileDocs.docs[0].id;
                    batch.delete(profileDocs.docs[0].ref); // Delete user_profiles document
                    console.log(`Deleting profile for ${userNameToDelete} (ID: ${userIdToDelete})`);
                } else {
                    console.warn(`User profile not found for "${userNameToDelete}". Proceeding to delete logs.`);
                }

                 // 2. Delete Work Logs associated with the username
                 const qLogs = query(collection(db, "work_logs"), where("userName", "==", userNameToDelete));
                 const logDocs = await getDocs(qLogs);
                 console.log(`Found ${logDocs.size} work logs for ${userNameToDelete} to delete.`);
                 logDocs.forEach((docSnapshot) => batch.delete(docSnapshot.ref));

                 // 3. Delete Work Status if userId was found
                 if (userIdToDelete) {
                     const statusRef = doc(db, "work_status", userIdToDelete);
                     batch.delete(statusRef); // Delete work_status document
                     console.log(`Deleting status for ${userNameToDelete} (ID: ${userIdToDelete})`);
                 } else {
                     console.warn(`Skipping status deletion as userId for ${userNameToDelete} was not found.`);
                 }

                // 4. Commit all deletions
                await batch.commit();
                console.log(`Successfully deleted user ${userNameToDelete} and associated data.`);
                alert(`ユーザー「${escapeHtml(userNameToDelete)}」を削除しました。`);

                // Navigate back to the host view after deletion
                showView(VIEWS.HOST);

            } catch (error) {
                console.error(`Error deleting user ${userNameToDelete}:`, error);
                alert(`ユーザー「${escapeHtml(userNameToDelete)}」の削除中にエラーが発生しました。`);
            }
        },
        () => {
             console.log(`Deletion of user ${userNameToDelete} cancelled.`); // Log cancellation
        }
    );
}

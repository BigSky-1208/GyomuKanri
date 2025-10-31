// js/views/progress/progressActions.js (アクション担当)

import { db, allTaskObjects } from "../../main.js";
import { doc, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmationModal, hideConfirmationModal } from "../../components/modal.js";
import { escapeHtml } from "../../utils.js";

/**
 * Handles the click on the "完了" (Complete) button for a goal.
 * Prompts for confirmation and updates the goal's status in Firestore.
 * @param {string} taskName - The name of the task the goal belongs to.
 * @param {string} goalId - The ID of the goal to mark as complete.
 * @param {function} onSuccessCallback - Callback to run on successful update (for UI refresh).
 */
export async function handleCompleteGoal(taskName, goalId, onSuccessCallback) {
    if (!taskName || !goalId) return;

    const task = allTaskObjects?.find(t => t.name === taskName);
    const goal = task?.goals?.find(g => g.id === goalId);
    if (!goal) return;

    showConfirmationModal(
        `工数「${escapeHtml(goal.title)}」を完了しますか？\n完了した工数はアーカイブに移動します。`,
        async () => {
            hideConfirmationModal(); // Hide modal immediately

            const taskIndex = allTaskObjects.findIndex((t) => t.name === taskName);
            if (taskIndex === -1 || !allTaskObjects[taskIndex].goals) return;

            const goalIndex = allTaskObjects[taskIndex].goals.findIndex((g) => g.id === goalId);
            if (goalIndex === -1) return;

            // Create a deep copy for update
            const updatedTasks = JSON.parse(JSON.stringify(allTaskObjects));
            const goalToUpdate = updatedTasks[taskIndex].goals[goalIndex];

            // Mark as complete and set completion timestamp
            goalToUpdate.isComplete = true;
            goalToUpdate.completedAt = Timestamp.now(); // Use Firestore Timestamp

            // Update Firestore
            const tasksRef = doc(db, "settings", "tasks");
            try {
                await updateDoc(tasksRef, { list: updatedTasks });
                console.log(`Goal ${goalId} marked as complete.`);

                // Firestoreリスナーがmain.jsでallTaskObjectsを自動更新する
                
                // 司令塔(progress.js)に成功を通知し、UI更新をトリガー
                if (typeof onSuccessCallback === 'function') {
                    onSuccessCallback();
                }

            } catch (error) {
                console.error("Error marking goal as complete:", error);
                alert("工数の完了処理中にエラーが発生しました。");
            }
        },
        () => {
             console.log("Goal completion cancelled.");
        }
    );
}

/**
 * Handles the click on the "削除" (Delete) button for a goal.
 * Prompts for confirmation and removes the goal from the task in Firestore.
 * @param {string} taskName - The name of the task the goal belongs to.
 * @param {string} goalId - The ID of the goal to delete.
 * @param {function} onSuccessCallback - Callback to run on successful update (for UI refresh).
 */
export async function handleDeleteGoal(taskName, goalId, onSuccessCallback) {
    if (!taskName || !goalId) return;

    const task = allTaskObjects?.find(t => t.name === taskName);
    const goal = task?.goals?.find(g => g.id === goalId);
    if (!goal) return;

    showConfirmationModal(
        `工数「${escapeHtml(goal.title)}」を完全に削除しますか？\n\n関連する全ての進捗記録（貢献件数ログ）は残りますが、この工数自体は復元できません。`,
        async () => {
            hideConfirmationModal(); // Hide modal immediately

            const taskIndex = allTaskObjects.findIndex((t) => t.name === taskName);
            if (taskIndex === -1 || !allTaskObjects[taskIndex].goals) return;

            // Create a deep copy for update
            const updatedTasks = JSON.parse(JSON.stringify(allTaskObjects));

            // Filter out the goal to be deleted
            updatedTasks[taskIndex].goals = updatedTasks[taskIndex].goals.filter(
                (g) => g.id !== goalId
            );

            // Update Firestore
            const tasksRef = doc(db, "settings", "tasks");
            try {
                await updateDoc(tasksRef, { list: updatedTasks });
                console.log(`Goal ${goalId} deleted from task ${taskName}.`);

                // Firestoreリスナーがmain.jsでallTaskObjectsを自動更新する

                // 司令塔(progress.js)に成功を通知し、UI更新をトリガー
                if (typeof onSuccessCallback === 'function') {
                    onSuccessCallback();
                }

            } catch (error) {
                console.error("Error deleting goal:", error);
                alert("工数の削除中にエラーが発生しました。");
            }
        },
        () => {
             console.log("Goal deletion cancelled.");
        }
    );
}

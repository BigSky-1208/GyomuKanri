// js/views/progress/progressActions.js (アクション担当)

import { db, allTaskObjects } from "../../main.js";
import { doc, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmationModal, hideConfirmationModal } from "../../components/modal/index.js";
import { escapeHtml } from "../../utils.js";

export async function handleCompleteGoal(taskName, goalId, onSuccessCallback) {
    if (!taskName || !goalId) return;

    const task = allTaskObjects?.find(t => t.name === taskName);
    const goal = task?.goals?.find(g => g.id === goalId);
    if (!goal) return;

    showConfirmationModal(
        `工数「${escapeHtml(goal.title)}」を完了しますか？\n完了した工数はアーカイブに移動します。`,
        async () => {
            hideConfirmationModal(); 

            const taskIndex = allTaskObjects.findIndex((t) => t.name === taskName);
            if (taskIndex === -1 || !allTaskObjects[taskIndex].goals) return;

            const goalIndex = allTaskObjects[taskIndex].goals.findIndex((g) => g.id === goalId);
            if (goalIndex === -1) return;

            const updatedTasks = JSON.parse(JSON.stringify(allTaskObjects));
            const goalToUpdate = updatedTasks[taskIndex].goals[goalIndex];

            goalToUpdate.isComplete = true;
            goalToUpdate.completedAt = Timestamp.now(); 

            const tasksRef = doc(db, "settings", "tasks");
            try {
                await updateDoc(tasksRef, { list: updatedTasks });
                console.log(`Goal ${goalId} marked as complete.`);

                
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

export async function handleDeleteGoal(taskName, goalId, onSuccessCallback) {
    if (!taskName || !goalId) return;

    const task = allTaskObjects?.find(t => t.name === taskName);
    const goal = task?.goals?.find(g => g.id === goalId);
    if (!goal) return;

    showConfirmationModal(
        `工数「${escapeHtml(goal.title)}」を完全に削除しますか？\n\n関連する全ての進捗記録（貢献件数ログ）は残りますが、この工数自体は復元できません。`,
        async () => {
            hideConfirmationModal(); 

            const taskIndex = allTaskObjects.findIndex((t) => t.name === taskName);
            if (taskIndex === -1 || !allTaskObjects[taskIndex].goals) return;

            const updatedTasks = JSON.parse(JSON.stringify(allTaskObjects));

            updatedTasks[taskIndex].goals = updatedTasks[taskIndex].goals.filter(
                (g) => g.id !== goalId
            );

            const tasksRef = doc(db, "settings", "tasks");
            try {
                await updateDoc(tasksRef, { list: updatedTasks });
                console.log(`Goal ${goalId} deleted from task ${taskName}.`);

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

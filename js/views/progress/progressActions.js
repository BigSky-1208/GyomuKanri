// js/views/progress/progressActions.js (アクション担当)

import { db, allTaskObjects, updateGlobalTaskObjects } from "../../main.js"; // ★ updateGlobalTaskObjects を追加
import { doc, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmationModal, hideConfirmationModal } from "../../components/modal/index.js";
import { escapeHtml } from "../../utils.js";

export async function handleCompleteGoal(taskName, goalId, onSuccessCallback) {
    if (!taskName || !goalId) return;

    const task = allTaskObjects?.find(t => t.name === taskName);
    // ★ IDまたはタイトルで検索
    const goal = task?.goals?.find(g => g.id === goalId || g.title === goalId);
    if (!goal) return;

    showConfirmationModal(
        `工数「${escapeHtml(goal.title)}」を完了にしますか？`,
        async () => {
            hideConfirmationModal(); 

            const taskIndex = allTaskObjects.findIndex((t) => t.name === taskName);
            const goalIndex = allTaskObjects[taskIndex].goals.findIndex((g) => g.id === goalId || g.title === goalId); // ★ 修正
            if (goalIndex === -1) return;

            const updatedTasks = JSON.parse(JSON.stringify(allTaskObjects));
            updatedTasks[taskIndex].goals[goalIndex].isComplete = true;
            updatedTasks[taskIndex].goals[goalIndex].completedAt = Timestamp.now(); 

            try {
                await updateDoc(doc(db, "settings", "tasks"), { list: updatedTasks });
                
                // ★ 重要: ローカルのデータを即時更新する
                updateGlobalTaskObjects(updatedTasks);

                if (typeof onSuccessCallback === 'function') onSuccessCallback();
            } catch (error) {
                console.error(error);
                alert("エラーが発生しました。");
            }
        }
    );
}

export async function handleDeleteGoal(taskName, goalId, onSuccessCallback) {
    if (!taskName || !goalId) return;

    const taskIndex = allTaskObjects.findIndex((t) => t.name === taskName);
    if (taskIndex === -1) return;

    const updatedTasks = JSON.parse(JSON.stringify(allTaskObjects));
    // ★ IDまたはタイトルでフィルタリング
    updatedTasks[taskIndex].goals = updatedTasks[taskIndex].goals.filter(
        (g) => g.id !== goalId && g.title !== goalId
    );

    showConfirmationModal(
        `工数を完全に削除しますか？`,
        async () => {
            hideConfirmationModal(); 
            try {
                await updateDoc(doc(db, "settings", "tasks"), { list: updatedTasks });
                
                // ★ 重要: ローカルのデータを即時更新する
                updateGlobalTaskObjects(updatedTasks);

                if (typeof onSuccessCallback === 'function') onSuccessCallback();
            } catch (error) {
                console.error(error);
                alert("削除に失敗しました。");
            }
        }
    );
}

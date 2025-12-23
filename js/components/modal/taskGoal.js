import { db } from "../../firebase.js"; // Firebaseが必要な場合
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmationModal } from "./core.js";

export function openGoalModal(mode, taskName, goalId = null) {
    const title = document.getElementById("goal-modal-title");
    const taskInput = document.getElementById("goal-modal-task-name");
    const goalIdInput = document.getElementById("goal-modal-goal-id");
    const titleInput = document.getElementById("goal-modal-title-input");
    const targetInput = document.getElementById("goal-modal-target-input");
    const deadlineInput = document.getElementById("goal-modal-deadline-input");
    const effortDeadlineInput = document.getElementById("goal-modal-effort-deadline-input");
    const memoInput = document.getElementById("goal-modal-memo-input");

    if (!goalModal) return;

    taskInput.value = taskName;
    goalIdInput.value = goalId || "";

    if (mode === 'edit' && goalId) {
        title.textContent = "工数の編集";
        // 既存データを検索して入力欄を埋める
        const task = allTaskObjects.find((t) => t.name === taskName);
        const goal = task?.goals?.find((g) => g.id === goalId);
        if (goal) {
            titleInput.value = goal.title || "";
            targetInput.value = goal.target || "";
            deadlineInput.value = goal.deadline || "";
            effortDeadlineInput.value = goal.effortDeadline || "";
            memoInput.value = goal.memo || "";
        }
    } else {
        title.textContent = `[${escapeHtml(taskName)}] に工数を追加`;
        titleInput.value = "";
        targetInput.value = "";
        deadlineInput.value = "";
        effortDeadlineInput.value = "";
        memoInput.value = "";
    }
    showModal(goalModal);
}

/**
 * 工数を削除するロジック
 */
export async function handleDeleteGoal(taskName, goalId) {
    showConfirmationModal("この工数を削除してもよろしいですか？", async () => {
        const { allTaskObjects, updateGlobalTaskObjects } = await import("../../main.js");
        const task = allTaskObjects.find(t => t.name === taskName);
        if (!task) return;

        const updatedGoals = task.goals.filter(g => g.id !== goalId);
        const taskRef = doc(db, "settings", "tasks");
        const newTaskList = allTaskObjects.map(t => t.name === taskName ? { ...t, goals: updatedGoals } : t);

        await updateDoc(taskRef, { list: newTaskList });
        updateGlobalTaskObjects(newTaskList);
        // 必要ならUI再描画を呼び出す
    });
}

/**
 * 完了した工数を未完了に戻すロジック
 */
export async function handleRestoreGoalClick(taskName, goalId) {
    const { allTaskObjects, updateGlobalTaskObjects } = await import("../../main.js");
    const task = allTaskObjects.find(t => t.name === taskName);
    const goal = task?.goals?.find(g => g.id === goalId);
    if (!goal) return;

    showConfirmationModal(`「${goal.title}」を未完了に戻しますか？`, async () => {
        const updatedGoals = task.goals.map(g => 
            g.id === goalId ? { ...g, isCompleted: false, completedAt: null } : g
        );
        const newTaskList = allTaskObjects.map(t => t.name === taskName ? { ...t, goals: updatedGoals } : t);
        
        await updateDoc(doc(db, "settings", "tasks"), { list: newTaskList });
        updateGlobalTaskObjects(newTaskList);
    });
}

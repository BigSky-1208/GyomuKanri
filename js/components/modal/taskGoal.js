// js/components/modal/taskGoal.js
import { db } from "../../firebase.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { allTaskObjects, updateGlobalTaskObjects, escapeHtml } from "../../main.js";
import { showModal, closeModal, showConfirmationModal } from "./core.js";

// --- DOM要素の取得 ---
export const taskModal = document.getElementById("task-modal");
export const goalModal = document.getElementById("goal-modal");
export const goalDetailsModal = document.getElementById("goal-details-modal");

/**
 * 業務（Task）追加・編集モーダルを開く
 */
export function openTaskModal(task = null) {
    const title = document.getElementById("task-modal-title");
    const nameInput = document.getElementById("task-name-input");
    if (!taskModal || !nameInput) return;

    if (task) {
        title.textContent = "業務を編集";
        nameInput.value = task.name;
        taskModal.dataset.editingName = task.name;
    } else {
        title.textContent = "新しい業務を追加";
        nameInput.value = "";
        delete taskModal.dataset.editingName;
    }
    showModal(taskModal);
    nameInput.focus();
}

/**
 * 工数（Goal）追加・編集モーダルを開く
 */
export function openGoalModal(mode, taskName, goalId = null) {
    // 関数内で要素を取得して ReferenceError を防ぐ
    const title = document.getElementById("goal-modal-title");
    const taskInput = document.getElementById("goal-modal-task-name");
    const goalIdInput = document.getElementById("goal-modal-goal-id");
    const titleInput = document.getElementById("goal-modal-title-input");
    const targetInput = document.getElementById("goal-modal-target-input");
    const deadlineInput = document.getElementById("goal-modal-deadline-input");
    const effortDeadlineInput = document.getElementById("goal-modal-effort-deadline-input");
    const memoInput = document.getElementById("goal-modal-memo-input");

    if (!goalModal) {
        console.error("goalModal element not found");
        return;
    }

    taskInput.value = taskName;
    goalIdInput.value = goalId || "";

    if (mode === 'edit' && goalId) {
        title.textContent = "工数の編集";
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
 * 工数を「完了」にするロジック
 */
export async function handleCompleteGoal(taskName, goalId) {
    const task = allTaskObjects.find(t => t.name === taskName);
    const goal = task?.goals?.find(g => g.id === goalId);
    if (!goal) return;

    showConfirmationModal(`「${goal.title}」を完了にしますか？`, async () => {
        const updatedGoals = task.goals.map(g => 
            g.id === goalId ? { ...g, isCompleted: true, completedAt: new Date() } : g
        );
        const newTaskList = allTaskObjects.map(t => t.name === taskName ? { ...t, goals: updatedGoals } : t);
        
        await updateDoc(doc(db, "settings", "tasks"), { list: newTaskList });
        updateGlobalTaskObjects(newTaskList);
        
        // 進捗画面なら再描画が必要（progress.js側の再描画関数を呼ぶかreload）
        if (window.location.hash === "#progress") location.reload(); 
    });
}

/**
 * 工数を「削除」するロジック
 */
export async function handleDeleteGoal(taskName, goalId) {
    const task = allTaskObjects.find(t => t.name === taskName);
    const goal = task?.goals?.find(g => g.id === goalId);
    if (!goal) return;

    showConfirmationModal(`工数「${goal.title}」を削除してもよろしいですか？\nこの操作は取り消せません。`, async () => {
        const updatedGoals = task.goals.filter(g => g.id !== goalId);
        const newTaskList = allTaskObjects.map(t => t.name === taskName ? { ...t, goals: updatedGoals } : t);

        await updateDoc(doc(db, "settings", "tasks"), { list: newTaskList });
        updateGlobalTaskObjects(newTaskList);
        
        location.reload(); 
    });
}

/**
 * 完了した工数を「未完了に戻す（復元）」
 */
export async function handleRestoreGoalClick(taskName, goalId) {
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
        
        location.reload();
    });
}

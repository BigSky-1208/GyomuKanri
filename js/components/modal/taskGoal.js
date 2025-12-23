// js/components/modal/taskGoal.js
import { db } from "../../firebase.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { allTaskObjects, updateGlobalTaskObjects, escapeHtml } from "../../main.js";
import { showModal, closeModal, showConfirmationModal, taskModal, goalModal } from "./core.js";

/**
 * 1. 業務(Task)の追加・編集モーダルを開く
 * 元の openTaskModal の全入力を網羅
 */
export function openTaskModal(task = null) {
    const title = document.getElementById("task-modal-title");
    const nameIn = document.getElementById("task-name-input");
    const catSel = document.getElementById("task-category-select");
    const memoIn = document.getElementById("task-memo-input");
    if (!taskModal || !nameIn) return;

    if (task) {
        title.textContent = "業務を編集";
        nameIn.value = task.name;
        catSel.value = task.category || "A";
        memoIn.value = task.memo || "";
        taskModal.dataset.editingName = task.name; // 変更前の名前を保存
    } else {
        title.textContent = "新しい業務を追加";
        nameIn.value = ""; catSel.value = "A"; memoIn.value = "";
        delete taskModal.dataset.editingName;
    }
    showModal(taskModal);
    nameIn.focus();
}

/**
 * 2. 工数(Goal)の追加・編集モーダルを開く
 * 元のコードの全入力項目（目標値、期限、工数期限、メモ）を完備
 */
export function openGoalModal(mode, taskName, goalId = null) {
    const title = document.getElementById("goal-modal-title");
    const taskIn = document.getElementById("goal-modal-task-name");
    const idIn = document.getElementById("goal-modal-goal-id");
    const titleIn = document.getElementById("goal-modal-title-input");
    const targetIn = document.getElementById("goal-modal-target-input");
    const deadlineIn = document.getElementById("goal-modal-deadline-input");
    const effortIn = document.getElementById("goal-modal-effort-deadline-input");
    const memoIn = document.getElementById("goal-modal-memo-input");
    goalModal.dataset.currentGoalId = goalId || "";

    if (idIn) idIn.value = goalId || "";
    if (taskIn) taskIn.value = taskName;

    if (!goalModal) return;

    taskIn.value = taskName;
    idIn.value = goalId || "";

if (mode === 'edit' && goalId) {
        title.textContent = "工数の編集";
        const task = allTaskObjects.find(t => t.name === taskName);
        // ★ ID または タイトルで検索
        const goal = task?.goals?.find(g => g.id === goalId || g.title === goalId);
    
        if (goal) {
            titleIn.value = goal.title || "";
            targetIn.value = goal.target || "";
            deadlineIn.value = goal.deadline || "";
            effortIn.value = goal.effortDeadline || "";
            memoIn.value = goal.memo || "";
        }
    } else {
        title.textContent = `[${escapeHtml(taskName)}] に工数を追加`;
        [titleIn, targetIn, deadlineIn, effortIn, memoIn].forEach(i => i.value = "");
    }
    showModal(goalModal);
    titleIn.focus();
}

/**
 * 3. 工数の完了処理 (Firebase連携)
 */
export async function handleCompleteGoal(taskName, goalId) {
    const task = allTaskObjects.find(t => t.name === taskName);
    const goal = task?.goals?.find(g => g.id === goalId);
    if (!goal) return;

    showConfirmationModal(`「${goal.title}」を完了にしますか？`, async () => {
        const updatedGoals = task.goals.map(g => 
            g.id === goalId ? { ...g, isCompleted: true, completedAt: new Date().toISOString() } : g
        );
        await updateFirestoreGoals(taskName, updatedGoals);
    });
}

/**
 * 4. 工数の削除処理 (Firebase連携)
 */
export async function handleDeleteGoal(taskName, goalId) {
    const task = allTaskObjects.find(t => t.name === taskName);
    const goal = task?.goals?.find(g => g.id === goalId);
    if (!goal) return;

    showConfirmationModal(`「${goal.title}」を削除しますか？\nこの操作は戻せません。`, async () => {
        const updatedGoals = task.goals.filter(g => g.id !== goalId);
        await updateFirestoreGoals(taskName, updatedGoals);
    });
}

/**
 * 5. 工数の復元処理 (Firebase連携)
 */
export async function handleRestoreGoalClick(taskName, goalId) {
    const task = allTaskObjects.find(t => t.name === taskName);
    const goal = task?.goals?.find(g => g.id === goalId);
    if (!goal) return;

    showConfirmationModal(`「${goal.title}」を未完了に戻しますか？`, async () => {
        const updatedGoals = task.goals.map(g => 
            g.id === goalId ? { ...g, isCompleted: false, completedAt: null } : g
        );
        await updateFirestoreGoals(taskName, updatedGoals);
    });
}

/**
 * Firestore更新の共通補助関数
 */
async function updateFirestoreGoals(taskName, updatedGoals) {
    try {
        const newTaskList = allTaskObjects.map(t => t.name === taskName ? { ...t, goals: updatedGoals } : t);
        await updateDoc(doc(db, "settings", "tasks"), { list: newTaskList });
        updateGlobalTaskObjects(newTaskList);
        location.reload(); // UIを確実に最新状態にするため
    } catch (e) {
        console.error("Firestore Update Error:", e);
        alert("更新に失敗しました。");
    }
}

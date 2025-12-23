// js/components/modal/taskGoal.js
import { allTaskObjects, escapeHtml } from "../../main.js";
import { showModal, closeModal } from "./core.js";

export const taskModal = document.getElementById("task-modal");
export const goalModal = document.getElementById("goal-modal");
export const goalDetailsModal = document.getElementById("goal-details-modal");

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

export function openGoalModal(mode, taskName, goalId = null) {
    const title = document.getElementById("goal-modal-title");
    const taskInput = document.getElementById("goal-modal-task-name");
    if (!goalModal) return;

    taskInput.value = taskName;
    if (mode === 'edit' && goalId) {
        title.textContent = "工数の編集";
        // ...既存の編集データ流し込みロジック...
    } else {
        title.textContent = `[${escapeHtml(taskName)}] に工数を追加`;
    }
    showModal(goalModal);
}

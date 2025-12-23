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

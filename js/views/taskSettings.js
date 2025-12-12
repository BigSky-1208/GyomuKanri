// js/views/taskSettings.js

import { db, allTaskObjects, authLevel, updateGlobalTaskObjects, handleGoBack, showView, VIEWS, userId } from "../main.js";
import { doc, setDoc, getDocs, collection, query, where, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmationModal, hideConfirmationModal, showHelpModal } from "../components/modal.js";
import { formatHoursMinutes } from "../utils.js";

const taskListEditor = document.getElementById("task-list-editor");
const addTaskForm = document.getElementById("add-task-form");
const newTaskInput = document.getElementById("new-task-input");
const addTaskButton = document.getElementById("add-task-btn");
const backButton = document.getElementById("back-to-selection-from-settings");
const helpButton = document.querySelector('#task-settings-view .help-btn');

// モーダル要素 (index.htmlにあるものを使用)
const goalModal = document.getElementById("goal-modal");
const goalModalTitle = document.getElementById("goal-modal-title");
const goalModalForm = document.getElementById("goal-modal-form");
const goalModalTaskNameInput = document.getElementById("goal-modal-task-name");
const goalModalGoalIdInput = document.getElementById("goal-modal-goal-id");
const goalTitleInput = document.getElementById("goal-modal-title-input");
const goalTargetInput = document.getElementById("goal-modal-target-input");
const goalDeadlineInput = document.getElementById("goal-modal-deadline-input");
const goalEffortDeadlineInput = document.getElementById("goal-modal-effort-deadline-input");
const goalMemoInput = document.getElementById("goal-modal-memo-input");
const goalModalSaveBtn = document.getElementById("goal-modal-save-btn");
const goalModalCancelBtn = document.getElementById("goal-modal-cancel-btn");

// ユーザー権限の状態
let currentUserRole = "general";

export async function initializeTaskSettingsView() {
    console.log("Initializing Task Settings View...");

    // ユーザー権限の取得 (Firestoreから)
    if (userId) {
        try {
            const userDoc = await getDoc(doc(db, "user_profiles", userId));
            if (userDoc.exists()) {
                currentUserRole = userDoc.data().role || "general";
            }
        } catch (error) {
            console.error("Error fetching user role:", error);
        }
    }

    renderTaskEditor();
    if(newTaskInput) newTaskInput.value = '';
}

export function setupTaskSettingsEventListeners() {
    console.log("Setting up Task Settings event listeners...");
    
    // ★修正: 要素の取得をここで行い、確実にイベントを設定する
    const viewProgressButton = document.getElementById("view-progress-from-settings-btn");
    
    viewProgressButton?.addEventListener('click', () => {
        console.log("View Progress button clicked");
        window.isProgressViewReadOnly = false;
        showView(VIEWS.PROGRESS);
    });

    addTaskButton?.addEventListener("click", handleAddTask);
    taskListEditor?.addEventListener("click", handleTaskEditorClick);
    backButton?.addEventListener("click", handleGoBack);

    helpButton?.addEventListener('click', () => showHelpModal('taskSettings'));

    newTaskInput?.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleAddTask();
        }
    });

    // モーダルのイベントリスナー
    goalModalSaveBtn?.addEventListener("click", handleSaveGoal);
    goalModalCancelBtn?.addEventListener("click", closeGoalModal);

    console.log("Task Settings event listeners set up complete.");
}

function renderTaskEditor() {
    if (!taskListEditor || !addTaskForm) {
        console.error("Task editor elements not found.");
        return;
    }

    // 権限判定: Admin認証(authLevel) または Roleが host
    const isHost = authLevel === "admin" || currentUserRole === "host";
    // 権限判定: Host または Roleが manager
    const isManager = isHost || currentUserRole === "manager";

    // 業務追加フォームの表示制御 (管理者のみ)
    if (isHost) {
        addTaskForm.style.display = "flex";
    } else {
        addTaskForm.style.display = "none";
    }

    taskListEditor.innerHTML = "";

    const sortedTasks = [...allTaskObjects].sort((a, b) => {
        if (a.name === "休憩") return 1;
        if (b.name === "休憩") return -1;
        return (a.name || "").localeCompare(b.name || "", "ja");
    });

    if (sortedTasks.length === 0) {
        taskListEditor.innerHTML = '<p class="text-gray-500 p-4">業務が登録されていません。</p>';
        return;
    }

    sortedTasks.forEach((task) => {
        const div = document.createElement("div");
        div.className = "p-4 bg-gray-100 rounded-lg shadow-sm mb-4 task-item";
        div.dataset.taskName = task.name;

        // 削除ボタン (管理者のみ)
        const deleteButtonHtml = (isHost && task.name !== "休憩")
            ? `<button class="delete-task-btn bg-red-500 text-white text-xs font-bold py-1 px-2 rounded-full hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400" data-task-name="${escapeHtml(task.name)}" title="業務「${escapeHtml(task.name)}」を削除">削除</button>`
            : "";

        // メモ入力欄
        const memoInputHtml = `
            <div class="mt-2">
                <label for="memo-${escapeHtml(task.name)}" class="block text-sm font-medium text-gray-600 mb-1">業務メモ:</label>
                <input type="text" id="memo-${escapeHtml(task.name)}" value="${escapeHtml(task.memo || "")}" placeholder="業務の補足情報 (例: 定例会議用の資料)" class="task-memo-editor w-full p-1 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500" ${task.name === "休憩" ? 'disabled' : ''}>
            </div>
        `;

        // メモ保存ボタン (休憩以外)
        const saveMemoButtonHtml = task.name !== "休憩" ? `
            <div class="text-right mt-2">
                <button class="save-task-btn bg-blue-500 text-white text-xs font-bold py-1 px-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400" data-task-name="${escapeHtml(task.name)}">メモを保存</button>
            </div>
        ` : '';

        // ★工数追加ボタン (業務管理者以上、休憩以外)
        // リスト表示は削除しました
        const addGoalButtonHtml = (task.name !== "休憩" && isManager) ? `
            <div class="mt-3 border-t pt-3">
                <button class="add-goal-btn bg-green-500 text-white text-xs font-bold py-1 px-3 rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400" data-task-name="${escapeHtml(task.name)}">この業務に工数を追加 +</button>
            </div>
        ` : (task.name === "休憩" ? '<div class="mt-3 border-t pt-3"><p class="text-xs text-gray-500">「休憩」には工数を追加できません。</p></div>' : '');

        // 担当者リストトグル
        const membersToggleHtml = `
             <div class="mt-3 border-t pt-3">
                 <button class="toggle-members-btn text-sm font-semibold text-gray-600 hover:text-blue-600 focus:outline-none" data-task-name="${escapeHtml(task.name)}">
                     担当者別 合計時間 [+]
                 </button>
                 <div class="members-list-container hidden mt-2 pl-4 border-l-2 border-gray-200 space-y-1 text-sm">
                     <p class="text-gray-400">読み込み中...</p>
                 </div>
             </div>
        `;

        div.innerHTML = `
            <div class="flex justify-between items-center">
                <span class="font-semibold text-lg text-gray-800">${escapeHtml(task.name)}</span>
                ${deleteButtonHtml}
            </div>
            ${memoInputHtml}
            ${saveMemoButtonHtml}
            ${addGoalButtonHtml}
            ${membersToggleHtml}
        `;
        taskListEditor.appendChild(div);
    });
}

async function handleTaskEditorClick(event) {
    const target = event.target;
    const taskItem = target.closest('.task-item');
    const taskName = taskItem?.dataset.taskName;

    const targetTaskName = taskName || target.dataset.taskName;
    
    if (!targetTaskName) return;

    if (target.classList.contains("delete-task-btn")) {
        handleDeleteTask(targetTaskName);
    } else if (target.classList.contains("save-task-btn")) {
        handleSaveTaskMemo(targetTaskName, taskItem);
    } else if (target.classList.contains("add-goal-btn")) {
        showGoalModal("add", targetTaskName);
    } else if (target.classList.contains("toggle-members-btn")) {
        await toggleMembersList(target, targetTaskName);
    }
}

// --- モーダル関連処理 ---

function showGoalModal(mode, taskName, goalIndex = null) {
    if (!goalModal) return;

    goalModalTaskNameInput.value = taskName;
    goalModalGoalIdInput.value = goalIndex !== null ? goalIndex : "";

    // 追加モードのみ対応（編集はリスト削除に伴い非表示）
    goalModalTitle.textContent = "工数の追加";
    goalModalForm.reset();
    goalModalTaskNameInput.value = taskName; 

    goalModal.classList.remove("hidden");
}

function closeGoalModal() {
    if (goalModal) goalModal.classList.add("hidden");
}

async function handleSaveGoal() {
    const taskName = goalModalTaskNameInput.value;
    const goalIndex = goalModalGoalIdInput.value;
    
    const title = goalTitleInput.value.trim();
    const target = parseInt(goalTargetInput.value);

    if (!title || isNaN(target)) {
        alert("タイトルと目標値は必須です。");
        return;
    }

    const newGoal = {
        title,
        target,
        deadline: goalDeadlineInput.value,
        effortDeadline: goalEffortDeadlineInput ? goalEffortDeadlineInput.value : "",
        memo: goalMemoInput.value,
        completed: false
    };

    const updatedTasks = allTaskObjects.map(task => {
        if (task.name === taskName) {
            const newGoals = [...(task.goals || [])];
            if (goalIndex !== "") {
                // 編集（呼び出し元がないため実質未使用だがロジックは維持）
                newGoals[parseInt(goalIndex)] = { ...newGoals[parseInt(goalIndex)], ...newGoal };
            } else {
                // 新規追加
                newGoals.push(newGoal);
            }
            return { ...task, goals: newGoals };
        }
        return task;
    });

    try {
        await saveAllTasksToFirestore(updatedTasks);
        updateGlobalTaskObjects(updatedTasks);
        renderTaskEditor();
        closeGoalModal();
        alert("工数を追加しました。");
    } catch (error) {
        console.error("Error saving goal:", error);
        alert("保存中にエラーが発生しました。");
    }
}

async function handleAddTask() {
    if (!newTaskInput) return;
    const newTaskName = newTaskInput.value.trim();

    if (!newTaskName) {
        alert("業務名を入力してください。");
        newTaskInput.focus();
        return;
    }
    if (newTaskName === "休憩") {
        alert("「休憩」は特別なタスク名のため追加できません。");
        newTaskInput.value = "";
        return;
    }
    if (/\s/.test(newTaskName)) {
        alert("業務名に空白は使用できません。");
        newTaskInput.focus();
        return;
    }

    if (allTaskObjects.some((t) => t.name === newTaskName)) {
        alert(`業務「${escapeHtml(newTaskName)}」は既に追加されています。`);
        newTaskInput.select();
        return;
    }

    const newTask = { name: newTaskName, memo: "", goals: [] };
    const updatedTasks = [...allTaskObjects, newTask];

    try {
        await saveAllTasksToFirestore(updatedTasks);
        console.log(`Task "${newTaskName}" added successfully.`);
        updateGlobalTaskObjects(updatedTasks);
        renderTaskEditor();
        newTaskInput.value = "";
    } catch (error) {
        console.error("Error adding task:", error);
        alert("業務の追加中にエラーが発生しました。");
    }
}

async function handleSaveTaskMemo(taskName, taskItemElement) {
    const memoInput = taskItemElement?.querySelector(".task-memo-editor");
    if (!memoInput) return;
    const newMemo = memoInput.value.trim();

    const taskIndex = allTaskObjects.findIndex((task) => task.name === taskName);
    if (taskIndex === -1) return;

    if (allTaskObjects[taskIndex].memo === newMemo) return;

    const updatedTasks = JSON.parse(JSON.stringify(allTaskObjects));
    updatedTasks[taskIndex].memo = newMemo;

    try {
        await saveAllTasksToFirestore(updatedTasks);
        console.log(`Memo saved for task "${taskName}".`);
        updateGlobalTaskObjects(updatedTasks);
        alert(`業務「${escapeHtml(taskName)}」のメモを保存しました。`);
    } catch(error) {
        console.error("Error saving task memo:", error);
        alert("メモの保存中にエラーが発生しました。");
    }
}

function handleDeleteTask(taskNameToDelete) {
    if (!taskNameToDelete || taskNameToDelete === "休憩") return;

    showConfirmationModal(
        `業務「${escapeHtml(taskNameToDelete)}」を削除しますか？\n\nこの業務に紐づく工数も全て削除されます。\n（関連する業務ログは削除されません）\n\nこの操作は元に戻せません。`,
        async () => {
            hideConfirmationModal();

            const updatedTasks = allTaskObjects.filter(
                (task) => task.name !== taskNameToDelete
            );

            try {
                await saveAllTasksToFirestore(updatedTasks);
                console.log(`Task "${taskNameToDelete}" deleted successfully.`);
                updateGlobalTaskObjects(updatedTasks);
                renderTaskEditor();
                alert(`業務「${escapeHtml(taskNameToDelete)}」を削除しました。`);
            } catch(error) {
                console.error("Error deleting task:", error);
                alert("業務の削除中にエラーが発生しました。");
            }
        },
        () => {
            console.log(`Deletion of task "${taskNameToDelete}" cancelled.`);
        }
    );
}

async function toggleMembersList(button, taskName) {
    const container = button.nextElementSibling;
    if (!container) return;

    const isHidden = container.classList.contains("hidden");

    if (isHidden) {
        button.textContent = "担当者別 合計時間 [-]";
        container.innerHTML = '<p class="text-gray-400">集計中...</p>';
        container.classList.remove("hidden");

        let logsForTask = [];
        try {
            const logsQuery = query(
                collection(db, "work_logs"),
                where("task", "==", taskName)
            );
            const logsSnapshot = await getDocs(logsQuery);
            logsForTask = logsSnapshot.docs
                .map((doc) => doc.data())
                .filter((log) => log.type !== "goal" && log.userName);
        } catch (error) {
            console.error(`Error fetching logs for task ${taskName}:`, error);
            container.innerHTML = '<p class="text-red-500">時間データの取得エラー</p>';
            return;
        }

        const memberSummary = logsForTask.reduce((acc, log) => {
            if (!acc[log.userName]) {
                acc[log.userName] = 0;
            }
            acc[log.userName] += (log.duration || 0);
            return acc;
        }, {});

        const sortedMembers = Object.entries(memberSummary)
            .filter(([, duration]) => duration > 0)
            .sort((a, b) => b[1] - a[1]);

        if (sortedMembers.length > 0) {
            container.innerHTML = sortedMembers
                .map(
                    ([name, duration]) =>
                    `<div class="flex justify-between hover:bg-gray-200 px-1 rounded"><span>${escapeHtml(name)}</span><span class="font-mono">${formatHoursMinutes(duration)}</span></div>`
                )
                .join("");
        } else {
            container.innerHTML = '<p class="text-gray-500">この業務の稼働記録はまだありません。</p>';
        }

    } else {
        button.textContent = "担当者別 合計時間 [+]";
        container.classList.add("hidden");
    }
}

async function saveAllTasksToFirestore(tasksToSave) {
    if (!tasksToSave) {
        console.error("Attempted to save undefined tasks list.");
        throw new Error("Invalid task list provided for saving.");
    }
    const tasksRef = doc(db, "settings", "tasks");
    await setDoc(tasksRef, { list: tasksToSave });
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

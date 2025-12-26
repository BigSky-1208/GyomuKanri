// js/views/taskSettings.js

import { 
    db, 
    getAllTaskObjects, 
    authLevel, 
    handleGoBack, 
    showView, 
    VIEWS, 
    userId,
    // ★追加: メインロジックから更新用関数をインポート
    updateGlobalTaskObjects, 
    refreshUIBasedOnTaskUpdate 
} from "../main.js";
import { 
    doc, 
    setDoc, 
    getDocs, 
    collection, 
    query, 
    where, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { 
    openGoalModal, 
    showConfirmationModal, 
    hideConfirmationModal, 
    showHelpModal 
} from "../components/modal/index.js";
import { formatHoursMinutes, escapeHtml } from "../utils.js";

// DOM要素
const goalModal = document.getElementById("goal-modal");
const goalModalTaskNameInput = document.getElementById("goal-modal-task-name");
const goalModalGoalIdInput = document.getElementById("goal-modal-goal-id");
const goalModalTitleInput = document.getElementById("goal-modal-title-input");
const goalModalTargetInput = document.getElementById("goal-modal-target-input");
const goalModalDeadlineInput = document.getElementById("goal-modal-deadline-input");
const goalModalEffortDeadlineInput = document.getElementById("goal-modal-effort-deadline-input");
const goalModalMemoInput = document.getElementById("goal-modal-memo-input");
const goalModalSaveBtn = document.getElementById("goal-modal-save-btn");
const goalModalCancelBtn = document.getElementById("goal-modal-cancel-btn");

let currentUserRole = "general";

/**
 * 画面の初期化
 */
export async function initializeTaskSettingsView() {
    console.log("Initializing Task Settings View...");
    
    if (userId) {
        try {
            const userDoc = await getDoc(doc(db, "user_profiles", userId));
            if (userDoc.exists()) currentUserRole = userDoc.data().role || "general";
        } catch (error) {
            console.error("Error fetching user role:", error);
        }
    }

    renderTaskEditor();
    
    const input = document.getElementById("new-task-input");
    if(input) input.value = '';

    // リロード後の復元処理（手動リロード時のために残しておく）
    const highlightTaskName = sessionStorage.getItem("highlightTaskName");
    if (highlightTaskName) {
        sessionStorage.removeItem("highlightTaskName");
        
        const actionMessage = sessionStorage.getItem("actionMessage");
        if (actionMessage) {
            alert(actionMessage);
            sessionStorage.removeItem("actionMessage");
        }
        
        restoreSelectionStateWithRetry(highlightTaskName);
    }
}

/**
 * イベントリスナー設定
 */
export function setupTaskSettingsEventListeners() {
    const viewProgressButton = document.getElementById("view-progress-from-settings-btn");
    viewProgressButton?.addEventListener('click', () => {
        window.isProgressViewReadOnly = false;
        showView(VIEWS.PROGRESS);
    });

    const addTaskButton = document.getElementById("add-task-btn");
    addTaskButton?.addEventListener("click", handleAddTask);

    const listEditor = document.getElementById("task-list-editor");
    listEditor?.addEventListener("click", handleTaskEditorClick);

    const backBtn = document.getElementById("back-to-selection-from-settings");
    backBtn?.addEventListener("click", handleGoBack);

    const helpBtn = document.querySelector('#task-settings-view .help-btn');
    helpBtn?.addEventListener('click', () => showHelpModal('taskSettings'));

    const newTaskIn = document.getElementById("new-task-input");
    newTaskIn?.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') handleAddTask();
    });

    goalModalSaveBtn?.addEventListener("click", handleSaveGoal);
    goalModalCancelBtn?.addEventListener("click", closeGoalModal);
}

/**
 * 業務リストの描画
 */
export function renderTaskEditor() {
    const taskListEditor = document.getElementById("task-list-editor");
    const addTaskForm = document.getElementById("add-task-form");

    if (!taskListEditor || !addTaskForm) return;

    // 常に最新データを取得
    const currentTasks = getAllTaskObjects();

    const isHost = authLevel === "admin" || currentUserRole === "host";
    const isManager = isHost || currentUserRole === "manager";

    addTaskForm.style.display = isHost ? "flex" : "none";
    taskListEditor.innerHTML = "";

    const sortedTasks = [...currentTasks].sort((a, b) => {
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
        div.className = "p-4 bg-gray-100 rounded-lg shadow-sm mb-4 task-item transition-all duration-1000"; 
        div.dataset.taskName = task.name;
        // 復元用のID付与
        div.id = `task-row-${task.name}`;

        const deleteButtonHtml = (isHost && task.name !== "休憩")
            ? `<button class="delete-task-btn bg-red-500 text-white text-xs font-bold py-1 px-2 rounded-full hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400" data-task-name="${escapeHtml(task.name)}">削除</button>`
            : "";

        const addGoalButtonHtml = (task.name !== "休憩" && isManager) ? `
            <div class="mt-3 border-t pt-3">
                <button class="add-goal-btn bg-green-500 text-white text-xs font-bold py-1 px-3 rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400" data-task-name="${escapeHtml(task.name)}">この業務に工数を追加 +</button>
            </div>
        ` : (task.name === "休憩" ? '<div class="mt-3 border-t pt-3"><p class="text-xs text-gray-500">「休憩」には工数を追加できません。</p></div>' : '');

        const membersToggleHtml = `
             <div class="mt-3 border-t pt-3">
                 <button class="toggle-members-btn text-sm font-semibold text-gray-600 hover:text-blue-600 focus:outline-none" data-task-name="${escapeHtml(task.name)}">
                     担当者別 合計時間 [+]
                 </button>
                 <div class="members-list-container hidden mt-2 pl-4 border-l-2 border-gray-200 space-y-1 text-sm"></div>
             </div>
        `;

        // ★修正: ここにあった goalsListHtml の生成処理を削除しました

        div.innerHTML = `
            <div class="flex justify-between items-center">
                <span class="font-semibold text-lg text-gray-800">${escapeHtml(task.name)}</span>
                ${deleteButtonHtml}
            </div>
            <div class="mt-2">
                <label class="block text-sm font-medium text-gray-600 mb-1">業務メモ:</label>
                <input type="text" value="${escapeHtml(task.memo || "")}" class="task-memo-editor w-full p-1 border border-gray-300 rounded-md text-sm focus:ring-indigo-500" ${task.name === "休憩" ? 'disabled' : ''}>
            </div>
            <div class="text-right mt-2">
                ${task.name !== "休憩" ? `<button class="save-task-btn bg-blue-500 text-white text-xs font-bold py-1 px-2 rounded hover:bg-blue-600" data-task-name="${escapeHtml(task.name)}">メモを保存</button>` : ''}
            </div>
            
            ${addGoalButtonHtml}
            ${membersToggleHtml}
        `;
        taskListEditor.appendChild(div);
    });
}

/**
 * 要素が見つかるまで待機して選択状態を復元する（リトライ機能付き）
 */
function restoreSelectionStateWithRetry(taskName, retryCount = 0) {
    if (!taskName) return;

    // IDで要素を探す
    const element = document.getElementById(`task-row-${taskName}`);

    if (element) {
        // スクロール
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        
        // ハイライト
        element.classList.remove("bg-gray-100");
        element.classList.add("bg-yellow-100", "ring-4", "ring-yellow-400");
        
        setTimeout(() => {
            element.classList.remove("bg-yellow-100", "ring-4", "ring-yellow-400");
            element.classList.add("bg-gray-100");
        }, 2000);

    } else {
        // 見つからない場合：まだ描画されていない可能性があるためリトライ
        if (retryCount < 20) { // 最大2秒待つ (100ms * 20回)
            setTimeout(() => {
                restoreSelectionStateWithRetry(taskName, retryCount + 1);
            }, 100);
        } else {
            console.log(`復元失敗: ${taskName} が見つかりませんでした。`);
        }
    }
}

// --- アクションハンドラ ---
async function handleTaskEditorClick(event) {
    const target = event.target;
    const taskItem = target.closest('.task-item');
    const taskName = taskItem?.dataset.taskName || target.dataset.taskName;
    if (!taskName) return;

    if (target.classList.contains("delete-task-btn")) {
        handleDeleteTask(taskName);
    } else if (target.classList.contains("save-task-btn")) {
        handleSaveTaskMemo(taskName, taskItem);
    } else if (target.classList.contains("add-goal-btn")) {
        const goalId = target.dataset.goalId;
        openGoalModal(goalId ? "edit" : "add", taskName, goalId);
    } else if (target.classList.contains("toggle-members-btn")) {
        await toggleMembersList(target, taskName);
    }
}

async function handleSaveGoal() {
    const taskName = goalModalTaskNameInput.value;
    const goalId = goalModalGoalIdInput.value;
    const title = goalModalTitleInput.value.trim();
    const target = parseInt(goalModalTargetInput.value, 10);

    if (!title || isNaN(target) || target < 0) {
        alert("有効なタイトルと目標件数を入力してください。");
        return;
    }

    const currentTasks = getAllTaskObjects();
    const taskIndex = currentTasks.findIndex((t) => t.name === taskName);
    if (taskIndex === -1) return;

    const updatedTasks = JSON.parse(JSON.stringify(currentTasks));
    const task = updatedTasks[taskIndex];

    if (goalId) {
        const goalIndex = task.goals.findIndex((g) => g.id === goalId || g.title === goalId);
        if (goalIndex !== -1) {
            task.goals[goalIndex] = {
                ...task.goals[goalIndex],
                title, target,
                deadline: goalModalDeadlineInput.value,
                effortDeadline: goalModalEffortDeadlineInput.value,
                memo: goalModalMemoInput.value.trim(),
            };
        }
    } else {
        const newGoal = {
            id: "goal_" + Date.now(),
            title, target,
            deadline: goalModalDeadlineInput.value,
            effortDeadline: goalModalEffortDeadlineInput.value,
            memo: goalModalMemoInput.value.trim(),
            current: 0, isComplete: false,
        };
        if (!task.goals) task.goals = [];
        task.goals.push(newGoal);
    }

    try {
        await saveAllTasksToFirestore(updatedTasks);
        
        // ★修正: リロードせずにメモリと画面を更新
        updateGlobalTaskObjects(updatedTasks);
        closeGoalModal();
        await refreshUIBasedOnTaskUpdate();
        
        // ハイライト復元と完了メッセージ
        restoreSelectionStateWithRetry(taskName);
        alert("工数を保存しました。");

    } catch (error) {
        console.error("Error saving goal:", error);
        alert("保存中にエラーが発生しました。");
    }
}

async function handleAddTask() {
    const newTaskIn = document.getElementById("new-task-input");
    if (!newTaskIn) return;
    const newTaskName = newTaskIn.value.trim();
    
    if (!newTaskName || newTaskName === "休憩" || /\s/.test(newTaskName)) {
        alert("有効な業務名を入力してください。");
        return;
    }

    const currentTasks = getAllTaskObjects();
    if (currentTasks.some((t) => t.name === newTaskName)) {
        alert("既に存在する業務名です。");
        return;
    }

    const updatedTasks = [...currentTasks, { name: newTaskName, memo: "", goals: [] }];
    try {
        await saveAllTasksToFirestore(updatedTasks);

        // ★修正: リロードせずに更新
        updateGlobalTaskObjects(updatedTasks);
        await refreshUIBasedOnTaskUpdate();
        
        newTaskIn.value = "";
        restoreSelectionStateWithRetry(newTaskName);
        alert(`業務「${newTaskName}」を追加しました。`);

    } catch (error) { console.error(error); }
}

async function handleSaveTaskMemo(taskName, taskItemElement) {
    const memoInput = taskItemElement?.querySelector(".task-memo-editor");
    const newMemo = memoInput.value.trim();
    
    const currentTasks = getAllTaskObjects();
    const taskIndex = currentTasks.findIndex((t) => t.name === taskName);
    if (taskIndex === -1) return;
    if (currentTasks[taskIndex].memo === newMemo) return;

    const updatedTasks = JSON.parse(JSON.stringify(currentTasks));
    updatedTasks[taskIndex].memo = newMemo;

    try {
        await saveAllTasksToFirestore(updatedTasks);
        
        // ★修正: リロードせずに更新
        updateGlobalTaskObjects(updatedTasks);
        await refreshUIBasedOnTaskUpdate();
        
        restoreSelectionStateWithRetry(taskName);
        alert("メモを保存しました。");

    } catch(error) { console.error(error); }
}

function handleDeleteTask(taskNameToDelete) {
    if (!taskNameToDelete || taskNameToDelete === "休憩") return;

    showConfirmationModal(
        `業務「${escapeHtml(taskNameToDelete)}」を削除しますか？\n\nこの業務に紐づく工数も全て削除されます。\n（関連する業務ログは削除されません）\n\nこの操作は元に戻せません。`,
        async () => {
            hideConfirmationModal();
            const currentTasks = getAllTaskObjects();
            const updatedTasks = currentTasks.filter(t => t.name !== taskNameToDelete);

            try {
                await saveAllTasksToFirestore(updatedTasks);
                
                // ★修正: リロードせずに更新
                updateGlobalTaskObjects(updatedTasks);
                await refreshUIBasedOnTaskUpdate();
                
                alert(`業務「${escapeHtml(taskNameToDelete)}」を削除しました。`);

            } catch(error) { 
                console.error(error);
                alert("削除中にエラーが発生しました。");
            }
        },
        () => { console.log("Deletion cancelled."); }
    );
}

// 集計処理
async function toggleMembersList(button, taskName) {
    const container = button.nextElementSibling;
    if (!container) return;
    const isHidden = container.classList.contains("hidden");

    if (isHidden) {
        button.textContent = "担当者別 合計時間 [-]";
        container.innerHTML = '<p class="text-gray-400">集計中...</p>';
        container.classList.remove("hidden");
        try {
            const q = query(collection(db, "work_logs"), where("task", "==", taskName));
            const snapshot = await getDocs(q);
            const memberSummary = snapshot.docs
                .map(doc => doc.data())
                .filter(log => log.type !== "goal" && log.userName)
                .reduce((acc, log) => {
                    acc[log.userName] = (acc[log.userName] || 0) + (log.duration || 0);
                    return acc;
                }, {});

            const sorted = Object.entries(memberSummary)
                .filter(([, duration]) => duration > 0)
                .sort((a, b) => b[1] - a[1]);

            container.innerHTML = sorted.length > 0 
                ? sorted.map(([name, d]) => `<div class="flex justify-between"><span>${escapeHtml(name)}</span><span class="font-mono">${formatHoursMinutes(d)}</span></div>`).join("")
                : '<p class="text-gray-500">稼働記録はありません。</p>';
        } catch (error) {
            container.innerHTML = '<p class="text-red-500">取得エラー</p>';
        }
    } else {
        button.textContent = "担当者別 合計時間 [+]";
        container.classList.add("hidden");
    }
}

async function saveAllTasksToFirestore(tasksToSave) {
    if (!tasksToSave) throw new Error("Invalid task list");
    const tasksRef = doc(db, "settings", "tasks");
    await setDoc(tasksRef, { list: tasksToSave });
}

function closeGoalModal() {
    if (goalModal) goalModal.classList.add("hidden");
}

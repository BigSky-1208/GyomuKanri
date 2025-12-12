// js/views/taskSettings.js

import { db, allTaskObjects, userId } from "../main.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// DOM要素
const taskListEditor = document.getElementById("task-list-editor");
const addTaskBtn = document.getElementById("add-task-btn");
const newTaskInput = document.getElementById("new-task-input");
const addTaskForm = document.getElementById("add-task-form"); // HTML側でこのIDのdivがある前提

// モーダル要素 (index.htmlの定義に基づく)
const goalModal = document.getElementById("goal-modal");
const goalModalTitle = document.getElementById("goal-modal-title");
const goalModalForm = document.getElementById("goal-modal-form");
const goalModalTaskNameInput = document.getElementById("goal-modal-task-name"); // hidden
const goalModalGoalIdInput = document.getElementById("goal-modal-goal-id"); // hidden
const goalTitleInput = document.getElementById("goal-modal-title-input");
const goalTargetInput = document.getElementById("goal-modal-target-input");
const goalDeadlineInput = document.getElementById("goal-modal-deadline-input");
const goalEffortDeadlineInput = document.getElementById("goal-modal-effort-deadline-input"); // 追加
const goalMemoInput = document.getElementById("goal-modal-memo-input");
const goalModalSaveBtn = document.getElementById("goal-modal-save-btn");
const goalModalCancelBtn = document.getElementById("goal-modal-cancel-btn");

// 状態変数
let currentUserRole = "general"; // デフォルトは一般権限

/**
 * 初期化関数
 */
export async function initializeTaskSettingsView() {
    console.log("Initializing Task Settings View...");
    
    // ユーザー権限の取得
    if (userId) {
        try {
            const userDoc = await getDoc(doc(db, "user_profiles", userId));
            if (userDoc.exists()) {
                currentUserRole = userDoc.data().role || "general";
                console.log("User Role:", currentUserRole);
            }
        } catch (error) {
            console.error("Error fetching user role:", error);
        }
    }

    renderTaskEditor();
}

/**
 * イベントリスナー設定
 */
export function setupTaskSettingsEventListeners() {
    console.log("Setting up Task Settings event listeners...");

    // タスク追加（管理者のみ）
    addTaskBtn?.addEventListener("click", handleAddTask);

    // モーダルのボタン
    goalModalSaveBtn?.addEventListener("click", handleSaveGoal);
    goalModalCancelBtn?.addEventListener("click", closeGoalModal);
}

/**
 * タスクエディタの描画
 * 権限に応じてボタンの出し分けを行う
 */
export function renderTaskEditor() {
    if (!taskListEditor) return;

    taskListEditor.innerHTML = "";

    // 権限判定
    const isHost = currentUserRole === "host";
    const isManager = currentUserRole === "manager" || isHost; // hostはmanagerの権限も含む

    // タスク追加フォームの表示制御 (Hostのみ)
    if (addTaskForm) {
        addTaskForm.style.display = isHost ? "flex" : "none";
    }

    if (!allTaskObjects || allTaskObjects.length === 0) {
        taskListEditor.innerHTML = '<p class="text-gray-500">業務が設定されていません。</p>';
        return;
    }

    // タスクリストの描画
    allTaskObjects.forEach((task) => {
        const taskItem = document.createElement("div");
        taskItem.className = "border rounded-lg p-4 bg-gray-50";

        // ヘッダー部分（タスク名 + 削除ボタン）
        const headerDiv = document.createElement("div");
        headerDiv.className = "flex justify-between items-center mb-3";

        const title = document.createElement("h3");
        title.className = "font-bold text-lg text-gray-700";
        title.textContent = task.name;
        headerDiv.appendChild(title);

        // タスク削除ボタン (Hostのみ)
        if (isHost) {
            const deleteBtn = document.createElement("button");
            deleteBtn.className = "text-red-500 hover:text-red-700 text-sm font-medium border border-red-200 bg-white px-3 py-1 rounded";
            deleteBtn.textContent = "業務を削除";
            deleteBtn.onclick = () => handleDeleteTask(task.name);
            headerDiv.appendChild(deleteBtn);
        }

        taskItem.appendChild(headerDiv);

        // 工数リストコンテナ
        const goalsContainer = document.createElement("div");
        goalsContainer.className = "space-y-2 pl-4 border-l-2 border-gray-200";

        // 工数リストの描画
        if (task.goals && task.goals.length > 0) {
            task.goals.forEach((goal, index) => {
                const goalItem = document.createElement("div");
                goalItem.className = "flex justify-between items-center bg-white p-2 rounded border border-gray-100 shadow-sm";
                
                const goalInfo = document.createElement("div");
                goalInfo.innerHTML = `<span class="font-medium text-gray-700">${goal.title}</span> <span class="text-sm text-gray-500">(目標: ${goal.target})</span>`;
                
                goalItem.appendChild(goalInfo);

                // 工数操作ボタン (Manager以上)
                if (isManager) {
                    const btnGroup = document.createElement("div");
                    btnGroup.className = "flex gap-2";

                    const editBtn = document.createElement("button");
                    editBtn.textContent = "編集";
                    editBtn.className = "text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200";
                    editBtn.onclick = () => openGoalModal(task.name, goal, index);

                    const delBtn = document.createElement("button");
                    delBtn.textContent = "削除";
                    delBtn.className = "text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200";
                    delBtn.onclick = () => handleDeleteGoal(task.name, index);

                    btnGroup.appendChild(editBtn);
                    btnGroup.appendChild(delBtn);
                    goalItem.appendChild(btnGroup);
                }

                goalsContainer.appendChild(goalItem);
            });
        } else {
            const noGoals = document.createElement("p");
            noGoals.className = "text-sm text-gray-400 italic";
            noGoals.textContent = "工数が設定されていません";
            goalsContainer.appendChild(noGoals);
        }

        // 工数追加ボタン (Manager以上)
        if (isManager) {
            const addGoalBtn = document.createElement("button");
            addGoalBtn.className = "mt-3 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1";
            addGoalBtn.innerHTML = '<span>+ 工数を追加</span>';
            addGoalBtn.onclick = () => openGoalModal(task.name);
            goalsContainer.appendChild(addGoalBtn);
        }

        taskItem.appendChild(goalsContainer);
        taskListEditor.appendChild(taskItem);
    });
}

// --- イベントハンドラ ---

/**
 * 業務（タスク）の追加処理
 */
async function handleAddTask() {
    const taskName = newTaskInput.value.trim();
    if (!taskName) return;

    // 重複チェック
    if (allTaskObjects.some(t => t.name === taskName)) {
        alert("その業務名は既に存在します。");
        return;
    }

    const newTask = {
        name: taskName,
        memo: "",
        goals: []
    };

    const updatedTasks = [...allTaskObjects, newTask];
    await saveTasks(updatedTasks);
    newTaskInput.value = "";
}

/**
 * 業務（タスク）の削除処理
 */
async function handleDeleteTask(taskName) {
    if (!confirm(`業務「${taskName}」を削除してもよろしいですか？\n登録済みの工数設定もすべて削除されます。`)) {
        return;
    }

    const updatedTasks = allTaskObjects.filter(t => t.name !== taskName);
    await saveTasks(updatedTasks);
}

/**
 * 工数（Goal）の削除処理
 */
async function handleDeleteGoal(taskName, goalIndex) {
    if (!confirm("この工数設定を削除しますか？")) return;

    const updatedTasks = allTaskObjects.map(task => {
        if (task.name === taskName) {
            const newGoals = [...task.goals];
            newGoals.splice(goalIndex, 1);
            return { ...task, goals: newGoals };
        }
        return task;
    });

    await saveTasks(updatedTasks);
}

// --- モーダル関連処理 ---

function openGoalModal(taskName, goalData = null, goalIndex = null) {
    goalModalTaskNameInput.value = taskName;
    goalModalGoalIdInput.value = goalIndex !== null ? goalIndex : ""; // 新規なら空

    if (goalData) {
        goalModalTitle.textContent = "工数の編集";
        goalTitleInput.value = goalData.title || "";
        goalTargetInput.value = goalData.target || "";
        goalDeadlineInput.value = goalData.deadline || "";
        if(goalEffortDeadlineInput) goalEffortDeadlineInput.value = goalData.effortDeadline || "";
        goalMemoInput.value = goalData.memo || "";
    } else {
        goalModalTitle.textContent = "工数の追加";
        goalModalForm.reset();
        goalModalTaskNameInput.value = taskName; // resetで消えるので再セット
    }

    goalModal.classList.remove("hidden");
}

function closeGoalModal() {
    goalModal.classList.add("hidden");
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
                // 編集
                newGoals[parseInt(goalIndex)] = { ...newGoals[parseInt(goalIndex)], ...newGoal };
            } else {
                // 新規追加
                newGoals.push(newGoal);
            }
            return { ...task, goals: newGoals };
        }
        return task;
    });

    await saveTasks(updatedTasks);
    closeGoalModal();
}

/**
 * Firestoreへの保存処理（共通）
 */
async function saveTasks(newTasks) {
    try {
        await setDoc(doc(db, "settings", "tasks"), { list: newTasks });
        // allTaskObjectsは main.js の onSnapshot で自動更新されるため
        // ここで手動更新する必要はないが、即時反映感を出すなら描画だけ呼んでも良い
        console.log("Tasks saved successfully.");
    } catch (error) {
        console.error("Error saving tasks:", error);
        alert("保存に失敗しました。");
    }
}

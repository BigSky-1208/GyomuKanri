// js/views/taskSettings.js
import { db, allTaskObjects, authLevel, updateGlobalTaskObjects, handleGoBack, showView, VIEWS } from "../../main.js"; 
import { doc, setDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmationModal, hideConfirmationModal, openGoalModal, showHelpModal } from "../../components/modal.js"; 
import { formatHoursMinutes } from "../utils.js"; 

const taskListEditor = document.getElementById("task-list-editor");
const addTaskForm = document.getElementById("add-task-form");
const newTaskInput = document.getElementById("new-task-input");
const addTaskButton = document.getElementById("add-task-btn");
const backButton = document.getElementById("back-to-selection-from-settings");
const viewProgressButton = document.getElementById("view-progress-from-settings-btn");
const helpButton = document.querySelector('#task-settings-view .help-btn');

export function initializeTaskSettingsView() {
    console.log("Initializing Task Settings View...");
    renderTaskEditor(); 
    if(newTaskInput) newTaskInput.value = ''; 
}

export function setupTaskSettingsEventListeners() {
    console.log("Setting up Task Settings event listeners...");
    addTaskButton?.addEventListener("click", handleAddTask);
    taskListEditor?.addEventListener("click", handleTaskEditorClick);
    backButton?.addEventListener("click", handleGoBack); 

    viewProgressButton?.addEventListener('click', () => {
         window.isProgressViewReadOnly = false; 
         showView(VIEWS.PROGRESS);
    });

     helpButton?.addEventListener('click', () => showHelpModal('taskSettings'));

     newTaskInput?.addEventListener('keypress', (event) => {
         if (event.key === 'Enter') {
             handleAddTask();
         }
     });

    console.log("Task Settings event listeners set up complete.");
}

function renderTaskEditor() {
    if (!taskListEditor || !addTaskForm) {
        console.error("Task editor elements not found.");
        return;
    }

    if (authLevel === "admin") {
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

        const deleteButtonHtml = (authLevel === "admin" && task.name !== "休憩")
            ? `<button class="delete-task-btn bg-red-500 text-white text-xs font-bold py-1 px-2 rounded-full hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400" data-task-name="${escapeHtml(task.name)}" title="業務「${escapeHtml(task.name)}」を削除">削除</button>`
            : "";

        const memoInputHtml = `
            <div class="mt-2">
                <label for="memo-${escapeHtml(task.name)}" class="block text-sm font-medium text-gray-600 mb-1">業務メモ:</label>
                <input type="text" id="memo-${escapeHtml(task.name)}" value="${escapeHtml(task.memo || "")}" placeholder="業務の補足情報 (例: 定例会議用の資料)" class="task-memo-editor w-full p-1 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500" ${task.name === "休憩" ? 'disabled' : ''}>
            </div>
        `;

        const saveMemoButtonHtml = task.name !== "休憩" ? `
            <div class="text-right mt-2">
                <button class="save-task-btn bg-blue-500 text-white text-xs font-bold py-1 px-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400" data-task-name="${escapeHtml(task.name)}">メモを保存</button>
            </div>
        ` : '';

        const addGoalButtonHtml = task.name !== "休憩" ? `
            <div class="mt-3 border-t pt-3">
                <button class="add-goal-btn bg-green-500 text-white text-xs font-bold py-1 px-3 rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400" data-task-name="${escapeHtml(task.name)}">この業務に工数を追加 +</button>
            </div>
        ` : '<div class="mt-3 border-t pt-3"><p class="text-xs text-gray-500">「休憩」には工数を追加できません。</p></div>';

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

    if (!taskName) return; 

    if (target.classList.contains("delete-task-btn") && authLevel === "admin") {
        handleDeleteTask(taskName);
    } else if (target.classList.contains("save-task-btn")) {
        handleSaveTaskMemo(taskName, taskItem); 
    } else if (target.classList.contains("add-goal-btn")) {
        openGoalModal("add", taskName); 
    } else if (target.classList.contains("toggle-members-btn")) {
        await toggleMembersList(target, taskName); 
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
        newTaskInput.value = ""; 
    } catch (error) {
         console.error("Error adding task:", error);
         alert("業務の追加中にエラーが発生しました。");
    }

}

async function handleSaveTaskMemo(taskName, taskItemElement) {
    const memoInput = taskItemElement?.querySelector(".task-memo-editor");
    if (!memoInput) {
         console.error("Memo input not found for task:", taskName);
         return;
    }
    const newMemo = memoInput.value.trim();

    const taskIndex = allTaskObjects.findIndex((task) => task.name === taskName);
    if (taskIndex === -1) {
         console.error("Task not found for saving memo:", taskName);
         return;
    }

     if (allTaskObjects[taskIndex].memo === newMemo) {
         console.log("Memo unchanged for task:", taskName);
         return;
     }


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

// ★ 修正: このタスクのログだけをフェッチするように変更
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
                 // インデックスがあれば日付で絞り込みも可能
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

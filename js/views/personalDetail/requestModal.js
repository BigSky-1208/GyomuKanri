// js/views/personalDetail/requestModal.js
import { db, userId, userName, allTaskObjects } from "../../main.js";
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { escapeHtml } from "../../utils.js";

// DOM要素の生成
function createRequestModalHTML() {
    if (document.getElementById("request-modal")) return;

    const modalHtml = `
    <div id="request-modal" class="modal hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div class="mt-3">
                <h3 class="text-lg leading-6 font-medium text-gray-900" id="request-modal-title">申請</h3>
                <div class="mt-2 px-1 space-y-3">
                    <input type="hidden" id="req-type">
                    <input type="hidden" id="req-target-log-id">
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700">日付</label>
                        <input type="date" id="req-date" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-100" readonly>
                    </div>

                    <div id="req-time-container" class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">開始時間</label>
                            <input type="time" id="req-start-time" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">終了時間</label>
                            <input type="time" id="req-end-time" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700">業務（タスク）</label>
                        <select id="req-task" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm"></select>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700">工数（目標）※件数を入れる場合は必須</label>
                        <select id="req-goal" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                            <option value="">(選択なし)</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700">件数 ※任意</label>
                        <input type="number" id="req-count" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" min="0">
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700">メモ</label>
                        <textarea id="req-memo" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" rows="3"></textarea>
                    </div>
                    
                    <p id="req-error" class="text-red-500 text-sm mt-2"></p>
                </div>
                <div class="items-center px-4 py-3">
                    <button id="req-send-btn" class="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300">
                        申請を送る
                    </button>
                    <button id="req-cancel-btn" class="mt-3 px-4 py-2 bg-gray-300 text-gray-700 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300">
                        キャンセル
                    </button>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    document.getElementById("req-cancel-btn").addEventListener("click", closeRequestModal);
    document.getElementById("req-send-btn").addEventListener("click", submitRequest);
    document.getElementById("req-task").addEventListener("change", () => updateGoalOptions());
}

function updateTaskOptions(selectedTaskName = null) {
    const taskSelect = document.getElementById("req-task");
    taskSelect.innerHTML = '<option value="">業務を選択</option>';
    allTaskObjects.forEach(task => {
        const option = document.createElement("option");
        option.value = task.name;
        option.textContent = task.name;
        taskSelect.appendChild(option);
    });
    if (selectedTaskName) taskSelect.value = selectedTaskName;
    updateGoalOptions();
}

function updateGoalOptions() {
    const taskSelect = document.getElementById("req-task");
    const goalSelect = document.getElementById("req-goal");
    const selectedTask = allTaskObjects.find(t => t.name === taskSelect.value);
    
    // 現在選択されているGoalを保持（あれば）
    const currentGoal = goalSelect.value;
    
    goalSelect.innerHTML = '<option value="">(選択なし)</option>';
    
    if (selectedTask && selectedTask.goals) {
        selectedTask.goals.forEach(goal => {
            const option = document.createElement("option");
            option.value = goal.id; 
            option.dataset.title = goal.title;
            option.textContent = goal.title;
            goalSelect.appendChild(option);
        });
    }
    
    // もしタスクが変わっていなくて、元のゴールがまだリストにあれば再選択
    if (currentGoal) {
        // 同じ値を持つoptionがあるか確認
        if(goalSelect.querySelector(`option[value="${currentGoal}"]`)){
            goalSelect.value = currentGoal;
        }
    }
}

export function openAddRequestModal(dateStr) {
    createRequestModalHTML();
    const modal = document.getElementById("request-modal");
    
    document.getElementById("req-type").value = "add";
    document.getElementById("request-modal-title").textContent = "業務追加申請";
    document.getElementById("req-date").value = dateStr;
    document.getElementById("req-time-container").style.display = "grid";
    document.getElementById("req-start-time").value = "";
    document.getElementById("req-end-time").value = "";
    document.getElementById("req-count").value = "";
    document.getElementById("req-memo").value = "";
    document.getElementById("req-error").textContent = "";

    updateTaskOptions();
    modal.classList.remove("hidden");
}

export function openUpdateRequestModal(log) {
    createRequestModalHTML();
    const modal = document.getElementById("request-modal");

    document.getElementById("req-type").value = "update";
    document.getElementById("request-modal-title").textContent = "業務変更申請";
    document.getElementById("req-target-log-id").value = log.id;
    document.getElementById("req-date").value = log.date;
    
    document.getElementById("req-time-container").style.display = "none";

    document.getElementById("req-count").value = log.contribution || "";
    document.getElementById("req-memo").value = log.memo || "";
    document.getElementById("req-error").textContent = "";

    updateTaskOptions(log.task);
    
    // updateTaskOptionsの中でupdateGoalOptionsが呼ばれるが、
    // タイミング的にここで明示的にゴールIDをセットする
    const goalSelect = document.getElementById("req-goal");
    if (log.goalId) {
        // 既にoptionが生成されているはず
        goalSelect.value = log.goalId;
    }

    modal.classList.remove("hidden");
}

function closeRequestModal() {
    const modal = document.getElementById("request-modal");
    if (modal) modal.classList.add("hidden");
}

async function submitRequest() {
    const type = document.getElementById("req-type").value;
    const date = document.getElementById("req-date").value;
    const task = document.getElementById("req-task").value;
    const goalSelect = document.getElementById("req-goal");
    const goalId = goalSelect.value || null;
    const goalTitle = goalSelect.options[goalSelect.selectedIndex]?.text || null;
    const count = parseInt(document.getElementById("req-count").value) || 0;
    const memo = document.getElementById("req-memo").value;
    const errorEl = document.getElementById("req-error");

    if (!task) {
        errorEl.textContent = "業務を選択してください。";
        return;
    }

    // ★追加: 件数と工数のリンク強制バリデーション
    if (count > 0 && !goalId) {
        errorEl.textContent = "件数を入力する場合は、必ず対象の工数（目標）を選択してください。";
        return;
    }

    let requestData = {
        type,
        status: "pending",
        userId,
        userName,
        requestDate: date,
        createdAt: Timestamp.now(),
        data: {
            task,
            goalId,
            goalTitle: goalId ? goalTitle : null,
            count,
            memo
        }
    };

    if (type === "add") {
        const startTime = document.getElementById("req-start-time").value;
        const endTime = document.getElementById("req-end-time").value;
        
        if (!startTime || !endTime) {
            errorEl.textContent = "開始・終了時間を入力してください。";
            return;
        }
        requestData.data.startTime = startTime;
        requestData.data.endTime = endTime;
    } else {
        requestData.targetLogId = document.getElementById("req-target-log-id").value;
    }

    try {
        await addDoc(collection(db, "work_log_requests"), requestData);
        alert("申請を送信しました。管理者の承認をお待ちください。");
        closeRequestModal();
    } catch (e) {
        console.error("Error submitting request:", e);
        errorEl.textContent = "送信中にエラーが発生しました。";
    }
}

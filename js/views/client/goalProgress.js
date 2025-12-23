// js/views/client/goalProgress.js - 目標進捗管理 (Client View)

// ★修正: escapeHtml を追加インポート
import { db, userId, userName, allTaskObjects, escapeHtml } from "../../main.js"; 
import { addDoc, collection, doc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; 
import { getJSTDateString } from "../../utils.js"; 
import { setHasContributed } from "./timer.js";

// --- 進捗更新処理 ---
// js/views/progress/goalProgress.js など

export async function handleUpdateGoalProgress(taskName, goalId, inputElement) {
    // 【修正点1】引数の goalId が空の場合、モーダルのデータから取得を試みる
    const finalGoalId = goalId || document.getElementById("goal-modal")?.dataset.currentGoalId;

    const contribution = parseInt(inputElement.value, 10);

    // 【修正点2】バリデーションを強化（goalIdが無いとFirebaseが死ぬため）
    if (!finalGoalId) {
        console.error("goalId is missing!");
        alert("エラー：工数IDが取得できません。もう一度開き直してください。");
        return;
    }

    if (isNaN(contribution) || contribution <= 0) {
        alert("正の数値を入力してください。");
        return;
    }

    // --- ここから先のロジックは維持 ---
    const taskIndex = allTaskObjects.findIndex((t) => t.name === taskName);
    if (taskIndex === -1) return;

    const goalIndex = allTaskObjects[taskIndex].goals.findIndex(
        (g) => g.id === finalGoalId // finalGoalId を使用
    );
    if (goalIndex === -1) return;

    const updatedTasks = JSON.parse(JSON.stringify(allTaskObjects));
    const task = updatedTasks[taskIndex];
    const goal = task.goals[goalIndex];
    const currentProgress = goal.current || 0;
    
    goal.current = currentProgress + contribution;

    try {
        const tasksRef = doc(db, "settings", "tasks");
        await setDoc(tasksRef, { list: updatedTasks }); 

        await addDoc(collection(db, `work_logs`), {
            type: "goal",
            userId,
            userName,
            task: taskName,
            goalId: finalGoalId, // undefined を回避
            goalTitle: goal.title,
            contribution: contribution,
            date: getJSTDateString(new Date()),
            startTime: Timestamp.fromDate(new Date()),
        });

        // 成功時の処理
        if (typeof setHasContributed === 'function') setHasContributed(true);
        inputElement.value = "";
        
        // モーダルを閉じる場合はここに追加
        // closeModal(document.getElementById("goal-modal"));

    } catch (error) {
        console.error("Error updating goal progress:", error);
        alert("進捗の更新中にエラーが発生しました。");
    }
}
// --- ★追加: 単一の工数進捗を表示する関数 ---
export function renderSingleGoalDisplay(task, goalId) {
    const container = document.getElementById("goal-progress-container");
    if (!container) return;

    // goalId で検索。見つからなければタイトルで検索（互換性のため）
    const goal = task.goals.find(g => g.id === goalId) || task.goals.find(g => g.title === goalId);
    
    if (!goal) {
        container.innerHTML = "";
        container.classList.add("hidden");
        return;
    }

    const current = goal.current || 0;
    const target = goal.target || 0;
    const percentage = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    
    // UIの描画
    container.innerHTML = `
        <div class="border-b pb-4 mb-4">
            <h3 class="text-sm font-bold text-gray-700 mb-1">
                ${escapeHtml(goal.title)}
                <span class="text-xs font-normal text-gray-500 ml-2">目標: ${target}</span>
            </h3>
            
            <div class="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>現在: <span class="font-bold text-lg">${current}</span></span>
                <span>${percentage}%</span>
            </div>

            <div class="w-full bg-gray-200 rounded-full h-2.5 mb-3">
                <div class="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
            </div>

            <div class="flex gap-2 items-center">
                <input type="number" id="goal-contribution-input" 
                    class="flex-grow p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                    placeholder="完了件数を追加 (例: 1)" min="1">
                <button id="update-goal-btn" 
                    class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-sm transition">
                    登録
                </button>
            </div>
        </div>
    `;

    container.classList.remove("hidden");

    // イベントリスナー設定
    const updateBtn = document.getElementById("update-goal-btn");
    const inputVal = document.getElementById("goal-contribution-input");

    updateBtn.addEventListener("click", () => {
        handleUpdateGoalProgress(task.name, goal.id, inputVal);
    });

    // Enterキーでも登録できるようにする
    inputVal.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            handleUpdateGoalProgress(task.name, goal.id, inputVal);
        }
    });
}

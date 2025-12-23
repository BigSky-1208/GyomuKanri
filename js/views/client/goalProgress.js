// js/views/client/goalProgress.js

import { db, userId, userName, allTaskObjects, escapeHtml } from "../../main.js"; 
import { addDoc, collection, doc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; 
import { getJSTDateString } from "../../utils.js"; 
import { setHasContributed } from "./timer.js";

export async function handleUpdateGoalProgress(taskName, goalId, inputElement) {
    console.log("1. 登録処理開始:", { taskName, goalId, value: inputElement?.value });

    // IDの特定
    let finalGoalId = goalId || document.getElementById("goal-modal")?.dataset.currentGoalId;

    if (!finalGoalId) {
        console.error("エラー: finalGoalId がありません");
        return;
    }

    const contribution = parseInt(inputElement.value, 10);
    if (isNaN(contribution) || contribution <= 0) {
        console.warn("警告: 数値が正しくありません");
        alert("正の数値を入力してください。");
        return;
    }

    // データの検索
    console.log("2. 検索中... 全タスク数:", allTaskObjects.length);
    const taskIndex = allTaskObjects.findIndex((t) => t.name === taskName);
    
    if (taskIndex === -1) {
        console.error("エラー: タスク名が見つかりません:", taskName);
        return;
    }

    const goalIndex = allTaskObjects[taskIndex].goals.findIndex(
        (g) => g.id === finalGoalId || g.title === finalGoalId
    );
    
    if (goalIndex === -1) {
        console.error("エラー: 工数が見つかりません:", finalGoalId);
        return;
    }

    console.log("3. データ特定成功。更新準備中...");

    const updatedTasks = JSON.parse(JSON.stringify(allTaskObjects));
    const task = updatedTasks[taskIndex];
    const goal = task.goals[goalIndex];
    
    goal.current = (goal.current || 0) + contribution;

    try {
        console.log("4. Firebase書き込み開始...");
        
        // Firestore: タスクマスターの更新
        const tasksRef = doc(db, "settings", "tasks");
        await setDoc(tasksRef, { list: updatedTasks }); 

        // Firestore: 作業ログの保存
        await addDoc(collection(db, `work_logs`), {
            type: "goal",
            userId: userId,
            userName: userName,
            task: taskName,
            goalId: finalGoalId,
            goalTitle: goal.title,
            contribution: contribution,
            date: getJSTDateString(new Date()),
            startTime: Timestamp.fromDate(new Date()),
        });

        console.log("5. 全ての更新が完了しました！");
        
        if (typeof setHasContributed === 'function') setHasContributed(true);
        inputElement.value = "";
        
    } catch (error) {
        console.error("Firebase更新エラー:", error);
        alert("進捗の更新中にエラーが発生しました。");
    }
}

export function renderSingleGoalDisplay(task, goalId) {
    const container = document.getElementById("goal-progress-container");
    if (!container) return;

    const goal = task.goals.find(g => g.id === goalId) || task.goals.find(g => g.title === goalId);
    if (!goal) {
        container.innerHTML = "";
        container.classList.add("hidden");
        return;
    }
    
    const current = goal.current || 0;
    const target = goal.target || 0;
    const percentage = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    
    container.innerHTML = `
        <div class="border-b pb-4 mb-4">
            <h3 class="text-sm font-bold text-gray-700 mb-1">${escapeHtml(goal.title)}</h3>
            <div class="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>現在: <strong>${current}</strong> / 目標: ${target}</span>
                <span>${percentage}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2.5 mb-3">
                <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${percentage}%"></div>
            </div>
            <div class="flex gap-2 items-center">
                <input type="number" id="goal-contribution-input" 
                    class="flex-grow p-2 border border-gray-300 rounded text-sm" 
                    placeholder="件数を追加" min="1">
                <button id="update-goal-btn" 
                    class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded text-sm transition">
                    登録
                </button>
            </div>
        </div>
    `;

    container.classList.remove("hidden");

    // ★ 修正: イベント登録のタイミングとIDの確定を確実にする
    const updateBtn = document.getElementById("update-goal-btn");
    const inputVal = document.getElementById("goal-contribution-input");
    const tid = goal.id || goal.title;

    if (updateBtn && inputVal) {
        updateBtn.onclick = (e) => {
            e.preventDefault(); // フォーム送信を防ぐ
            handleUpdateGoalProgress(task.name, tid, inputVal);
        };
        
        inputVal.onkeypress = (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleUpdateGoalProgress(task.name, tid, inputVal);
            }
        };
    }
}

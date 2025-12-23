// js/views/client/goalProgress.js

import { db, userId, userName, allTaskObjects, escapeHtml } from "../../main.js"; 
import { addDoc, collection, doc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; 
import { getJSTDateString } from "../../utils.js"; 
import { setHasContributed } from "./timer.js";

export async function handleUpdateGoalProgress(taskName, goalId, inputElement) {
    console.log("登録処理開始");

    let finalGoalId = goalId || document.getElementById("goal-modal")?.dataset.currentGoalId;
    if (!finalGoalId) return;

    const contribution = parseInt(inputElement.value, 10);
    if (isNaN(contribution) || contribution <= 0) return;

    const taskIndex = allTaskObjects.findIndex((t) => t.name === taskName);
    if (taskIndex === -1) return;

    const goalIndex = allTaskObjects[taskIndex].goals.findIndex(
        (g) => g.id === finalGoalId || g.title === finalGoalId
    );
    if (goalIndex === -1) return;

    // --- 1. ローカルデータの準備 ---
    const updatedTasks = JSON.parse(JSON.stringify(allTaskObjects));
    const task = updatedTasks[taskIndex];
    const goal = task.goals[goalIndex];
    
    const oldCurrent = goal.current || 0;
    const newCurrent = oldCurrent + contribution; // 新しい合計値
    goal.current = newCurrent;

    try {
        // --- 2. Firestore書き込み ---
        const tasksRef = doc(db, "settings", "tasks");
        await setDoc(tasksRef, { list: updatedTasks }); 

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

        // --- 3. ★UIの即時更新ロジック ---
        
        // メモリ上のデータを更新（他の画面への移動対策）
        allTaskObjects[taskIndex].goals[goalIndex].current = newCurrent;

        // 画面上の要素を特定
        const container = document.getElementById("goal-progress-container");
        if (container) {
            const currentLabel = container.querySelector(".font-bold.text-lg"); // 現在値の数字
            const progressBar = container.querySelector(".bg-blue-600");       // 青いバー
            const percentLabel = container.querySelector("div.flex.justify-between span:last-child"); // %表示

            const target = goal.target || 1;
            const newPercent = Math.min(100, Math.round((newCurrent / target) * 100));

            // 数字を更新
            if (currentLabel) {
                currentLabel.textContent = newCurrent;
                // 登録した感出すために一瞬色を変える
                currentLabel.classList.add("text-blue-600");
                setTimeout(() => currentLabel.classList.remove("text-blue-600"), 1000);
            }

            // バーを伸ばす
            if (progressBar) {
                progressBar.style.width = `${newPercent}%`;
            }

            // パーセント数字を更新
            if (percentLabel) {
                percentLabel.textContent = `${newPercent}%`;
            }
        }

        // 入力欄をクリア
        inputElement.value = "";
        console.log("UIの即時更新が完了しました");

    } catch (error) {
        console.error("更新エラー:", error);
        alert("エラーが発生しました。");
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

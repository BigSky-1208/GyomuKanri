// js/views/client/goalProgress.js

import { db, userId, userName, allTaskObjects, escapeHtml } from "../../main.js"; 
import { addDoc, collection, doc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; 
import { getJSTDateString } from "../../utils.js"; 
import { setHasContributed } from "./timer.js";

export async function handleUpdateGoalProgress(taskName, goalId, inputElement) {
    let finalGoalId = goalId || document.getElementById("goal-modal")?.dataset.currentGoalId;
    if (!finalGoalId) return;

    const contribution = parseInt(inputElement.value, 10);
    if (isNaN(contribution) || contribution <= 0) return;

    const taskIndex = allTaskObjects.findIndex((t) => t.name === taskName);
    const goalIndex = allTaskObjects[taskIndex]?.goals.findIndex(g => g.id === finalGoalId || g.title === finalGoalId);
    if (taskIndex === -1 || goalIndex === -1) return;

    // データ更新
    const updatedTasks = JSON.parse(JSON.stringify(allTaskObjects));
    const goal = updatedTasks[taskIndex].goals[goalIndex];
    const newCurrent = (goal.current || 0) + contribution;
    goal.current = newCurrent;

    try {
        // Firebase保存
        await setDoc(doc(db, "settings", "tasks"), { list: updatedTasks }); 
        await addDoc(collection(db, "work_logs"), {
            type: "goal", userId, userName, task: taskName,
            goalId: finalGoalId, goalTitle: goal.title, contribution,
            date: getJSTDateString(new Date()),
            startTime: Timestamp.fromDate(new Date()),
        });

        // --- ★UIの直接更新（ID指定で確実に） ---
        const valEl = document.getElementById("ui-current-val");
        const barEl = document.getElementById("ui-current-bar");
        const pctEl = document.getElementById("ui-current-percent");

        if (valEl) valEl.textContent = newCurrent;
        if (barEl || pctEl) {
            const target = goal.target || 1;
            const newPercent = Math.min(100, Math.round((newCurrent / target) * 100));
            if (barEl) barEl.style.width = `${newPercent}%`;
            if (pctEl) pctEl.textContent = `${newPercent}%`;
        }

        // メモリ上のデータも同期
        allTaskObjects[taskIndex].goals[goalIndex].current = newCurrent;
        inputElement.value = "";

    } catch (error) {
        console.error("Update error:", error);
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
    
    // ★追加: メモがある場合のみ表示するHTMLを作成
    // ※改行を反映させるため whitespace-pre-wrap を使用
    const memoHtml = goal.memo ? `
        <div class="h-fit bg-gray-50 border-l-4 border-blue-600 p-3 mb-4 rounded text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            ${escapeHtml(goal.memo)}
        </div>
    ` : '';

    container.innerHTML = `
        <div class="border-b pb-4 mb-4">
            <h3 class="text-sm font-bold text-gray-700 mb-2">${escapeHtml(goal.title)}</h3>
            
            ${memoHtml}
            
            <div class="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>現在: <span id="ui-current-val" class="font-bold text-lg">${current}</span> / 目標: ${target}</span>
                <span id="ui-current-percent">${percentage}%</span>
            </div>

            <div class="w-full bg-gray-200 rounded-full h-2.5 mb-3">
                <div id="ui-current-bar" class="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
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

    // イベントリスナー設定
    const updateBtn = document.getElementById("update-goal-btn");
    const inputVal = document.getElementById("goal-contribution-input");
    const tid = goal.id || goal.title;

    updateBtn.onclick = () => handleUpdateGoalProgress(task.name, tid, inputVal);
    inputVal.onkeypress = (e) => {
        if (e.key === "Enter") handleUpdateGoalProgress(task.name, tid, inputVal);
    };
}

// js/views/client/goalProgress.js - 目標進捗管理 (Client View)

import { db, userId, userName, allTaskObjects, showView, VIEWS } from "../../main.js"; 
import { addDoc, collection, doc, updateDoc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; 
import { getJSTDateString } from "../../utils.js"; 
// ★追加: 工数入力フラグを更新するためにインポート
import { setHasContributed } from "./timer.js";

export async function handleUpdateGoalProgress(taskName, goalId, inputElement) {
    const contribution = parseInt(inputElement.value, 10);

    if (isNaN(contribution) || contribution <= 0) {
        alert("正の数値を入力してください。");
        return;
    }

    const taskIndex = allTaskObjects.findIndex((t) => t.name === taskName);
    if (taskIndex === -1) return;

    const goalIndex = allTaskObjects[taskIndex].goals.findIndex(
        (g) => g.id === goalId
    );
    if (goalIndex === -1) return;

    // Update local state deeply
    const updatedTasks = JSON.parse(JSON.stringify(allTaskObjects));
    const task = updatedTasks[taskIndex];
    const goal = task.goals[goalIndex];
    const currentProgress = goal.current || 0;
    
    // Update Goal Object
    goal.current = currentProgress + contribution;

    try {
        // 1. Save updated tasks to Firestore
        const tasksRef = doc(db, "settings", "tasks");
        await setDoc(tasksRef, { list: updatedTasks }); 

        // 2. Log contribution to work_logs
        await addDoc(collection(db, `work_logs`), {
            type: "goal",
            userId,
            userName,
            task: taskName,
            goalId: goal.id,
            goalTitle: goal.title,
            contribution: contribution,
            date: getJSTDateString(new Date()),
            startTime: Timestamp.fromDate(new Date()),
        });

        // ★追加: 工数入力フラグをTrueにする
        setHasContributed(true);

        inputElement.value = "";
        // UI update is handled by the Firestore snapshot listener in main.js -> clientUI.js re-render

    } catch (error) {
        console.error("Error updating goal progress:", error);
        alert("進捗の更新中にエラーが発生しました。");
    }
}

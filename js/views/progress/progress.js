// js/views/progress/progress.js
// ★ dbとFirestore関数をインポート
// ★修正: js/views/progress/progress.js から見て main.js は ../../main.js (Correct)
import { db, allTaskObjects, handleGoBack, showView, VIEWS, escapeHtml } from "../../main.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// ★修正: js/views/progress/ から js/components/ は ../../components/
import { openGoalModal, showHelpModal } from "../../components/modal/index.js";
import { destroyCharts } from "../../components/chart.js";

import {
    renderProgressTaskList,
    renderProgressGoalList,
    renderProgressGoalDetails,
    renderChartAndTable,
    clearGoalDetailsAndSummary,
    updateTaskSelectionUI,
    updateGoalSelectionUI
} from "./progressUI.js";

import {
    calculateDateRange,
    aggregateWeeklyData
} from "./progressData.js";

import {
    handleCompleteGoal,
    handleDeleteGoal
} from "./progressActions.js";

let selectedProgressTaskName = null;
let selectedProgressGoalId = null;
let progressWeekOffset = 0;
let progressMonthOffset = 0;
let progressChartType = "contribution";
let progressLineChartInstance = null;
let selectedTaskLogs = []; // ★ 選択されたタスクのログを保持するローカル変数

const taskListContainer = document.getElementById("progress-task-list");
const goalListContainer = document.getElementById("progress-goal-list");
const goalDetailsContainer = document.getElementById("progress-goal-details-container");
const chartContainer = document.getElementById("progress-chart-container");
const weeklySummaryContainer = document.getElementById("progress-weekly-summary-container");
const backButton = document.getElementById("back-to-previous-view-from-progress");
const viewArchiveButton = document.getElementById("view-archive-btn");
const helpButton = document.querySelector('#progress-view .help-btn');

export async function initializeProgressView() {
    console.log("Initializing Progress View...");
    
    // ★ 全件取得は削除。初期化時はタスクリストの表示のみ。
    selectedTaskLogs = []; 
    
    progressWeekOffset = 0;
    progressMonthOffset = 0;

    renderProgressTaskList(allTaskObjects, selectedProgressTaskName, handleTaskClick);

    if (selectedProgressTaskName) {
        // タスクが選択済みの場合は、そのタスクのログをフェッチして再描画
        await fetchLogsForTask(selectedProgressTaskName);
        
        renderProgressGoalList(allTaskObjects, selectedProgressTaskName, selectedProgressGoalId, handleGoalClick);
        if (selectedProgressGoalId) {
            renderDetailsAndSummary();
        } else {
            clearGoalDetailsAndSummary(goalDetailsContainer, chartContainer, weeklySummaryContainer, [progressLineChartInstance]);
            progressLineChartInstance = null;
        }
    } else {
        if(goalListContainer) goalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
        clearGoalDetailsAndSummary(goalDetailsContainer, chartContainer, weeklySummaryContainer, [progressLineChartInstance]);
        progressLineChartInstance = null;
    }
}

export function setupProgressEventListeners() {
    backButton?.addEventListener("click", handleGoBack);
    viewArchiveButton?.addEventListener("click", () => showView(VIEWS.ARCHIVE));
    helpButton?.addEventListener('click', () => showHelpModal('progress'));

     goalDetailsContainer?.addEventListener('click', (event) => {
        const target = event.target.closest('button');
        if (!target) return;

        const taskName = target.dataset.taskName;
        const goalId = target.dataset.goalId;
        if (!taskName || !goalId) return;
        
        const readOnlyMode = window.isProgressViewReadOnly === true;
        if (readOnlyMode) return;

        if (target.classList.contains('edit-goal-btn')) {
             openGoalModal('edit', taskName, goalId);
        } else if (target.classList.contains('complete-goal-btn')) {
             handleCompleteGoal(taskName, goalId, async () => {
                 // 成功時のコールバック
                 selectedProgressGoalId = null;
                 clearGoalDetailsAndSummary(goalDetailsContainer, chartContainer, weeklySummaryContainer, [progressLineChartInstance]);
                 progressLineChartInstance = null;
                 // データ更新の可能性があるためログ再取得（工数完了ログなどが追加されるため）
                 await fetchLogsForTask(taskName); 
                 renderProgressTaskList(allTaskObjects, selectedProgressTaskName, handleTaskClick);
                 renderProgressGoalList(allTaskObjects, selectedProgressTaskName, null, handleGoalClick);
             });
        } else if (target.classList.contains('delete-goal-btn')) {
             handleDeleteGoal(taskName, goalId, () => {
                 selectedProgressGoalId = null;
                 clearGoalDetailsAndSummary(goalDetailsContainer, chartContainer, weeklySummaryContainer, [progressLineChartInstance]);
                 progressLineChartInstance = null;
                 renderProgressTaskList(allTaskObjects, selectedProgressTaskName, handleTaskClick);
                 renderProgressGoalList(allTaskObjects, selectedProgressTaskName, null, handleGoalClick);
             });
        }
    });

     chartContainer?.addEventListener('click', (event) => {
        const target = event.target.closest('button');
        if (!target) return;

        if (target.id === 'chart-toggle-contribution') {
            if (progressChartType !== 'contribution') {
                progressChartType = 'contribution';
                renderDetailsAndSummary();
            }
        } else if (target.id === 'chart-toggle-efficiency') {
             if (progressChartType !== 'efficiency') {
                progressChartType = 'efficiency';
                renderDetailsAndSummary();
            }
        }
     });

     weeklySummaryContainer?.addEventListener('click', (event) => {
        const target = event.target.closest('button');
        if (!target) return;

        if (target.id === 'progress-prev-week-btn') {
            progressWeekOffset--;
            renderDetailsAndSummary();
        } else if (target.id === 'progress-next-week-btn') {
            progressWeekOffset++;
            renderDetailsAndSummary();
        } else if (target.id === 'progress-prev-month-btn') {
             progressMonthOffset--;
             progressWeekOffset = 0;
             renderDetailsAndSummary();
        } else if (target.id === 'progress-next-month-btn') {
             progressMonthOffset++;
             progressWeekOffset = 0;
             renderDetailsAndSummary();
        }
     });
}

// ★ 新規: 指定されたタスクのログを全期間分取得する
async function fetchLogsForTask(taskName) {
    console.log(`Fetching logs for task: ${taskName}`);
    // UIにローディング表示などを出すとより良い
    
    try {
        const q = query(
            collection(db, "work_logs"),
            where("task", "==", taskName)
        );
        // タスク作成日がデータとして存在しないため、全期間の該当タスクログを取得する仕様
        const snapshot = await getDocs(q);
        
        // Timestamp変換を含めてローカル変数に格納
        selectedTaskLogs = snapshot.docs.map((d) => {
             const data = d.data();
             const log = { id: d.id, ...data };
             if (log.startTime && log.startTime.toDate) log.startTime = log.startTime.toDate();
             if (log.endTime && log.endTime.toDate) log.endTime = log.endTime.toDate();
             return log;
        });
        console.log(`Fetched ${selectedTaskLogs.length} logs for task ${taskName}`);

    } catch (error) {
        console.error("Error fetching task logs:", error);
        selectedTaskLogs = [];
        alert("ログデータの取得中にエラーが発生しました。");
    }
}

async function handleTaskClick(taskName) {
    selectedProgressTaskName = taskName;
    selectedProgressGoalId = null;

    updateTaskSelectionUI(taskListContainer, taskName);
    
    // ★ タスクがクリックされた時点でログを取得
    await fetchLogsForTask(taskName);

    renderProgressGoalList(allTaskObjects, selectedProgressTaskName, null, handleGoalClick);
    
    clearGoalDetailsAndSummary(goalDetailsContainer, chartContainer, weeklySummaryContainer, [progressLineChartInstance]);
    progressLineChartInstance = null;
}

function handleGoalClick(goalId) {
    selectedProgressGoalId = goalId;
    progressWeekOffset = 0;
    progressMonthOffset = 0;
    progressChartType = "contribution";

    updateGoalSelectionUI(goalListContainer, goalId);
    renderDetailsAndSummary();
}

function renderDetailsAndSummary() {
    if (!selectedProgressTaskName || !selectedProgressGoalId) {
        clearGoalDetailsAndSummary(goalDetailsContainer, chartContainer, weeklySummaryContainer, [progressLineChartInstance]);
        progressLineChartInstance = null;
        return;
    }

    const task = allTaskObjects.find((t) => t.name === selectedProgressTaskName);
    const goal = task?.goals.find((g) => g.id === selectedProgressGoalId || g.title === selectedProgressGoalId);

    if (!goal || goal.isComplete) {
        clearGoalDetailsAndSummary(goalDetailsContainer, chartContainer, weeklySummaryContainer, [progressLineChartInstance]);
        progressLineChartInstance = null;
        if (goal?.isComplete) {
            selectedProgressGoalId = null;
            renderProgressGoalList(allTaskObjects, selectedProgressTaskName, null, handleGoalClick);
        }
        return;
    }

    const readOnlyMode = window.isProgressViewReadOnly === true;
    renderProgressGoalDetails(goal, task.name, readOnlyMode, goalDetailsContainer);

    const weekDates = calculateDateRange(progressWeekOffset, progressMonthOffset);

    // ★ allUserLogs ではなく selectedTaskLogs を渡す
    const finalGoalIdForFilter = goal.id || goal.title;
    const chartAndTableData = aggregateWeeklyData(selectedTaskLogs, finalGoalIdForFilter, weekDates);

    destroyCharts([progressLineChartInstance]);
    progressLineChartInstance = renderChartAndTable(
        weekDates,
        chartAndTableData,
        goal,
        progressChartType,
        progressMonthOffset,
        progressWeekOffset,
        chartContainer,
        weeklySummaryContainer
    );
}

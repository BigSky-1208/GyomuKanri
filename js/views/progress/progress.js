// js/views/progress.js (リファクタリング版 - 司令塔)

import { allTaskObjects, allUserLogs, fetchAllUserLogs, handleGoBack, showView, VIEWS, escapeHtml } from "../../main.js";
import { openGoalModal, showHelpModal } from "../components/modal.js";
import { destroyCharts } from "../components/chart.js";

// --- 新しく分割したモジュールをインポート ---
// (これらは js/views/progress/ フォルダに作成することを想定)
import {
    renderProgressTaskList,
    renderProgressGoalList,
    renderProgressGoalDetails,
    renderChartAndTable,
    clearGoalDetailsAndSummary,
    updateTaskSelectionUI,
    updateGoalSelectionUI
} from "./progress/progressUI.js";

import {
    calculateDateRange,
    aggregateWeeklyData
} from "./progress/progressData.js";

import {
    handleCompleteGoal,
    handleDeleteGoal
} from "./progress/progressActions.js";

// --- Module State ---
let selectedProgressTaskName = null;
let selectedProgressGoalId = null;
let progressWeekOffset = 0;
let progressMonthOffset = 0;
let progressChartType = "contribution"; // 'contribution' (件数) or 'efficiency' (件/h)
let progressLineChartInstance = null; // To hold the Chart.js instance

// --- DOM Element references ---
const taskListContainer = document.getElementById("progress-task-list");
const goalListContainer = document.getElementById("progress-goal-list");
const goalDetailsContainer = document.getElementById("progress-goal-details-container");
const chartContainer = document.getElementById("progress-chart-container");
const weeklySummaryContainer = document.getElementById("progress-weekly-summary-container");
const backButton = document.getElementById("back-to-previous-view-from-progress");
const viewArchiveButton = document.getElementById("view-archive-btn");
const helpButton = document.querySelector('#progress-view .help-btn');

/**
 * Initializes the Progress View.
 */
export async function initializeProgressView() {
    console.log("Initializing Progress View...");
    await fetchAllUserLogs(); // 最新のログデータを取得

    // オフセットをリセット
    progressWeekOffset = 0;
    progressMonthOffset = 0;

    // タスクリストを描画（クリックハンドラを渡す）
    renderProgressTaskList(allTaskObjects, selectedProgressTaskName, handleTaskClick);

    // 以前選択したタスク/ゴールがあれば再描画
    if (selectedProgressTaskName) {
        renderProgressGoalList(allTaskObjects, selectedProgressTaskName, selectedProgressGoalId, handleGoalClick);
        if (selectedProgressGoalId) {
            // 詳細とサマリーを再描画
            renderDetailsAndSummary();
        } else {
            clearGoalDetailsAndSummary(goalDetailsContainer, chartContainer, weeklySummaryContainer, [progressLineChartInstance]);
            progressLineChartInstance = null;
        }
    } else {
        // 何も選択されていなければ、すべてクリア
        if(goalListContainer) goalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
        clearGoalDetailsAndSummary(goalDetailsContainer, chartContainer, weeklySummaryContainer, [progressLineChartInstance]);
        progressLineChartInstance = null;
    }
}

/**
 * Sets up event listeners for the Progress View.
 */
export function setupProgressEventListeners() {
    console.log("Setting up Progress View event listeners...");
    backButton?.addEventListener("click", handleGoBack);
    viewArchiveButton?.addEventListener("click", () => showView(VIEWS.ARCHIVE));
    helpButton?.addEventListener('click', () => showHelpModal('progress'));

     // --- イベント委任 ---

     // タスクリストのクリック (renderProgressTaskList で個別に設定するため不要)
     // taskListContainer?.addEventListener('click', (event) => { ... });
     
     // ゴールリストのクリック (renderProgressGoalList で個別に設定するため不要)
     // goalListContainer?.addEventListener('click', (event) => { ... });

     // ゴール詳細のアクションボタン
     goalDetailsContainer?.addEventListener('click', (event) => {
        const target = event.target.closest('button'); // クリックされたボタンを取得
        if (!target) return;

        const taskName = target.dataset.taskName;
        const goalId = target.dataset.goalId;
        if (!taskName || !goalId) return;
        
        // 読み取り専用モードかチェック (main.js からのグローバル変数)
        const readOnlyMode = window.isProgressViewReadOnly === true;
        if (readOnlyMode) return; // 読み取り専用モードではアクション不可

        if (target.classList.contains('edit-goal-btn')) {
             openGoalModal('edit', taskName, goalId);
        } else if (target.classList.contains('complete-goal-btn')) {
             // 完了処理を progressActions に委任
             handleCompleteGoal(taskName, goalId, () => {
                 // 成功時のコールバック (UI更新)
                 selectedProgressGoalId = null;
                 clearGoalDetailsAndSummary(goalDetailsContainer, chartContainer, weeklySummaryContainer, [progressLineChartInstance]);
                 progressLineChartInstance = null;
                 // リストを再描画
                 renderProgressTaskList(allTaskObjects, selectedProgressTaskName, handleTaskClick);
                 renderProgressGoalList(allTaskObjects, selectedProgressTaskName, null, handleGoalClick);
             });
        } else if (target.classList.contains('delete-goal-btn')) {
             // 削除処理を progressActions に委任
             handleDeleteGoal(taskName, goalId, () => {
                // 成功時のコールバック (UI更新)
                 selectedProgressGoalId = null;
                 clearGoalDetailsAndSummary(goalDetailsContainer, chartContainer, weeklySummaryContainer, [progressLineChartInstance]);
                 progressLineChartInstance = null;
                 // リストを再描画
                 renderProgressTaskList(allTaskObjects, selectedProgressTaskName, handleTaskClick);
                 renderProgressGoalList(allTaskObjects, selectedProgressTaskName, null, handleGoalClick);
             });
        }
    });

     // グラフタイプ切り替え
     chartContainer?.addEventListener('click', (event) => {
        const target = event.target.closest('button');
        if (!target) return;

        if (target.id === 'chart-toggle-contribution') {
            if (progressChartType !== 'contribution') {
                progressChartType = 'contribution';
                renderDetailsAndSummary(); // グラフと表を再描画
            }
        } else if (target.id === 'chart-toggle-efficiency') {
             if (progressChartType !== 'efficiency') {
                progressChartType = 'efficiency';
                renderDetailsAndSummary(); // グラフと表を再描画
            }
        }
     });

     // 週/月ナビゲーション
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
             progressWeekOffset = 0; // 月変更時は週オフセットをリセット
             renderDetailsAndSummary();
        } else if (target.id === 'progress-next-month-btn') {
             progressMonthOffset++;
             progressWeekOffset = 0; // 月変更時は週オフセットをリセット
             renderDetailsAndSummary();
        }
     });
}

/**
 * タスクリストの項目がクリックされたときのハンドラ
 * @param {string} taskName - クリックされたタスク名
 */
function handleTaskClick(taskName) {
    selectedProgressTaskName = taskName;
    selectedProgressGoalId = null; // ゴール選択をリセット

    // UIの選択状態を更新
    updateTaskSelectionUI(taskListContainer, taskName);
    
    // ゴールリストを再描画
    renderProgressGoalList(allTaskObjects, selectedProgressTaskName, null, handleGoalClick);
    
    // 詳細・サマリーをクリア
    clearGoalDetailsAndSummary(goalDetailsContainer, chartContainer, weeklySummaryContainer, [progressLineChartInstance]);
    progressLineChartInstance = null;
}

/**
 * ゴールリストの項目がクリックされたときのハンドラ
 * @param {string} goalId - クリックされたゴールID
 */
function handleGoalClick(goalId) {
    selectedProgressGoalId = goalId;
    
    // オフセットとチャートタイプをリセット
    progressWeekOffset = 0;
    progressMonthOffset = 0;
    progressChartType = "contribution";

    // UIの選択状態を更新
    updateGoalSelectionUI(goalListContainer, goalId);

    // 詳細・サマリーを描画
    renderDetailsAndSummary();
}

/**
 * 選択中のゴールと日付オフセットに基づき、詳細・グラフ・表を（再）描画する
 */
function renderDetailsAndSummary() {
    if (!selectedProgressTaskName || !selectedProgressGoalId) {
        clearGoalDetailsAndSummary(goalDetailsContainer, chartContainer, weeklySummaryContainer, [progressLineChartInstance]);
        progressLineChartInstance = null;
        return;
    }

    const task = allTaskObjects.find((t) => t.name === selectedProgressTaskName);
    const goal = task?.goals.find((g) => g.id === selectedProgressGoalId);

    if (!goal || goal.isComplete) {
        console.warn("Goal not found or is complete, clearing details.");
        clearGoalDetailsAndSummary(goalDetailsContainer, chartContainer, weeklySummaryContainer, [progressLineChartInstance]);
        progressLineChartInstance = null;
        // もしゴールが完了していたらリストを再描画して選択を外す
        if (goal?.isComplete) {
            selectedProgressGoalId = null;
            renderProgressGoalList(allTaskObjects, selectedProgressTaskName, null, handleGoalClick);
        }
        return;
    }

    // 1. ゴール詳細を描画
    const readOnlyMode = window.isProgressViewReadOnly === true;
    renderProgressGoalDetails(goal, task.name, readOnlyMode, goalDetailsContainer);

    // 2. 日付範囲を計算
    const weekDates = calculateDateRange(progressWeekOffset, progressMonthOffset);

    // 3. データを集計
    const chartAndTableData = aggregateWeeklyData(allUserLogs, goal.id, weekDates);

    // 4. グラフと表を描画（UIモジュールに委任）
    // グラフインスタンスを破棄・再割り当て
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

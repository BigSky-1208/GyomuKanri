// js/views/progress/progressUI.js (UI描画 担当)

import { escapeHtml, formatHoursMinutes } from "../../utils.js";
import { createLineChart } from "../../components/chart.js";

export function renderProgressTaskList(allTaskObjects, selectedProgressTaskName, handleTaskClick) {
    const taskListContainer = document.getElementById("progress-task-list");
    if (!taskListContainer) return;

    taskListContainer.innerHTML = ""; 

    const tasksWithActiveGoals = allTaskObjects
        .filter(task => task.goals && task.goals.some(g => !g.isComplete))
        .sort((a,b)=> (a.name || "").localeCompare(b.name || "", "ja"));

    if (tasksWithActiveGoals.length === 0) {
        taskListContainer.innerHTML = '<p class="text-gray-500 p-2">進行中の工数がある業務はありません。</p>';
        const goalListContainer = document.getElementById("progress-goal-list");
        if (goalListContainer) goalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
        return;
    }

    tasksWithActiveGoals.forEach((task) => {
        const button = document.createElement("button");
        button.className = `w-full text-left p-2 rounded-lg list-item hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${selectedProgressTaskName === task.name ? "selected bg-indigo-100" : ""}`;
        button.textContent = escapeHtml(task.name);
        button.dataset.taskName = task.name;

        button.onclick = () => handleTaskClick(task.name);
        
        taskListContainer.appendChild(button);
    });
}

export function renderProgressGoalList(allTaskObjects, selectedProgressTaskName, selectedProgressGoalId, handleGoalClick) {
    const goalListContainer = document.getElementById("progress-goal-list");
    if (!goalListContainer) return;

    if (!selectedProgressTaskName) {
         goalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
        return;
    }

    goalListContainer.innerHTML = ""; 

    const task = allTaskObjects.find((t) => t.name === selectedProgressTaskName);
    if (!task || !task.goals) {
         goalListContainer.innerHTML = '<p class="text-gray-500">選択された業務が見つからないか、工数がありません。</p>';
        return;
    }

    const activeGoals = task.goals
        .filter((g) => !g.isComplete)
        .sort((a,b) => (a.title || "").localeCompare(b.title || "", "ja"));

    if (activeGoals.length === 0) {
        goalListContainer.innerHTML = '<p class="text-gray-500">この業務に進行中の工数はありません。</p>';
        return;
    }

activeGoals.forEach((goal) => {
        const button = document.createElement("button");
        const tid = goal.id || goal.title; // ★IDがなければタイトルを使用
        button.className = `w-full text-left p-2 rounded-lg list-item hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${selectedProgressGoalId === tid ? "selected bg-indigo-100" : ""}`;
        button.textContent = escapeHtml(goal.title);
        button.dataset.goalId = tid;

        button.onclick = () => handleGoalClick(tid);
        goalListContainer.appendChild(button);   
});
}

export function updateTaskSelectionUI(taskListContainer, taskName) {
    if (!taskListContainer) return;
    taskListContainer.querySelectorAll(".list-item").forEach((item) => {
        if (item.dataset.taskName === taskName) {
            item.classList.add("selected", "bg-indigo-100");
        } else {
            item.classList.remove("selected", "bg-indigo-100");
        }
    });
}

export function updateGoalSelectionUI(goalListContainer, goalId) {
    if (!goalListContainer) return;
    goalListContainer.querySelectorAll(".list-item").forEach((item) => {
        if (item.dataset.goalId === goalId) {
            item.classList.add("selected", "bg-indigo-100");
        } else {
            item.classList.remove("selected", "bg-indigo-100");
        }
    });
}

export function renderProgressGoalDetails(goal, taskName, readOnlyMode, goalDetailsContainer) {
    if (!goalDetailsContainer) return;

    const progress = goal.target > 0 ? Math.min(100, Math.max(0,(goal.current / goal.target) * 100)) : 0;
    const tid = goal.id || goal.title;

const buttonsHtml = readOnlyMode ? "" : `
        <div class="flex-shrink-0 ml-4 space-x-2">
            <button class="edit-goal-btn bg-blue-500 text-white font-bold py-1 px-3 rounded hover:bg-blue-600 text-sm" data-task-name="${escapeHtml(taskName)}" data-goal-id="${goal.id || goal.title}">編集</button>
            <button class="complete-goal-btn bg-green-500 text-white font-bold py-1 px-3 rounded hover:bg-green-600 text-sm" data-task-name="${escapeHtml(taskName)}" data-goal-id="${goal.id || goal.title}">完了</button>
            <button class="delete-goal-btn bg-red-500 text-white font-bold py-1 px-3 rounded hover:bg-red-600 text-sm" data-task-name="${escapeHtml(taskName)}" data-goal-id="${goal.id || goal.title}">削除</button>
        </div>
    `;

    goalDetailsContainer.innerHTML = `
        <div class="flex justify-between items-start flex-wrap">
            <div class="flex-grow mb-2">
                <h3 class="text-xl font-bold">[${escapeHtml(taskName)}] ${escapeHtml(goal.title)}</h3>
                <p class="text-sm text-gray-500 mt-1">納期: ${goal.deadline || "未設定"}</p>
                <p class="text-sm text-gray-500 mt-1">工数納期: ${goal.effortDeadline || "未設定"}</p>
                <p class="text-sm text-gray-600 mt-2 whitespace-pre-wrap">${escapeHtml(goal.memo || "メモはありません")}</p>
            </div>
            ${buttonsHtml}
        </div>
        <div class="w-full bg-gray-200 rounded-full h-4 mt-2" title="${goal.current || 0} / ${goal.target || 0}">
            <div class="bg-blue-600 h-4 rounded-full text-center text-white text-xs leading-4" style="width: ${progress}%">${Math.round(progress)}%</div>
        </div>
        <div class="text-lg text-right font-semibold text-gray-700 mt-1">${goal.current || 0} / ${goal.target || 0}</div>
    `;
    goalDetailsContainer.classList.remove("hidden");
}

export function clearGoalDetailsAndSummary(goalDetailsContainer, chartContainer, weeklySummaryContainer, chartInstances) {
    if (goalDetailsContainer) goalDetailsContainer.classList.add("hidden");
    if (chartContainer) chartContainer.classList.add("hidden");
    if (weeklySummaryContainer) weeklySummaryContainer.classList.add("hidden");
    
}


function _renderProgressLineChart(chartContainer, weekDates, data, goal, progressChartType) {
    if (!chartContainer) return null;
    chartContainer.innerHTML = ""; 

    const buttonsDiv = document.createElement("div");
    buttonsDiv.className = "flex justify-center md:justify-end gap-2 mb-2";
    buttonsDiv.innerHTML = `
        <button id="chart-toggle-contribution" class="text-xs md:text-sm py-1 px-2 md:px-3 rounded-lg transition-colors ${
            progressChartType === "contribution" ? "bg-blue-600 text-white" : "bg-gray-200 hover:bg-gray-300"
        }">合計件数</button>
        <button id="chart-toggle-efficiency" class="text-xs md:text-sm py-1 px-2 md:px-3 rounded-lg transition-colors ${
            progressChartType === "efficiency" ? "bg-blue-600 text-white" : "bg-gray-200 hover:bg-gray-300"
        }">時間あたり件数</button>
    `;
    chartContainer.appendChild(buttonsDiv);

    // ★修正: Chart.jsの高さ暴走を防ぐため、固定高さの親divで囲む
    const canvasWrapper = document.createElement("div");
    canvasWrapper.className = "relative w-full h-96"; // h-96はTailwindで384px。高さをここで制限します。
    
    const canvas = document.createElement("canvas");
    canvasWrapper.appendChild(canvas);
    chartContainer.appendChild(canvasWrapper);

    const datasets = data.map((userData, index) => {
        const hue = (index * 137.508) % 360;
        const color = `hsl(${hue}, 70%, 50%)`;
        return {
            label: escapeHtml(userData.name),
            data: userData.dailyData.map((d) =>
                progressChartType === "contribution" ? d.contribution : d.efficiency
            ),
            borderColor: color,
            backgroundColor: color + '33',
            fill: false,
            tension: 0.1,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5
        };
    });

    const labels = weekDates.map((dateStr) => {
        try {
            const date = new Date(dateStr + 'T00:00:00');
            return `${date.getMonth() + 1}/${date.getDate()}`;
        } catch (error) {
             console.error("Error parsing date for chart label:", dateStr, error);
             return dateStr;
        }
    });

    const yAxisTitle = progressChartType === "contribution" ? "合計件数" : "時間あたり件数 (件/h)";
    const chartTitle = `${escapeHtml(goal.title)} - 週間進捗グラフ`;

    const ctx = canvas.getContext("2d");
    return createLineChart(ctx, labels, datasets, chartTitle, yAxisTitle); 
}

function _renderProgressTable(weeklySummaryContainer, weekDates, data) {
    if (!weeklySummaryContainer) return;

    let tableHtml = '<div class="overflow-x-auto mt-4"><table class="w-full text-sm text-left text-gray-500">';
    tableHtml += '<thead class="text-xs text-gray-700 uppercase bg-gray-50"><tr><th scope="col" class="px-3 py-3 sticky left-0 bg-gray-50 z-10">名前</th>';
    weekDates.forEach((dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');
        tableHtml += `<th scope="col" class="px-3 py-3 text-center min-w-[100px]">${date.getMonth() + 1}/${date.getDate()}</th>`;
    });
    tableHtml += "</tr></thead><tbody>";

    data.forEach((userData) => {
        tableHtml += `<tr class="bg-white border-b hover:bg-gray-50"><th scope="row" class="px-3 py-4 font-medium text-gray-900 whitespace-nowrap sticky left-0 bg-white z-10">${escapeHtml(userData.name)}</th>`;
        userData.dailyData.forEach((d) => {
            const cellClass = (d.contribution > 0 || d.duration > 0) ? "highlight-cell bg-yellow-50" : "";
            tableHtml += `<td class="px-3 py-4 text-center ${cellClass}">
                <div title="件数 / 時間">${d.contribution}件 / ${formatHoursMinutes(d.duration)}</div>
                <div class="text-xs text-gray-400" title="時間あたり件数">${d.efficiency}件/h</div>
            </td>`;
        });
        tableHtml += "</tr>";
    });

    tableHtml += "</tbody></table></div>";
    weeklySummaryContainer.innerHTML += tableHtml; 
}

function _renderProgressTableNavigation(weeklySummaryContainer, progressMonthOffset, progressWeekOffset) {
     if (!weeklySummaryContainer) return;

     const baseDateNav = new Date();
     baseDateNav.setHours(0,0,0,0);
     if (progressMonthOffset !== 0) {
          baseDateNav.setMonth(baseDateNav.getMonth() + progressMonthOffset);
          baseDateNav.setDate(1);
     }
     const year = baseDateNav.getFullYear();
     const month = baseDateNav.getMonth() + 1;

     const referenceDateNav = new Date();
     referenceDateNav.setHours(0,0,0,0);
     if (progressMonthOffset !== 0) {
         referenceDateNav.setFullYear(year);
         referenceDateNav.setMonth(month - 1);
         referenceDateNav.setDate(1);
     }
     referenceDateNav.setDate(referenceDateNav.getDate() + progressWeekOffset * 7);

     const dayOfWeekNav = referenceDateNav.getDay();
     const startOfWeekNav = new Date(referenceDateNav);
     startOfWeekNav.setDate(referenceDateNav.getDate() - dayOfWeekNav);
     const startWeekStr = `${startOfWeekNav.getMonth() + 1}/${startOfWeekNav.getDate()}`;

     const endOfWeekNav = new Date(startOfWeekNav);
     endOfWeekNav.setDate(startOfWeekNav.getDate() + 6);
     const endWeekStr = `${endOfWeekNav.getMonth() + 1}/${endOfWeekNav.getDate()}`;

     let navHtml = `
     <div class="flex flex-col sm:flex-row justify-between items-center mb-2 gap-2">
         <h4 class="text-lg font-bold text-center sm:text-left">週間データ (${year}/${month.toString().padStart(2, "0")})</h4>
         <div class="flex items-center justify-center gap-1 flex-wrap">
             <button id="progress-prev-month-btn" class="p-1 md:p-2 rounded-lg hover:bg-gray-200 text-xs md:text-sm font-bold" title="前の月へ">&lt;&lt; 月</button>
             <button id="progress-prev-week-btn" class="p-1 md:p-2 rounded-lg hover:bg-gray-200 text-xs md:text-sm" title="前の週へ">&lt; 週</button>
             <span class="text-sm md:text-base font-semibold text-gray-700 whitespace-nowrap">${startWeekStr} - ${endWeekStr}</span>
             <button id="progress-next-week-btn" class="p-1 md:p-2 rounded-lg hover:bg-gray-200 text-xs md:text-sm" title="次の週へ">週 &gt;</button>
             <button id="progress-next-month-btn" class="p-1 md:p-2 rounded-lg hover:bg-gray-200 text-xs md:text-sm font-bold" title="次の月へ">月 &gt;&gt;</button>
         </div>
     </div>`;
     weeklySummaryContainer.innerHTML = navHtml; 
 }

export function renderChartAndTable(
    weekDates,
    chartAndTableData,
    goal,
    progressChartType,
    progressMonthOffset,
    progressWeekOffset,
    chartContainer,
    weeklySummaryContainer
) {
    if (!chartContainer || !weeklySummaryContainer) return null;

    let chartInstance = null;
    
    _renderProgressTableNavigation(weeklySummaryContainer, progressMonthOffset, progressWeekOffset);

    if (chartAndTableData.length > 0) {
        chartInstance = _renderProgressLineChart(chartContainer, weekDates, chartAndTableData, goal, progressChartType);
        _renderProgressTable(weeklySummaryContainer, weekDates, chartAndTableData);
        
        chartContainer.classList.remove('hidden');
        weeklySummaryContainer.classList.remove('hidden');
    } else {
        chartContainer.innerHTML = '<p class="text-gray-500 text-center p-4">この期間のグラフデータはありません。</p>';
        weeklySummaryContainer.innerHTML += '<p class="text-gray-500 text-center p-4 mt-4">この期間の集計データはありません。</p>'; 
        
        chartContainer.classList.remove('hidden');
        weeklySummaryContainer.classList.remove('hidden');
    }
    
    return chartInstance;
}

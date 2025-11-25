// js/views/archive.js
// ★ dbとFirestore関数をインポート
import { db, allTaskObjects, handleGoBack } from "../main.js"; 
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { formatHoursMinutes, escapeHtml } from "../utils.js";
import { renderArchiveChart, renderArchiveTable, destroyCharts } from "../components/chart.js";

let selectedArchiveTaskName = null;
let selectedArchiveGoalId = null;
let archiveDatePageIndex = 0;
let archiveChartInstance = null;
let selectedGoalLogs = []; // ★ 選択されたゴールのログを保持するローカル変数

const archiveTaskListContainer = document.getElementById("archive-task-list");
const archiveGoalListContainer = document.getElementById("archive-goal-list");
const archiveGoalDetailsContainer = document.getElementById("archive-goal-details-container");
const archiveWeeklySummaryContainer = document.getElementById("archive-weekly-summary-container");
const archiveChartContainer = document.getElementById("archive-chart-container");
const archiveBackButton = document.getElementById("back-to-progress-from-archive");

export async function initializeArchiveView() {
    selectedArchiveTaskName = null;
    selectedArchiveGoalId = null;
    archiveDatePageIndex = 0;
    selectedGoalLogs = []; // クリア

    renderArchiveTaskList();
    
    if(archiveGoalListContainer) archiveGoalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
    if(archiveGoalDetailsContainer) archiveGoalDetailsContainer.classList.add("hidden");
    if(archiveChartContainer) archiveChartContainer.classList.add("hidden");
    if(archiveWeeklySummaryContainer) archiveWeeklySummaryContainer.classList.add("hidden");
     destroyCharts([archiveChartInstance]);
     archiveChartInstance = null;
}

export function setupArchiveEventListeners() {
    archiveBackButton?.addEventListener('click', handleGoBack);

    archiveWeeklySummaryContainer?.addEventListener('click', (event) => {
        if (event.target.id === 'archive-prev-page-btn') {
            if (archiveDatePageIndex > 0) {
                archiveDatePageIndex--;
                renderArchiveWeeklySummary();
            }
        } else if (event.target.id === 'archive-next-page-btn') {
            const totalPages = calculateTotalPages();
            if (archiveDatePageIndex < totalPages - 1) {
                archiveDatePageIndex++;
                renderArchiveWeeklySummary();
            }
        }
    });

     archiveGoalDetailsContainer?.addEventListener('click', async (event) => {
        const target = event.target;
        const taskName = target.dataset.taskName;
        const goalId = target.dataset.goalId;

        if (!taskName || !goalId) return;

        if (target.classList.contains('restore-goal-btn')) {
            const { handleRestoreGoalClick } = await import('../components/modal.js');
            handleRestoreGoalClick(taskName, goalId);
        } else if (target.classList.contains('delete-goal-btn')) {
            const { handleDeleteGoal } = await import('../components/modal.js');
            handleDeleteGoal(taskName, goalId);
        }
     });

    archiveGoalListContainer?.addEventListener('click', async (event) => { // async追加
        const button = event.target.closest('.list-item');
        if (button && button.dataset.goalId) {
            selectedArchiveGoalId = button.dataset.goalId;
            archiveDatePageIndex = 0;

             archiveGoalListContainer.querySelectorAll(".list-item").forEach(item => item.classList.remove("selected", "bg-indigo-100"));
             button.classList.add("selected", "bg-indigo-100");

            // ★ ゴールが選択されたら、そのゴールのログを取得
            await fetchLogsForGoal(selectedArchiveGoalId);

            renderArchiveGoalDetails();
            renderArchiveWeeklySummary();
        }
    });

    archiveTaskListContainer?.addEventListener('click', (event) => {
        const button = event.target.closest('.list-item');
         if (button && button.dataset.taskName) {
            selectedArchiveTaskName = button.dataset.taskName;
            selectedArchiveGoalId = null;
            archiveDatePageIndex = 0;
            selectedGoalLogs = []; // クリア

             archiveTaskListContainer.querySelectorAll(".list-item").forEach(item => item.classList.remove("selected", "bg-indigo-100"));
             button.classList.add("selected", "bg-indigo-100");

             if(archiveGoalDetailsContainer) archiveGoalDetailsContainer.classList.add("hidden");
             if(archiveChartContainer) archiveChartContainer.classList.add("hidden");
             if(archiveWeeklySummaryContainer) archiveWeeklySummaryContainer.classList.add("hidden");
             destroyCharts([archiveChartInstance]);
             archiveChartInstance = null;

            renderArchiveGoalList();
         }
    });
}

// ★ 新規: 指定されたゴールIDのログを取得する
async function fetchLogsForGoal(goalId) {
    console.log(`Fetching logs for goal: ${goalId}`);
    try {
        const q = query(
            collection(db, "work_logs"),
            where("goalId", "==", goalId)
        );
        const snapshot = await getDocs(q);
        
        selectedGoalLogs = snapshot.docs.map((d) => {
             const data = d.data();
             const log = { id: d.id, ...data };
             if (log.startTime && log.startTime.toDate) log.startTime = log.startTime.toDate();
             if (log.endTime && log.endTime.toDate) log.endTime = log.endTime.toDate();
             return log;
        });
        console.log(`Fetched ${selectedGoalLogs.length} logs for goal ${goalId}`);

    } catch (error) {
        console.error("Error fetching goal logs:", error);
        selectedGoalLogs = [];
        alert("ログデータの取得中にエラーが発生しました。");
    }
}

// ... renderArchiveTaskList, renderArchiveGoalList ... (これらは変更なし)
function renderArchiveTaskList() {
  if (!archiveTaskListContainer) return;
  archiveTaskListContainer.innerHTML = ""; 

  const tasksWithCompletedGoals = allTaskObjects.filter(
    (task) => task.goals && task.goals.some((g) => g.isComplete)
  );

  tasksWithCompletedGoals.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));

  if (tasksWithCompletedGoals.length === 0) {
    archiveTaskListContainer.innerHTML =
      '<p class="text-gray-500 p-2">完了済みの工数がある業務はありません。</p>';
    if (archiveGoalListContainer) archiveGoalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
    if (archiveGoalDetailsContainer) archiveGoalDetailsContainer.classList.add("hidden");
    if (archiveWeeklySummaryContainer) archiveWeeklySummaryContainer.classList.add("hidden");
    if (archiveChartContainer) archiveChartContainer.classList.add("hidden");
    return;
  }

  tasksWithCompletedGoals.forEach((task) => {
    const button = document.createElement("button");
    button.className = `w-full text-left p-2 rounded-lg list-item hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
      selectedArchiveTaskName === task.name ? "selected bg-indigo-100" : "" 
    }`;
    button.textContent = escapeHtml(task.name);
    button.dataset.taskName = task.name;
    archiveTaskListContainer.appendChild(button);
  });

  if (selectedArchiveTaskName) {
     const taskExists = tasksWithCompletedGoals.some(t => t.name === selectedArchiveTaskName);
     if(taskExists){
         renderArchiveGoalList();
     } else {
       selectedArchiveTaskName = null;
       if (archiveGoalListContainer) archiveGoalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
     }
  } else {
    if (archiveGoalListContainer) archiveGoalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
  }
}

function renderArchiveGoalList() {
  if (!archiveGoalListContainer) return;
  archiveGoalListContainer.innerHTML = ""; 

  const task = allTaskObjects.find((t) => t.name === selectedArchiveTaskName);
  if (!task) {
    archiveGoalListContainer.innerHTML = '<p class="text-gray-500">エラー：選択された業務が見つかりません。</p>';
    return;
  }

  const completedGoals = (task.goals || [])
    .filter((g) => g.isComplete && g.completedAt)
    .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0));

  if (completedGoals.length === 0) {
    archiveGoalListContainer.innerHTML = '<p class="text-gray-500">この業務に完了済みの工数はありません。</p>';
     selectedArchiveGoalId = null;
     if(archiveGoalDetailsContainer) archiveGoalDetailsContainer.classList.add("hidden");
     if(archiveChartContainer) archiveChartContainer.classList.add("hidden");
     if(archiveWeeklySummaryContainer) archiveWeeklySummaryContainer.classList.add("hidden");
     destroyCharts([archiveChartInstance]);
     archiveChartInstance = null;
    return;
  }

  completedGoals.forEach((goal) => {
    const button = document.createElement("button");
    button.className = `w-full text-left p-2 rounded-lg list-item hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
      selectedArchiveGoalId === goal.id ? "selected bg-indigo-100" : "" 
    }`;
    const completedDate = (goal.completedAt instanceof Date && !isNaN(goal.completedAt))
      ? goal.completedAt.toLocaleDateString("ja-JP")
      : "不明";
    button.innerHTML = `
            <div>${escapeHtml(goal.title || '無題')}</div>
            <div class="text-xs text-gray-500">完了日: ${completedDate}</div>
        `;
    button.dataset.goalId = goal.id;
    archiveGoalListContainer.appendChild(button);
  });

   if (selectedArchiveGoalId) {
    const goalExists = completedGoals.some(g => g.id === selectedArchiveGoalId);
    if(goalExists){
        renderArchiveGoalDetails();
        renderArchiveWeeklySummary();
        const selectedButton = archiveGoalListContainer.querySelector(`.list-item[data-goal-id="${selectedArchiveGoalId}"]`);
        if(selectedButton) selectedButton.classList.add('selected', 'bg-indigo-100');
    } else {
        selectedArchiveGoalId = null;
        if(archiveGoalDetailsContainer) archiveGoalDetailsContainer.classList.add("hidden");
        if(archiveWeeklySummaryContainer) archiveWeeklySummaryContainer.classList.add("hidden");
        if(archiveChartContainer) archiveChartContainer.classList.add("hidden");
        destroyCharts([archiveChartInstance]);
        archiveChartInstance = null;
    }
  }
}

function renderArchiveGoalDetails() {
  if (!archiveGoalDetailsContainer) return;
  archiveGoalDetailsContainer.innerHTML = ""; 

  const task = allTaskObjects.find((t) => t.name === selectedArchiveTaskName);
  if (!task || !selectedArchiveGoalId) {
    archiveGoalDetailsContainer.classList.add("hidden");
    return;
  }

  const goal = task.goals.find((g) => g.id === selectedArchiveGoalId);
  if (!goal || !goal.isComplete) {
    archiveGoalDetailsContainer.classList.add("hidden");
    return;
  }

  const completedDate = (goal.completedAt instanceof Date && !isNaN(goal.completedAt))
    ? goal.completedAt.toLocaleString("ja-JP")
    : "不明";

  const readOnlyMode = window.isProgressViewReadOnly === true;
  const buttonsHtml = readOnlyMode ? "" : `
    <div class="flex-shrink-0 ml-4 space-x-2">
        <button class="restore-goal-btn bg-yellow-500 text-white font-bold py-1 px-3 rounded hover:bg-yellow-600 text-sm" data-task-name="${escapeHtml(task.name)}" data-goal-id="${goal.id}">進行中に戻す</button>
        <button class="delete-goal-btn bg-red-500 text-white font-bold py-1 px-3 rounded hover:bg-red-600 text-sm" data-task-name="${escapeHtml(task.name)}" data-goal-id="${goal.id}">完全に削除</button>
    </div>
    `;

  archiveGoalDetailsContainer.innerHTML = `
    <div class="flex justify-between items-start flex-wrap">
        <div class="flex-grow mb-2">
            <h3 class="text-xl font-bold">[${escapeHtml(task.name)}] ${escapeHtml(goal.title || '無題')}</h3>
            <p class="text-sm text-gray-500 mt-1">完了日時: ${completedDate}</p>
            <p class="text-sm text-gray-500 mt-1">納期: ${goal.deadline || "未設定"}</p>
            <p class="text-sm text-gray-500 mt-1">工数納期: ${goal.effortDeadline || "未設定"}</p>
            <p class="text-sm text-gray-600 mt-2 whitespace-pre-wrap">${escapeHtml(goal.memo || "メモはありません")}</p>
        </div>
        ${buttonsHtml}
    </div>
    <div class="mt-4">
        <p class="text-lg text-right font-semibold text-gray-700 mt-1">最終結果: ${goal.current || 0} / ${goal.target || 0}</p>
    </div>
    `;
  archiveGoalDetailsContainer.classList.remove("hidden"); 
}

function renderArchiveWeeklySummary() {
  if (!archiveWeeklySummaryContainer || !archiveChartContainer) return;

  archiveWeeklySummaryContainer.innerHTML = ""; 
  archiveChartContainer.innerHTML = "";     
  destroyCharts([archiveChartInstance]); 
  archiveChartInstance = null;

  // ★ ローカル変数のログを使用する (selectedGoalLogs)
  const relevantLogs = selectedGoalLogs;

  const usersWithContributions = [
    ...new Set(relevantLogs.map((log) => log.userName).filter(Boolean)),
  ].sort((a,b) => a.localeCompare(b, "ja"));

  const allActiveDates = [
    ...new Set(relevantLogs.map((log) => log.date).filter(Boolean)),
  ].sort();

  if (allActiveDates.length === 0) {
    archiveWeeklySummaryContainer.innerHTML = '<p class="text-gray-500 p-4 text-center">この工数に関する稼働記録はありません。</p>';
    archiveWeeklySummaryContainer.classList.remove("hidden");
    archiveChartContainer.classList.add("hidden");
    return;
  }

  const datesPerPage = 7;
  const totalPages = calculateTotalPages(); 

  if (archiveDatePageIndex < 0) archiveDatePageIndex = 0;
  if (archiveDatePageIndex >= totalPages && totalPages > 0) archiveDatePageIndex = totalPages - 1;
  else if (totalPages === 0) archiveDatePageIndex = 0; 

  const startIndex = archiveDatePageIndex * datesPerPage;
  let datesToShow = allActiveDates.slice(startIndex, startIndex + datesPerPage);

  if (datesToShow.length === 0 && allActiveDates.length > 0 && startIndex >= allActiveDates.length) {
     archiveDatePageIndex = Math.max(0, totalPages - 1); 
     const lastPageStartIndex = archiveDatePageIndex * datesPerPage;
     datesToShow = allActiveDates.slice(lastPageStartIndex, lastPageStartIndex + datesPerPage);
  }

  const weeklyData = usersWithContributions.map((userName) => {
    const userData = { name: userName, dailyData: [] };
    datesToShow.forEach((dateStr) => {
      const logsForDay = relevantLogs.filter(
        (log) => log.userName === userName && log.date === dateStr
      );
      const totalDuration = logsForDay
        .filter((l) => l.type !== "goal")
        .reduce((sum, log) => sum + (log.duration || 0), 0);
      const totalContribution = logsForDay
        .filter((l) => l.type === "goal")
        .reduce((sum, log) => sum + (log.contribution || 0), 0);
      const hours = totalDuration / 3600;
      const efficiency =
        hours > 0
          ? parseFloat((totalContribution / hours).toFixed(1))
          : 0;

      userData.dailyData.push({
        contribution: totalContribution,
        duration: totalDuration,
        efficiency: efficiency,
      });
    });
    if(userData.dailyData.some(d => d.contribution > 0 || d.duration > 0)){
        return userData;
    }
    return null; 
  }).filter(Boolean); 


  if(weeklyData.length > 0 || datesToShow.length > 0) { 
       renderArchiveTableNavigation(datesToShow, archiveDatePageIndex + 1, totalPages);

       if (weeklyData.length > 0) {
           archiveChartInstance = renderArchiveChart(archiveChartContainer, datesToShow, weeklyData); 
           renderArchiveTable(archiveWeeklySummaryContainer, datesToShow, weeklyData); 
           archiveChartContainer.classList.remove("hidden");
       } else {
           archiveWeeklySummaryContainer.innerHTML += '<p class="text-gray-500 p-4 text-center">選択された期間に貢献記録はありません。</p>';
           archiveChartContainer.innerHTML = '<p class="text-gray-500 p-4 text-center">選択された期間に貢献記録はありません。</p>'; 
           archiveChartContainer.classList.remove("hidden");
       }
       archiveWeeklySummaryContainer.classList.remove("hidden"); 
  } else {
       archiveWeeklySummaryContainer.innerHTML = '<p class="text-gray-500 p-4 text-center">この工数に関する稼働記録はありません。</p>';
       archiveWeeklySummaryContainer.classList.remove("hidden");
       archiveChartContainer.classList.add("hidden");
  }

}

function calculateTotalPages() {
    // ★ ローカル変数のログを使用
    const relevantLogs = selectedGoalLogs;
    const allActiveDates = [...new Set(relevantLogs.map((log) => log.date).filter(Boolean))];
    const datesPerPage = 7;
    return Math.ceil(allActiveDates.length / datesPerPage);
}

function renderArchiveTableNavigation(datesToShow, currentPage, totalPages) {
    if (!archiveWeeklySummaryContainer) return;

    const startStr = datesToShow[0] || "?";
    const endStr = datesToShow[datesToShow.length - 1] || "?";

    let navHtml = `
     <div class="flex flex-col sm:flex-row justify-between items-center mb-2 gap-2">
         <h4 class="text-lg font-bold text-center sm:text-left">貢献記録 (期間別)</h4>
         <div class="flex items-center justify-center gap-1 flex-wrap">
             <button id="archive-prev-page-btn" class="p-1 md:p-2 rounded-lg hover:bg-gray-200 text-xs md:text-sm ${currentPage <= 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage <= 1 ? 'disabled' : ''} title="前の期間へ">&lt; 前へ</button>
             <span class="text-sm md:text-base font-semibold text-gray-700 whitespace-nowrap">${escapeHtml(startStr)} - ${escapeHtml(endStr)} (${currentPage}/${totalPages})</span>
             <button id="archive-next-page-btn" class="p-1 md:p-2 rounded-lg hover:bg-gray-200 text-xs md:text-sm ${currentPage >= totalPages ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage >= totalPages ? 'disabled' : ''} title="次の期間へ">次へ &gt;</button>
         </div>
     </div>`;
    archiveWeeklySummaryContainer.innerHTML = navHtml; 
}

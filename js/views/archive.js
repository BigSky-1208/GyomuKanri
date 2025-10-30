// js/views/archive.js
import { allTaskObjects, allUserLogs, handleGoBack } from "../main.js"; // Import handleGoBack, removed unused showView, VIEWS
import { formatHoursMinutes, escapeHtml } from "../utils.js"; // Removed unused getJSTDateString, added escapeHtml
// handleGoalDetailClick was likely meant for progress view, removing import
// import { handleGoalDetailClick } from "./progress.js";
// openGoalDetailsModal is not used currently, removing import
// import {
//   openGoalDetailsModal // Importing function to open modal
// } from "../components/modal.js";
// handleRestoreGoalClick and handleDeleteGoal are now handled directly via event delegation below
import { renderArchiveChart, renderArchiveTable, destroyCharts } from "../components/chart.js"; // Assume chart functions exist

// State specific to the archive view
let selectedArchiveTaskName = null;
let selectedArchiveGoalId = null;
let archiveDatePageIndex = 0; // Index for paging through dates in the table
let archiveChartInstance = null; // Store chart instance for destruction

// --- DOM Element References --- (Assuming these exist in index.html)
const archiveTaskListContainer = document.getElementById("archive-task-list");
const archiveGoalListContainer = document.getElementById("archive-goal-list");
const archiveGoalDetailsContainer = document.getElementById("archive-goal-details-container");
const archiveWeeklySummaryContainer = document.getElementById("archive-weekly-summary-container");
const archiveChartContainer = document.getElementById("archive-chart-container");
const archiveBackButton = document.getElementById("back-to-progress-from-archive"); // Assuming back button ID

/**
 * Initializes the Archive View.
 */
export async function initializeArchiveView() {
    // console.log("Initializing Archive View..."); // Removed console.log
    selectedArchiveTaskName = null; // Reset selection on init
    selectedArchiveGoalId = null;
    archiveDatePageIndex = 0;
    renderArchiveTaskList(); // Initial render
    // Clear other sections initially
    if(archiveGoalListContainer) archiveGoalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
    if(archiveGoalDetailsContainer) archiveGoalDetailsContainer.classList.add("hidden");
    if(archiveChartContainer) archiveChartContainer.classList.add("hidden");
    if(archiveWeeklySummaryContainer) archiveWeeklySummaryContainer.classList.add("hidden");
     destroyCharts([archiveChartInstance]); // Destroy previous chart if exists
     archiveChartInstance = null;
}

/**
 * Sets up event listeners for the Archive View.
 */
export function setupArchiveEventListeners() {
    // console.log("Setting up Archive View event listeners..."); // Removed console.log
    archiveBackButton?.addEventListener('click', handleGoBack); // Use global go back

    // Event delegation for table navigation buttons
    archiveWeeklySummaryContainer?.addEventListener('click', (event) => {
        if (event.target.id === 'archive-prev-page-btn') {
            if (archiveDatePageIndex > 0) {
                archiveDatePageIndex--;
                renderArchiveWeeklySummary();
            }
        } else if (event.target.id === 'archive-next-page-btn') {
            // Need totalPages to prevent going too far
            const totalPages = calculateTotalPages(); // Helper function needed
            if (archiveDatePageIndex < totalPages - 1) {
                archiveDatePageIndex++;
                renderArchiveWeeklySummary();
            }
        }
    });

     // Event delegation for details/restore/delete buttons added dynamically
     archiveGoalDetailsContainer?.addEventListener('click', async (event) => {
        const target = event.target;
        const taskName = target.dataset.taskName;
        const goalId = target.dataset.goalId;

        if (!taskName || !goalId) return;

        if (target.classList.contains('restore-goal-btn')) {
            // Dynamically import modal functions when needed
            // NOTE: Dynamic import might have issues in older environments or bundlers
            // Consider static import in modal.js if problems arise.
            const { handleRestoreGoalClick } = await import('../components/modal.js');
            handleRestoreGoalClick(taskName, goalId);
        } else if (target.classList.contains('delete-goal-btn')) {
            // Dynamically import modal functions when needed
            const { handleDeleteGoal } = await import('../components/modal.js');
            handleDeleteGoal(taskName, goalId);
        }
     });

    // Handle clicks on goal list items
    archiveGoalListContainer?.addEventListener('click', (event) => {
        const button = event.target.closest('.list-item');
        if (button && button.dataset.goalId) {
            selectedArchiveGoalId = button.dataset.goalId;
            archiveDatePageIndex = 0; // Reset page index

             // Update selection highlight
             archiveGoalListContainer.querySelectorAll(".list-item").forEach(item => item.classList.remove("selected", "bg-indigo-100"));
             button.classList.add("selected", "bg-indigo-100");

            renderArchiveGoalDetails();
            renderArchiveWeeklySummary();
        }
    });

    // Handle clicks on task list items
    archiveTaskListContainer?.addEventListener('click', (event) => {
        const button = event.target.closest('.list-item');
         if (button && button.dataset.taskName) {
            selectedArchiveTaskName = button.dataset.taskName;
            selectedArchiveGoalId = null; // Reset goal selection
            archiveDatePageIndex = 0; // Reset page index

             // Update selection highlight
             archiveTaskListContainer.querySelectorAll(".list-item").forEach(item => item.classList.remove("selected", "bg-indigo-100"));
             button.classList.add("selected", "bg-indigo-100");

             // Clear details and summaries
             if(archiveGoalDetailsContainer) archiveGoalDetailsContainer.classList.add("hidden");
             if(archiveChartContainer) archiveChartContainer.classList.add("hidden");
             if(archiveWeeklySummaryContainer) archiveWeeklySummaryContainer.classList.add("hidden");
             destroyCharts([archiveChartInstance]);
             archiveChartInstance = null;

            renderArchiveGoalList(); // Render goals for the selected task
         }
    });

}

// Function to render the list of tasks with completed goals
function renderArchiveTaskList() {
  if (!archiveTaskListContainer) return;
  archiveTaskListContainer.innerHTML = ""; // Clear previous list

  // Filter tasks that have at least one completed goal
  const tasksWithCompletedGoals = allTaskObjects.filter(
    (task) => task.goals && task.goals.some((g) => g.isComplete)
  );

  // Sort tasks alphabetically (Japanese locale)
  tasksWithCompletedGoals.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));

  if (tasksWithCompletedGoals.length === 0) {
    archiveTaskListContainer.innerHTML =
      '<p class="text-gray-500 p-2">完了済みの工数がある業務はありません。</p>';
    // Clear subsequent lists/details if no tasks are available
    if (archiveGoalListContainer) archiveGoalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
    if (archiveGoalDetailsContainer) archiveGoalDetailsContainer.classList.add("hidden");
    if (archiveWeeklySummaryContainer) archiveWeeklySummaryContainer.classList.add("hidden");
    if (archiveChartContainer) archiveChartContainer.classList.add("hidden");
    return;
  }

  // Render the list of tasks with completed goals
  tasksWithCompletedGoals.forEach((task) => {
    const button = document.createElement("button");
    button.className = `w-full text-left p-2 rounded-lg list-item hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
      selectedArchiveTaskName === task.name ? "selected bg-indigo-100" : "" // Apply selected class
    }`;
    button.textContent = escapeHtml(task.name); // Escape name
    button.dataset.taskName = task.name;
    archiveTaskListContainer.appendChild(button);
  });

  // If a task was previously selected, re-render its goal list
  if (selectedArchiveTaskName) {
     const taskExists = tasksWithCompletedGoals.some(t => t.name === selectedArchiveTaskName);
     if(taskExists){
         renderArchiveGoalList();
     } else {
       // If selected task no longer has completed goals, clear selection
       selectedArchiveTaskName = null;
       if (archiveGoalListContainer) archiveGoalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
     }
  } else {
    // If no task is selected (initial load or after clearing), show placeholder
    if (archiveGoalListContainer) archiveGoalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
  }
}

// Function to render the list of completed goals for the selected task
function renderArchiveGoalList() {
  if (!archiveGoalListContainer) return;
  archiveGoalListContainer.innerHTML = ""; // Clear previous list

  const task = allTaskObjects.find((t) => t.name === selectedArchiveTaskName);
  if (!task) {
    archiveGoalListContainer.innerHTML = '<p class="text-gray-500">エラー：選択された業務が見つかりません。</p>';
    return;
  }

  // Filter and sort completed goals by completion date (newest first)
  const completedGoals = (task.goals || [])
    .filter((g) => g.isComplete && g.completedAt) // Ensure completedAt exists
    .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0)); // Use getTime for Date objects

  if (completedGoals.length === 0) {
    archiveGoalListContainer.innerHTML = '<p class="text-gray-500">この業務に完了済みの工数はありません。</p>';
     // Clear subsequent selections if no goals are available
     selectedArchiveGoalId = null;
     if(archiveGoalDetailsContainer) archiveGoalDetailsContainer.classList.add("hidden");
     if(archiveChartContainer) archiveChartContainer.classList.add("hidden");
     if(archiveWeeklySummaryContainer) archiveWeeklySummaryContainer.classList.add("hidden");
     destroyCharts([archiveChartInstance]);
     archiveChartInstance = null;
    return;
  }

  // Render the list of completed goals
  completedGoals.forEach((goal) => {
    const button = document.createElement("button");
    button.className = `w-full text-left p-2 rounded-lg list-item hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
      selectedArchiveGoalId === goal.id ? "selected bg-indigo-100" : "" // Apply selected class
    }`;
    // Ensure completedAt is a Date object before calling toLocaleDateString
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

   // If a goal was previously selected, re-render its details and summary
   if (selectedArchiveGoalId) {
    // Check if the previously selected goal still exists in the list
    const goalExists = completedGoals.some(g => g.id === selectedArchiveGoalId);
    if(goalExists){
        renderArchiveGoalDetails();
        renderArchiveWeeklySummary();
        // Re-apply selected class
        const selectedButton = archiveGoalListContainer.querySelector(`.list-item[data-goal-id="${selectedArchiveGoalId}"]`);
        if(selectedButton) selectedButton.classList.add('selected', 'bg-indigo-100');
    } else {
        // If the goal no longer exists (e.g., restored), clear selection
        selectedArchiveGoalId = null;
        if(archiveGoalDetailsContainer) archiveGoalDetailsContainer.classList.add("hidden");
        if(archiveWeeklySummaryContainer) archiveWeeklySummaryContainer.classList.add("hidden");
        if(archiveChartContainer) archiveChartContainer.classList.add("hidden");
        destroyCharts([archiveChartInstance]);
        archiveChartInstance = null;
    }
  }
}

// Function to render the details of the selected completed goal
function renderArchiveGoalDetails() {
  if (!archiveGoalDetailsContainer) return;
  archiveGoalDetailsContainer.innerHTML = ""; // Clear previous details

  const task = allTaskObjects.find((t) => t.name === selectedArchiveTaskName);
  if (!task || !selectedArchiveGoalId) {
    archiveGoalDetailsContainer.classList.add("hidden");
    return;
  }

  const goal = task.goals.find((g) => g.id === selectedArchiveGoalId);
  if (!goal || !goal.isComplete) {
    // Ensure the goal exists and is indeed complete
    archiveGoalDetailsContainer.classList.add("hidden");
    return;
  }

  // Ensure completedAt is a Date object
  const completedDate = (goal.completedAt instanceof Date && !isNaN(goal.completedAt))
    ? goal.completedAt.toLocaleString("ja-JP")
    : "不明";

  // Buttons for restoring or permanently deleting the goal
  // Access global state - consider passing if refactoring
  const readOnlyMode = window.isProgressViewReadOnly === true; // Assuming this global flag exists
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
  archiveGoalDetailsContainer.classList.remove("hidden"); // Show the details container

}

// Function to render the weekly summary table and chart for the selected completed goal
function renderArchiveWeeklySummary() {

  if (!archiveWeeklySummaryContainer || !archiveChartContainer) return;

  archiveWeeklySummaryContainer.innerHTML = ""; // クリア
  archiveChartContainer.innerHTML = "";     // クリア
  destroyCharts([archiveChartInstance]); // 前のチャートを破棄
  archiveChartInstance = null;

  const task = allTaskObjects.find((t) => t.name === selectedArchiveTaskName);
  if (!task || !selectedArchiveGoalId) {
    archiveWeeklySummaryContainer.classList.add("hidden");
    archiveChartContainer.classList.add("hidden");
    return;
  }
  const goal = task.goals.find((g) => g.id === selectedArchiveGoalId);
  if (!goal) {
    archiveWeeklySummaryContainer.classList.add("hidden");
    archiveChartContainer.classList.add("hidden");
    return;
  }

  // このゴールに関連するログを抽出
  const relevantLogs = allUserLogs.filter((log) => log.goalId === goal.id);

  // 貢献があったユーザー名（重複除去）
  const usersWithContributions = [
    ...new Set(relevantLogs.map((log) => log.userName).filter(Boolean)), // undefined/null を除外
  ].sort((a,b) => a.localeCompare(b, "ja"));

  // 稼働があった日付を一意に取得し、昇順でソート
  const allActiveDates = [
    ...new Set(relevantLogs.map((log) => log.date).filter(Boolean)), // undefined/null を除外
  ].sort();

  if (allActiveDates.length === 0) {
    archiveWeeklySummaryContainer.innerHTML = '<p class="text-gray-500 p-4 text-center">この工数に関する稼働記録はありません。</p>';
    archiveWeeklySummaryContainer.classList.remove("hidden");
    archiveChartContainer.classList.add("hidden");
    return;
  }

  // 日付をページング（1ページあたり7日）
  const datesPerPage = 7;
  const totalPages = calculateTotalPages(); // Use helper

  // Ensure page index is within valid bounds
  if (archiveDatePageIndex < 0) archiveDatePageIndex = 0;
  if (archiveDatePageIndex >= totalPages && totalPages > 0) archiveDatePageIndex = totalPages - 1;
  else if (totalPages === 0) archiveDatePageIndex = 0; // Handle no dates case

  const startIndex = archiveDatePageIndex * datesPerPage;
  let datesToShow = allActiveDates.slice(startIndex, startIndex + datesPerPage);

  // If slicing resulted in empty array but should have data (e.g., index was out of bounds)
  if (datesToShow.length === 0 && allActiveDates.length > 0 && startIndex >= allActiveDates.length) {
     archiveDatePageIndex = Math.max(0, totalPages - 1); // Go to last page
     const lastPageStartIndex = archiveDatePageIndex * datesPerPage;
     datesToShow = allActiveDates.slice(lastPageStartIndex, lastPageStartIndex + datesPerPage);
  }

  // Prepare data structure for chart and table
  const weeklyData = usersWithContributions.map((userName) => {
    const userData = { name: userName, dailyData: [] };
    datesToShow.forEach((dateStr) => {
      const logsForDay = relevantLogs.filter(
        (log) => log.userName === userName && log.date === dateStr
      );
      // Sum duration (excluding goal contribution logs)
      const totalDuration = logsForDay
        .filter((l) => l.type !== "goal")
        .reduce((sum, log) => sum + (log.duration || 0), 0);
      // Sum contribution (only goal contribution logs)
      const totalContribution = logsForDay
        .filter((l) => l.type === "goal")
        .reduce((sum, log) => sum + (log.contribution || 0), 0);
      // Calculate efficiency (contribution per hour)
      const hours = totalDuration / 3600;
      const efficiency =
        hours > 0
          ? parseFloat((totalContribution / hours).toFixed(1)) // Keep one decimal place
          : 0;

      userData.dailyData.push({
        contribution: totalContribution,
        duration: totalDuration,
        efficiency: efficiency,
      });
    });
    // Only include users who had activity on the *displayed dates*
    if(userData.dailyData.some(d => d.contribution > 0 || d.duration > 0)){
        return userData;
    }
    return null; // Return null if no activity in this period
  }).filter(Boolean); // Filter out the null entries


  // Render the line chart and the summary table if there's data for the period
  if(weeklyData.length > 0 || datesToShow.length > 0) { // Show nav even if no user data for the week
       // Render Navigation first
       renderArchiveTableNavigation(datesToShow, archiveDatePageIndex + 1, totalPages);

       if (weeklyData.length > 0) {
           // Render chart and table only if there is user data
           archiveChartInstance = renderArchiveChart(archiveChartContainer, datesToShow, weeklyData); // Store instance
           renderArchiveTable(archiveWeeklySummaryContainer, datesToShow, weeklyData); // Appends table to existing nav
           archiveChartContainer.classList.remove("hidden");
       } else {
           // If no user data for this specific week, show message in table area
           archiveWeeklySummaryContainer.innerHTML += '<p class="text-gray-500 p-4 text-center">選択された期間に貢献記録はありません。</p>';
           archiveChartContainer.innerHTML = '<p class="text-gray-500 p-4 text-center">選択された期間に貢献記録はありません。</p>'; // Also show message in chart area
           archiveChartContainer.classList.remove("hidden");
       }
       archiveWeeklySummaryContainer.classList.remove("hidden"); // Show container (nav + table/message)
  } else {
       // Should be covered by the allActiveDates.length === 0 check earlier
       archiveWeeklySummaryContainer.innerHTML = '<p class="text-gray-500 p-4 text-center">この工数に関する稼働記録はありません。</p>';
       archiveWeeklySummaryContainer.classList.remove("hidden");
       archiveChartContainer.classList.add("hidden");
  }

}

/** Helper function to calculate total pages needed for pagination */
function calculateTotalPages() {
    const task = allTaskObjects.find((t) => t.name === selectedArchiveTaskName);
    const goal = task?.goals.find((g) => g.id === selectedArchiveGoalId);
    if (!goal) return 0;

    const relevantLogs = allUserLogs.filter((log) => log.goalId === goal.id);
    const allActiveDates = [...new Set(relevantLogs.map((log) => log.date).filter(Boolean))];
    const datesPerPage = 7;
    return Math.ceil(allActiveDates.length / datesPerPage);
}


/** Renders the navigation buttons for the archive table */
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
    archiveWeeklySummaryContainer.innerHTML = navHtml; // Overwrite container with navigation
}

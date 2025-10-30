// js/views/archive.js
import { allTaskObjects, allUserLogs, handleGoBack, showView, VIEWS } from "../../main.js"; // Import necessary state and functions, including handleGoBack, showView, VIEWS
// import { formatHoursMinutes } from "../utils.js"; // Import utility functions - formatHoursMinutes IS used
// import { handleGoalDetailClick } from "./progress.js"; // Import shared function if needed - Seems unused, commenting out
// Import specific handlers for restore/delete actions
import { showConfirmationModal, hideConfirmationModal /* openGoalDetailsModal */ } from "../components/modal.js"; // Import modal functions
// Import functions to handle actual restore/delete logic from where they are defined (e.g., taskSettings.js)
import { handleRestoreGoal, handleDeleteGoalCompletely } from "./taskSettings.js"; // Assuming restore/delete logic resides here
// Import chart/table functions
import { createLineChart, destroyCharts } from "../components/chart.js"; // Import chart functions
import { getJSTDateString, formatHoursMinutes, escapeHtml } from "../utils.js"; // Import necessary utils


// State specific to the archive view
let selectedArchiveTaskName = null;
let selectedArchiveGoalId = null;
let archiveDatePageIndex = 0; // Index for paging through dates in the table
let archiveChartInstance = null; // Store chart instance

// Function to initialize the archive view
export function initializeArchiveView() {
  console.log("Initializing Archive View...");
  // Reset selections when initializing the view? Or persist them? Let's reset for now.
  // selectedArchiveTaskName = null;
  // selectedArchiveGoalId = null;
  // archiveDatePageIndex = 0; // Keep page index? Let's reset.
  archiveDatePageIndex = 0;

  renderArchiveTaskList(); // Render the initial task list

  // If a task/goal was previously selected, re-render the necessary parts
   if (selectedArchiveTaskName) {
       renderArchiveGoalList();
       if (selectedArchiveGoalId) {
           renderArchiveGoalDetails();
           renderArchiveWeeklySummary();
       } else {
           // Clear goal-specific sections if only task was selected
           const goalListContainer = document.getElementById("archive-goal-list");
           const detailsContainer = document.getElementById("archive-goal-details-container");
           const weeklyContainer = document.getElementById("archive-weekly-summary-container");
           const chartContainer = document.getElementById("archive-chart-container");
           if(goalListContainer) goalListContainer.innerHTML = '<p class="text-gray-500">完了済み工数を選択</p>'; // Reset goal list placeholder
           if(detailsContainer) detailsContainer.classList.add("hidden");
           if(weeklyContainer) weeklyContainer.classList.add("hidden");
           if(chartContainer) chartContainer.classList.add("hidden");
           destroyCharts([archiveChartInstance]); // Destroy chart if goal deselected
           archiveChartInstance = null;
       }
   } else {
        // Clear everything if no task selected
       const goalListContainer = document.getElementById("archive-goal-list");
       const detailsContainer = document.getElementById("archive-goal-details-container");
       const weeklyContainer = document.getElementById("archive-weekly-summary-container");
       const chartContainer = document.getElementById("archive-chart-container");
       if(goalListContainer) goalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
       if(detailsContainer) detailsContainer.classList.add("hidden");
       if(weeklyContainer) weeklyContainer.classList.add("hidden");
       if(chartContainer) chartContainer.classList.add("hidden");
       destroyCharts([archiveChartInstance]); // Ensure chart is destroyed
       archiveChartInstance = null;
   }

}

/**
 * Sets up event listeners for the Archive View.
 */
export function setupArchiveEventListeners() {
    console.log("Setting up Archive View event listeners...");
    const backButton = document.getElementById("back-to-progress-from-archive");
    backButton?.addEventListener("click", handleGoBack); // Use global go back

     // Event delegation for dynamically added buttons (restore, delete)
     const detailsContainer = document.getElementById("archive-goal-details-container");
     detailsContainer?.addEventListener('click', (event) => {
         const target = event.target;
         const taskName = target.dataset.taskName;
         const goalId = target.dataset.goalId;

         if (target.classList.contains('restore-goal-btn') && taskName && goalId) {
             handleRestoreGoalClick(taskName, goalId); // Call restore handler
         } else if (target.classList.contains('delete-goal-btn') && taskName && goalId) {
             handleDeleteGoalClick(taskName, goalId); // Call delete handler
         }
     });

     // Event delegation for weekly summary navigation (using page index now)
     const weeklyContainer = document.getElementById("archive-weekly-summary-container");
     weeklyContainer?.addEventListener('click', (event) => {
        const target = event.target;
        if (target.id === 'archive-prev-page-btn') {
            if (archiveDatePageIndex > 0) {
                archiveDatePageIndex--;
                renderArchiveWeeklySummary();
            }
        } else if (target.id === 'archive-next-page-btn') {
            // Need total pages to check boundary, calculate within render or pass it
            // For now, increment and let render function handle boundary
            archiveDatePageIndex++;
            renderArchiveWeeklySummary(); // Re-render with new page index
        }
     });


    console.log("Archive View event listeners set up complete.");
}


// Function to render the list of tasks with completed goals
function renderArchiveTaskList() {
  const taskListContainer = document.getElementById("archive-task-list");
  if (!taskListContainer) return;
  taskListContainer.innerHTML = ""; // Clear previous list

  // Filter tasks that have at least one completed goal
  const tasksWithCompletedGoals = allTaskObjects.filter(
    (task) => task.goals && task.goals.some((g) => g.isComplete)
  );

  // Sort tasks alphabetically (Japanese locale)
  tasksWithCompletedGoals.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));

  if (tasksWithCompletedGoals.length === 0) {
    taskListContainer.innerHTML =
      '<p class="text-gray-500 p-2">完了済みの工数がある業務はありません。</p>';
    // Clear subsequent lists/details if no tasks are available
    selectedArchiveTaskName = null; // Clear selection
    selectedArchiveGoalId = null;
    const goalListContainer = document.getElementById("archive-goal-list");
    const detailsContainer = document.getElementById("archive-goal-details-container");
    const weeklyContainer = document.getElementById("archive-weekly-summary-container");
    const chartContainer = document.getElementById("archive-chart-container");
    if(goalListContainer) goalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
    if(detailsContainer) detailsContainer.classList.add("hidden");
    if(weeklyContainer) weeklyContainer.classList.add("hidden");
    if(chartContainer) chartContainer.classList.add("hidden");
    destroyCharts([archiveChartInstance]);
    archiveChartInstance = null;
    return;
  }

  // Render the list of tasks with completed goals
  tasksWithCompletedGoals.forEach((task) => {
    const button = document.createElement("button");
    // Apply selected class if this task matches the stored state
    button.className = `w-full text-left p-2 rounded-lg list-item hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
      selectedArchiveTaskName === task.name ? "selected bg-indigo-100" : ""
    }`;
    button.textContent = task.name;
    button.dataset.taskName = task.name;

    // Event listener for selecting a task
    button.onclick = () => {
      selectedArchiveTaskName = task.name;
      selectedArchiveGoalId = null; // Reset goal selection when task changes
      archiveDatePageIndex = 0; // Reset date page index

      // Clear details and summaries before rendering new goal list
      const detailsContainer = document.getElementById("archive-goal-details-container");
      const weeklyContainer = document.getElementById("archive-weekly-summary-container");
      const chartContainer = document.getElementById("archive-chart-container");
      if(detailsContainer) detailsContainer.classList.add("hidden");
      if(weeklyContainer) weeklyContainer.classList.add("hidden");
      if(chartContainer) chartContainer.classList.add("hidden");
      destroyCharts([archiveChartInstance]); // Destroy chart when task changes
      archiveChartInstance = null;

      renderArchiveGoalList(); // Render the list of completed goals for the selected task

      // Update selection highlight in the task list
      taskListContainer
        .querySelectorAll(".list-item")
        .forEach((item) => item.classList.remove("selected", "bg-indigo-100"));
      button.classList.add("selected", "bg-indigo-100");
    };
    taskListContainer.appendChild(button);
  });
}

// Function to render the list of completed goals for the selected task
function renderArchiveGoalList() {
  const goalListContainer = document.getElementById("archive-goal-list");
  if (!goalListContainer || !selectedArchiveTaskName) {
      if(goalListContainer) goalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
      return;
  }
  goalListContainer.innerHTML = ""; // Clear previous list

  const task = allTaskObjects.find((t) => t.name === selectedArchiveTaskName);
  if (!task || !task.goals) {
    goalListContainer.innerHTML =
      '<p class="text-gray-500">エラー：選択された業務が見つかりません。</p>';
    return;
  }

  // Filter and sort completed goals by completion date (newest first)
  const completedGoals = (task.goals || [])
    .filter((g) => g.isComplete && g.completedAt) // Ensure completedAt exists (should be Date object from main.js)
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime()); // Use getTime() for Date objects


  if (completedGoals.length === 0) {
    goalListContainer.innerHTML =
      '<p class="text-gray-500">この業務に完了済みの工数はありません。</p>';
      // Clear subsequent selections
      selectedArchiveGoalId = null;
      const detailsContainer = document.getElementById("archive-goal-details-container");
      const weeklyContainer = document.getElementById("archive-weekly-summary-container");
      const chartContainer = document.getElementById("archive-chart-container");
      if(detailsContainer) detailsContainer.classList.add("hidden");
      if(weeklyContainer) weeklyContainer.classList.add("hidden");
      if(chartContainer) chartContainer.classList.add("hidden");
      destroyCharts([archiveChartInstance]);
      archiveChartInstance = null;
    return;
  }

  // Render the list of completed goals
  completedGoals.forEach((goal) => {
    const button = document.createElement("button");
    // Apply selected class if this goal matches the stored state
    button.className = `w-full text-left p-2 rounded-lg list-item hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
      selectedArchiveGoalId === goal.id ? "selected bg-indigo-100" : ""
    }`;
    // Use Date object's methods for formatting
    const completedDate = goal.completedAt instanceof Date
      ? goal.completedAt.toLocaleDateString("ja-JP")
      : "不明";
    button.innerHTML = `
            <div>${escapeHtml(goal.title)}</div>
            <div class="text-xs text-gray-500">完了日: ${completedDate}</div>
        `;
    button.dataset.goalId = goal.id;

    // Event listener for selecting a goal
    button.onclick = () => {
      selectedArchiveGoalId = goal.id;
      archiveDatePageIndex = 0; // Reset date page index when goal changes

      renderArchiveGoalDetails(); // Show details for the selected goal
      renderArchiveWeeklySummary(); // Show summary table/chart for the selected goal

      // Update selection highlight in the goal list
      goalListContainer
        .querySelectorAll(".list-item")
        .forEach((item) => item.classList.remove("selected", "bg-indigo-100"));
      button.classList.add("selected", "bg-indigo-100");
    };
    goalListContainer.appendChild(button);
  });

}

// Function to render the details of the selected completed goal
function renderArchiveGoalDetails() {
  const container = document.getElementById(
    "archive-goal-details-container"
  );
  if (!container || !selectedArchiveTaskName || !selectedArchiveGoalId) {
      if(container) container.classList.add("hidden");
      return;
  }
  container.innerHTML = ""; // Clear previous details

  const task = allTaskObjects.find((t) => t.name === selectedArchiveTaskName);
  if (!task || !task.goals) {
    container.classList.add("hidden");
    return;
  }

  const goal = task.goals.find((g) => g.id === selectedArchiveGoalId);
  if (!goal || !goal.isComplete) {
    // Ensure the goal exists and is indeed complete
    container.classList.add("hidden");
    // If goal somehow became incomplete, reset selection and UI
    if (goal && !goal.isComplete) {
        selectedArchiveGoalId = null;
        renderArchiveGoalList(); // Re-render goal list
        const weeklyContainer = document.getElementById("archive-weekly-summary-container");
        const chartContainer = document.getElementById("archive-chart-container");
        if(weeklyContainer) weeklyContainer.classList.add("hidden");
        if(chartContainer) chartContainer.classList.add("hidden");
        destroyCharts([archiveChartInstance]);
        archiveChartInstance = null;
    }
    return;
  }

  const completedDate = goal.completedAt instanceof Date
    ? goal.completedAt.toLocaleString("ja-JP") // Include time potentially
    : "不明";

  // Buttons for restoring or permanently deleting the goal
  const buttonsHtml = `
    <div class="flex-shrink-0 ml-4 space-x-2">
        <button class="restore-goal-btn bg-yellow-500 text-white font-bold py-1 px-3 rounded hover:bg-yellow-600 text-sm" data-task-name="${escapeHtml(task.name)}" data-goal-id="${goal.id}">進行中に戻す</button>
        <button class="delete-goal-btn bg-red-500 text-white font-bold py-1 px-3 rounded hover:bg-red-600 text-sm" data-task-name="${escapeHtml(task.name)}" data-goal-id="${goal.id}">完全に削除</button>
    </div>
    `;

  container.innerHTML = `
    <div class="flex justify-between items-start flex-wrap">
        <div class="flex-grow mb-2">
            <h3 class="text-xl font-bold">[${escapeHtml(task.name)}] ${escapeHtml(goal.title)}</h3>
            <p class="text-sm text-gray-500 mt-1">完了日時: ${completedDate}</p>
            <p class="text-sm text-gray-600 mt-2 whitespace-pre-wrap">${
              escapeHtml(goal.memo || "メモはありません")
            }</p>
        </div>
        ${buttonsHtml}
    </div>
    <div class="mt-4">
        <p class="text-lg text-right font-semibold text-gray-700 mt-1">最終結果: ${
          goal.current || 0
        } / ${goal.target || 0}</p>
    </div>
    `;
  container.classList.remove("hidden"); // Show the details container
  // Event listeners for buttons are added via delegation in setupArchiveEventListeners
}

// Function to render the weekly summary table and chart for the selected completed goal
function renderArchiveWeeklySummary() {
  const weeklyContainer = document.getElementById(
    "archive-weekly-summary-container"
  );
  const chartContainer = document.getElementById("archive-chart-container");

  if (!weeklyContainer || !chartContainer || !selectedArchiveTaskName || !selectedArchiveGoalId) {
      if(weeklyContainer) weeklyContainer.classList.add("hidden");
      if(chartContainer) chartContainer.classList.add("hidden");
      destroyCharts([archiveChartInstance]);
      archiveChartInstance = null;
      return;
  }

  weeklyContainer.innerHTML = ""; // Clear previous content
  chartContainer.innerHTML = "";   // Clear previous content
  // Destroy previous chart
  destroyCharts([archiveChartInstance]);
  archiveChartInstance = null;


  const task = allTaskObjects.find((t) => t.name === selectedArchiveTaskName);
  if (!task || !task.goals) {
    weeklyContainer.classList.add("hidden");
    chartContainer.classList.add("hidden");
    return;
  }
  const goal = task.goals.find((g) => g.id === selectedArchiveGoalId);
  if (!goal) {
    weeklyContainer.classList.add("hidden");
    chartContainer.classList.add("hidden");
    return;
  }

  // Filter logs relevant to this specific goal
  const relevantLogs = allUserLogs.filter((log) => log.goalId === goal.id);

  // Get unique user names who contributed to this goal, sorted
  const usersWithContributions = [
    ...new Set(relevantLogs.map((log) => log.userName).filter(Boolean)),
  ].sort((a,b) => a.localeCompare(b, "ja"));

  // Get all unique dates where work or contribution happened for this goal, sorted chronologically
  const allActiveDates = [
    ...new Set(relevantLogs.map((log) => log.date).filter(Boolean)),
  ].sort();

  if (allActiveDates.length === 0) {
    weeklyContainer.innerHTML = '<p class="text-gray-500 p-4 text-center">この工数に関する稼働記録はありません。</p>';
    weeklyContainer.classList.remove("hidden"); // Changed from add to remove to show the message
    chartContainer.classList.add("hidden");
    return;
  }

  // Paginate the dates (7 dates per page)
  const datesPerPage = 7;
  const totalPages = Math.ceil(allActiveDates.length / datesPerPage);

  // Ensure page index is within bounds
  if (archiveDatePageIndex < 0) {
      archiveDatePageIndex = 0;
  } else if (archiveDatePageIndex >= totalPages && totalPages > 0) {
      archiveDatePageIndex = totalPages - 1;
  } else if (totalPages === 0) {
       archiveDatePageIndex = 0; // Handle case with no dates
  }

  const finalStartIndex = archiveDatePageIndex * datesPerPage;
  // Use let instead of const for datesToShow to allow reassignment
  let datesToShow = allActiveDates.slice(
    finalStartIndex,
    finalStartIndex + datesPerPage
  );


  if (datesToShow.length === 0 && allActiveDates.length > 0) {
     // This case should ideally not happen with the boundary checks above, but as fallback:
     weeklyContainer.innerHTML = '<p class="text-gray-500 p-4 text-center">表示する日付が見つかりません。</p>';
     weeklyContainer.classList.remove("hidden"); // Show the container with message
     chartContainer.classList.add("hidden");
     return;
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
    // Only include users if they had activity in the displayed dates
    if (userData.dailyData.some(d => d.contribution > 0 || d.duration > 0)) {
        return userData;
    }
    return null; // Return null for users with no activity in this period
  }).filter(Boolean); // Filter out the null entries


  // Render the line chart and the summary table
  renderArchiveChart(chartContainer, datesToShow, weeklyData); // Pass filtered weeklyData
  renderArchiveTable(
    weeklyContainer,
    datesToShow,
    weeklyData, // Pass filtered weeklyData
    archiveDatePageIndex + 1, // Current page number (1-based)
    totalPages
  );
  chartContainer.classList.remove("hidden");
  weeklyContainer.classList.remove("hidden");
}


// --- Functions specific to Archive View (Chart and Table Rendering) ---

/**
 * Renders the line chart for archive data (contribution).
 * @param {HTMLElement} container - The container element for the chart.
 * @param {string[]} datesToShow - Array of date strings for the x-axis.
 * @param {Array} weeklyData - Array of user data for the week.
 */
function renderArchiveChart(container, datesToShow, weeklyData) {
     if (!container) return;
     container.innerHTML = ""; // Clear previous content

     if (weeklyData.length === 0 || datesToShow.length === 0) {
         container.innerHTML = '<p class="text-gray-500 text-center p-4">グラフデータがありません。</p>';
         return;
     }

     const canvas = document.createElement("canvas");
     canvas.style.minHeight = '250px';
     container.appendChild(canvas);

     const labels = datesToShow.map((dateStr) => {
         try {
             const date = new Date(dateStr + 'T00:00:00');
             return `${date.getMonth() + 1}/${date.getDate()}`;
         } catch(e) { return dateStr; }
     });

     const datasets = weeklyData.map((userData, index) => {
         const hue = (index * 137.508) % 360;
         const color = `hsl(${hue}, 70%, 50%)`;
         return {
             label: userData.name,
             data: userData.dailyData.map((d) => d.contribution), // Show contribution
             borderColor: color,
             backgroundColor: color + '33',
             fill: false,
             tension: 0.1,
             borderWidth: 2,
             pointRadius: 3,
             pointHoverRadius: 5
         };
     });

     const ctx = canvas.getContext("2d");
     archiveChartInstance = createLineChart( // Use imported function
         ctx,
         labels,
         datasets,
         "日別 貢献件数",
         "合計件数"
     );
}

/**
 * Renders the data table for archive data.
 * @param {HTMLElement} container - The container element for the table and navigation.
 * @param {string[]} datesToShow - Array of date strings for table columns.
 * @param {Array} weeklyData - Array of user data for the week.
 * @param {number} currentPage - Current page number (1-based).
 * @param {number} totalPages - Total number of pages.
 */
function renderArchiveTable(container, datesToShow, weeklyData, currentPage, totalPages) {
     if (!container) return;
     container.innerHTML = ""; // Clear previous content

     // --- Navigation ---
     let navHtml = `
     <div class="flex justify-between items-center mb-2">
         <h4 class="text-lg font-bold">稼働サマリー</h4>
         <div class="flex items-center gap-2">
             <button id="archive-prev-page-btn" class="p-2 rounded-lg hover:bg-gray-200 ${currentPage <= 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage <= 1 ? 'disabled' : ''}>&lt;</button>
             <span class="text-sm font-semibold">ページ ${currentPage} / ${totalPages > 0 ? totalPages : 1}</span>
             <button id="archive-next-page-btn" class="p-2 rounded-lg hover:bg-gray-200 ${currentPage >= totalPages ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage >= totalPages ? 'disabled' : ''}>&gt;</button>
         </div>
     </div>`;
     container.innerHTML = navHtml;

     // --- Table ---
     if (weeklyData.length === 0 || datesToShow.length === 0) {
         container.innerHTML += '<p class="text-gray-500 p-4 text-center mt-4">この期間の記録はありません。</p>';
         return;
     }

     let tableHtml = '<div class="overflow-x-auto mt-4"><table class="w-full text-sm text-left text-gray-500">';
     // Header
     tableHtml += '<thead class="text-xs text-gray-700 uppercase bg-gray-50"><tr><th scope="col" class="px-3 py-3 sticky left-0 bg-gray-50 z-10">名前</th>';
     datesToShow.forEach((dateStr) => {
         const date = new Date(dateStr + 'T00:00:00');
         tableHtml += `<th scope="col" class="px-3 py-3 text-center min-w-[100px]">${date.getMonth() + 1}/${date.getDate()}</th>`;
     });
     tableHtml += "</tr></thead><tbody>";

     // Body
     weeklyData.forEach((userData) => {
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
     container.innerHTML += tableHtml; // Append table after navigation
}


// --- Action Handlers ---

/**
 * Handles restoring a completed goal back to active.
 * @param {string} taskName
 * @param {string} goalId
 */
async function handleRestoreGoalClick(taskName, goalId) {
    const goal = allTaskObjects?.find(t => t.name === taskName)?.goals?.find(g => g.id === goalId);
    if (!goal) return;

     showConfirmationModal(
         `工数「${escapeHtml(goal.title)}」を進行中に戻しますか？`,
         async () => {
             await handleRestoreGoal(taskName, goalId); // Call imported function from taskSettings
             // Refresh the archive view UI after successful restore
             selectedArchiveGoalId = null; // Clear selection
             renderArchiveTaskList(); // Task might disappear if it no longer has completed goals
             renderArchiveGoalList(); // Goal will disappear
             const detailsContainer = document.getElementById("archive-goal-details-container");
             const weeklyContainer = document.getElementById("archive-weekly-summary-container");
             const chartContainer = document.getElementById("archive-chart-container");
             if(detailsContainer) detailsContainer.classList.add("hidden");
             if(weeklyContainer) weeklyContainer.classList.add("hidden");
             if(chartContainer) chartContainer.classList.add("hidden");
             destroyCharts([archiveChartInstance]);
             archiveChartInstance = null;
             hideConfirmationModal();
         }
     );
}

/**
 * Handles permanently deleting a goal.
 * @param {string} taskName
 * @param {string} goalId
 */
async function handleDeleteGoalClick(taskName, goalId) {
    const goal = allTaskObjects?.find(t => t.name === taskName)?.goals?.find(g => g.id === goalId);
    if (!goal) return;

     showConfirmationModal(
         `工数「${escapeHtml(goal.title)}」を完全に削除しますか？\n\n関連ログは残りますが、工数データは復元できません。`,
         async () => {
             await handleDeleteGoalCompletely(taskName, goalId); // Call imported function from taskSettings
             // Refresh the archive view UI after successful deletion
             selectedArchiveGoalId = null; // Clear selection
             renderArchiveTaskList(); // Task might disappear if it no longer has completed goals
             renderArchiveGoalList(); // Goal will disappear
             const detailsContainer = document.getElementById("archive-goal-details-container");
             const weeklyContainer = document.getElementById("archive-weekly-summary-container");
             const chartContainer = document.getElementById("archive-chart-container");
             if(detailsContainer) detailsContainer.classList.add("hidden");
             if(weeklyContainer) weeklyContainer.classList.add("hidden");
             if(chartContainer) chartContainer.classList.add("hidden");
             destroyCharts([archiveChartInstance]);
             archiveChartInstance = null;
             hideConfirmationModal();
         }
     );
}


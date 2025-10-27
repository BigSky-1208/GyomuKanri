// js/views/archive.js
import { allTaskObjects, allUserLogs } from "../main.js"; // Import necessary state
import { formatHoursMinutes } from "../utils.js"; // Import utility functions
import { handleGoalDetailClick } from "./progress.js"; // Import shared function if needed
import {
  handleRestoreGoalClick,
  handleDeleteGoal,
} from "../components/modal.js"; // Import modal handlers
import { renderArchiveChart, renderArchiveTable } from "../components/chart.js"; // Import chart/table functions

// State specific to the archive view
let selectedArchiveTaskName = null;
let selectedArchiveGoalId = null;
let archiveDatePageIndex = 0; // Index for paging through dates in the table

// Function to initialize the archive view
export async function setupArchiveView() {
  const taskListContainer = document.getElementById("archive-task-list");
  taskListContainer.innerHTML = ""; // Clear previous list

  // Filter tasks that have at least one completed goal
  const tasksWithCompletedGoals = allTaskObjects.filter(
    (task) => task.goals && task.goals.some((g) => g.isComplete)
  );

  // Sort tasks alphabetically (Japanese locale)
  tasksWithCompletedGoals.sort((a, b) => a.name.localeCompare(b.name, "ja"));

  if (tasksWithCompletedGoals.length === 0) {
    taskListContainer.innerHTML =
      '<p class="text-gray-500 p-2">完了済みの工数がある業務はありません。</p>';
    // Clear subsequent lists/details if no tasks are available
    document.getElementById("archive-goal-list").innerHTML =
      '<p class="text-gray-500">業務を選択してください</p>';
    document
      .getElementById("archive-goal-details-container")
      .classList.add("hidden");
    document
      .getElementById("archive-weekly-summary-container")
      .classList.add("hidden");
    document.getElementById("archive-chart-container").classList.add("hidden");
    return;
  }

  // Render the list of tasks with completed goals
  tasksWithCompletedGoals.forEach((task) => {
    const button = document.createElement("button");
    button.className = `w-full text-left p-2 rounded-lg list-item ${
      selectedArchiveTaskName === task.name ? "selected" : ""
    }`;
    button.textContent = task.name;
    button.dataset.taskName = task.name;

    // Event listener for selecting a task
    button.onclick = () => {
      selectedArchiveTaskName = task.name;
      selectedArchiveGoalId = null; // Reset goal selection when task changes
      archiveDatePageIndex = 0; // Reset date page index

      // Clear details and summaries before rendering new goal list
      document
        .getElementById("archive-goal-details-container")
        .classList.add("hidden");
      document
        .getElementById("archive-weekly-summary-container")
        .classList.add("hidden");
      document.getElementById("archive-chart-container").classList.add("hidden");

      renderArchiveGoalList(); // Render the list of completed goals for the selected task

      // Update selection highlight in the task list
      taskListContainer
        .querySelectorAll(".list-item")
        .forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
    };
    taskListContainer.appendChild(button);
  });

  // If a task was previously selected, re-render its goal list
  if (selectedArchiveTaskName) {
    renderArchiveGoalList();
  } else {
    // If no task is selected (initial load or after clearing), show placeholder
    document.getElementById("archive-goal-list").innerHTML =
      '<p class="text-gray-500">業務を選択してください</p>';
  }
}

// Function to render the list of completed goals for the selected task
export function renderArchiveGoalList() {
  const goalListContainer = document.getElementById("archive-goal-list");
  goalListContainer.innerHTML = ""; // Clear previous list

  const task = allTaskObjects.find((t) => t.name === selectedArchiveTaskName);
  if (!task) {
    goalListContainer.innerHTML =
      '<p class="text-gray-500">エラー：選択された業務が見つかりません。</p>';
    return;
  }

  // Filter and sort completed goals by completion date (newest first)
  const completedGoals = (task.goals || [])
    .filter((g) => g.isComplete && g.completedAt) // Ensure completedAt exists
    .sort((a, b) => b.completedAt.toMillis() - a.completedAt.toMillis());

  if (completedGoals.length === 0) {
    goalListContainer.innerHTML =
      '<p class="text-gray-500">この業務に完了済みの工数はありません。</p>';
    return;
  }

  // Render the list of completed goals
  completedGoals.forEach((goal) => {
    const button = document.createElement("button");
    button.className = `w-full text-left p-2 rounded-lg list-item ${
      selectedArchiveGoalId === goal.id ? "selected" : ""
    }`;
    const completedDate = goal.completedAt
      ? goal.completedAt.toDate().toLocaleDateString("ja-JP")
      : "不明";
    button.innerHTML = `
            <div>${goal.title}</div>
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
        .forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
    };
    goalListContainer.appendChild(button);
  });

   // If a goal was previously selected, re-render its details and summary
   if (selectedArchiveGoalId) {
    // Check if the previously selected goal still exists in the list
    const goalExists = completedGoals.some(g => g.id === selectedArchiveGoalId);
    if(goalExists){
        renderArchiveGoalDetails();
        renderArchiveWeeklySummary();
        // Re-apply selected class
        const selectedButton = goalListContainer.querySelector(`.list-item[data-goal-id="${selectedArchiveGoalId}"]`);
        if(selectedButton) selectedButton.classList.add('selected');
    } else {
        // If the goal no longer exists (e.g., restored), clear selection
        selectedArchiveGoalId = null;
        document.getElementById("archive-goal-details-container").classList.add("hidden");
        document.getElementById("archive-weekly-summary-container").classList.add("hidden");
        document.getElementById("archive-chart-container").classList.add("hidden");
    }
  }
}

// Function to render the details of the selected completed goal
export function renderArchiveGoalDetails() {
  const container = document.getElementById(
    "archive-goal-details-container"
  );
  container.innerHTML = ""; // Clear previous details

  const task = allTaskObjects.find((t) => t.name === selectedArchiveTaskName);
  if (!task || !selectedArchiveGoalId) {
    container.classList.add("hidden");
    return;
  }

  const goal = task.goals.find((g) => g.id === selectedArchiveGoalId);
  if (!goal || !goal.isComplete) {
    // Ensure the goal exists and is indeed complete
    container.classList.add("hidden");
    return;
  }

  const completedDate = goal.completedAt
    ? goal.completedAt.toDate().toLocaleString("ja-JP")
    : "不明";

  // Buttons for restoring or permanently deleting the goal
  const buttonsHtml = `
    <div class="flex-shrink-0 ml-4 space-x-2">
        <button class="restore-goal-btn bg-yellow-500 text-white font-bold py-1 px-3 rounded hover:bg-yellow-600" data-task-name="${task.name}" data-goal-id="${goal.id}">進行中に戻す</button>
        <button class="delete-goal-btn bg-red-500 text-white font-bold py-1 px-3 rounded hover:bg-red-600" data-task-name="${task.name}" data-goal-id="${goal.id}">完全に削除</button>
    </div>
    `;

  container.innerHTML = `
    <div class="flex justify-between items-start">
        <div>
            <h3 class="text-xl font-bold">[${task.name}] ${goal.title}</h3>
            <p class="text-sm text-gray-500 mt-1">完了日時: ${completedDate}</p>
            <p class="text-sm text-gray-600 mt-2 whitespace-pre-wrap">${
              goal.memo || "メモはありません"
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

  // Add event listeners to the buttons
  container.querySelector(".restore-goal-btn").onclick = (e) =>
    handleRestoreGoalClick(
      e.target.dataset.taskName,
      e.target.dataset.goalId
    );
  container.querySelector(".delete-goal-btn").onclick = (e) =>
    handleDeleteGoal(e.target.dataset.taskName, e.target.dataset.goalId);
}

// Function to render the weekly summary table and chart for the selected completed goal
export function renderArchiveWeeklySummary() {
  const weeklyContainer = document.getElementById(
    "archive-weekly-summary-container"
  );
  const chartContainer = document.getElementById("archive-chart-container");
  weeklyContainer.innerHTML = ""; // Clear previous content
  chartContainer.innerHTML = "";   // Clear previous content

  const task = allTaskObjects.find((t) => t.name === selectedArchiveTaskName);
  if (!task || !selectedArchiveGoalId) {
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

  // Get unique user names who contributed to this goal
  const usersWithContributions = [
    ...new Set(relevantLogs.map((log) => log.userName)),
  ].sort((a,b) => a.localeCompare(b, "ja"));

  // Get all unique dates where work or contribution happened for this goal, sorted chronologically
  const allActiveDates = [
    ...new Set(relevantLogs.map((log) => log.date)),
  ].sort();

  if (allActiveDates.length === 0) {
    weeklyContainer.innerHTML = '<p class="text-gray-500 p-4 text-center">この工数に関する稼働記録はありません。</p>';
    weeklyContainer.classList.remove("hidden");
    chartContainer.classList.add("hidden");
    return;
  }

  // Paginate the dates (7 dates per page)
  const datesPerPage = 7;
  const startIndex = archiveDatePageIndex * datesPerPage;
   // Ensure startIndex is not negative
   if (startIndex < 0) archiveDatePageIndex = 0;
   const actualStartIndex = Math.max(0, archiveDatePageIndex * datesPerPage); // Recalculate based on potentially adjusted index

   const totalPages = Math.ceil(allActiveDates.length / datesPerPage);
   // Ensure page index does not exceed total pages
   if (archiveDatePageIndex >= totalPages && totalPages > 0) {
       archiveDatePageIndex = totalPages - 1;
   } else if (totalPages === 0) {
       archiveDatePageIndex = 0; // Handle case with no dates
   }
   const finalStartIndex = Math.max(0, archiveDatePageIndex * datesPerPage); // Final calculation


  const datesToShow = allActiveDates.slice(
    finalStartIndex,
    finalStartIndex + datesPerPage
  );


  if (datesToShow.length === 0 && allActiveDates.length > 0) {
     // If datesToShow is empty but there are active dates, likely went past the last page
     archiveDatePageIndex = totalPages - 1; // Go to the last page
     const lastPageStartIndex = Math.max(0, archiveDatePageIndex * datesPerPage);
     datesToShow = allActiveDates.slice(lastPageStartIndex, lastPageStartIndex + datesPerPage);
  } else if (datesToShow.length === 0 && allActiveDates.length === 0) {
     // No dates at all
     weeklyContainer.innerHTML = '<p class="text-gray-500 p-4 text-center">この工数に関する稼働記録はありません。</p>';
     weeklyContainer.classList.remove("hidden");
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
        .reduce((sum, log) => sum + log.duration, 0);
      // Sum contribution (only goal contribution logs)
      const totalContribution = logsForDay
        .filter((l) => l.type === "goal")
        .reduce((sum, log) => sum + log.contribution, 0);
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
    return userData;
  });


  // Render the line chart and the summary table
  renderArchiveChart(chartContainer, datesToShow, weeklyData);
  renderArchiveTable(
    weeklyContainer,
    datesToShow,
    weeklyData,
    archiveDatePageIndex + 1, // Current page number (1-based)
    totalPages
  );
}

// js/views/progress.js
import { db, allTaskObjects, allUserLogs, fetchAllUserLogs, updateGlobalTaskObjects, handleGoBack, showView, VIEWS } from "../../main.js"; // Import global state and functions
import { collection, doc, getDocs, updateDoc, Timestamp, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Import Firestore functions
import { formatDuration, formatHoursMinutes, getJSTDateString } from "../utils.js"; // Import utility functions
import { showConfirmationModal, hideConfirmationModal, openGoalModal } from "../components/modal.js"; // Import modal functions
import { createLineChart } from "../components/chart.js"; // Import chart creation function

// --- Module State ---
let selectedProgressTaskName = null;
let selectedProgressGoalId = null;
let progressWeekOffset = 0; // Offset for weekly summary navigation
let progressMonthOffset = 0; // Offset for monthly navigation in weekly summary
let progressChartType = "contribution"; // 'contribution' (件数) or 'efficiency' (件/h)
let progressLineChartInstance = null; // To hold the Chart.js instance

// Read-only state is managed globally in main.js via window.isProgressViewReadOnly for simplicity,
// otherwise it would need to be passed down or managed via a more complex state system.


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
 * Initializes the Progress View. Fetches latest logs and renders the initial state.
 */
export async function initializeProgressView() {
    console.log("Initializing Progress View...");
    // Ensure latest logs are available (fetchAllUserLogs updates the global allUserLogs)
    await fetchAllUserLogs();

    // Reset offsets when the view is initialized
    progressWeekOffset = 0;
    progressMonthOffset = 0;
    // selectedProgressTaskName and selectedProgressGoalId persist until user selects differently or leaves the view group

    renderProgressTaskList(); // Render the list of tasks with active goals

    // If a task was previously selected, re-render its goal list and details
    if (selectedProgressTaskName) {
        renderProgressGoalList(); // Render goals for the selected task
        if (selectedProgressGoalId) {
            renderProgressGoalDetails(); // Render details for the selected goal
            renderProgressWeeklySummary(); // Render chart/table for the selected goal
        } else {
             // If only task was selected, clear goal-specific sections
             if(goalDetailsContainer) goalDetailsContainer.classList.add('hidden');
             if(chartContainer) chartContainer.classList.add('hidden');
             if(weeklySummaryContainer) weeklySummaryContainer.classList.add('hidden');
        }
    } else {
        // If no task selected, ensure everything is cleared/hidden
        if(goalListContainer) goalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
        if(goalDetailsContainer) goalDetailsContainer.classList.add('hidden');
        if(chartContainer) chartContainer.classList.add('hidden');
        if(weeklySummaryContainer) weeklySummaryContainer.classList.add('hidden');
    }
}

/**
 * Sets up event listeners for the Progress View.
 */
export function setupProgressEventListeners() {
    console.log("Setting up Progress View event listeners...");
    backButton?.addEventListener("click", handleGoBack); // Use global go back handler
    viewArchiveButton?.addEventListener("click", () => showView(VIEWS.ARCHIVE));
    helpButton?.addEventListener('click', () => showHelpModal('progress'));

     // Event delegation for dynamically added buttons in goal details
     goalDetailsContainer?.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('edit-goal-btn')) {
             const taskName = target.dataset.taskName;
             const goalId = target.dataset.goalId;
             if (taskName && goalId) openGoalModal('edit', taskName, goalId);
        } else if (target.classList.contains('complete-goal-btn')) {
             const taskName = target.dataset.taskName;
             const goalId = target.dataset.goalId;
             if (taskName && goalId) handleCompleteGoalClick(taskName, goalId);
        } else if (target.classList.contains('delete-goal-btn')) {
             const taskName = target.dataset.taskName;
             const goalId = target.dataset.goalId;
             if (taskName && goalId) handleDeleteGoal(taskName, goalId);
        }
    });

     // Event delegation for chart type toggle buttons
     chartContainer?.addEventListener('click', (event) => {
        if (event.target.id === 'chart-toggle-contribution') {
            if (progressChartType !== 'contribution') {
                progressChartType = 'contribution';
                renderProgressWeeklySummary(); // Re-render chart and table
            }
        } else if (event.target.id === 'chart-toggle-efficiency') {
             if (progressChartType !== 'efficiency') {
                progressChartType = 'efficiency';
                renderProgressWeeklySummary(); // Re-render chart and table
            }
        }
     });

     // Event delegation for weekly summary navigation
     weeklySummaryContainer?.addEventListener('click', (event) => {
        const target = event.target;
        if (target.id === 'progress-prev-week-btn') {
            progressWeekOffset--;
            renderProgressWeeklySummary();
        } else if (target.id === 'progress-next-week-btn') {
            progressWeekOffset++;
            renderProgressWeeklySummary();
        } else if (target.id === 'progress-prev-month-btn') {
             progressMonthOffset--;
             progressWeekOffset = 0; // Reset week offset when changing month
             renderProgressWeeklySummary();
        } else if (target.id === 'progress-next-month-btn') {
             progressMonthOffset++;
             progressWeekOffset = 0; // Reset week offset when changing month
             renderProgressWeeklySummary();
        }
     });

    console.log("Progress View event listeners set up complete.");
}

/**
 * Renders the list of tasks that have at least one active (not completed) goal.
 */
function renderProgressTaskList() {
    if (!taskListContainer) return;
    taskListContainer.innerHTML = ""; // Clear existing list

    const tasksWithActiveGoals = allTaskObjects
        .filter(task => task.goals && task.goals.some(g => !g.isComplete))
        .sort((a,b)=> (a.name || "").localeCompare(b.name || "", "ja")); // Sort tasks by name


    if (tasksWithActiveGoals.length === 0) {
        taskListContainer.innerHTML = '<p class="text-gray-500 p-2">進行中の工数がある業務はありません。</p>';
        // Clear subsequent selections if no tasks are available
        selectedProgressTaskName = null;
        selectedProgressGoalId = null;
        if(goalListContainer) goalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
        if(goalDetailsContainer) goalDetailsContainer.classList.add('hidden');
        if(chartContainer) chartContainer.classList.add('hidden');
        if(weeklySummaryContainer) weeklySummaryContainer.classList.add('hidden');
        return;
    }

    tasksWithActiveGoals.forEach((task) => {
        const button = document.createElement("button");
        // Apply 'selected' class if this task is the currently selected one
        button.className = `w-full text-left p-2 rounded-lg list-item hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${selectedProgressTaskName === task.name ? "selected bg-indigo-100" : ""}`;
        button.textContent = task.name;
        button.dataset.taskName = task.name; // Store task name in dataset

        button.onclick = () => {
            // Update selected task state
            selectedProgressTaskName = task.name;
            selectedProgressGoalId = null; // Reset goal selection when task changes

            // Update UI highlighting for task list
            taskListContainer.querySelectorAll(".list-item").forEach((item) => item.classList.remove("selected", "bg-indigo-100"));
            button.classList.add("selected", "bg-indigo-100");

            // Clear goal-specific displays
            if(goalDetailsContainer) goalDetailsContainer.classList.add("hidden");
            if(chartContainer) chartContainer.classList.add("hidden");
            if(weeklySummaryContainer) weeklySummaryContainer.classList.add("hidden");

            // Render the list of goals for the newly selected task
            renderProgressGoalList();
        };
        taskListContainer.appendChild(button);
    });
}

/**
 * Renders the list of active (not completed) goals for the currently selected task.
 */
function renderProgressGoalList() {
    if (!goalListContainer || !selectedProgressTaskName) {
         if(goalListContainer) goalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
        return;
    }

    goalListContainer.innerHTML = ""; // Clear existing list

    const task = allTaskObjects.find((t) => t.name === selectedProgressTaskName);
    if (!task || !task.goals) {
         goalListContainer.innerHTML = '<p class="text-gray-500">選択された業務が見つからないか、工数がありません。</p>';
        return;
    }


    const activeGoals = task.goals
        .filter((g) => !g.isComplete)
        .sort((a,b) => (a.title || "").localeCompare(b.title || "", "ja")); // Sort goals by title


    if (activeGoals.length === 0) {
        goalListContainer.innerHTML = '<p class="text-gray-500">この業務に進行中の工数はありません。</p>';
        // Clear subsequent selections if no goals are available
        selectedProgressGoalId = null;
        if(goalDetailsContainer) goalDetailsContainer.classList.add('hidden');
        if(chartContainer) chartContainer.classList.add('hidden');
        if(weeklySummaryContainer) weeklySummaryContainer.classList.add('hidden');
        return;
    }

    activeGoals.forEach((goal) => {
        const button = document.createElement("button");
        // Apply 'selected' class if this goal is the currently selected one
        button.className = `w-full text-left p-2 rounded-lg list-item hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${selectedProgressGoalId === goal.id ? "selected bg-indigo-100" : ""}`;
        button.textContent = goal.title;
        button.dataset.goalId = goal.id; // Store goal ID in dataset

        button.onclick = () => {
            // Update selected goal state
            selectedProgressGoalId = goal.id;
            // Reset offsets when a new goal is selected
            progressWeekOffset = 0;
            progressMonthOffset = 0;
            progressChartType = "contribution"; // Reset chart type

            // Update UI highlighting for goal list
            goalListContainer.querySelectorAll(".list-item").forEach((item) => item.classList.remove("selected", "bg-indigo-100"));
            button.classList.add("selected", "bg-indigo-100");

            // Render details and summary for the newly selected goal
            renderProgressGoalDetails();
            renderProgressWeeklySummary();
        };
        goalListContainer.appendChild(button);
    });
}

/**
 * Renders the detailed information and action buttons for the selected goal.
 */
function renderProgressGoalDetails() {
    if (!goalDetailsContainer || !selectedProgressTaskName || !selectedProgressGoalId) {
        if(goalDetailsContainer) goalDetailsContainer.classList.add("hidden");
        return;
    }


    const task = allTaskObjects.find((t) => t.name === selectedProgressTaskName);
    if (!task || !task.goals) {
        goalDetailsContainer.classList.add("hidden");
        return;
    }

    const goal = task.goals.find((g) => g.id === selectedProgressGoalId);
    if (!goal || goal.isComplete) { // Ensure goal exists and is not complete
        goalDetailsContainer.classList.add("hidden");
        // If the selected goal is no longer active (e.g., completed elsewhere), clear selection
        if(goal?.isComplete) {
            selectedProgressGoalId = null;
            renderProgressGoalList(); // Re-render goal list to remove selection highlight
        }
        return;
    }

    // Calculate progress percentage (0-100)
    const progress = goal.target > 0 ? Math.min(100, Math.max(0,(goal.current / goal.target) * 100)) : 0;

    // Determine if buttons should be shown (not in read-only mode)
    // Accessing global window object - consider passing as state if refactoring
    const readOnlyMode = window.isProgressViewReadOnly === true;
    const buttonsHtml = readOnlyMode ? "" : `
        <div class="flex-shrink-0 ml-4 space-x-2">
            <button class="edit-goal-btn bg-blue-500 text-white font-bold py-1 px-3 rounded hover:bg-blue-600 text-sm" data-task-name="${escapeHtml(task.name)}" data-goal-id="${goal.id}">編集</button>
            <button class="complete-goal-btn bg-green-500 text-white font-bold py-1 px-3 rounded hover:bg-green-600 text-sm" data-task-name="${escapeHtml(task.name)}" data-goal-id="${goal.id}">完了</button>
            <button class="delete-goal-btn bg-red-500 text-white font-bold py-1 px-3 rounded hover:bg-red-600 text-sm" data-task-name="${escapeHtml(task.name)}" data-goal-id="${goal.id}">削除</button>
        </div>
    `;

    // Render goal details HTML
    goalDetailsContainer.innerHTML = `
        <div class="flex justify-between items-start flex-wrap">
            <div class="flex-grow mb-2">
                <h3 class="text-xl font-bold">[${escapeHtml(task.name)}] ${escapeHtml(goal.title)}</h3>
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
    goalDetailsContainer.classList.remove("hidden"); // Show the details container
}

/**
 * Renders the weekly summary section, including the line chart and data table,
 * for the currently selected goal based on offsets.
 */
function renderProgressWeeklySummary() {
    // Ensure containers and selections are valid
    if (!chartContainer || !weeklySummaryContainer || !selectedProgressTaskName || !selectedProgressGoalId) {
        if(chartContainer) chartContainer.classList.add("hidden");
        if(weeklySummaryContainer) weeklySummaryContainer.classList.add("hidden");
        return;
    }

    const task = allTaskObjects.find((t) => t.name === selectedProgressTaskName);
    if (!task || !task.goals) {
        chartContainer.classList.add("hidden");
        weeklySummaryContainer.classList.add("hidden");
        return;
    }

    const goal = task.goals.find((g) => g.id === selectedProgressGoalId);
    if (!goal || goal.isComplete) { // Don't render summary for completed goals here
        chartContainer.classList.add("hidden");
        weeklySummaryContainer.classList.add("hidden");
        return;
    }

    // --- Calculate Date Range for the Week ---
    // Start from today, apply month offset, then week offset
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0); // Normalize to start of day
    // Apply month offset first
    if (progressMonthOffset !== 0) {
         baseDate.setMonth(baseDate.getMonth() + progressMonthOffset);
         // Go to the 1st of that month to ensure week offset starts correctly relative to the month
         baseDate.setDate(1);
    }
    // Apply week offset relative to the calculated month's start or today
    const referenceDate = new Date(baseDate);
    referenceDate.setDate(referenceDate.getDate() + progressWeekOffset * 7);

    const dayOfWeek = referenceDate.getDay(); // 0 (Sun) to 6 (Sat)
    const startOfWeek = new Date(referenceDate);
    startOfWeek.setDate(referenceDate.getDate() - dayOfWeek); // Go back to Sunday

    const weekDates = []; // Array of "YYYY-MM-DD" strings for the week
    for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        weekDates.push(getJSTDateString(date)); // Use utility function
    }
    // --- End Date Range Calculation ---


    // --- Aggregate Data for the Week ---
    // Find all users who have contributed or worked on this goal *at any time*
    const usersInvolved = [...new Set(
        allUserLogs
            .filter(log => log.goalId === goal.id)
            .map(log => log.userName)
            .filter(name => name) // Filter out undefined/null names
    )].sort((a,b)=>a.localeCompare(b,"ja"));

    const chartAndTableData = []; // Array to hold { name: string, dailyData: [ { contribution, duration, efficiency } x 7 ] }

    usersInvolved.forEach((name) => {
        const userData = { name: name, dailyData: [] };
        weekDates.forEach((dateStr) => {
            // Filter logs for this specific user, goal, and date
            const logsForDay = allUserLogs.filter(
                (log) =>
                    log.userName === name &&
                    log.date === dateStr &&
                    log.goalId === goal.id
            );

            // Calculate total duration (from non-goal logs) and contribution (from goal logs)
            const totalDuration = logsForDay
                .filter(l => l.type !== "goal") // Work/Break logs
                .reduce((sum, log) => sum + (log.duration || 0), 0);
            const totalContribution = logsForDay
                .filter(l => l.type === "goal") // Contribution logs
                .reduce((sum, log) => sum + (log.contribution || 0), 0);

            // Calculate efficiency (contribution per hour)
            const hours = totalDuration / 3600;
            const efficiency = hours > 0 ? parseFloat((totalContribution / hours).toFixed(1)) : 0;

            userData.dailyData.push({
                contribution: totalContribution,
                duration: totalDuration,
                efficiency: efficiency,
            });
        });
        // Only include users who had activity (duration or contribution) during this specific week
        if(userData.dailyData.some(d => d.contribution > 0 || d.duration > 0)){
            chartAndTableData.push(userData);
        }
    });
    // --- End Data Aggregation ---


    // --- Render Chart and Table ---
    if (chartAndTableData.length > 0) {
        renderProgressLineChart(weekDates, chartAndTableData, goal); // Render the line chart
        renderProgressTable(weekDates, chartAndTableData, goal);     // Render the data table
        chartContainer.classList.remove('hidden');
        weeklySummaryContainer.classList.remove('hidden');
    } else {
        // If no data for this week, hide the sections
        chartContainer.innerHTML = '<p class="text-gray-500 text-center p-4">この期間のグラフデータはありません。</p>';
        weeklySummaryContainer.innerHTML = '<p class="text-gray-500 text-center p-4">この期間の集計データはありません。</p>';
         // Still show navigation buttons within weeklySummaryContainer if needed
         renderProgressTableNavigation(goal); // Render just the nav part
        chartContainer.classList.remove('hidden'); // Show the containers with the message
        weeklySummaryContainer.classList.remove('hidden');

    }
    // --- End Rendering ---
}


/**
 * Renders the line chart for weekly progress (contribution or efficiency).
 * @param {string[]} weekDates - Array of date strings ("YYYY-MM-DD") for the x-axis labels.
 * @param {Array} data - Aggregated data array [{ name, dailyData: [{ contribution, efficiency }] }].
 * @param {object} goal - The goal object (for context, not directly used in chart data).
 */
function renderProgressLineChart(weekDates, data, goal) {
    if (!chartContainer) return;
    chartContainer.innerHTML = ""; // Clear previous chart and buttons

    // Add Toggle Buttons for Chart Type
    const buttonsDiv = document.createElement("div");
    buttonsDiv.className = "flex justify-center md:justify-end gap-2 mb-2"; // Centered on mobile, right on desktop
    buttonsDiv.innerHTML = `
        <button id="chart-toggle-contribution" class="text-xs md:text-sm py-1 px-2 md:px-3 rounded-lg transition-colors ${
            progressChartType === "contribution" ? "bg-blue-600 text-white" : "bg-gray-200 hover:bg-gray-300"
        }">合計件数</button>
        <button id="chart-toggle-efficiency" class="text-xs md:text-sm py-1 px-2 md:px-3 rounded-lg transition-colors ${
            progressChartType === "efficiency" ? "bg-blue-600 text-white" : "bg-gray-200 hover:bg-gray-300"
        }">時間あたり件数</button>
    `;
    chartContainer.appendChild(buttonsDiv);

    const canvas = document.createElement("canvas");
    // Set a minimum height for the canvas container to prevent collapse
    canvas.style.minHeight = '250px';
    chartContainer.appendChild(canvas);

    // Destroy previous chart instance if it exists
    if (progressLineChartInstance) {
        progressLineChartInstance.destroy();
        progressLineChartInstance = null;
    }

    // Prepare datasets for Chart.js
    const datasets = data.map((userData, index) => {
        const hue = (index * 137.508) % 360; // Golden angle for distinct colors
        const color = `hsl(${hue}, 70%, 50%)`;
        return {
            label: userData.name,
            // Select data based on the current chart type
            data: userData.dailyData.map((d) =>
                progressChartType === "contribution" ? d.contribution : d.efficiency
            ),
            borderColor: color,
            backgroundColor: color + '33', // Add some transparency for background/fill
            fill: false, // Don't fill area under line by default
            tension: 0.1, // Slight curve to lines
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5
        };
    });

    // Prepare labels for the x-axis (Month/Day format)
    const labels = weekDates.map((dateStr) => {
        try {
            const date = new Date(dateStr + 'T00:00:00'); // Ensure parsing as local date
            return `${date.getMonth() + 1}/${date.getDate()}`;
        } catch (e) { return dateStr; } // Fallback to YYYY-MM-DD on error
    });

    // Determine Y-axis title based on chart type
    const yAxisTitle = progressChartType === "contribution" ? "合計件数" : "時間あたり件数 (件/h)";

    // Create the new line chart
    const ctx = canvas.getContext("2d");
    progressLineChartInstance = createLineChart( // Use imported function
         ctx,
         labels,
         datasets,
         "週間進捗グラフ", // Chart Title
         yAxisTitle // Y-Axis Title
    );
}

/**
 * Renders the data table for the weekly summary.
 * @param {string[]} weekDates - Array of date strings ("YYYY-MM-DD") for table columns.
 * @param {Array} data - Aggregated data array [{ name, dailyData: [{ contribution, duration, efficiency }] }].
 * @param {object} goal - The goal object (used for context in title, not data).
 */
function renderProgressTable(weekDates, data, goal) {
    if (!weeklySummaryContainer) return;
    weeklySummaryContainer.innerHTML = ""; // Clear previous content

    // --- Render Navigation ---
    renderProgressTableNavigation(goal); // Separate function for navigation part

    // --- Render Table ---
    let tableHtml = '<div class="overflow-x-auto mt-4"><table class="w-full text-sm text-left text-gray-500">';
    // Table Header
    tableHtml += '<thead class="text-xs text-gray-700 uppercase bg-gray-50"><tr><th scope="col" class="px-3 py-3 sticky left-0 bg-gray-50 z-10">名前</th>'; // Sticky name column
    weekDates.forEach((dateStr) => {
        const date = new Date(dateStr + 'T00:00:00'); // Ensure local date parsing
        tableHtml += `<th scope="col" class="px-3 py-3 text-center min-w-[100px]">${date.getMonth() + 1}/${date.getDate()}</th>`;
    });
    tableHtml += "</tr></thead><tbody>";

    // Table Body
    if (data.length === 0) {
        tableHtml += `<tr><td colspan="${weekDates.length + 1}" class="text-center p-4 text-gray-500">この週の記録はありません。</td></tr>`;
    } else {
        data.forEach((userData) => {
            tableHtml += `<tr class="bg-white border-b hover:bg-gray-50"><th scope="row" class="px-3 py-4 font-medium text-gray-900 whitespace-nowrap sticky left-0 bg-white z-10">${escapeHtml(userData.name)}</th>`; // Sticky name column
            userData.dailyData.forEach((d) => {
                // Apply highlight if there was contribution or duration
                const cellClass = (d.contribution > 0 || d.duration > 0) ? "highlight-cell bg-yellow-50" : "";
                tableHtml += `<td class="px-3 py-4 text-center ${cellClass}">
                    <div title="件数 / 時間">${d.contribution}件 / ${formatHoursMinutes(d.duration)}</div>
                    <div class="text-xs text-gray-400" title="時間あたり件数">${d.efficiency}件/h</div>
                </td>`;
            });
            tableHtml += "</tr>";
        });
    }

    tableHtml += "</tbody></table></div>";
    // Append the table after the navigation which was added by renderProgressTableNavigation
    weeklySummaryContainer.innerHTML += tableHtml;
    // weeklySummaryContainer.classList.remove("hidden"); // Ensure container is visible
}

/**
 * Renders only the navigation part of the weekly summary table.
 * @param {object} goal - The goal object for context.
 */
 function renderProgressTableNavigation(goal) {
     if (!weeklySummaryContainer || !goal) return;

     const baseDateNav = new Date();
     baseDateNav.setHours(0,0,0,0);
     if (progressMonthOffset !== 0) {
          baseDateNav.setMonth(baseDateNav.getMonth() + progressMonthOffset);
          baseDateNav.setDate(1); // Use 1st of month for month label consistency
     }
     const year = baseDateNav.getFullYear();
     const month = baseDateNav.getMonth() + 1;

     // Determine the start date of the *currently displayed* week for the title
     const referenceDateNav = new Date(baseDateNav); // Use the potentially month-offset date
     if(progressMonthOffset === 0) { // If current month, offset from today
          referenceDateNav.setDate(referenceDateNav.getDate() + progressWeekOffset * 7);
     } else { // If different month, offset from the 1st of that month
          referenceDateNav.setDate(referenceDateNav.getDate() + progressWeekOffset * 7);
     }

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
     weeklySummaryContainer.innerHTML = navHtml; // Set navigation html first
 }


// --- Goal Management Actions ---

/**
 * Handles the click on the "完了" (Complete) button for a goal.
 * Prompts for confirmation and updates the goal's status in Firestore.
 * @param {string} taskName - The name of the task the goal belongs to.
 * @param {string} goalId - The ID of the goal to mark as complete.
 */
async function handleCompleteGoalClick(taskName, goalId) {
    if (!taskName || !goalId) return;

     const goal = allTaskObjects?.find(t => t.name === taskName)?.goals?.find(g => g.id === goalId);
     if(!goal) return;


    showConfirmationModal(
        `工数「${escapeHtml(goal.title)}」を完了しますか？\n完了した工数はアーカイブに移動します。`,
        async () => {
            hideConfirmationModal(); // Hide modal immediately

            const taskIndex = allTaskObjects.findIndex((t) => t.name === taskName);
            if (taskIndex === -1 || !allTaskObjects[taskIndex].goals) return;

            const goalIndex = allTaskObjects[taskIndex].goals.findIndex((g) => g.id === goalId);
            if (goalIndex === -1) return;

            // Create a deep copy for update
            const updatedTasks = JSON.parse(JSON.stringify(allTaskObjects));
            const goalToUpdate = updatedTasks[taskIndex].goals[goalIndex];

            // Mark as complete and set completion timestamp
            goalToUpdate.isComplete = true;
            goalToUpdate.completedAt = Timestamp.now(); // Use Firestore Timestamp

            // Update Firestore
            const tasksRef = doc(db, "settings", "tasks");
            try {
                await updateDoc(tasksRef, { list: updatedTasks });
                console.log(`Goal ${goalId} marked as complete.`);

                // Update global state *after* successful Firestore update
                updateGlobalTaskObjects(updatedTasks);

                // Update UI: Clear selection and re-render lists
                selectedProgressGoalId = null;
                 if (goalDetailsContainer) goalDetailsContainer.classList.add("hidden");
                 if (chartContainer) chartContainer.classList.add("hidden");
                 if (weeklySummaryContainer) weeklySummaryContainer.classList.add("hidden");
                renderProgressTaskList(); // Re-render task list (might remove task if it was the last active goal)
                renderProgressGoalList(); // Re-render goal list (will remove the completed goal)

            } catch (error) {
                console.error("Error marking goal as complete:", error);
                alert("工数の完了処理中にエラーが発生しました。");
            }
        },
        () => {
             console.log("Goal completion cancelled.");
        }
    );
}

/**
 * Handles the click on the "削除" (Delete) button for a goal.
 * Prompts for confirmation and removes the goal from the task in Firestore.
 * @param {string} taskName - The name of the task the goal belongs to.
 * @param {string} goalId - The ID of the goal to delete.
 */
async function handleDeleteGoal(taskName, goalId) {
    if (!taskName || !goalId) return;

    const goal = allTaskObjects?.find(t => t.name === taskName)?.goals?.find(g => g.id === goalId);
    if (!goal) return;


    showConfirmationModal(
        `工数「${escapeHtml(goal.title)}」を完全に削除しますか？\n\n関連する全ての進捗記録（貢献件数ログ）は残りますが、この工数自体は復元できません。`,
        async () => {
            hideConfirmationModal(); // Hide modal immediately

            const taskIndex = allTaskObjects.findIndex((t) => t.name === taskName);
            if (taskIndex === -1 || !allTaskObjects[taskIndex].goals) return;

            // Create a deep copy for update
            const updatedTasks = JSON.parse(JSON.stringify(allTaskObjects));

            // Filter out the goal to be deleted
            updatedTasks[taskIndex].goals = updatedTasks[taskIndex].goals.filter(
                (g) => g.id !== goalId
            );

            // Update Firestore
            const tasksRef = doc(db, "settings", "tasks");
            try {
                await updateDoc(tasksRef, { list: updatedTasks });
                console.log(`Goal ${goalId} deleted from task ${taskName}.`);

                // Update global state *after* successful Firestore update
                updateGlobalTaskObjects(updatedTasks);

                // Update UI: Clear selection and re-render lists
                selectedProgressGoalId = null;
                 if (goalDetailsContainer) goalDetailsContainer.classList.add("hidden");
                 if (chartContainer) chartContainer.classList.add("hidden");
                 if (weeklySummaryContainer) weeklySummaryContainer.classList.add("hidden");
                renderProgressTaskList(); // Re-render task list
                renderProgressGoalList(); // Re-render goal list

            } catch (error) {
                console.error("Error deleting goal:", error);
                alert("工数の削除中にエラーが発生しました。");
            }
        },
        () => {
             console.log("Goal deletion cancelled.");
        }
    );
}


/**
 * Simple HTML escaping function to prevent XSS.
 * @param {string | null | undefined} unsafe - The potentially unsafe string.
 * @returns {string} The escaped string.
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

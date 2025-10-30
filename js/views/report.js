// js/views/report.js
import { allUserLogs, fetchAllUserLogs, handleGoBack } from "../../main.js"; // Import global state and functions
import { renderUnifiedCalendar } from "../components/calendar.js"; // Import calendar rendering function
import { createPieChart, destroyCharts } from "../components/chart.js"; // Import chart functions
import { formatDuration, formatHoursMinutes } from "../utils.js"; // Import utility functions

// --- Module State ---
let currentReportDate = new Date(); // Date displayed on the report calendar
let activeReportCharts = []; // Store active Chart.js instances for destruction
let selectedReportDateStr = null; // Store selected date "YYYY-MM-DD", null for month view

// --- DOM Element references ---
const reportCalendarEl = document.getElementById("report-calendar");
const reportMonthYearEl = document.getElementById("report-calendar-month-year");
const reportPrevMonthBtn = document.getElementById("report-prev-month-btn");
const reportNextMonthBtn = document.getElementById("report-next-month-btn");
const reportTitleEl = document.getElementById("report-title");
const reportChartsContainer = document.getElementById("report-charts-container");
const backButton = document.getElementById("back-to-host-from-report"); // Assuming back goes to host

/**
 * Initializes the Report View. Fetches logs, sets up the calendar, and renders initial charts.
 */
export async function initializeReportView() {
    console.log("Initializing Report View...");
    // Ensure latest logs are available
    await fetchAllUserLogs();

    currentReportDate = new Date(); // Reset to current month on initialization
    selectedReportDateStr = null; // Default to month view

    renderReportCalendar();       // Render the calendar UI
    renderReportChartsForMonth(); // Render charts for the current month by default
}

/**
 * Cleans up the Report view when navigating away. Destroys active charts.
 */
export function cleanupReportView() {
    console.log("Cleaning up Report View...");
    destroyCharts(activeReportCharts); // Destroy charts using the utility function
    activeReportCharts = []; // Clear the array
    selectedReportDateStr = null; // Reset selection state
}

/**
 * Sets up event listeners for the Report View.
 */
export function setupReportEventListeners() {
    console.log("Setting up Report event listeners...");
    reportPrevMonthBtn?.addEventListener("click", () => moveReportMonth(-1));
    reportNextMonthBtn?.addEventListener("click", () => moveReportMonth(1));
    backButton?.addEventListener("click", handleGoBack); // Use global go back handler

    // Calendar month title click listener is set within renderUnifiedCalendar
    // Calendar day click listener is set within renderUnifiedCalendar
    console.log("Report event listeners set up complete.");
}

/**
 * Renders the calendar for the report view.
 */
function renderReportCalendar() {
    if (!reportCalendarEl || !reportMonthYearEl) {
        console.warn("Report calendar elements not found.");
        return;
    }
    renderUnifiedCalendar({
        calendarEl: reportCalendarEl,
        monthYearEl: reportMonthYearEl,
        dateToDisplay: currentReportDate,
        logs: allUserLogs, // Use globally fetched logs
        onDayClick: (e) => { // Handle day click
            const dateStr = e.currentTarget.dataset.date;
            selectedReportDateStr = dateStr; // Store selected date
            // Highlight selected day (renderUnifiedCalendar doesn't handle selection persistence)
            reportCalendarEl.querySelectorAll(".calendar-day.selected").forEach(el => el.classList.remove("selected"));
            e.currentTarget.classList.add("selected");
            renderReportChartsForDay(dateStr);
        },
        onMonthClick: () => { // Handle month click (month title)
             selectedReportDateStr = null; // Clear date selection for month view
             // Remove selected class from any day
             reportCalendarEl.querySelectorAll(".calendar-day.selected").forEach(el => el.classList.remove("selected"));
             renderReportChartsForMonth();
        },
    });
     // Re-apply selected class after calendar re-render if a date was selected
     if(selectedReportDateStr){
        const dayElement = reportCalendarEl.querySelector(`.calendar-day[data-date="${selectedReportDateStr}"]`);
        dayElement?.classList.add('selected');
     }
}

/**
 * Moves the report calendar to the previous or next month and updates charts.
 * @param {number} direction - -1 for previous, 1 for next.
 */
function moveReportMonth(direction) {
    selectedReportDateStr = null; // Reset to month view when changing month
    currentReportDate.setMonth(currentReportDate.getMonth() + direction);
    renderReportCalendar();       // Re-render calendar
    renderReportChartsForMonth(); // Re-render charts for the new month
}

/**
 * Renders the report charts for the entire month currently displayed on the calendar.
 */
function renderReportChartsForMonth() {
     if (!reportTitleEl) return;
    const year = currentReportDate.getFullYear();
    const month = currentReportDate.getMonth(); // 0-based month
    reportTitleEl.textContent = `${year}年 ${month + 1}月 月次レポート`;

    const monthStr = `${year}-${(month + 1).toString().padStart(2, "0")}`; // YYYY-MM format

    // Filter logs for the specified month
    const logsForMonth = allUserLogs.filter(
        (log) => log.date && log.date.startsWith(monthStr)
    );

    renderReportCharts(logsForMonth); // Render charts with the filtered data
}

/**
 * Renders the report charts for a specific selected day.
 * @param {string} dateStr - The date string in "YYYY-MM-DD" format.
 */
function renderReportChartsForDay(dateStr) {
     if (!reportTitleEl || !dateStr) return;
    reportTitleEl.textContent = `${dateStr} 日次レポート`;

    // Filter logs for the specified day
    const logsForDay = allUserLogs.filter((log) => log.date === dateStr);

    renderReportCharts(logsForDay); // Render charts with the filtered data
}

/**
 * Core function to render the pie charts based on the provided log data.
 * Calculates totals per task and per user, then creates charts.
 * @param {Array} logs - Array of work log objects for the selected period (day or month).
 */
function renderReportCharts(logs) {
    if (!reportChartsContainer) return;

    // Destroy previously created charts before rendering new ones
    destroyCharts(activeReportCharts);
    activeReportCharts = [];
    reportChartsContainer.innerHTML = ""; // Clear the container

    // --- Data Aggregation ---
    const personalData = {}; // { userName: { taskName: duration } }
    const totalData = {};    // { taskName: duration }
    const allTasksSet = new Set(); // To get a unique list of tasks in this period

    logs.forEach((log) => {
        // Exclude logs without user/task, breaks, or goal contribution logs
        if (!log.userName || !log.task || log.task === "休憩" || log.type === "goal") {
            return;
        }

        const taskName = log.task.startsWith("その他_") ? log.task.substring(4) : log.task; // Clean "Other" task name for display
        allTasksSet.add(taskName);

        // Aggregate total duration per task
        if (!totalData[taskName]) totalData[taskName] = 0;
        totalData[taskName] += (log.duration || 0);

        // Aggregate duration per user per task
        if (!personalData[log.userName]) personalData[log.userName] = {};
        if (!personalData[log.userName][taskName]) personalData[log.userName][taskName] = 0;
        personalData[log.userName][taskName] += (log.duration || 0);
    });
    // --- End Data Aggregation ---


    // --- Color Mapping for Tasks ---
    const taskColorMap = {};
    const uniqueTasks = Array.from(allTasksSet).sort((a, b) => a.localeCompare(b, "ja"));
    uniqueTasks.forEach((task, index) => {
        const hue = (index * 137.508) % 360; // Use golden angle for distinct colors
        taskColorMap[task] = `hsl(${hue}, 70%, 60%)`; // Assign color based on index
    });
    // --- End Color Mapping ---


    // --- Render Charts ---
    if (Object.keys(totalData).length > 0) {
        // 1. Render Overall Total Chart and List
        const totalDuration = Object.values(totalData).reduce((sum, duration) => sum + duration, 0);
        const totalChartWrapper = document.createElement("div");
        totalChartWrapper.className = "p-4 border rounded-lg bg-white shadow"; // Added bg and shadow

        // Use grid for better layout within the total section
        totalChartWrapper.innerHTML = `
            <div class="text-center mb-4">
                <h3 class="text-xl font-semibold">全従業員 合計</h3>
                <p class="text-gray-600 font-mono text-lg">${formatHoursMinutes(totalDuration)}</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div class="relative w-full min-h-[250px] md:min-h-[300px]">
                    <canvas id="total-report-chart-canvas"></canvas>
                </div>
                <div id="total-report-list" class="text-sm"></div>
            </div>
        `;
        reportChartsContainer.appendChild(totalChartWrapper);

        // Render the list of tasks and durations for the total chart
        const totalListContainer = totalChartWrapper.querySelector("#total-report-list");
        const sortedTotalTasks = Object.entries(totalData).sort(([, a], [, b]) => b - a); // Sort by duration desc
        let totalListHtml = '<ul class="space-y-1">';
        sortedTotalTasks.forEach(([task, duration]) => {
            const color = taskColorMap[task] || "#CCCCCC"; // Fallback color
             totalListHtml += `
                 <li class="flex items-center justify-between p-1.5 rounded-md hover:bg-gray-50">
                     <span class="flex items-center"><span class="w-3 h-3 rounded-full mr-2 flex-shrink-0" style="background-color: ${color};"></span>${escapeHtml(task)}</span>
                     <span class="font-mono ml-2 flex-shrink-0">${formatHoursMinutes(duration)}</span>
                 </li>`;
        });
        totalListHtml += "</ul>";
        if(totalListContainer) totalListContainer.innerHTML = totalListHtml;

        // Create the total pie chart
        const totalCtx = totalChartWrapper.querySelector("#total-report-chart-canvas")?.getContext("2d");
        if (totalCtx) {
            const totalChart = createPieChart(
                totalCtx,
                totalData,
                taskColorMap,
                false // Show legend only for total chart? Maybe false is better with list. Let's try false.
            );
            if (totalChart) activeReportCharts.push(totalChart);
        }

        // 2. Render Individual User Charts
        const sortedUserNames = Object.keys(personalData).sort((a, b) => a.localeCompare(b, "ja"));
        sortedUserNames.forEach((name) => {
            const userData = personalData[name];
            const userDuration = Object.values(userData).reduce((sum, duration) => sum + duration, 0);

            // Skip rendering if user has no duration in this period
            if (userDuration <= 0) return;

            const userChartWrapper = document.createElement("div");
            userChartWrapper.className = "p-4 border rounded-lg bg-white shadow flex flex-col"; // Added bg/shadow, flex col

            userChartWrapper.innerHTML = `
                <div class="text-center mb-2">
                    <h3 class="text-lg font-semibold">${escapeHtml(name)}</h3>
                    <p class="text-gray-600 font-mono">${formatHoursMinutes(userDuration)}</p>
                </div>
                <div class="relative flex-grow min-h-[200px] w-full">
                    <canvas></canvas>
                </div>
            `;
            reportChartsContainer.appendChild(userChartWrapper);

            // Create pie chart for the user (legend typically off for small multiples)
            const userCtx = userChartWrapper.querySelector("canvas")?.getContext("2d");
            if (userCtx) {
                const userChart = createPieChart(
                    userCtx,
                    userData,
                    taskColorMap,
                    false // Legend off for individual charts
                );
                 if (userChart) activeReportCharts.push(userChart);
            }
        });

    } else {
        // No log data found for the selected period
        reportChartsContainer.innerHTML = `<p class="text-gray-500 text-center col-span-full py-10">この期間の業務記録はありません。</p>`;
    }
    // --- End Render Charts ---
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

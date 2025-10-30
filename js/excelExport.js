// js/excelExport.js
import { allUserLogs, fetchAllUserLogs } from "../main.js"; // Import global log data and fetch function
import { formatHoursAndMinutesSimple } from "../utils.js"; // Import formatting function
import { exportExcelModal } from "../components/modal.js"; // Import modal element reference

// --- DOM Element references for the modal ---
const yearSelect = document.getElementById("export-year-select");
const monthSelect = document.getElementById("export-month-select");
const confirmButton = document.getElementById("confirm-export-excel-btn");
const cancelButton = document.getElementById("cancel-export-excel-btn");

/**
 * Sets up event listeners for the Excel export modal.
 * Should be called once during application initialization.
 */
export function setupExcelExportEventListeners() {
    confirmButton?.addEventListener("click", handleExportExcel);
    cancelButton?.addEventListener("click", closeExportExcelModal);
}

/**
 * Opens the Excel export modal and populates the year/month dropdowns.
 */
export function openExportExcelModal() {
    if (!yearSelect || !monthSelect || !exportExcelModal) {
        console.error("Excel export modal elements not found.");
        alert("Excel出力機能の準備ができていません。");
        return;
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-based month

    // Populate Year dropdown (e.g., last 5 years)
    yearSelect.innerHTML = "";
    for (let i = 0; i < 5; i++) {
        const year = currentYear - i;
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        if (i === 0) option.selected = true; // Select current year by default
        yearSelect.appendChild(option);
    }

    // Populate Month dropdown
    monthSelect.innerHTML = "";
    for (let i = 1; i <= 12; i++) {
        const option = document.createElement("option");
        option.value = i;
        option.textContent = `${i}月`;
        if (i === currentMonth) option.selected = true; // Select current month by default
        monthSelect.appendChild(option);
    }

    exportExcelModal.classList.remove("hidden"); // Show the modal
}

/**
 * Closes the Excel export modal.
 */
function closeExportExcelModal() {
    if (exportExcelModal) {
        exportExcelModal.classList.add("hidden");
    }
}

/**
 * Handles the generation and download of the Excel file based on the selected year and month.
 */
async function handleExportExcel() {
    if (!yearSelect || !monthSelect) {
        console.error("Year/Month select elements not found for export.");
        return;
    }

    const year = yearSelect.value;
    const month = monthSelect.value.padStart(2, "0"); // Ensure two digits (e.g., "01", "12")
    const monthStr = `${year}-${month}`; // YYYY-MM format

    console.log(`Exporting Excel for month: ${monthStr}`);
    confirmButton.disabled = true; // Disable button during processing
    confirmButton.textContent = "出力中...";

    // Ensure the latest logs are available
    await fetchAllUserLogs();

    // Filter logs for the selected month
    const logsForMonth = allUserLogs.filter(
        (log) => log.date && log.date.startsWith(monthStr)
    );

    if (logsForMonth.length === 0) {
        alert("選択された月のログデータはありません。");
        confirmButton.disabled = false;
        confirmButton.textContent = "出力";
        return;
    }

    // --- Generate Excel Data ---
    try {
        const wb = XLSX.utils.book_new(); // Create a new workbook

        // --- Sheet 1: Monthly Summary ---
        const monthlySummaryData = {}; // { userName: { taskName: duration } }
        const monthlyTaskTotals = {}; // { taskName: duration }
        // Get unique users and tasks for the month, sorted
        const usersInMonth = [...new Set(logsForMonth.map((log) => log.userName).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ja"));
        const allTasksInMonth = [...new Set(
            logsForMonth.map((l) => l.task?.startsWith("その他_") ? l.task.substring(4) : l.task) // Clean task names
                      .filter((t) => t && t !== "休憩") // Filter out null/undefined and breaks
        )].sort((a,b)=>a.localeCompare(b,"ja"));

        // Initialize task totals
        allTasksInMonth.forEach((task) => { monthlyTaskTotals[task] = 0; });

        // Aggregate durations
        logsForMonth.forEach((log) => {
            // Skip irrelevant logs
            if (!log.userName || !log.task || log.task === "休憩" || log.type === "goal") return;

            const cleanTaskName = log.task.startsWith("その他_") ? log.task.substring(4) : log.task;

            // Initialize user entry if needed
            if (!monthlySummaryData[log.userName]) monthlySummaryData[log.userName] = {};
            // Initialize task entry for user if needed
            if (!monthlySummaryData[log.userName][cleanTaskName]) monthlySummaryData[log.userName][cleanTaskName] = 0;

            // Add duration
            monthlySummaryData[log.userName][cleanTaskName] += (log.duration || 0);
            if (monthlyTaskTotals[cleanTaskName] !== undefined) { // Check existence before adding
                 monthlyTaskTotals[cleanTaskName] += (log.duration || 0);
            }
        });

        // Prepare data array for worksheet (AoA format)
        const summarySheetData = [["従業員", ...allTasksInMonth]]; // Header row

        // Add total row
        const totalRow = ["合計時間"];
        allTasksInMonth.forEach((task) => {
            totalRow.push(formatHoursAndMinutesSimple(monthlyTaskTotals[task])); // Format as H:MM
        });
        summarySheetData.push(totalRow);

        // Add rows for each user
        usersInMonth.forEach((user) => {
            const row = [user];
            allTasksInMonth.forEach((task) => {
                const durationSeconds = (monthlySummaryData[user] && monthlySummaryData[user][task]) || 0;
                row.push(formatHoursAndMinutesSimple(durationSeconds)); // Format as H:MM
            });
            summarySheetData.push(row);
        });

        const wsSummary = XLSX.utils.aoa_to_sheet(summarySheetData);
         // Auto-adjust column widths (optional, requires specific structure or helper)
         // Example: wsSummary['!cols'] = [{wch:20}, {wch:15}, ...]; // Set widths manually if needed
        XLSX.utils.book_append_sheet(wb, wsSummary, "月次サマリー(時間)");

        // --- Sheet 2+: Daily Summaries ---
        const uniqueDates = [...new Set(logsForMonth.map((log) => log.date).filter(Boolean))].sort();

        uniqueDates.forEach((dateStr) => {
            const logsForDay = logsForMonth.filter((log) => log.date === dateStr);
            const dailySummaryData = {}; // { userName: { taskName: duration } }
            const dailyTaskTotals = {}; // { taskName: duration }
            const tasksOnDay = [...new Set(
                 logsForDay.map((l) => l.task?.startsWith("その他_") ? l.task.substring(4) : l.task)
                           .filter((t) => t && t !== "休憩")
            )].sort((a,b)=>a.localeCompare(b,"ja"));

            // Initialize daily totals
            tasksOnDay.forEach((task) => { dailyTaskTotals[task] = 0; });

            // Aggregate daily durations
            logsForDay.forEach((log) => {
                if (!log.userName || !log.task || log.task === "休憩" || log.type === "goal") return;
                const cleanTaskName = log.task.startsWith("その他_") ? log.task.substring(4) : log.task;

                if (!dailySummaryData[log.userName]) dailySummaryData[log.userName] = {};
                if (!dailySummaryData[log.userName][cleanTaskName]) dailySummaryData[log.userName][cleanTaskName] = 0;

                dailySummaryData[log.userName][cleanTaskName] += (log.duration || 0);
                 if (dailyTaskTotals[cleanTaskName] !== undefined) {
                     dailyTaskTotals[cleanTaskName] += (log.duration || 0);
                 }
            });

            // Prepare AoA data for daily sheet
            const dailySheetData = [["従業員", ...tasksOnDay]]; // Header

            // Add total row for the day
            const dailyTotalRow = ["合計時間"];
            tasksOnDay.forEach((task) => {
                dailyTotalRow.push(formatHoursAndMinutesSimple(dailyTaskTotals[task]));
            });
            dailySheetData.push(dailyTotalRow);

            // Add rows for each user (include all users from the month for consistency)
            usersInMonth.forEach((user) => {
                const row = [user];
                tasksOnDay.forEach((task) => {
                    const durationSeconds = (dailySummaryData[user] && dailySummaryData[user][task]) || 0;
                    row.push(formatHoursAndMinutesSimple(durationSeconds));
                });
                dailySheetData.push(row);
            });

            const wsDaily = XLSX.utils.aoa_to_sheet(dailySheetData);
            // Auto-adjust column widths (optional)
            XLSX.utils.book_append_sheet(wb, wsDaily, `稼働時間_${dateStr}`); // Sheet name includes date
        });

        // --- Download File ---
        const fileName = `業務記録_${year}年${month}月.xlsx`;
        XLSX.writeFile(wb, fileName);
        console.log(`Excel file "${fileName}" generated.`);

        closeExportExcelModal(); // Close modal on success

    } catch (error) {
        console.error("Error generating Excel file:", error);
        alert("Excelファイルの生成中にエラーが発生しました。");
    } finally {
        // Re-enable button regardless of success or error
        confirmButton.disabled = false;
        confirmButton.textContent = "出力";
    }
}

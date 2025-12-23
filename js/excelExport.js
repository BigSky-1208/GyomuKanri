// js/excelExport.js
import { db } from "./firebase.js"; // Correct: Same directory
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { formatHoursAndMinutesSimple, getMonthDateRange } from "./utils.js"; // Correct: Same directory
// ★修正: js/excelExport.js から見て js/components/modal.js は ./components/modal.js
import { exportExcelModal } from "./components/modal/index.js"; 

const yearSelect = document.getElementById("export-year-select");
const monthSelect = document.getElementById("export-month-select");
const confirmButton = document.getElementById("confirm-export-excel-btn");
const cancelButton = document.getElementById("cancel-export-excel-btn");

export function setupExcelExportEventListeners() {
    confirmButton?.addEventListener("click", handleExportExcel);
    cancelButton?.addEventListener("click", closeExportExcelModal);
}

export function openExportExcelModal() {
    if (!yearSelect || !monthSelect || !exportExcelModal) {
        console.error("Excel export modal elements not found.");
        alert("Excel出力機能の準備ができていません。");
        return;
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    yearSelect.innerHTML = "";
    for (let i = 0; i < 5; i++) {
        const year = currentYear - i;
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        if (i === 0) option.selected = true;
        yearSelect.appendChild(option);
    }

    monthSelect.innerHTML = "";
    for (let i = 1; i <= 12; i++) {
        const option = document.createElement("option");
        option.value = i;
        option.textContent = `${i}月`;
        if (i === currentMonth) option.selected = true;
        monthSelect.appendChild(option);
    }

    exportExcelModal.classList.remove("hidden");
}

function closeExportExcelModal() {
    if (exportExcelModal) {
        exportExcelModal.classList.add("hidden");
    }
}

async function handleExportExcel() {
    if (!yearSelect || !monthSelect) {
        console.error("Year/Month select elements not found for export.");
        return;
    }

    const year = parseInt(yearSelect.value, 10);
    const month = parseInt(monthSelect.value, 10);
    
    // 選択された月の初日と末日を取得
    const targetDate = new Date(year, month - 1, 1);
    const { start, end } = getMonthDateRange(targetDate);

    console.log(`Exporting Excel for period: ${start} to ${end}`);
    confirmButton.disabled = true;
    confirmButton.textContent = "データ取得中...";

    let logsForMonth = [];

    try {
        // 指定された月のデータのみをFirestoreから取得
        const q = query(
            collection(db, "work_logs"),
            where("date", ">=", start),
            where("date", "<=", end)
        );
        
        const querySnapshot = await getDocs(q);
        logsForMonth = querySnapshot.docs.map(doc => {
            const data = doc.data();
            // Excel出力に必要なフィールドがあるか確認
            return { id: doc.id, ...data };
        });

    } catch (error) {
        console.error("Error fetching logs for export:", error);
        alert("ログデータの取得中にエラーが発生しました。\n\n※インデックスが未作成の場合は、ブラウザのコンソールを確認してリンクから作成してください。");
        confirmButton.disabled = false;
        confirmButton.textContent = "出力";
        return;
    }

    if (logsForMonth.length === 0) {
        alert("選択された月のログデータはありません。");
        confirmButton.disabled = false;
        confirmButton.textContent = "出力";
        return;
    }

    confirmButton.textContent = "生成中...";

    // --- Generate Excel Data (ロジックは変更なし、データソースのみ変更) ---
    try {
        const wb = XLSX.utils.book_new();

        // --- Sheet 1: Monthly Summary ---
        const monthlySummaryData = {}; 
        const monthlyTaskTotals = {}; 
        const usersInMonth = [...new Set(logsForMonth.map((log) => log.userName).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ja"));
        const allTasksInMonth = [...new Set(
            logsForMonth.map((l) => l.task?.startsWith("その他_") ? l.task.substring(4) : l.task)
                      .filter((t) => t && t !== "休憩")
        )].sort((a,b)=>a.localeCompare(b,"ja"));

        allTasksInMonth.forEach((task) => { monthlyTaskTotals[task] = 0; });

        logsForMonth.forEach((log) => {
            if (!log.userName || !log.task || log.task === "休憩" || log.type === "goal") return;

            const cleanTaskName = log.task.startsWith("その他_") ? log.task.substring(4) : log.task;

            if (!monthlySummaryData[log.userName]) monthlySummaryData[log.userName] = {};
            if (!monthlySummaryData[log.userName][cleanTaskName]) monthlySummaryData[log.userName][cleanTaskName] = 0;

            monthlySummaryData[log.userName][cleanTaskName] += (log.duration || 0);
            if (monthlyTaskTotals[cleanTaskName] !== undefined) {
                 monthlyTaskTotals[cleanTaskName] += (log.duration || 0);
            }
        });

        const summarySheetData = [["従業員", ...allTasksInMonth]];

        const totalRow = ["合計時間"];
        allTasksInMonth.forEach((task) => {
            totalRow.push(formatHoursAndMinutesSimple(monthlyTaskTotals[task]));
        });
        summarySheetData.push(totalRow);

        usersInMonth.forEach((user) => {
            const row = [user];
            allTasksInMonth.forEach((task) => {
                const durationSeconds = (monthlySummaryData[user] && monthlySummaryData[user][task]) || 0;
                row.push(formatHoursAndMinutesSimple(durationSeconds));
            });
            summarySheetData.push(row);
        });

        const wsSummary = XLSX.utils.aoa_to_sheet(summarySheetData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "月次サマリー(時間)");

        // --- Sheet 2+: Daily Summaries ---
        const uniqueDates = [...new Set(logsForMonth.map((log) => log.date).filter(Boolean))].sort();

        uniqueDates.forEach((dateStr) => {
            const logsForDay = logsForMonth.filter((log) => log.date === dateStr);
            const dailySummaryData = {};
            const dailyTaskTotals = {};
            const tasksOnDay = [...new Set(
                 logsForDay.map((l) => l.task?.startsWith("その他_") ? l.task.substring(4) : l.task)
                           .filter((t) => t && t !== "休憩")
            )].sort((a,b)=>a.localeCompare(b,"ja"));

            tasksOnDay.forEach((task) => { dailyTaskTotals[task] = 0; });

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

            const dailySheetData = [["従業員", ...tasksOnDay]];

            const dailyTotalRow = ["合計時間"];
            tasksOnDay.forEach((task) => {
                dailyTotalRow.push(formatHoursAndMinutesSimple(dailyTaskTotals[task]));
            });
            dailySheetData.push(dailyTotalRow);

            usersInMonth.forEach((user) => {
                const row = [user];
                tasksOnDay.forEach((task) => {
                    const durationSeconds = (dailySummaryData[user] && dailySummaryData[user][task]) || 0;
                    row.push(formatHoursAndMinutesSimple(durationSeconds));
                });
                dailySheetData.push(row);
            });

            const wsDaily = XLSX.utils.aoa_to_sheet(dailySheetData);
            XLSX.utils.book_append_sheet(wb, wsDaily, `稼働時間_${dateStr}`);
        });

        const fileName = `業務記録_${year}年${month}月.xlsx`;
        XLSX.writeFile(wb, fileName);
        console.log(`Excel file "${fileName}" generated.`);

        closeExportExcelModal();

    } catch (error) {
        console.error("Error generating Excel file:", error);
        alert("Excelファイルの生成中にエラーが発生しました。");
    } finally {
        confirmButton.disabled = false;
        confirmButton.textContent = "出力";
    }
}

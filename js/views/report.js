// js/views/report.js
import { db } from "../../firebase.js"; // Firestoreインスタンス
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { handleGoBack } from "../../main.js";
import { renderUnifiedCalendar } from "../components/calendar.js";
import { createPieChart, destroyCharts } from "../components/chart.js";
import { formatDuration, formatHoursMinutes, getMonthDateRange } from "../utils.js"; // helperをimport

let currentReportDate = new Date();
let activeReportCharts = [];
let selectedReportDateStr = null;
let currentMonthLogs = []; // ★ 現在表示中の月のログを保持するローカル変数

const reportCalendarEl = document.getElementById("report-calendar");
const reportMonthYearEl = document.getElementById("report-calendar-month-year");
const reportPrevMonthBtn = document.getElementById("report-prev-month-btn");
const reportNextMonthBtn = document.getElementById("report-next-month-btn");
const reportTitleEl = document.getElementById("report-title");
const reportChartsContainer = document.getElementById("report-charts-container");
const backButton = document.getElementById("back-to-host-from-report");

export async function initializeReportView() {
    console.log("Initializing Report View...");
    currentReportDate = new Date();
    selectedReportDateStr = null;
    
    // 初期化時に今月のデータを取得して表示
    await fetchAndRenderForCurrentMonth();
}

export function cleanupReportView() {
    console.log("Cleaning up Report View...");
    destroyCharts(activeReportCharts);
    activeReportCharts = [];
    selectedReportDateStr = null;
    currentMonthLogs = []; // データをクリア
}

export function setupReportEventListeners() {
    reportPrevMonthBtn?.addEventListener("click", () => moveReportMonth(-1));
    reportNextMonthBtn?.addEventListener("click", () => moveReportMonth(1));
    backButton?.addEventListener("click", handleGoBack);
}

// ★ 新規: 現在の月（currentReportDate）のデータを取得し、描画する関数
async function fetchAndRenderForCurrentMonth() {
    const { start, end } = getMonthDateRange(currentReportDate);
    console.log(`Fetching report logs for ${start} to ${end}`);

    // ローディング表示などを入れると親切
    if(reportTitleEl) reportTitleEl.textContent = "データを読み込み中...";

    try {
        const q = query(
            collection(db, "work_logs"),
            where("date", ">=", start),
            where("date", "<=", end)
        );
        const snapshot = await getDocs(q);
        currentMonthLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        renderReportCalendar();       
        renderReportChartsForMonth(); 

    } catch (error) {
        console.error("Error fetching report logs:", error);
        if(reportChartsContainer) reportChartsContainer.innerHTML = `<p class="text-red-500 text-center">データの取得中にエラーが発生しました。</p>`;
    }
}

function renderReportCalendar() {
    if (!reportCalendarEl || !reportMonthYearEl) return;
    
    renderUnifiedCalendar({
        calendarEl: reportCalendarEl,
        monthYearEl: reportMonthYearEl,
        dateToDisplay: currentReportDate,
        logs: currentMonthLogs, // ★ ローカル変数を使用
        onDayClick: (e) => {
            const dateStr = e.currentTarget.dataset.date;
            selectedReportDateStr = dateStr;
            reportCalendarEl.querySelectorAll(".calendar-day.selected").forEach(el => el.classList.remove("selected"));
            e.currentTarget.classList.add("selected");
            renderReportChartsForDay(dateStr);
        },
        onMonthClick: () => {
             selectedReportDateStr = null;
             reportCalendarEl.querySelectorAll(".calendar-day.selected").forEach(el => el.classList.remove("selected"));
             renderReportChartsForMonth();
        },
    });
     if(selectedReportDateStr){
        const dayElement = reportCalendarEl.querySelector(`.calendar-day[data-date="${selectedReportDateStr}"]`);
        dayElement?.classList.add('selected');
     }
}

async function moveReportMonth(direction) {
    selectedReportDateStr = null;
    currentReportDate.setMonth(currentReportDate.getMonth() + direction);
    // 月移動時は必ずデータをフェッチし直す
    await fetchAndRenderForCurrentMonth();
}

function renderReportChartsForMonth() {
     if (!reportTitleEl) return;
    const year = currentReportDate.getFullYear();
    const month = currentReportDate.getMonth();
    reportTitleEl.textContent = `${year}年 ${month + 1}月 月次レポート`;

    // 既に今月分のみに絞り込まれているので、そのまま渡す
    renderReportCharts(currentMonthLogs);
}

function renderReportChartsForDay(dateStr) {
     if (!reportTitleEl || !dateStr) return;
    reportTitleEl.textContent = `${dateStr} 日次レポート`;

    // ローカルデータから該当日のみフィルタリング
    const logsForDay = currentMonthLogs.filter((log) => log.date === dateStr);
    renderReportCharts(logsForDay);
}

function renderReportCharts(logs) {
    if (!reportChartsContainer) return;

    destroyCharts(activeReportCharts);
    activeReportCharts = [];
    reportChartsContainer.innerHTML = "";

    // --- 集計ロジック (変更なし) ---
    const personalData = {};
    const totalData = {};
    const allTasksSet = new Set();

    logs.forEach((log) => {
        if (!log.userName || !log.task || log.task === "休憩" || log.type === "goal") return;

        const taskName = log.task.startsWith("その他_") ? log.task.substring(4) : log.task;
        allTasksSet.add(taskName);

        if (!totalData[taskName]) totalData[taskName] = 0;
        totalData[taskName] += (log.duration || 0);

        if (!personalData[log.userName]) personalData[log.userName] = {};
        if (!personalData[log.userName][taskName]) personalData[log.userName][taskName] = 0;
        personalData[log.userName][taskName] += (log.duration || 0);
    });

    const taskColorMap = {};
    const uniqueTasks = Array.from(allTasksSet).sort((a, b) => a.localeCompare(b, "ja"));
    uniqueTasks.forEach((task, index) => {
        const hue = (index * 137.508) % 360;
        taskColorMap[task] = `hsl(${hue}, 70%, 60%)`;
    });

    if (Object.keys(totalData).length > 0) {
        // 全体チャート描画
        const totalDuration = Object.values(totalData).reduce((sum, duration) => sum + duration, 0);
        const totalChartWrapper = document.createElement("div");
        totalChartWrapper.className = "p-4 border rounded-lg bg-white shadow";
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

        const totalListContainer = totalChartWrapper.querySelector("#total-report-list");
        const sortedTotalTasks = Object.entries(totalData).sort(([, a], [, b]) => b - a);
        let totalListHtml = '<ul class="space-y-1">';
        sortedTotalTasks.forEach(([task, duration]) => {
            const color = taskColorMap[task] || "#CCCCCC";
             totalListHtml += `
                 <li class="flex items-center justify-between p-1.5 rounded-md hover:bg-gray-50">
                     <span class="flex items-center"><span class="w-3 h-3 rounded-full mr-2 flex-shrink-0" style="background-color: ${color};"></span>${escapeHtml(task)}</span>
                     <span class="font-mono ml-2 flex-shrink-0">${formatHoursMinutes(duration)}</span>
                 </li>`;
        });
        totalListHtml += "</ul>";
        if(totalListContainer) totalListContainer.innerHTML = totalListHtml;

        const totalCtx = totalChartWrapper.querySelector("#total-report-chart-canvas")?.getContext("2d");
        if (totalCtx) {
            const totalChart = createPieChart(totalCtx, totalData, taskColorMap, false);
            if (totalChart) activeReportCharts.push(totalChart);
        }

        // 個人チャート描画
        const sortedUserNames = Object.keys(personalData).sort((a, b) => a.localeCompare(b, "ja"));
        sortedUserNames.forEach((name) => {
            const userData = personalData[name];
            const userDuration = Object.values(userData).reduce((sum, duration) => sum + duration, 0);
            if (userDuration <= 0) return;

            const userChartWrapper = document.createElement("div");
            userChartWrapper.className = "p-4 border rounded-lg bg-white shadow flex flex-col";
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

            const userCtx = userChartWrapper.querySelector("canvas")?.getContext("2d");
            if (userCtx) {
                const userChart = createPieChart(userCtx, userData, taskColorMap, false);
                 if (userChart) activeReportCharts.push(userChart);
            }
        });

    } else {
        reportChartsContainer.innerHTML = `<p class="text-gray-500 text-center col-span-full py-10">この期間の業務記録はありません。</p>`;
    }
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

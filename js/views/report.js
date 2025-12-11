// js/views/report.js
import { db } from "../firebase.js"; 
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { handleGoBack } from "../main.js"; 
import { renderUnifiedCalendar } from "../components/calendar.js";
import { renderChart, destroyCharts } from "../components/chart.js";
import { formatDuration, formatHoursMinutes, getMonthDateRange, escapeHtml } from "../utils.js";

let currentReportDate = new Date();
let activeReportCharts = [];
let selectedReportDateStr = null;
let currentMonthLogs = []; 

const reportCalendarEl = document.getElementById("report-calendar");
const reportMonthYearEl = document.getElementById("report-calendar-month-year");
const reportPrevMonthBtn = document.getElementById("report-prev-month-btn");
const reportNextMonthBtn = document.getElementById("report-next-month-btn");
const reportTitleEl = document.getElementById("report-title");
const reportChartsContainer = document.getElementById("report-charts-container");
const backButton = document.getElementById("back-to-host-from-report");

// --- 初期化・クリーンアップ関数 ---

export async function initializeReportView() {
    console.log("Initializing Report View...");
    currentReportDate = new Date();
    selectedReportDateStr = null;
    
    await fetchAndRenderForCurrentMonth();
}

export function cleanupReportView() {
    console.log("Cleaning up Report View...");
    destroyCharts(activeReportCharts);
    activeReportCharts = [];
    selectedReportDateStr = null;
    currentMonthLogs = [];
    if (reportChartsContainer) reportChartsContainer.innerHTML = "";
}

export function setupReportEventListeners() {
    reportPrevMonthBtn?.addEventListener("click", () => moveReportMonth(-1));
    reportNextMonthBtn?.addEventListener("click", () => moveReportMonth(1));
    backButton?.addEventListener("click", handleGoBack);
}

// --- データ取得・描画ロジック ---

async function fetchAndRenderForCurrentMonth() {
    const { start, end } = getMonthDateRange(currentReportDate);
    console.log(`Fetching report logs for ${start} to ${end}`);

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
        logs: currentMonthLogs, 
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
    await fetchAndRenderForCurrentMonth();
}

function renderReportChartsForMonth() {
     if (!reportTitleEl) return;
    const year = currentReportDate.getFullYear();
    const month = currentReportDate.getMonth();
    reportTitleEl.textContent = `${year}年 ${month + 1}月 月次レポート`;

    renderReportCharts(currentMonthLogs);
}

function renderReportChartsForDay(dateStr) {
     if (!reportTitleEl || !dateStr) return;
    reportTitleEl.textContent = `${dateStr} 日次レポート`;

    const logsForDay = currentMonthLogs.filter((log) => log.date === dateStr);
    renderReportCharts(logsForDay);
}

function renderReportCharts(logs) {
    if (!reportChartsContainer) return;

    destroyCharts(activeReportCharts);
    activeReportCharts = [];
    
    reportChartsContainer.className = "space-y-12"; 
    reportChartsContainer.innerHTML = "";

    // 1. 集計処理
    const userStats = new Map(); // userId -> { name, tasks: Map<taskName, duration> }
    const grandTotalTasks = new Map();
    let grandTotalDuration = 0;

    logs.forEach(log => {
        if (!log.userName || !log.task || log.task === "休憩" || log.type === "goal") return;

        const taskName = log.task.startsWith("その他_") ? log.task.substring(4) : log.task;
        const userId = log.userId || log.userName; 

        if (!userStats.has(userId)) {
            userStats.set(userId, { name: log.userName, tasks: new Map() });
        }
        const user = userStats.get(userId);
        const currentDuration = user.tasks.get(taskName) || 0;
        user.tasks.set(taskName, currentDuration + (log.duration || 0));

        const totalTaskDuration = grandTotalTasks.get(taskName) || 0;
        grandTotalTasks.set(taskName, totalTaskDuration + (log.duration || 0));
        grandTotalDuration += (log.duration || 0);
    });

    if (grandTotalDuration === 0) {
        reportChartsContainer.innerHTML = `<p class="text-gray-500 text-center col-span-full py-10">この期間の業務記録はありません。</p>`;
        return;
    }

    // 2. レイアウトの作成

    // A. 全体合計用コンテナ
    const totalSectionTitle = document.createElement("h3");
    totalSectionTitle.className = "text-xl font-bold text-gray-700 mb-4 text-center border-b pb-2";
    totalSectionTitle.textContent = "全従業員 合計";
    reportChartsContainer.appendChild(totalSectionTitle);

    const totalWrapper = document.createElement("div");
    totalWrapper.className = "w-full md:w-2/3 mx-auto mb-12 bg-white p-6 rounded-lg shadow-md border border-gray-100";
    reportChartsContainer.appendChild(totalWrapper);

    // ★修正: 全体合計のカード作成時に userStats (内訳用データ) を渡す
    createChartCard(totalWrapper, "全従業員", grandTotalTasks, grandTotalDuration, true, userStats);

    // B. 個別従業員用コンテナ
    if (userStats.size > 0) {
        const employeeSectionTitle = document.createElement("h3");
        employeeSectionTitle.className = "text-xl font-bold text-gray-700 mb-4 border-b pb-2";
        employeeSectionTitle.textContent = "従業員別 詳細";
        reportChartsContainer.appendChild(employeeSectionTitle);

        const gridContainer = document.createElement("div");
        gridContainer.className = "grid grid-cols-1 md:grid-cols-2 gap-8";
        reportChartsContainer.appendChild(gridContainer);

        const sortedUsers = Array.from(userStats.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name, "ja"));

        sortedUsers.forEach(([userId, stats]) => {
            const card = document.createElement("div");
            card.className = "bg-white p-4 rounded shadow border border-gray-200 flex flex-col";
            
            let totalUserDuration = 0;
            stats.tasks.forEach(d => totalUserDuration += d);

            if (totalUserDuration > 0) {
                // 個別カードには内訳データ(userStats)は渡さない(null)
                createChartCard(card, stats.name, stats.tasks, totalUserDuration, false, null);
                gridContainer.appendChild(card);
            }
        });
    }
}

/**
 * チャートと詳細リストを含むカードの中身を生成するヘルパー関数
 * @param {HTMLElement} parentElement 追加先の要素
 * @param {string} title タイトル
 * @param {Map} tasksMap タスクデータ
 * @param {number} totalDuration 合計時間
 * @param {boolean} isLarge 全体表示かどうか
 * @param {Map} allUserStats 内訳表示用の全ユーザーデータ (省略可)
 */
function createChartCard(parentElement, title, tasksMap, totalDuration, isLarge, allUserStats = null) {
    // 1. ヘッダー
    const header = document.createElement("div");
    header.className = "flex justify-between items-center mb-4 border-b pb-2";
    
    const nameEl = document.createElement("h3");
    nameEl.className = isLarge ? "text-xl font-bold text-indigo-700" : "text-lg font-semibold text-gray-700";
    nameEl.textContent = title;
    
    const timeEl = document.createElement("span");
    timeEl.className = "text-sm font-medium text-gray-500";
    timeEl.textContent = `合計: ${formatHoursMinutes(totalDuration)}`;

    header.appendChild(nameEl);
    header.appendChild(timeEl);
    parentElement.appendChild(header);

    // 2. チャート描画エリア
    const canvasContainer = document.createElement("div");
    canvasContainer.className = isLarge ? "relative h-80 w-full" : "relative h-64 w-full";
    const canvas = document.createElement("canvas");
    canvasContainer.appendChild(canvas);
    parentElement.appendChild(canvasContainer);

    // データを整形でソート（降順）
    const sortedTasks = Array.from(tasksMap.entries()).sort((a, b) => b[1] - a[1]);
    const labels = sortedTasks.map(t => t[0]);
    const dataPoints = sortedTasks.map(t => Math.round(t[1] / 3600 * 10) / 10); 

    const chartInstance = renderChart(canvas, labels, dataPoints, title);
    if (chartInstance) {
        activeReportCharts.push(chartInstance);
    }

    const backgroundColors = chartInstance?.data?.datasets[0]?.backgroundColor || [];

    // 3. 詳細リスト
    const listContainer = document.createElement("div");
    // ★修正: リストの高さを拡大 (max-h-40 -> max-h-96)
    listContainer.className = "mt-4 text-sm text-gray-600 max-h-96 overflow-y-auto custom-scrollbar";
    
    const ul = document.createElement("ul");
    ul.className = "space-y-1";

    sortedTasks.forEach(([taskName, duration], index) => {
        const percentage = totalDuration > 0 ? Math.round((duration / totalDuration) * 100) : 0;
        const color = backgroundColors[index] || '#cccccc';

        const li = document.createElement("li");
        // ★修正: クリック可能な場合はカーソルを変更し、レイアウトを縦並び(flex-col)に変更
        const cursorClass = allUserStats ? "cursor-pointer" : "";
        li.className = `flex flex-col px-2 py-1 hover:bg-gray-50 rounded border-b border-gray-100 last:border-0 ${cursorClass}`;
        
        // 業務名の行
        const rowDiv = document.createElement("div");
        rowDiv.className = "flex justify-between items-center w-full";
        rowDiv.innerHTML = `
            <div class="flex items-center truncate mr-2 flex-1" title="${escapeHtml(taskName)}">
                <span class="w-3 h-3 rounded-full mr-2 flex-shrink-0" style="background-color: ${color};"></span>
                <span class="truncate font-medium">${escapeHtml(taskName)}</span>
                ${allUserStats ? '<span class="text-xs text-gray-400 ml-2 toggle-icon">▼</span>' : ''}
            </div>
            <div class="flex items-center gap-2 whitespace-nowrap">
                <span class="font-mono text-gray-800">${formatHoursMinutes(duration)}</span>
                <span class="text-xs text-gray-400 w-8 text-right">(${percentage}%)</span>
            </div>
        `;
        li.appendChild(rowDiv);

        // ★修正: 内訳表示用のコンテナを追加
        if (allUserStats) {
            const breakdownDiv = document.createElement("div");
            breakdownDiv.className = "hidden pl-6 mt-2 pb-2 text-xs text-gray-600 border-l-2 border-gray-200 ml-1.5 space-y-1 bg-gray-50 rounded-r";
            
            // クリックイベントの設定
            li.addEventListener("click", (e) => {
                e.stopPropagation();
                
                if (breakdownDiv.classList.contains("hidden")) {
                    // 表示: データがまだなければ生成
                    if (breakdownDiv.innerHTML === "") {
                        const contributors = [];
                        allUserStats.forEach((stats) => {
                            const userTaskDuration = stats.tasks.get(taskName);
                            if (userTaskDuration > 0) {
                                contributors.push({ name: stats.name, duration: userTaskDuration });
                            }
                        });
                        contributors.sort((a, b) => b.duration - a.duration);
                        
                        if (contributors.length === 0) {
                            breakdownDiv.innerHTML = "<div class='p-2'>データなし</div>";
                        } else {
                            contributors.forEach(c => {
                                const dEl = document.createElement("div");
                                dEl.className = "flex justify-between hover:bg-gray-200 p-1 rounded px-2";
                                dEl.innerHTML = `<span>${escapeHtml(c.name)}</span><span class="font-mono">${formatHoursMinutes(c.duration)}</span>`;
                                breakdownDiv.appendChild(dEl);
                            });
                        }
                    }
                    breakdownDiv.classList.remove("hidden");
                    const icon = rowDiv.querySelector(".toggle-icon");
                    if(icon) icon.textContent = "▲";
                } else {
                    // 非表示
                    breakdownDiv.classList.add("hidden");
                    const icon = rowDiv.querySelector(".toggle-icon");
                    if(icon) icon.textContent = "▼";
                }
            });
            li.appendChild(breakdownDiv);
        }

        ul.appendChild(li);
    });

    listContainer.appendChild(ul);
    parentElement.appendChild(listContainer);
}

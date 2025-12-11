// js/views/report.js
import { db } from "../main.js";
import { collection, query, where, getDocs, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { renderChart } from "../components/chart.js";
import { formatDuration } from "../utils.js";

export async function renderMonthlyReport() {
    const reportMonthInput = document.getElementById("report-month");
    const generateBtn = document.getElementById("generate-report-btn");
    const chartsContainer = document.getElementById("report-charts-container");

    // Set default month to current month
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    reportMonthInput.value = `${year}-${month}`;

    generateBtn.addEventListener("click", async () => {
        const selectedMonth = reportMonthInput.value;
        if (!selectedMonth) {
            alert("月を選択してください。");
            return;
        }

        chartsContainer.innerHTML = '<p class="text-center text-gray-500">データを読み込み中...</p>';
        
        try {
            const data = await fetchMonthlyData(selectedMonth);
            
            // データが存在しない場合
            if (data.userStats.size === 0) {
                chartsContainer.innerHTML = '<p class="text-center text-gray-500">選択された月のデータはありません。</p>';
                return;
            }

            renderReports(data, chartsContainer);
        } catch (error) {
            console.error("Error generating report:", error);
            chartsContainer.innerHTML = '<p class="text-center text-red-500">レポートの生成中にエラーが発生しました。</p>';
        }
    });
}

async function fetchMonthlyData(monthStr) {
    const [year, month] = monthStr.split("-");
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // "date" field is stored as string "YYYY-MM-DD"
    // To handle string comparison correctly for the month, we can format start and end date strings
    // Or simpler: fetch wider range or filter in memory if dataset is small.
    // Given the current structure, let's fetch by date string range.
    
    // Correct string range for the month
    // Assuming date format "YYYY-MM-DD"
    const startStr = `${year}-${month}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endStr = `${year}-${month}-${lastDay}`;

    const q = query(
        collection(db, "work_logs"),
        where("date", ">=", startStr),
        where("date", "<=", endStr)
    );

    const snapshot = await getDocs(q);
    return aggregateData(snapshot);
}

function aggregateData(snapshot) {
    const userStats = new Map(); // userId -> { name, tasks: Map<taskName, duration> }

    snapshot.forEach(doc => {
        const data = doc.data();
        const { userId, userName, task, duration } = data;

        if (!userStats.has(userId)) {
            userStats.set(userId, { name: userName, tasks: new Map() });
        }

        const user = userStats.get(userId);
        const currentDuration = user.tasks.get(task) || 0;
        user.tasks.set(task, currentDuration + duration);
    });

    return { userStats };
}

function renderReports(data, container) {
    container.innerHTML = '';
    const { userStats } = data;

    // --- 1. 全従業員の合計データを計算 ---
    const grandTotalTasks = new Map();
    let grandTotalDuration = 0;

    userStats.forEach(user => {
        user.tasks.forEach((duration, taskName) => {
            const currentTotal = grandTotalTasks.get(taskName) || 0;
            grandTotalTasks.set(taskName, currentTotal + duration);
            grandTotalDuration += duration;
        });
    });

    // --- 2. レイアウトの作成 ---

    // A. 全体合計用コンテナ（上部・1カラム・中央寄せ）
    const totalSectionTitle = document.createElement("h3");
    totalSectionTitle.className = "text-xl font-bold text-gray-700 mb-4 text-center border-b pb-2";
    totalSectionTitle.textContent = "全従業員 合計";
    container.appendChild(totalSectionTitle);

    const totalWrapper = document.createElement("div");
    // 幅を制限して中央に配置 (md:w-2/3 mx-auto)
    totalWrapper.className = "w-full md:w-2/3 mx-auto mb-12 bg-white p-6 rounded-lg shadow-md border border-gray-100";
    container.appendChild(totalWrapper);

    // 全体チャートの描画
    createChartCard(totalWrapper, "全従業員", grandTotalTasks, grandTotalDuration, true);


    // B. 個別従業員用コンテナ（下部・2カラムグリッド）
    const employeeSectionTitle = document.createElement("h3");
    employeeSectionTitle.className = "text-xl font-bold text-gray-700 mb-4 border-b pb-2";
    employeeSectionTitle.textContent = "従業員別 詳細";
    container.appendChild(employeeSectionTitle);

    const gridContainer = document.createElement("div");
    // グリッドレイアウト: PCで2列 (md:grid-cols-2), スマホで1列, ギャップ広め
    gridContainer.className = "grid grid-cols-1 md:grid-cols-2 gap-8";
    container.appendChild(gridContainer);

    // 各従業員のチャートを描画してグリッドに追加
    userStats.forEach((stats, userId) => {
        const card = document.createElement("div");
        card.className = "bg-white p-4 rounded shadow border border-gray-200 flex flex-col";
        
        let totalUserDuration = 0;
        stats.tasks.forEach(d => totalUserDuration += d);

        // カードの中身を作成
        createChartCard(card, stats.name, stats.tasks, totalUserDuration, false);
        
        gridContainer.appendChild(card);
    });
}

/**
 * チャートと詳細リストを含むカードの中身を生成するヘルパー関数
 * @param {HTMLElement} parentElement - 追加先の要素
 * @param {string} title - チャートのタイトル（名前）
 * @param {Map} tasksMap - タスクデータのMap
 * @param {number} totalDuration - 合計時間（秒）
 * @param {boolean} isLarge - 全体用（大きく表示）かどうか
 */
function createChartCard(parentElement, title, tasksMap, totalDuration, isLarge) {
    // 1. ヘッダー（名前と合計時間）
    const header = document.createElement("div");
    header.className = "flex justify-between items-center mb-4 border-b pb-2";
    
    const nameEl = document.createElement("h3");
    nameEl.className = isLarge ? "text-xl font-bold text-indigo-700" : "text-lg font-semibold text-gray-700";
    nameEl.textContent = title;
    
    const timeEl = document.createElement("span");
    timeEl.className = "text-sm font-medium text-gray-500";
    timeEl.textContent = `合計: ${formatDuration(totalDuration)}`;

    header.appendChild(nameEl);
    header.appendChild(timeEl);
    parentElement.appendChild(header);

    // 2. チャート描画エリア
    const canvasContainer = document.createElement("div");
    // 全体用なら少し高さを大きくする
    canvasContainer.className = isLarge ? "relative h-80 w-full" : "relative h-64 w-full";
    const canvas = document.createElement("canvas");
    canvasContainer.appendChild(canvas);
    parentElement.appendChild(canvasContainer);

    // データを整形でソート（降順）
    const sortedTasks = Array.from(tasksMap.entries())
        .sort((a, b) => b[1] - a[1]);
    
    const labels = sortedTasks.map(t => t[0]);
    const dataPoints = sortedTasks.map(t => Math.round(t[1] / 3600 * 10) / 10); // 時間単位

    renderChart(canvas, labels, dataPoints, title);

    // 3. 詳細リスト（アコーディオンなどはせずシンプルに表示）
    const listContainer = document.createElement("div");
    listContainer.className = "mt-4 text-sm text-gray-600 max-h-40 overflow-y-auto"; // スクロール可能に
    
    const ul = document.createElement("ul");
    ul.className = "space-y-1";

    sortedTasks.forEach(([taskName, duration]) => {
        const percentage = totalDuration > 0 ? Math.round((duration / totalDuration) * 100) : 0;
        
        const li = document.createElement("li");
        li.className = "flex justify-between items-center px-2 py-1 hover:bg-gray-50 rounded";
        li.innerHTML = `
            <span class="truncate mr-2 flex-1" title="${taskName}">${taskName}</span>
            <div class="flex items-center gap-2 whitespace-nowrap">
                <span class="font-mono text-gray-800">${formatDuration(duration)}</span>
                <span class="text-xs text-gray-400 w-8 text-right">(${percentage}%)</span>
            </div>
        `;
        ul.appendChild(li);
    });

    listContainer.appendChild(ul);
    parentElement.appendChild(listContainer);
}

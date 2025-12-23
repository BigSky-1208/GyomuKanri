import { 
    db, 
    allTaskObjects, 
    handleGoBack,
    // ★追加: リロードなし更新用
    updateGlobalTaskObjects,
    refreshUIBasedOnTaskUpdate
} from "../main.js"; 
import { 
    collection, 
    query, 
    where, 
    getDocs,
    doc,
    setDoc // ★追加: 保存用
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { formatHoursMinutes, escapeHtml } from "../utils.js";
import { createLineChart, destroyCharts } from "../components/chart.js";

let selectedArchiveTaskName = null;
let selectedArchiveGoalId = null;
let archiveDatePageIndex = 0;
let archiveChartInstance = null;
let selectedGoalLogs = []; 

const archiveTaskListContainer = document.getElementById("archive-task-list");
const archiveGoalListContainer = document.getElementById("archive-goal-list");
const archiveGoalDetailsContainer = document.getElementById("archive-goal-details-container");
const archiveWeeklySummaryContainer = document.getElementById("archive-weekly-summary-container");
const archiveChartContainer = document.getElementById("archive-chart-container");
const archiveBackButton = document.getElementById("back-to-progress-from-archive");

export async function initializeArchiveView() {
    selectedArchiveTaskName = null;
    selectedArchiveGoalId = null;
    archiveDatePageIndex = 0;
    selectedGoalLogs = []; 

    renderArchiveTaskList();
    
    if(archiveGoalListContainer) archiveGoalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
    if(archiveGoalDetailsContainer) archiveGoalDetailsContainer.classList.add("hidden");
    if(archiveChartContainer) archiveChartContainer.classList.add("hidden");
    if(archiveWeeklySummaryContainer) archiveWeeklySummaryContainer.classList.add("hidden");
     destroyCharts([archiveChartInstance]);
     archiveChartInstance = null;
}

export function setupArchiveEventListeners() {
    archiveBackButton?.addEventListener('click', handleGoBack);

    archiveWeeklySummaryContainer?.addEventListener('click', (event) => {
        if (event.target.id === 'archive-prev-page-btn') {
            if (archiveDatePageIndex > 0) {
                archiveDatePageIndex--;
                renderArchiveWeeklySummary();
            }
        } else if (event.target.id === 'archive-next-page-btn') {
            const totalPages = calculateTotalPages();
            if (archiveDatePageIndex < totalPages - 1) {
                archiveDatePageIndex++;
                renderArchiveWeeklySummary();
            }
        }
    });

     archiveGoalDetailsContainer?.addEventListener('click', async (event) => {
        const target = event.target;
        const taskName = target.dataset.taskName;
        const goalId = target.dataset.goalId;

        if (!taskName || !goalId) return;

        // ★修正: リロードなしの内部関数を呼び出し
        if (target.classList.contains('restore-goal-btn')) {
            await handleRestoreGoal(taskName, goalId);
        } else if (target.classList.contains('delete-goal-btn')) {
            await handleDeleteGoal(taskName, goalId);
        }
     });

    archiveGoalListContainer?.addEventListener('click', async (event) => { 
        const button = event.target.closest('.list-item');
        if (button && button.dataset.goalId) {
            selectedArchiveGoalId = button.dataset.goalId;
            archiveDatePageIndex = 0;

             archiveGoalListContainer.querySelectorAll(".list-item").forEach(item => item.classList.remove("selected", "bg-indigo-100"));
             button.classList.add("selected", "bg-indigo-100");

            await fetchLogsForGoal(selectedArchiveGoalId);

            renderArchiveGoalDetails();
            renderArchiveWeeklySummary();
        }
    });

    archiveTaskListContainer?.addEventListener('click', (event) => {
        const button = event.target.closest('.list-item');
         if (button && button.dataset.taskName) {
            selectedArchiveTaskName = button.dataset.taskName;
            selectedArchiveGoalId = null;
            archiveDatePageIndex = 0;
            selectedGoalLogs = []; 

             archiveTaskListContainer.querySelectorAll(".list-item").forEach(item => item.classList.remove("selected", "bg-indigo-100"));
             button.classList.add("selected", "bg-indigo-100");

             if(archiveGoalDetailsContainer) archiveGoalDetailsContainer.classList.add("hidden");
             if(archiveChartContainer) archiveChartContainer.classList.add("hidden");
             if(archiveWeeklySummaryContainer) archiveWeeklySummaryContainer.classList.add("hidden");
             destroyCharts([archiveChartInstance]);
             archiveChartInstance = null;

            renderArchiveGoalList();
         }
    });
}

/**
 * ★追加: 工数を進行中に戻す処理（リロードなし）
 */
async function handleRestoreGoal(taskName, goalId) {
    if (!confirm(`「${taskName}」のこの工数を進行中に戻しますか？`)) return;

    try {
        const currentTasks = allTaskObjects;
        const taskIndex = currentTasks.findIndex(t => t.name === taskName);
        if (taskIndex === -1) return;

        const updatedTasks = JSON.parse(JSON.stringify(currentTasks));
        const task = updatedTasks[taskIndex];
        const goal = task.goals.find(g => g.id === goalId || g.title === goalId);

        if (goal) {
            goal.isComplete = false;
            // 必要なら completedAt を削除する場合は以下を有効化
            // delete goal.completedAt; 
        } else {
            alert("エラー: 工数が見つかりませんでした。");
            return;
        }

        const tasksRef = doc(db, "settings", "tasks");
        await setDoc(tasksRef, { list: updatedTasks });

        updateGlobalTaskObjects(updatedTasks);
        await refreshUIBasedOnTaskUpdate();
        
        // 画面更新後に選択状態がリセットされるため、完了リストから消えたことを考慮して初期化
        selectedArchiveGoalId = null;
        renderArchiveTaskList();
        renderArchiveGoalList();

        alert("進行中の工数に戻しました。");

    } catch (error) {
        console.error("Error restoring goal:", error);
        alert("処理中にエラーが発生しました。");
    }
}

/**
 * ★追加: 工数を削除する処理（リロードなし）
 */
async function handleDeleteGoal(taskName, goalId) {
    if (!confirm(`この工数を完全に削除しますか？\nこの操作は元に戻せません。`)) return;

    try {
        const currentTasks = allTaskObjects;
        const taskIndex = currentTasks.findIndex(t => t.name === taskName);
        if (taskIndex === -1) return;

        const updatedTasks = JSON.parse(JSON.stringify(currentTasks));
        const task = updatedTasks[taskIndex];
        
        // 該当の工数を除外
        task.goals = task.goals.filter(g => g.id !== goalId && g.title !== goalId);

        const tasksRef = doc(db, "settings", "tasks");
        await setDoc(tasksRef, { list: updatedTasks });

        updateGlobalTaskObjects(updatedTasks);
        await refreshUIBasedOnTaskUpdate();
        
        selectedArchiveGoalId = null;
        renderArchiveTaskList();
        renderArchiveGoalList();

        alert("工数を削除しました。");

    } catch (error) {
        console.error("Error deleting goal:", error);
        alert("処理中にエラーが発生しました。");
    }
}

async function fetchLogsForGoal(goalId) {
    console.log(`Fetching logs for goal: ${goalId}`);
    try {
        const q = query(
            collection(db, "work_logs"),
            where("goalId", "==", goalId)
        );
        const snapshot = await getDocs(q);
        
        selectedGoalLogs = snapshot.docs.map((d) => {
             const data = d.data();
             const log = { id: d.id, ...data };
             if (log.startTime && log.startTime.toDate) log.startTime = log.startTime.toDate();
             if (log.endTime && log.endTime.toDate) log.endTime = log.endTime.toDate();
             return log;
        });
        console.log(`Fetched ${selectedGoalLogs.length} logs for goal ${goalId}`);

    } catch (error) {
        console.error("Error fetching goal logs:", error);
        selectedGoalLogs = [];
        alert("ログデータの取得中にエラーが発生しました。");
    }
}

function renderArchiveTaskList() {
  if (!archiveTaskListContainer) return;
  archiveTaskListContainer.innerHTML = ""; 

  const tasksWithCompletedGoals = allTaskObjects.filter(
    (task) => task.goals && task.goals.some((g) => g.isComplete)
  );

  tasksWithCompletedGoals.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));

  if (tasksWithCompletedGoals.length === 0) {
    archiveTaskListContainer.innerHTML =
      '<p class="text-gray-500 p-2">完了済みの工数がある業務はありません。</p>';
    if (archiveGoalListContainer) archiveGoalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
    if (archiveGoalDetailsContainer) archiveGoalDetailsContainer.classList.add("hidden");
    if (archiveWeeklySummaryContainer) archiveWeeklySummaryContainer.classList.add("hidden");
    if (archiveChartContainer) archiveChartContainer.classList.add("hidden");
    return;
  }

  tasksWithCompletedGoals.forEach((task) => {
    const button = document.createElement("button");
    button.className = `w-full text-left p-2 rounded-lg list-item hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
      selectedArchiveTaskName === task.name ? "selected bg-indigo-100" : "" 
    }`;
    button.textContent = escapeHtml(task.name);
    button.dataset.taskName = task.name;
    archiveTaskListContainer.appendChild(button);
  });

  if (selectedArchiveTaskName) {
     const taskExists = tasksWithCompletedGoals.some(t => t.name === selectedArchiveTaskName);
     if(taskExists){
         renderArchiveGoalList();
     } else {
       selectedArchiveTaskName = null;
       if (archiveGoalListContainer) archiveGoalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
     }
  } else {
    if (archiveGoalListContainer) archiveGoalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
  }
}

/**
 * アーカイブされた（完了済み）工数リストを描画する
 */
function renderArchiveGoalList() {
  if (!archiveGoalListContainer) return;
  archiveGoalListContainer.innerHTML = ""; 

  const task = allTaskObjects.find((t) => t.name === selectedArchiveTaskName);
  if (!task) {
    archiveGoalListContainer.innerHTML = '<p class="text-gray-500">エラー：選択された業務が見つかりません。</p>';
    return;
  }

  // ★ 日付を安全に数値(ミリ秒)に変換する内部ヘルパー
  const getMillis = (val) => {
    if (!val) return 0;
    if (typeof val.toMillis === 'function') return val.toMillis(); // Firestore Timestamp
    if (val instanceof Date) return val.getTime(); // Date object
    if (val.seconds) return val.seconds * 1000; // Plain object with seconds
    return new Date(val).getTime(); // String or others
  };

  // 完了フラグが立っており、かつ完了日時がある工数を抽出
  const completedGoals = (task.goals || [])
    .filter((g) => g.isComplete && g.completedAt)
    // ★ getTime() の代わりに getMillis を使用して安全に降順ソート（最新が上）
    .sort((a, b) => getMillis(b.completedAt) - getMillis(a.completedAt));

  if (completedGoals.length === 0) {
    archiveGoalListContainer.innerHTML = '<p class="text-gray-500">この業務に完了済みの工数はありません。</p>';
    selectedArchiveGoalId = null;
    if (archiveGoalDetailsContainer) archiveGoalDetailsContainer.classList.add("hidden");
    if (archiveChartContainer) archiveChartContainer.classList.add("hidden");
    if (archiveWeeklySummaryContainer) archiveWeeklySummaryContainer.classList.add("hidden");
    destroyCharts([archiveChartInstance]);
    archiveChartInstance = null;
    return;
  }

  completedGoals.forEach((goal) => {
    const button = document.createElement("button");
    // IDまたはタイトルを識別子として使用（selected状態の判定用）
    const tid = goal.id || goal.title;
    
    button.className = `w-full text-left p-2 rounded-lg list-item hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
      selectedArchiveGoalId === tid ? "selected bg-indigo-100" : "" 
    }`;

    // ★ 表示用の日付変換ロジック：Timestamp なら toDate()、それ以外なら new Date() で変換
    const d = goal.completedAt?.toDate ? goal.completedAt.toDate() : new Date(goal.completedAt);
    const completedDate = (d instanceof Date && !isNaN(d))
      ? d.toLocaleDateString("ja-JP")
      : "不明";

    button.innerHTML = `
            <div>${escapeHtml(goal.title || '無題')}</div>
            <div class="text-xs text-gray-500">完了日: ${completedDate}</div>
        `;
    button.dataset.goalId = tid;
    archiveGoalListContainer.appendChild(button);
  });

  // 既に工数が選択されている場合の状態維持
  if (selectedArchiveGoalId) {
    const goalExists = completedGoals.some(g => (g.id || g.title) === selectedArchiveGoalId);
    if (goalExists) {
        renderArchiveGoalDetails();
        renderArchiveWeeklySummary();
        const selectedButton = archiveGoalListContainer.querySelector(`.list-item[data-goal-id="${selectedArchiveGoalId}"]`);
        if (selectedButton) selectedButton.classList.add('selected', 'bg-indigo-100');
    } else {
        selectedArchiveGoalId = null;
        if (archiveGoalDetailsContainer) archiveGoalDetailsContainer.classList.add("hidden");
        if (archiveWeeklySummaryContainer) archiveWeeklySummaryContainer.classList.add("hidden");
        if (archiveChartContainer) archiveChartContainer.classList.add("hidden");
        destroyCharts([archiveChartInstance]);
        archiveChartInstance = null;
    }
  }
}

function renderArchiveGoalDetails() {
  if (!archiveGoalDetailsContainer) return;
  archiveGoalDetailsContainer.innerHTML = ""; 

  const task = allTaskObjects.find((t) => t.name === selectedArchiveTaskName);
  if (!task || !selectedArchiveGoalId) {
    archiveGoalDetailsContainer.classList.add("hidden");
    return;
  }

  const goal = task.goals.find((g) => g.id === selectedArchiveGoalId);
  if (!goal || !goal.isComplete) {
    archiveGoalDetailsContainer.classList.add("hidden");
    return;
  }

  // ★ 表示用日時の変換を安全に行う
  const d = goal.completedAt?.toDate ? goal.completedAt.toDate() : new Date(goal.completedAt);
  const completedDate = (d instanceof Date && !isNaN(d))
    ? d.toLocaleString("ja-JP")
    : "不明";
    
  const readOnlyMode = window.isProgressViewReadOnly === true;
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
  archiveGoalDetailsContainer.classList.remove("hidden"); 
}

function renderArchiveWeeklySummary() {
  if (!archiveWeeklySummaryContainer || !archiveChartContainer) return;

  archiveWeeklySummaryContainer.innerHTML = ""; 
  archiveChartContainer.innerHTML = "";     
  destroyCharts([archiveChartInstance]); 
  archiveChartInstance = null;

  const relevantLogs = selectedGoalLogs;

  const usersWithContributions = [
    ...new Set(relevantLogs.map((log) => log.userName).filter(Boolean)),
  ].sort((a,b) => a.localeCompare(b, "ja"));

  const allActiveDates = [
    ...new Set(relevantLogs.map((log) => log.date).filter(Boolean)),
  ].sort();

  if (allActiveDates.length === 0) {
    archiveWeeklySummaryContainer.innerHTML = '<p class="text-gray-500 p-4 text-center">この工数に関する稼働記録はありません。</p>';
    archiveWeeklySummaryContainer.classList.remove("hidden");
    archiveChartContainer.classList.add("hidden");
    return;
  }

  const datesPerPage = 7;
  const totalPages = calculateTotalPages(); 

  if (archiveDatePageIndex < 0) archiveDatePageIndex = 0;
  if (archiveDatePageIndex >= totalPages && totalPages > 0) archiveDatePageIndex = totalPages - 1;
  else if (totalPages === 0) archiveDatePageIndex = 0; 

  const startIndex = archiveDatePageIndex * datesPerPage;
  let datesToShow = allActiveDates.slice(startIndex, startIndex + datesPerPage);

  if (datesToShow.length === 0 && allActiveDates.length > 0 && startIndex >= allActiveDates.length) {
     archiveDatePageIndex = Math.max(0, totalPages - 1); 
     const lastPageStartIndex = archiveDatePageIndex * datesPerPage;
     datesToShow = allActiveDates.slice(lastPageStartIndex, lastPageStartIndex + datesPerPage);
  }

  const weeklyData = usersWithContributions.map((userName) => {
    const userData = { name: userName, dailyData: [] };
    datesToShow.forEach((dateStr) => {
      const logsForDay = relevantLogs.filter(
        (log) => log.userName === userName && log.date === dateStr
      );
      const totalDuration = logsForDay
        .filter((l) => l.type !== "goal")
        .reduce((sum, log) => sum + (log.duration || 0), 0);
      const totalContribution = logsForDay
        .filter((l) => l.type === "goal")
        .reduce((sum, log) => sum + (log.contribution || 0), 0);
      const hours = totalDuration / 3600;
      const efficiency =
        hours > 0
          ? parseFloat((totalContribution / hours).toFixed(1))
          : 0;

      userData.dailyData.push({
        contribution: totalContribution,
        duration: totalDuration,
        efficiency: efficiency,
      });
    });
    if(userData.dailyData.some(d => d.contribution > 0 || d.duration > 0)){
        return userData;
    }
    return null; 
  }).filter(Boolean); 


  if(weeklyData.length > 0 || datesToShow.length > 0) { 
       renderArchiveTableNavigation(datesToShow, archiveDatePageIndex + 1, totalPages);

       if (weeklyData.length > 0) {
           _renderArchiveChart(archiveChartContainer, datesToShow, weeklyData); 
           _renderArchiveTable(archiveWeeklySummaryContainer, datesToShow, weeklyData); 
           archiveChartContainer.classList.remove("hidden");
       } else {
           archiveWeeklySummaryContainer.innerHTML += '<p class="text-gray-500 p-4 text-center">選択された期間に貢献記録はありません。</p>';
           archiveChartContainer.innerHTML = '<p class="text-gray-500 p-4 text-center">選択された期間に貢献記録はありません。</p>'; 
           archiveChartContainer.classList.remove("hidden");
       }
       archiveWeeklySummaryContainer.classList.remove("hidden"); 
  } else {
       archiveWeeklySummaryContainer.innerHTML = '<p class="text-gray-500 p-4 text-center">この工数に関する稼働記録はありません。</p>';
       archiveWeeklySummaryContainer.classList.remove("hidden");
       archiveChartContainer.classList.add("hidden");
  }

}

function _renderArchiveChart(container, activeDates, data) {
    container.innerHTML = "";
    const canvas = document.createElement("canvas");
    canvas.style.minHeight = '250px';
    container.appendChild(canvas);

    const datasets = data.map((userData, index) => {
        const hue = (index * 137.508) % 360;
        const color = `hsl(${hue}, 70%, 50%)`;
        return {
            label: userData.name,
            data: userData.dailyData.map((d) => d.contribution),
            borderColor: color,
            backgroundColor: color,
            fill: false,
            tension: 0.1,
        };
    });

    const labels = activeDates.map((dateStr) => {
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    });

    archiveChartInstance = createLineChart(canvas.getContext("2d"), labels, datasets, "日別貢献件数", "合計件数");
}

function _renderArchiveTable(container, activeDates, data) {
    let tableHtml = '<div class="overflow-x-auto mt-4"><table class="w-full text-sm text-left text-gray-500">';
    tableHtml += '<thead class="text-xs text-gray-700 uppercase bg-gray-50"><tr><th scope="col" class="px-4 py-3">名前</th>';

    activeDates.forEach((dateStr) => {
        const date = new Date(dateStr);
        tableHtml += `<th scope="col" class="px-4 py-3 text-center">${date.getMonth() + 1}/${date.getDate()}</th>`;
    });
    tableHtml += "</tr></thead><tbody>";

    data.forEach((userData) => {
        tableHtml += `<tr class="bg-white border-b"><th scope="row" class="px-4 py-4 font-medium text-gray-900 whitespace-nowrap">${escapeHtml(userData.name)}</th>`;
        userData.dailyData.forEach((d) => {
            const cellClass = d.duration > 0 || d.contribution > 0 ? "highlight-cell bg-yellow-50" : "";
            tableHtml += `<td class="px-4 py-4 text-center ${cellClass}">
                <div>${d.contribution}件 / ${formatHoursMinutes(d.duration)}</div>
                <div class="text-xs text-gray-400">${d.efficiency}件/h</div>
            </td>`;
        });
        tableHtml += "</tr>";
    });

    tableHtml += "</tbody></table></div>";
    container.innerHTML += tableHtml;
}

function calculateTotalPages() {
    const relevantLogs = selectedGoalLogs;
    const allActiveDates = [...new Set(relevantLogs.map((log) => log.date).filter(Boolean))];
    const datesPerPage = 7;
    return Math.ceil(allActiveDates.length / datesPerPage);
}

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
    archiveWeeklySummaryContainer.innerHTML = navHtml; 
}

// js/views/archive.js
import { allTaskObjects, allUserLogs, handleGoBack } from "../main.js"; // main から必要なものをインポート
import { formatHoursMinutes, escapeHtml } from "../utils.js"; // ユーティリティ関数をインポート
// 進捗表示用の関数は不要なので削除
// import { handleGoalDetailClick } from "./progress.js";
// モーダル用の関数は動的に読み込むため未インポート
// import {
//   openGoalDetailsModal
// } from "../components/modal.js";
// restore/delete はイベント委譲で処理
import { renderArchiveChart, renderArchiveTable, destroyCharts } from "../components/chart.js"; // チャート関連関数

// アーカイブ表示用の状態
let selectedArchiveTaskName = null;
let selectedArchiveGoalId = null;
let archiveDatePageIndex = 0; // 日付ページのインデックス
let archiveChartInstance = null; // チャートインスタンスを保持

// --- DOM 要素参照 --- (index.html に存在すると仮定)
const archiveTaskListContainer = document.getElementById("archive-task-list");
const archiveGoalListContainer = document.getElementById("archive-goal-list");
const archiveGoalDetailsContainer = document.getElementById("archive-goal-details-container");
const archiveWeeklySummaryContainer = document.getElementById("archive-weekly-summary-container");
const archiveChartContainer = document.getElementById("archive-chart-container");
const archiveBackButton = document.getElementById("back-to-progress-from-archive"); // 戻るボタン

/**
 * アーカイブ表示を初期化
 */
export async function initializeArchiveView() {
    selectedArchiveTaskName = null; // 選択をリセット
    selectedArchiveGoalId = null;
    archiveDatePageIndex = 0;
    renderArchiveTaskList(); // タスクリストを初期表示
    // 他の領域をクリア
    if(archiveGoalListContainer) archiveGoalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
    if(archiveGoalDetailsContainer) archiveGoalDetailsContainer.classList.add("hidden");
    if(archiveChartContainer) archiveChartContainer.classList.add("hidden");
    if(archiveWeeklySummaryContainer) archiveWeeklySummaryContainer.classList.add("hidden");
    destroyCharts([archiveChartInstance]); // 前のチャートを破棄
    archiveChartInstance = null;
}

/**
 * アーカイブ表示のイベントリスナを設定
 */
export function setupArchiveEventListeners() {
    archiveBackButton?.addEventListener('click', handleGoBack); // 共通の戻る処理を使う

    // テーブルのページングボタンをイベント委譲で処理
    archiveWeeklySummaryContainer?.addEventListener('click', (event) => {
        if (event.target.id === 'archive-prev-page-btn') {
            if (archiveDatePageIndex > 0) {
                archiveDatePageIndex--;
                renderArchiveWeeklySummary();
            }
        } else if (event.target.id === 'archive-next-page-btn') {
            const totalPages = calculateTotalPages(); // 総ページ数を取得
            if (archiveDatePageIndex < totalPages - 1) {
                archiveDatePageIndex++;
                renderArchiveWeeklySummary();
            }
        }
    });

    // 詳細・復元・削除ボタンは動的に追加されるため委譲で処理
    archiveGoalDetailsContainer?.addEventListener('click', async (event) => {
        const target = event.target;
        const taskName = target.dataset.taskName;
        const goalId = target.dataset.goalId;

        if (!taskName || !goalId) return;

        if (target.classList.contains('restore-goal-btn')) {
            // 必要時にモジュールを動的読み込み
            const { handleRestoreGoalClick } = await import('../components/modal.js');
            handleRestoreGoalClick(taskName, goalId);
        } else if (target.classList.contains('delete-goal-btn')) {
            const { handleDeleteGoal } = await import('../components/modal.js');
            handleDeleteGoal(taskName, goalId);
        }
    });

    // ゴールリスト項目のクリック処理
    archiveGoalListContainer?.addEventListener('click', (event) => {
        const button = event.target.closest('.list-item');
        if (button && button.dataset.goalId) {
            selectedArchiveGoalId = button.dataset.goalId;
            archiveDatePageIndex = 0; // ページをリセット

            // 選択表示を更新
            archiveGoalListContainer.querySelectorAll(".list-item").forEach(item => item.classList.remove("selected", "bg-indigo-100"));
            button.classList.add("selected", "bg-indigo-100");

            renderArchiveGoalDetails();
            renderArchiveWeeklySummary();
        }
    });

    // タスクリスト項目のクリック処理
    archiveTaskListContainer?.addEventListener('click', (event) => {
        const button = event.target.closest('.list-item');
        if (button && button.dataset.taskName) {
            selectedArchiveTaskName = button.dataset.taskName;
            selectedArchiveGoalId = null; // ゴール選択をリセット
            archiveDatePageIndex = 0; // ページをリセット

            // 選択表示を更新
            archiveTaskListContainer.querySelectorAll(".list-item").forEach(item => item.classList.remove("selected", "bg-indigo-100"));
            button.classList.add("selected", "bg-indigo-100");

            // 詳細やサマリをクリア
            if(archiveGoalDetailsContainer) archiveGoalDetailsContainer.classList.add("hidden");
            if(archiveChartContainer) archiveChartContainer.classList.add("hidden");
            if(archiveWeeklySummaryContainer) archiveWeeklySummaryContainer.classList.add("hidden");
            destroyCharts([archiveChartInstance]);
            archiveChartInstance = null;

            renderArchiveGoalList(); // 選択タスクのゴール一覧を表示
        }
    });

}

// 完了済みゴールがあるタスクの一覧を描画
function renderArchiveTaskList() {
  if (!archiveTaskListContainer) return;
  archiveTaskListContainer.innerHTML = ""; // クリア

  // 完了済みゴールがあるタスクのみ抽出
  const tasksWithCompletedGoals = allTaskObjects.filter(
    (task) => task.goals && task.goals.some((g) => g.isComplete)
  );

  // 日本語ロケールでソート
  tasksWithCompletedGoals.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));

  if (tasksWithCompletedGoals.length === 0) {
    archiveTaskListContainer.innerHTML =
      '<p class="text-gray-500 p-2">完了済みの工数がある業務はありません。</p>';
    // 後続領域を初期化
    if (archiveGoalListContainer) archiveGoalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
    if (archiveGoalDetailsContainer) archiveGoalDetailsContainer.classList.add("hidden");
    if (archiveWeeklySummaryContainer) archiveWeeklySummaryContainer.classList.add("hidden");
    if (archiveChartContainer) archiveChartContainer.classList.add("hidden");
    return;
  }

  // タスクリストを作成
  tasksWithCompletedGoals.forEach((task) => {
    const button = document.createElement("button");
    button.className = `w-full text-left p-2 rounded-lg list-item hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
      selectedArchiveTaskName === task.name ? "selected bg-indigo-100" : "" // 選択クラス
    }`;
    button.textContent = escapeHtml(task.name); // エスケープ
    button.dataset.taskName = task.name;
    archiveTaskListContainer.appendChild(button);
  });

  // 以前選択していたタスクがあれば再描画
  if (selectedArchiveTaskName) {
      const taskExists = tasksWithCompletedGoals.some(t => t.name === selectedArchiveTaskName);
      if(taskExists){
          renderArchiveGoalList();
      } else {
         // 選択タスクに完了ゴールが無くなった場合は選択をクリア
         selectedArchiveTaskName = null;
         if (archiveGoalListContainer) archiveGoalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
      }
  } else {
    // 未選択時のプレースホルダ
    if (archiveGoalListContainer) archiveGoalListContainer.innerHTML = '<p class="text-gray-500">業務を選択してください</p>';
  }
}

// 選択タスクの完了ゴール一覧を描画
function renderArchiveGoalList() {
  if (!archiveGoalListContainer) return;
  archiveGoalListContainer.innerHTML = ""; // クリア

  const task = allTaskObjects.find((t) => t.name === selectedArchiveTaskName);
  if (!task) {
    archiveGoalListContainer.innerHTML = '<p class="text-gray-500">エラー：選択された業務が見つかりません。</p>';
    return;
  }

  // 完了ゴールを完了日順でソート（新しい順）
  const completedGoals = (task.goals || [])
    .filter((g) => g.isComplete && g.completedAt) // completedAt を確認
    .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0)); // Date の getTime を使用

  if (completedGoals.length === 0) {
    archiveGoalListContainer.innerHTML = '<p class="text-gray-500">この業務に完了済みの工数はありません。</p>';
    // 後続の選択をクリア
    selectedArchiveGoalId = null;
    if(archiveGoalDetailsContainer) archiveGoalDetailsContainer.classList.add("hidden");
    if(archiveChartContainer) archiveChartContainer.classList.add("hidden");
    if(archiveWeeklySummaryContainer) archiveWeeklySummaryContainer.classList.add("hidden");
    destroyCharts([archiveChartInstance]);
    archiveChartInstance = null;
    return;
  }

  // 完了ゴール一覧を描画
  completedGoals.forEach((goal) => {
    const button = document.createElement("button");
    button.className = `w-full text-left p-2 rounded-lg list-item hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
      selectedArchiveGoalId === goal.id ? "selected bg-indigo-100" : "" // 選択クラス
    }`;
    const completedDate = (goal.completedAt instanceof Date && !isNaN(goal.completedAt))
      ? goal.completedAt.toLocaleDateString("ja-JP")
      : "不明";
    button.innerHTML = `
            <div>${escapeHtml(goal.title || '無題')}</div>
            <div class="text-xs text-gray-500">完了日: ${completedDate}</div>
        `;
    button.dataset.goalId = goal.id;
    archiveGoalListContainer.appendChild(button);
  });

   // 以前選択していたゴールがあれば再描画
   if (selectedArchiveGoalId) {
    const goalExists = completedGoals.some(g => g.id === selectedArchiveGoalId);
    if(goalExists){
        renderArchiveGoalDetails();
        renderArchiveWeeklySummary();
        const selectedButton = archiveGoalListContainer.querySelector(`.list-item[data-goal-id="${selectedArchiveGoalId}"]`);
        if(selectedButton) selectedButton.classList.add('selected', 'bg-indigo-100');
    } else {
        // ゴールが無くなっていれば選択を解除
        selectedArchiveGoalId = null;
        if(archiveGoalDetailsContainer) archiveGoalDetailsContainer.classList.add("hidden");
        if(archiveWeeklySummaryContainer) archiveWeeklySummaryContainer.classList.add("hidden");
        if(archiveChartContainer) archiveChartContainer.classList.add("hidden");
        destroyCharts([archiveChartInstance]);
        archiveChartInstance = null;
    }
  }
}

// 選択された完了ゴールの詳細を描画
function renderArchiveGoalDetails() {
  if (!archiveGoalDetailsContainer) return;
  archiveGoalDetailsContainer.innerHTML = ""; // クリア

  const task = allTaskObjects.find((t) => t.name === selectedArchiveTaskName);
  if (!task || !selectedArchiveGoalId) {
    archiveGoalDetailsContainer.classList.add("hidden");
    return;
  }

  const goal = task.goals.find((g) => g.id === selectedArchiveGoalId);
  if (!goal || !goal.isComplete) {
    // ゴールが存在し完了済みであることを確認
    archiveGoalDetailsContainer.classList.add("hidden");
    return;
  }

  const completedDate = (goal.completedAt instanceof Date && !isNaN(goal.completedAt))
    ? goal.completedAt.toLocaleString("ja-JP")
    : "不明";

  // 復元や完全削除ボタン（読み取り専用時は表示しない）
  const readOnlyMode = window.isProgressViewReadOnly === true; // グローバルフラグ想定
  const buttonsHtml = readOnlyMode ? "" : `
    <div class="flex-shrink-0 ml-4 space-x-2">
        <button class="restore-goal-btn bg-yellow-500 text-white font-bold py-1 px-3 rounded hover:bg-yellow-600 text-sm" data-task-name="${escapeHtml(task.name)}" data-goal-id="${goal.id}">進��[...]</button>
        <button class="delete-goal-btn bg-red-500 text-white font-bold py-1 px-3 rounded hover:bg-red-600 text-sm" data-task-name="${escapeHtml(task.name)}" data-goal-id="${goal.id}">完全に削[...]</button>
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
  archiveGoalDetailsContainer.classList.remove("hidden"); // 表示

}

// 選択ゴールの週間サマリ（表とチャート）を描画
function renderArchiveWeeklySummary() {

  if (!archiveWeeklySummaryContainer || !archiveChartContainer) return;

  archiveWeeklySummaryContainer.innerHTML = ""; // クリア
  archiveChartContainer.innerHTML = "";   // クリア
  destroyCharts([archiveChartInstance]); // 前のチャートを破棄
  archiveChartInstance = null;

  const task = allTaskObjects.find((t) => t.name === selectedArchiveTaskName);
  if (!task || !selectedArchiveGoalId) {
    archiveWeeklySummaryContainer.classList.add("hidden");
    archiveChartContainer.classList.add("hidden");
    return;
  }
  const goal = task.goals.find((g) => g.id === selectedArchiveGoalId);
  if (!goal) {
    archiveWeeklySummaryContainer.classList.add("hidden");
    archiveChartContainer.classList.add("hidden");
    return;
  }

  // このゴールに関連するログを抽出
  const relevantLogs = allUserLogs.filter((log) => log.goalId === goal.id);

  // 貢献があったユーザー名（重複除去）
  const usersWithContributions = [
    ...new Set(relevantLogs.map((log) => log.userName).filter(Boolean)), // undefined/null を除外
  ].sort((a,b) => a.localeCompare(b, "ja"));

  // 稼働があった日付を一意に取得し、昇順でソート
  const allActiveDates = [
    ...new Set(relevantLogs.map((log) => log.date).filter(Boolean)), // undefined/null を除外
  ].sort();

  if (allActiveDates.length === 0) {
    archiveWeeklySummaryContainer.innerHTML = '<p class="text-gray-500 p-4 text-center">この工数に関する稼働記録はありません。</p>';
    archiveWeeklySummaryContainer.classList.remove("hidden");
    archiveChartContainer.classList.add("hidden");
    return;
  }

  // 日付をページング（1ページあたり7日）
  const datesPerPage = 7;
  const totalPages = calculateTotalPages(); // ヘルパーを利用

  // ページインデックスが範囲外にならないよう調整
  if (archiveDatePageIndex < 0) archiveDatePageIndex = 0;
  if (archiveDatePageIndex >= totalPages && totalPages > 0) archiveDatePageIndex = totalPages - 1;
  else if (totalPages === 0) archiveDatePageIndex = 0; // 日付がない場合

  const startIndex = archiveDatePageIndex * datesPerPage;
  let datesToShow = allActiveDates.slice(startIndex, startIndex + datesPerPage);

  // スライス結果が空になった場合は最後のページに移動
  if (datesToShow.length === 0 && allActiveDates.length > 0 && startIndex >= allActiveDates.length) {
     archiveDatePageIndex = Math.max(0, totalPages - 1); // 最終ページへ
     const lastPageStartIndex = archiveDatePageIndex * datesPerPage;
     datesToShow = allActiveDates.slice(lastPageStartIndex, lastPageStartIndex + datesPerPage);
  }

  // チャートと表用のデータ整形
  const weeklyData = usersWithContributions.map((userName) => {
    const userData = { name: userName, dailyData: [] };
    datesToShow.forEach((dateStr) => {
      const logsForDay = relevantLogs.filter(
        (log) => log.userName === userName && log.date === dateStr
      );
      // 作業時間の合計（ゴール貢献ログは除外）
      const totalDuration = logsForDay
        .filter((l) => l.type !== "goal")
        .reduce((sum, log) => sum + (log.duration || 0), 0);
      // 貢献量の合計（ゴール貢献ログのみ）
      const totalContribution = logsForDay
        .filter((l) => l.type === "goal")
        .reduce((sum, log) => sum + (log.contribution || 0), 0);
      // 効率（貢献/時間）計算
      const hours = totalDuration / 3600;
      const efficiency =
        hours > 0
          ? parseFloat((totalContribution / hours).toFixed(1)) // 小数第1位
          : 0;

      userData.dailyData.push({
        contribution: totalContribution,
        duration: totalDuration,
        efficiency: efficiency,
      });
    });
    // 表示中の日に活動があったユーザーのみ返す
    if(userData.dailyData.some(d => d.contribution > 0 || d.duration > 0)){
        return userData;
    }
    return null; // 活動がなければ null
  }).filter(Boolean); // null を除去


  // チャートと表を描画
  if(weeklyData.length > 0 || datesToShow.length > 0) { // ユーザーデータがなくてもナビは表示
      // ナビを描画
      renderArchiveTableNavigation(datesToShow, archiveDatePageIndex + 1, totalPages);

      if (weeklyData.length > 0) {
          // ユーザーデータがあればチャートと表を描画
          archiveChartInstance = renderArchiveChart(archiveChartContainer, datesToShow, weeklyData); // インスタンス保持
          renderArchiveTable(archiveWeeklySummaryContainer, datesToShow, weeklyData); // 既存ナビにテーブルを追加
          archiveChartContainer.classList.remove("hidden");
      } else {
          // この週に活動がなければメッセージ表示
          archiveWeeklySummaryContainer.innerHTML += '<p class="text-gray-500 p-4 text-center">選択された期間に貢献記録はありません。</p>';
          archiveChartContainer.innerHTML = '<p class="text-gray-500 p-4 text-center">選択された期間に貢献記録はありません。</p>';
          archiveChartContainer.classList.remove("hidden");
      }
      archiveWeeklySummaryContainer.classList.remove("hidden"); // 表示
  } else {
       // ここは earlier の allActiveDates.length === 0 でカバーされる想定
       archiveWeeklySummaryContainer.innerHTML = '<p class="text-gray-500 p-4 text-center">この工数に関する稼働記録はありません。</p>';
       archiveWeeklySummaryContainer.classList.remove("hidden");
       archiveChartContainer.classList.add("hidden");
  }

}

/** ヘルパー: ページ総数を計算 */
function calculateTotalPages() {
    const task = allTaskObjects.find((t) => t.name === selectedArchiveTaskName);
    const goal = task?.goals.find((g) => g.id === selectedArchiveGoalId);
    if (!goal) return 0;

    const relevantLogs = allUserLogs.filter((log) => log.goalId === goal.id);
    const allActiveDates = [...new Set(relevantLogs.map((log) => log.date).filter(Boolean))];
    const datesPerPage = 7;
    return Math.ceil(allActiveDates.length / datesPerPage);
}


/** ナビを描画 */
function renderArchiveTableNavigation(datesToShow, currentPage, totalPages) {
    if (!archiveWeeklySummaryContainer) return;

    const startStr = datesToShow[0] || "?";
    const endStr = datesToShow[datesToShow.length - 1] || "?";

    let navHtml = `
     <div class="flex flex-col sm:flex-row justify-between items-center mb-2 gap-2">
         <h4 class="text-lg font-bold text-center sm:text-left">貢献記録 (期間別)</h4>
         <div class="flex items-center justify-center gap-1 flex-wrap">
             <button id="archive-prev-page-btn" class="p-1 md:p-2 rounded-lg hover:bg-gray-200 text-xs md:text-sm ${currentPage <= 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage <= 1 ? 'disabled' : ''}>前へ</button>
             <span class="text-sm md:text-base font-semibold text-gray-700 whitespace-nowrap">${escapeHtml(startStr)} - ${escapeHtml(endStr)} (${currentPage}/${totalPages})</span>
             <button id="archive-next-page-btn" class="p-1 md:p-2 rounded-lg hover:bg-gray-200 text-xs md:text-sm ${currentPage >= totalPages ? 'opacity-50 cursor-not-allowed' : ''}" ${currentPage >= totalPages ? 'disabled' : ''}>次へ</button>
         </div>
     </div>`;
    archiveWeeklySummaryContainer.innerHTML = navHtml; // ナビを書き換え
}
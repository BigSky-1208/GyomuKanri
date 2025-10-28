// js/components/calendar.js - 共通カレンダー描画関数

// utils.js から必要な関数をインポート（現在は未使用だが将来的に使う可能性あり）
// import { getJSTDateString } from '../utils.js';

/**
 * 汎用的なカレンダーUIを描画し、イベントリスナーを設定します。
 * @param {object} config - カレンダー設定オブジェクト
 * @param {HTMLElement} config.calendarEl - カレンダーを描画する<table>要素。
 * @param {HTMLElement} config.monthYearEl - 年月を表示する要素 (例: <h2>)。クリックリスナーも設定されます。
 * @param {Date} config.dateToDisplay - 表示する月を含むDateオブジェクト。
 * @param {Array} config.logs - ログデータの配列。各ログは { date: "YYYY-MM-DD", ... } 形式を想定。ログのある日付に印をつけます。
 * @param {function} config.onDayClick - 日付セルがクリックされたときに呼び出すコールバック関数 (event引数を受け取る)。
 * @param {function} config.onMonthClick - 年月表示要素がクリックされたときに呼び出すコールバック関数。
 */
export function renderUnifiedCalendar(config) {
    const {
        calendarEl,
        monthYearEl,
        dateToDisplay,
        logs = [], // デフォルト値を空配列に
        onDayClick,
        onMonthClick,
    } = config;

    // --- 引数チェック ---
    if (!calendarEl || !monthYearEl || !dateToDisplay || typeof onDayClick !== 'function' || typeof onMonthClick !== 'function') {
        console.error("renderUnifiedCalendar: Invalid configuration provided.", config);
        if (calendarEl) calendarEl.innerHTML = '<tr><td class="text-red-500">カレンダー描画エラー</td></tr>';
        if (monthYearEl) monthYearEl.textContent = "エラー";
        return;
    }

    // --- 年月表示 ---
    const year = dateToDisplay.getFullYear();
    const month = dateToDisplay.getMonth(); // 0-based month
    monthYearEl.textContent = `${year}年 ${month + 1}月`;
    monthYearEl.dataset.year = year;
    monthYearEl.dataset.month = month + 1; // Store 1-based month in dataset
    // Remove previous listener before adding new one
    monthYearEl.onclick = null;
    monthYearEl.onclick = onMonthClick; // Assign the provided month click handler

    // --- カレンダー計算 ---
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0); // 月の最終日を取得
    const daysInMonth = lastDayOfMonth.getDate(); // 月の日数
    const startDayOfWeek = firstDayOfMonth.getDay(); // 週の開始曜日 (0=日曜, 1=月曜...)

    // --- ログのある日付をSetに格納 (効率的な検索のため) ---
    const logDates = new Set(logs.map(log => log.date).filter(Boolean)); // dateが存在するログのみ対象

    // --- HTML生成 ---
    let html = `
        <thead>
            <tr>
                <th class="text-red-600">日</th>
                <th>月</th>
                <th>火</th>
                <th>水</th>
                <th>木</th>
                <th>金</th>
                <th class="text-blue-600">土</th>
            </tr>
        </thead>
        <tbody>
            <tr>`;

    // 月初の空白セルを追加
    for (let i = 0; i < startDayOfWeek; i++) {
        html += '<td class="empty"></td>';
    }

    const today = new Date();
    // 今日の日付を "YYYY-MM-DD" 形式で取得 (比較用)
    const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;

    // 日付セルを生成
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);
        const dateStr = `${year}-${(month + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
        const dayOfWeek = currentDate.getDay(); // 曜日を取得 (0=日曜, 6=土曜)

        // CSSクラスを決定
        let classes = "calendar-day relative p-1 md:p-2 h-16 md:h-20 cursor-pointer text-center align-top border border-gray-200"; // 基本クラス + Tailwindユーティリティ
        if (logDates.has(dateStr)) {
            classes += " has-log font-semibold"; // ログがある日のスタイル
        }
        if (dateStr === todayStr) {
            classes += " today bg-orange-100 text-orange-700 font-bold"; // 今日のスタイル
        }
        if (dayOfWeek === 0) { // 日曜日
            classes += " text-red-600";
        } else if (dayOfWeek === 6) { // 土曜日
            classes += " text-blue-600";
        }
         // ホバー時のスタイルを追加 (Tailwind)
         classes += " hover:bg-indigo-100";

        // has-log の視覚的インジケータ (小さな点) を追加
        const logIndicator = logDates.has(dateStr)
                           ? '<span class="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full"></span>'
                           : '';

        html += `<td class="${classes}" data-date="${dateStr}">${day}${logIndicator}</td>`;

        // 週の終わりに新しい行を開始
        if ((day + startDayOfWeek) % 7 === 0 && day < daysInMonth) {
            html += "</tr><tr>";
        }
    }

    // 月末の空白セルを追加
    const remainingCells = (7 - ((daysInMonth + startDayOfWeek) % 7)) % 7;
    for (let i = 0; i < remainingCells; i++) {
        html += '<td class="empty border border-gray-200"></td>';
    }

    html += "</tr></tbody>";
    calendarEl.innerHTML = html;

    // --- イベントリスナー設定 ---
    // 日付セルにクリックイベントリスナーを追加 (空セルを除く)
    calendarEl.querySelectorAll(".calendar-day").forEach((dayCell) => {
        // data-date属性があるセルのみリスナーを設定
        if (dayCell.dataset.date) {
             // Remove potential previous listener before adding
             dayCell.onclick = null;
             dayCell.onclick = onDayClick; // Assign the provided day click handler
        }
    });

    console.log(`Calendar rendered for ${year}-${month + 1}`);
}

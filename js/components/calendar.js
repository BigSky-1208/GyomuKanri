// js/components/calendar.js - 共通カレンダー描画関数

// import { getJSTDateString } from '../utils.js'; // 未使用ならコメントアウトのまま

export function renderUnifiedCalendar(config) {
    const {
        calendarEl,
        monthYearEl,
        dateToDisplay,
        logs = [], 
        onDayClick,
        onMonthClick,
    } = config;

    if (!calendarEl || !monthYearEl || !dateToDisplay || typeof onDayClick !== 'function' || typeof onMonthClick !== 'function') {
        console.error("renderUnifiedCalendar: Invalid configuration provided.", config);
        if (calendarEl) calendarEl.innerHTML = '<tr><td class="text-red-500">カレンダー描画エラー</td></tr>';
        if (monthYearEl) monthYearEl.textContent = "エラー";
        return;
    }

    const year = dateToDisplay.getFullYear();
    const month = dateToDisplay.getMonth(); 
    monthYearEl.textContent = `${year}年 ${month + 1}月`;
    monthYearEl.dataset.year = year;
    monthYearEl.dataset.month = month + 1; 
    monthYearEl.onclick = null;
    monthYearEl.onclick = onMonthClick; 

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0); 
    const daysInMonth = lastDayOfMonth.getDate(); 
    const startDayOfWeek = firstDayOfMonth.getDay(); 

    const logDates = new Set(logs.map(log => log.date).filter(Boolean)); 

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

    for (let i = 0; i < startDayOfWeek; i++) {
        html += '<td class="empty"></td>';
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;

    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);
        const dateStr = `${year}-${(month + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
        const dayOfWeek = currentDate.getDay(); 

        let classes = "calendar-day relative p-1 md:p-2 h-16 md:h-20 cursor-pointer text-center align-top border border-gray-200"; 
        if (logDates.has(dateStr)) {
            classes += " has-log font-semibold"; 
        }
        if (dateStr === todayStr) {
            classes += " today bg-orange-100 text-orange-700 font-bold"; 
        }
        if (dayOfWeek === 0) { 
            classes += " text-red-600";
        } else if (dayOfWeek === 6) { 
            classes += " text-blue-600";
        }
         classes += " hover:bg-indigo-100";

        const logIndicator = logDates.has(dateStr)
                           ? '<span class="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full"></span>'
                           : '';

        html += `<td class="${classes}" data-date="${dateStr}">${day}${logIndicator}</td>`;

        if ((day + startDayOfWeek) % 7 === 0 && day < daysInMonth) {
            html += "</tr><tr>";
        }
    }

    const remainingCells = (7 - ((daysInMonth + startDayOfWeek) % 7)) % 7;
    for (let i = 0; i < remainingCells; i++) {
        html += '<td class="empty border border-gray-200"></td>';
    }

    html += "</tr></tbody>";
    calendarEl.innerHTML = html;

    calendarEl.querySelectorAll(".calendar-day").forEach((dayCell) => {
        if (dayCell.dataset.date) {
             dayCell.onclick = null;
             dayCell.onclick = onDayClick; 
        }
    });

    console.log(`Calendar rendered for ${year}-${month + 1}`);
}

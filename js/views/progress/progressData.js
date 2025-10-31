// js/views/progress/progressData.js (データ集計 担当)

import { getJSTDateString } from "../../utils.js";

/**
 * Renders the weekly summary section, including the line chart and data table,
 * for the currently selected goal based on offsets.
 * @param {number} progressWeekOffset - Offset for weekly summary navigation.
 * @param {number} progressMonthOffset - Offset for monthly navigation.
 * @returns {string[]} Array of date strings ("YYYY-MM-DD") for the week.
 */
export function calculateDateRange(progressWeekOffset, progressMonthOffset) {
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);
    if (progressMonthOffset !== 0) {
         baseDate.setMonth(baseDate.getMonth() + progressMonthOffset);
         baseDate.setDate(1);
    }
    const referenceDate = new Date(baseDate);
    
    // Adjust reference date based on month offset start day if needed
    if (progressMonthOffset !== 0){
        // If we are looking at a past/future month, calculate offset from the 1st
        referenceDate.setDate(referenceDate.getDate() + progressWeekOffset * 7);
    } else {
        // If current month, calculate offset from today
        const todayForRef = new Date();
        todayForRef.setHours(0,0,0,0);
        referenceDate.setTime(todayForRef.getTime()); // Reset to today before applying offset
        referenceDate.setDate(referenceDate.getDate() + progressWeekOffset * 7);
    }

    // 基準日（referenceDate）が含まれる週の日曜日を計算
    const dayOfWeek = referenceDate.getDay(); // 0 = Sunday, 1 = Monday...
    const startOfWeek = new Date(referenceDate);
    startOfWeek.setDate(referenceDate.getDate() - dayOfWeek); // 日曜日に設定

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        weekDates.push(getJSTDateString(date)); // utils.js からインポート
    }
    return weekDates;
}

/**
 * Aggregates weekly data for the chart and table.
 * @param {Array} allUserLogs - The global array of all user logs.
 * @param {string} goalId - The ID of the goal to filter by.
 * @param {string[]} weekDates - Array of date strings ("YYYY-MM-DD") for the week.
 * @returns {Array} Aggregated data array: [{ name, dailyData: [{ contribution, duration, efficiency }] }]
 */
export function aggregateWeeklyData(allUserLogs, goalId, weekDates) {
    
    // --- Aggregate Data for the Week ---
    // このゴールIDに関連するログを持つ全ユーザーを特定し、ソートする
    const usersInvolved = [...new Set(
        allUserLogs
            .filter(log => log.goalId === goalId)
            .map(log => log.userName)
            .filter(name => name) // null や undefined を除外
    )].sort((a,b)=>a.localeCompare(b,"ja"));

    const chartAndTableData = [];

    usersInvolved.forEach((name) => {
        const userData = { name: name, dailyData: [] };
        
        weekDates.forEach((dateStr) => {
            // このユーザー、この日、このゴールIDに一致するログをフィルタリング
            const logsForDay = allUserLogs.filter(
                (log) =>
                    log.userName === name &&
                    log.date === dateStr &&
                    log.goalId === goalId
            );

            // "goal" タイプではないログ（＝時間記録ログ）の合計時間(duration)を計算
            const totalDuration = logsForDay
                .filter(l => l.type !== "goal")
                .reduce((sum, log) => sum + (log.duration || 0), 0);
            
            // "goal" タイプのログ（＝貢献記録ログ）の合計貢献(contribution)を計算
            const totalContribution = logsForDay
                .filter(l => l.type === "goal")
                .reduce((sum, log) => sum + (log.contribution || 0), 0);

            // 時間あたりの効率を計算
            const hours = totalDuration / 3600;
            const efficiency = hours > 0 ? parseFloat((totalContribution / hours).toFixed(1)) : 0;

            userData.dailyData.push({
                contribution: totalContribution,
                duration: totalDuration,
                efficiency: efficiency,
            });
        });
        
        // この週に何らかの活動（貢献または時間）があったユーザーのみを最終リストに追加
        if(userData.dailyData.some(d => d.contribution > 0 || d.duration > 0)){
            chartAndTableData.push(userData);
        }
    });
    
    return chartAndTableData;
}

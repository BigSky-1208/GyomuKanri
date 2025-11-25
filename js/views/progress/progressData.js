// js/views/progress/progressData.js (データ集計 担当)

import { getJSTDateString } from "../../utils.js"; // 正しいパス

export function calculateDateRange(progressWeekOffset, progressMonthOffset) {
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);
    if (progressMonthOffset !== 0) {
         baseDate.setMonth(baseDate.getMonth() + progressMonthOffset);
         baseDate.setDate(1);
    }
    const referenceDate = new Date(baseDate);
    
    if (progressMonthOffset !== 0){
        referenceDate.setDate(referenceDate.getDate() + progressWeekOffset * 7);
    } else {
        const todayForRef = new Date();
        todayForRef.setHours(0,0,0,0);
        referenceDate.setTime(todayForRef.getTime()); 
        referenceDate.setDate(referenceDate.getDate() + progressWeekOffset * 7);
    }

    const dayOfWeek = referenceDate.getDay(); 
    const startOfWeek = new Date(referenceDate);
    startOfWeek.setDate(referenceDate.getDate() - dayOfWeek); 

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        weekDates.push(getJSTDateString(date)); 
    }
    return weekDates;
}

export function aggregateWeeklyData(allUserLogs, goalId, weekDates) {
    
    const usersInvolved = [...new Set(
        allUserLogs
            .filter(log => log.goalId === goalId)
            .map(log => log.userName)
            .filter(name => name) 
    )].sort((a,b)=>a.localeCompare(b,"ja"));

    const chartAndTableData = [];

    usersInvolved.forEach((name) => {
        const userData = { name: name, dailyData: [] };
        
        weekDates.forEach((dateStr) => {
            const logsForDay = allUserLogs.filter(
                (log) =>
                    log.userName === name &&
                    log.date === dateStr &&
                    log.goalId === goalId
            );

            const totalDuration = logsForDay
                .filter(l => l.type !== "goal")
                .reduce((sum, log) => sum + (log.duration || 0), 0);
            
            const totalContribution = logsForDay
                .filter(l => l.type === "goal")
                .reduce((sum, log) => sum + (log.contribution || 0), 0);

            const hours = totalDuration / 3600;
            const efficiency = hours > 0 ? parseFloat((totalContribution / hours).toFixed(1)) : 0;

            userData.dailyData.push({
                contribution: totalContribution,
                duration: totalDuration,
                efficiency: efficiency,
            });
        });
        
        if(userData.dailyData.some(d => d.contribution > 0 || d.duration > 0)){
            chartAndTableData.push(userData);
        }
    });
    
    return chartAndTableData;
}

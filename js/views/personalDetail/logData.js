// js/views/personalDetail/logData.js (データ取得 担当)

import { db } from "../../firebase.js";
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getJSTDateString } from "../../utils.js";

let personalDetailUnsubscribe = null; // Firestore listener unsubscribe function

/**
 * Starts the Firestore listener for the specified user's work logs for a specific month.
 * @param {string} name - The username whose logs to fetch.
 * @param {Date} dateToDisplay - The date object indicating which month to fetch.
 * @param {function} onLogsReceived - Callback function executed with the fetched logs array.
 */
export function startListeningForUserLogs(name, dateToDisplay, onLogsReceived) {
    stopListeningForUserLogs(); // Ensure previous listener is stopped

    if (!name) {
        console.error("Cannot listen for logs: Username is missing.");
        onLogsReceived([]); // ログ無しとしてコールバック
        return;
    }

    // 1. 表示対象の月の初日と最終日を計算
    const year = dateToDisplay.getFullYear();
    const month = dateToDisplay.getMonth(); // 0-based
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0); // その月の最終日
    
    const startDateStr = getJSTDateString(firstDay); // "YYYY-MM-01"
    const endDateStr = getJSTDateString(lastDay);   // "YYYY-MM-30" など

    console.log(`Starting log listener for ${name} between ${startDateStr} and ${endDateStr}`);

    // 2. クエリを修正
    const q = query(
        collection(db, "work_logs"),
        where("userName", "==", name),
        where("date", ">=", startDateStr), // ★追加: 月の初日
        where("date", "<=", endDateStr)   // ★追加: 月の最終日
    );
    // (注意: このクエリにはFirestoreの複合インデックスが必要です)

    personalDetailUnsubscribe = onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map((d) => {
            const data = d.data();
            // Convert Firestore Timestamps to JS Date objects
            const log = { id: d.id, ...data };
            if (log.startTime && log.startTime.toDate) log.startTime = log.startTime.toDate();
            if (log.endTime && log.endTime.toDate) log.endTime = log.endTime.toDate();
            return log;
        });
        
        console.log(`Received ${logs.length} logs for ${name} for month ${startDateStr.substring(0, 7)}.`);
        
        // データを司令塔（personalDetail.js）にコールバックで渡す
        if (typeof onLogsReceived === 'function') {
            onLogsReceived(logs);
        }

    }, (error) => {
        console.error(`Error listening for logs for user ${name}:`, error);
        if (typeof onLogsReceived === 'function') {
            onLogsReceived([]); // エラー時も空配列を渡す
        }
    });
}

/**
 * Stops the Firestore listener for user logs.
 */
export function stopListeningForUserLogs() {
    if (personalDetailUnsubscribe) {
        console.log("Stopping log listener.");
        personalDetailUnsubscribe();
        personalDetailUnsubscribe = null;
    }
}

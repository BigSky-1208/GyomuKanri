// js/utils.js - 汎用ヘルパー関数

import { db } from "./firebase.js"; // Firestoreインスタンスをインポート
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmationModal, hideConfirmationModal } from "./components/modal.js"; // モーダル関数をインポート

/**
 * 秒数を HH:MM:SS 形式の文字列にフォーマットします。
 * @param {number} seconds - フォーマットする秒数。
 * @returns {string} フォーマットされた時間文字列 (例: "01:23:45")。
 */
export function formatDuration(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * 秒数を "X時間 Y分" 形式の文字列にフォーマットします。
 * @param {number} seconds - フォーマットする秒数。
 * @returns {string} フォーマットされた時間文字列 (例: "1時間 23分")。
 */
export function formatHoursMinutes(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0時間 0分";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    // 秒は切り捨て
    return `${h}時間 ${m}分`;
}

/**
 * 秒数を H:MM 形式の文字列にフォーマットします (Excel出力用など)。
 * @param {number} seconds - フォーマットする秒数。
 * @returns {string} フォーマットされた時間文字列 (例: "1:23", "0:45")。
 */
export function formatHoursAndMinutesSimple(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}:${m.toString().padStart(2, "0")}`;
}

/**
 * Firestore TimestampオブジェクトまたはDateオブジェクトを HH:MM 形式の文字列にフォーマットします。
 * @param {object | Date | null | undefined} timestamp - Firestore TimestampオブジェクトまたはDateオブジェクト。
 * @returns {string} フォーマットされた時間文字列 (例: "09:30")、無効な場合は空文字列。
 */
export function formatTime(timestamp) {
    let date;
    if (timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate(); // Firestore Timestamp
    } else if (timestamp instanceof Date && !isNaN(timestamp)) {
        date = timestamp; // JavaScript Date
    } else {
        return ""; // 無効な入力
    }

    try {
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");
        return `${hours}:${minutes}`;
    } catch (error) {
        console.error("Error formatting time:", error, timestamp);
        return ""; // フォーマットエラー時
    }
}

/**
 * Dateオブジェクトを "YYYY-MM-DD" 形式の文字列に変換します。
 * タイムゾーンは考慮せず、Dateオブジェクトのローカルな年月日を使用します。
 * @param {Date} dateObj - 変換するDateオブジェクト。
 * @returns {string} フォーマットされた日付文字列 (例: "2023-10-28")、無効な場合は空文字列。
 */
export function getJSTDateString(dateObj) {
     if (!(dateObj instanceof Date) || isNaN(dateObj)) {
         console.warn("Invalid date object passed to getJSTDateString:", dateObj);
         dateObj = new Date();
     }
    try {
        const year = dateObj.getFullYear();
        const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
        const day = dateObj.getDate().toString().padStart(2, "0");
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error("Error formatting date string:", error, dateObj);
        return ""; // フォーマットエラー時
    }
}

/**
 * 指定された月（Dateオブジェクト）の初日と末日の日付文字列を返します。
 * @param {Date} dateObj - 対象の月を含むDateオブジェクト
 * @returns {object} { start: "YYYY-MM-01", end: "YYYY-MM-31" }
 */
export function getMonthDateRange(dateObj) {
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    return {
        start: getJSTDateString(firstDay),
        end: getJSTDateString(lastDay)
    };
}


/**
 * Firestoreのユーザーステータスを確認し、退勤忘れ修正が必要な場合にモーダルを表示します。
 * 確認後、Firestoreのフラグをリセットします。
 * @param {string} uid - 確認対象のユーザーID。
 */
export async function checkForCheckoutCorrection(uid) {
    if (!uid) {
         console.warn("Cannot check for checkout correction: UID is missing.");
         return;
    }
    const statusRef = doc(db, "work_status", uid);
    try {
        const statusSnap = await getDoc(statusRef);
        if (statusSnap.exists() && statusSnap.data().needsCheckoutCorrection === true) {
            console.log(`User ${uid} needs checkout correction.`);
            // モーダルを表示
            showConfirmationModal(
                "前回の退勤が自動処理されました。正しい退勤時刻を「退勤忘れを修正」ボタンから登録してください。",
                hideConfirmationModal // 確認ボタンでモーダルを閉じるだけ
            );
            // 確認モーダル表示後、フラグをリセットする
            await updateDoc(statusRef, { needsCheckoutCorrection: false });
             console.log(`Reset needsCheckoutCorrection flag for user ${uid}.`);
        } else {
             // console.log(`No checkout correction needed for user ${uid}.`);
        }
    } catch (error) {
        console.error(`Error checking or resetting checkout correction flag for user ${uid}:`, error);
        // エラーが発生しても処理は続行するが、ログには残す
    }
}

/**
 * Simple HTML escaping function to prevent XSS.
 * Use this when inserting dynamic text content into innerHTML.
 * @param {string | null | undefined} unsafe - The potentially unsafe string.
 * @returns {string} The escaped string.
 */
export function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

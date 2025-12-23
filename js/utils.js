// js/utils.js - 汎用ヘルパー関数

import { db } from "./firebase.js"; 
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { fixCheckoutModal } from "./components/modal/index.js"; 

export function formatDuration(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function formatHoursMinutes(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0時間 0分";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}時間 ${m}分`;
}

export function formatHoursAndMinutesSimple(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}:${m.toString().padStart(2, "0")}`;
}

export function formatTime(timestamp) {
    let date;
    if (timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate(); 
    } else if (timestamp instanceof Date && !isNaN(timestamp)) {
        date = timestamp; 
    } else {
        return ""; 
    }

    try {
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");
        return `${hours}:${minutes}`;
    } catch (error) {
        console.error("Error formatting time:", error, timestamp);
        return ""; 
    }
}

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
        return ""; 
    }
}

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
 * Firestoreのユーザーステータスを確認し、退勤忘れ修正が必要な場合に修正モーダルを表示します。
 * 修正が必要な場合はキャンセルボタンを隠し、警告メッセージを表示して修正を強制します。
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
            
            if (fixCheckoutModal) {
                const dateInput = fixCheckoutModal.querySelector("#fix-checkout-date-input");
                const cancelBtn = fixCheckoutModal.querySelector("#fix-checkout-cancel-btn");
                const descP = fixCheckoutModal.querySelector("p"); // 説明文の要素を取得
                
                // 昨日をデフォルト設定
                if (dateInput) {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    dateInput.value = getJSTDateString(yesterday);
                }

                // ★修正: 後回し不可にするため、キャンセルボタンを非表示にする
                if (cancelBtn) cancelBtn.style.display = "none";

                // ★追加: 説明文を警告メッセージに書き換え、赤字で強調する
                if (descP) {
                    descP.textContent = "【重要】前回の退勤処理が完了していません。正しい退勤時刻を入力して修正してください。この操作は完了するまでスキップできません。";
                    descP.classList.add("text-red-600", "font-bold");
                }

                // モーダルを表示
                fixCheckoutModal.classList.remove("hidden");
            }
        }
    } catch (error) {
        console.error(`Error checking checkout correction flag for user ${uid}:`, error);
    }
}

export function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

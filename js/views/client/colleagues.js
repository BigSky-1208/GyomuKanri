// js/views/client/colleagues.js
import { db, userName } from "../../main.js"; // Import global state (db, userName)
// ★ onSnapshot の代わりに getDocs をインポート
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Import Firestore functions

// --- Module State ---
// ★ 監視リスナーが不要になるため、この行は削除
// let colleaguesListenerUnsubscribe = null;

// --- DOM Element references ---
const colleaguesContainer = document.getElementById("colleagues-on-task-container");
const colleaguesList = document.getElementById("colleagues-list");

/**
 * ★ 関数名を変更 (listenForColleagues -> fetchColleaguesOnTaskStart)
 * Starts listening to Firestore for colleagues working on the specified task
 * and updates the UI list.
 * @param {string} task - The name of the task (internal name, e.g., "その他_detail") to monitor.
 */
export function fetchColleaguesOnTaskStart(task) { // ★関数名を変更
    stopColleaguesListener(); // (これはUIを隠すために呼び出します)

    // Exit if essential elements or data are missing
    if (!colleaguesContainer || !colleaguesList || !userName || !task) {
        console.warn("Cannot fetch colleagues: Missing elements, userName, or task.", { task, userName });
        // Ensure UI is hidden if we can't listen
        if (colleaguesContainer) colleaguesContainer.classList.add("hidden");
        if (colleaguesList) colleaguesList.innerHTML = "";
        return;
    }

    console.log(`Fetching colleagues on task: ${task}`); // ★ログメッセージを変更

    // Query for work_status documents where:
    // - isWorking is true
    // - currentTask matches the specified task
    const q = query(
        collection(db, "work_status"),
        where("isWorking", "==", true),
        where("currentTask", "==", task)
    );

    // --- ▼▼▼ ここから修正 ▼▼▼ ---
    // onSnapshot (常時監視) を getDocs (1回取得) に変更
    getDocs(q).then((snapshot) => {
    // --- ▲▲▲ ここまで修正 ▲▲▲ ---

        if (!colleaguesList || !colleaguesContainer) return; // Check elements again in callback

        colleaguesList.innerHTML = ""; // Clear current list display

        // Filter out the current user and map data
        const colleagues = snapshot.docs
            .map((doc) => doc.data())
            // Ensure userName exists and is not the current user's name
            .filter((data) => data.userName && data.userName !== userName)
            // Sort colleagues by name (Japanese locale)
            .sort((a, b) => (a.userName || "").localeCompare(b.userName || "", "ja"));

        if (colleagues.length > 0) {
            // Render list of colleagues
            colleagues.forEach((data) => {
                const li = document.createElement("li");
                li.className = "p-3 bg-gray-100 rounded-md";
                // Display word of the day if available
                const wordDisplay = data.wordOfTheDay
                    ? `<p class="text-sm text-gray-600 mt-1 pl-2 border-l-2 border-gray-300">「${escapeHtml(data.wordOfTheDay)}」</p>` // Escape HTML in word
                    : "";
                li.innerHTML = `<p class="font-semibold">${escapeHtml(data.userName)}</p>${wordDisplay}`; // Escape HTML in username
                colleaguesList.appendChild(li);
            });
            colleaguesContainer.classList.remove("hidden"); // Show the container
        } else {
            // No colleagues found for this task
            colleaguesContainer.classList.add("hidden"); // Hide the container
        }
    // --- ▼▼▼ ここから修正 ▼▼▼ ---
    }).catch((error) => { // ★ getDocs 用の .catch() エラー処理を追加
        console.error("Error fetching colleagues:", error);
        if (colleaguesContainer) colleaguesContainer.classList.add("hidden");
        if (colleaguesList) colleaguesList.innerHTML = "";
    });
    // --- ▲▲▲ ここまで修正 ▲▲▲ ---
}

/**
 * Stops the Firestore listener for colleagues and clears the UI list.
 */
export function stopColleaguesListener() {
    // --- ▼▼▼ ここを修正 ▼▼▼ ---
    // ★ 監視リスナー (unsubscribe) の呼び出しを削除
    /*
    if (colleaguesListenerUnsubscribe) {
        console.log("Stopping colleagues listener.");
        colleaguesListenerUnsubscribe(); // Call the unsubscribe function
        colleaguesListenerUnsubscribe = null; // Reset the variable
    }
    */
    // --- ▲▲▲ ここまで修正 ▲▲▲ ---

    // Always hide the container and clear the list when stopping
    if (colleaguesContainer) colleaguesContainer.classList.add("hidden");
    if (colleaguesList) colleaguesList.innerHTML = "";
}

/**
 * Simple HTML escaping function to prevent XSS.
 * @param {string} unsafe - The potentially unsafe string.
 * @returns {string} The escaped string.
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

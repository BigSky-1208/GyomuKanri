// js/views/client/colleagues.js - 同僚の稼働状況表示

import { db, userName } from "../../main.js";
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { escapeHtml } from "../../utils.js";

let colleaguesListenerUnsubscribe = null;

/**
 * Starts listening for colleagues working on the same task.
 * @param {string} task - The name of the task to filter by.
 */
export function listenForColleagues(task) {
    stopColleaguesListener(); // Stop any existing listener first

    if (!userName || !task) return;

    const container = document.getElementById("colleagues-on-task-container");
    const colleaguesList = document.getElementById("colleagues-list");

    if (!container || !colleaguesList) return;

    // "休憩"の場合は同僚を表示しない要件であればここでリターン
    if (task === "休憩") {
        container.classList.add("hidden");
        return;
    }

    const q = query(
        collection(db, "work_status"),
        where("isWorking", "==", true),
        where("currentTask", "==", task)
    );

    // console.log(`Starting colleague listener for task: ${task}`);

    colleaguesListenerUnsubscribe = onSnapshot(q, (snapshot) => {
        const colleagues = snapshot.docs
            .map((doc) => doc.data())
            .filter((data) => data.userName && data.userName !== userName);

        colleaguesList.innerHTML = "";

        if (colleagues.length > 0) {
            colleagues.forEach((data) => {
                const li = document.createElement("li");
                li.className = "p-2 bg-gray-50 rounded-md text-sm";
                
                const wordDisplay = data.wordOfTheDay
                    ? `<p class="text-xs text-gray-500 mt-1 pl-2 border-l-2 border-gray-300">「${escapeHtml(data.wordOfTheDay)}」</p>`
                    : "";
                
                li.innerHTML = `
                    <div class="flex items-center">
                        <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                        <span class="font-semibold text-gray-700">${escapeHtml(data.userName)}</span>
                    </div>
                    ${wordDisplay}
                `;
                colleaguesList.appendChild(li);
            });
            container.classList.remove("hidden");
        } else {
            container.classList.add("hidden");
        }
    }, (error) => {
        console.error("Error listening for colleagues:", error);
        container.classList.add("hidden");
    });
}

/**
 * Stops the colleague listener.
 */
export function stopColleaguesListener() {
    if (colleaguesListenerUnsubscribe) {
        colleaguesListenerUnsubscribe();
        colleaguesListenerUnsubscribe = null;
    }
    
    const container = document.getElementById("colleagues-on-task-container");
    const list = document.getElementById("colleagues-list");
    
    if (container) container.classList.add("hidden");
    if (list) list.innerHTML = "";
}

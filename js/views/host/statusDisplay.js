// js/views/host/statusDisplay.js
import { db } from "../../firebase.js"; 
import { collection, query, onSnapshot, getDoc, doc, writeBatch, Timestamp, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; 
import { formatDuration, getJSTDateString } from "../../utils.js"; 
import { showConfirmationModal, hideConfirmationModal } from "../../components/modal.js"; 

// --- Module State ---
let statusListenerUnsubscribe = null; 
let hostViewIntervals = []; 
let currentAllStatuses = []; 

// --- DOM Element references ---
const statusListContainer = document.getElementById("status-list"); 
const taskSummaryContainer = document.getElementById("task-summary-list"); 

export function startListeningForStatusUpdates() {
    stopListeningForStatusUpdates(); 

    if (!statusListContainer || !taskSummaryContainer) {
        console.error("Host view status display elements not found.");
        return;
    }

    console.log("Starting listener for work status updates...");
    const q = query(collection(db, `work_status`));

    statusListenerUnsubscribe = onSnapshot(q, (snapshot) => {
        hostViewIntervals.forEach(clearInterval);
        hostViewIntervals = [];
        
        statusListContainer.innerHTML = "";
        taskSummaryContainer.innerHTML = "";

        currentAllStatuses = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        const workingClientsData = currentAllStatuses.filter(
            (data) => data.isWorking && data.userName 
        );

        workingClientsData.sort((a, b) => {
            const taskA = a.currentTask || "";
            const taskB = b.currentTask || "";
            return taskA.localeCompare(taskB, "ja");
        });

        if (workingClientsData.length === 0) {
            statusListContainer.innerHTML = '<p class="text-gray-500">稼働中の従業員はいません。</p>';
            taskSummaryContainer.innerHTML = '<p class="text-gray-500">稼働中の業務はありません。</p>';
        } else {
            renderTaskSummary(workingClientsData); 
            renderWorkingClientList(workingClientsData); 
        }
         setupForceStopListeners();

    }, (error) => {
        console.error("Error listening for status updates:", error);
        statusListContainer.innerHTML = '<p class="text-red-500">ステータスの読み込み中にエラーが発生しました。</p>';
        taskSummaryContainer.innerHTML = '';
        currentAllStatuses = []; 
        hostViewIntervals.forEach(clearInterval);
        hostViewIntervals = [];
    });
}

export function stopListeningForStatusUpdates() {
    if (statusListenerUnsubscribe) {
        console.log("Stopping listener for work status updates.");
        statusListenerUnsubscribe();
        statusListenerUnsubscribe = null;
    }
    hostViewIntervals.forEach(clearInterval);
    hostViewIntervals = [];
}

function renderTaskSummary(workingClientsData) {
    if (!taskSummaryContainer) return;
    taskSummaryContainer.innerHTML = ""; 

    const taskSummary = {}; 

    workingClientsData.forEach((data) => {
        const taskDisplayKey = data.currentGoalTitle
            ? `${data.currentTask} (${data.currentGoalTitle})`
            : data.currentTask || "未定義の業務"; 

         let displayKeyClean = taskDisplayKey;
         if (displayKeyClean.startsWith("その他_")) {
            displayKeyClean = displayKeyClean.substring(4); 
         }

        if (!taskSummary[displayKeyClean]) {
            taskSummary[displayKeyClean] = 0;
        }
        taskSummary[displayKeyClean]++;
    });

    const sortedTasks = Object.keys(taskSummary).sort((a, b) => a.localeCompare(b, "ja"));

    sortedTasks.forEach((taskKey) => {
        const count = taskSummary[taskKey];
        const summaryItem = document.createElement("div");
        summaryItem.className = "flex justify-between items-center text-sm";
        summaryItem.innerHTML = `<span class="font-semibold text-gray-600">${escapeHtml(taskKey)}</span><span class="font-mono bg-gray-200 px-2 py-1 rounded-md text-gray-800">${count}人</span>`;
        taskSummaryContainer.appendChild(summaryItem);
    });
}

function renderWorkingClientList(workingClientsData) {
    if (!statusListContainer) return;
    statusListContainer.innerHTML = ""; 

    workingClientsData.forEach((data) => {
        const userId = data.userId || data.id; 
        const userName = data.userName || "不明なユーザー";
        const taskDisplayKey = data.currentGoalTitle
            ? `${data.currentTask} (${data.currentGoalTitle})`
            : data.currentTask || "未定義の業務";

        let displayKeyClean = taskDisplayKey;
        if (displayKeyClean.startsWith("その他_")) {
           displayKeyClean = displayKeyClean.substring(4); 
        }

        const card = document.createElement("div");
        card.className = "p-4 bg-gray-50 rounded-lg border";
        card.id = `status-card-${userId}`; 

        card.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <div>
                    <p class="font-semibold text-blue-600">${escapeHtml(displayKeyClean)}</p>
                    <p class="text-sm text-gray-500 mt-1">${escapeHtml(userName)}</p>
                </div>
                <p id="timer-${userId}" class="font-mono text-lg text-green-600">--:--:--</p>
            </div>
            <div class="text-right">
                <button class="force-stop-btn bg-red-600 text-white font-bold py-1 px-3 text-xs rounded-lg hover:bg-red-700 transition" data-user-id="${userId}" data-user-name="${escapeHtml(userName)}">
                    強制停止
                </button>
            </div>`;

        statusListContainer.appendChild(card);

        // --- Set up Timer Display ---
        const timerElement = document.getElementById(`timer-${userId}`);
        const startTime = data.startTime?.toDate(); 

        // ★修正: intervalIdの定義と即時実行を正しく分離
        if (startTime && timerElement) {
            const updateTimer = () => {
                const now = new Date();
                if (startTime instanceof Date && !isNaN(startTime)) {
                    const elapsed = Math.max(0, Math.floor((now - startTime) / 1000)); 
                    
                    const currentTimerElement = document.getElementById(`timer-${userId}`);
                    if (currentTimerElement) {
                       currentTimerElement.textContent = formatDuration(elapsed);
                    } else {
                         // If element is gone (removed from DOM), we can't clear using `intervalId` 
                         // here easily because of scope. We rely on `hostViewIntervals` cleanup 
                         // on snapshot update or view cleanup.
                    }
                } else {
                     timerElement.textContent = "--:--:--"; 
                }
            };

            updateTimer(); // Update immediately
            const intervalId = setInterval(updateTimer, 1000); 
            hostViewIntervals.push(intervalId); 
        } else if (timerElement) {
             timerElement.textContent = "--:--:--"; 
        }
    });
}

function setupForceStopListeners() {
     if (!statusListContainer) return;
     // Remove previous listener (optional, as we clear innerHTML)
     // statusListContainer.removeEventListener('click', handleForceStopClick); 
     statusListContainer.addEventListener('click', handleForceStopClick);
 }

 function handleForceStopClick(event) {
     if (event.target.classList.contains("force-stop-btn")) {
         const button = event.target;
         const userIdToStop = button.dataset.userId;
         const userNameToStop = button.dataset.userName;

         if (!userIdToStop || !userNameToStop) {
             console.error("Missing user ID or name for force stop.");
             return;
         }

         showConfirmationModal(
             `${userNameToStop}さんの業務を強制的に停止（帰宅処理）します。よろしいですか？`,
             async () => { 
                 await forceStopUser(userIdToStop, userNameToStop); 
                 hideConfirmationModal();
             }
         );
     }
 }

export async function forceStopUser(userIdToStop, userNameToStop) {
    console.log(`Attempting to force stop user: ${userNameToStop} (${userIdToStop})`);
    const statusRef = doc(db, "work_status", userIdToStop);

    try {
        const statusSnap = await getDoc(statusRef);

        if (!statusSnap.exists() || !statusSnap.data().isWorking) {
            alert(`${userNameToStop}さんは現在稼働中ではありません。`);
            return;
        }

        const statusData = statusSnap.data();
        const taskStartTime = statusData.startTime?.toDate(); 

        if (!taskStartTime || !(taskStartTime instanceof Date) || isNaN(taskStartTime)) {
             console.error(`Invalid startTime found for user ${userNameToStop}. Cannot log duration.`);
        } else {
            const endTime = new Date(); 
            const duration = Math.max(0, Math.floor((endTime - taskStartTime) / 1000));

             if(duration > 0) {
                 const logData = {
                     userId: userIdToStop,
                     userName: statusData.userName,
                     task: statusData.currentTask || "不明な業務",
                     goalId: statusData.currentGoalId || null,
                     goalTitle: statusData.currentGoalTitle || null,
                     date: getJSTDateString(taskStartTime), 
                     startTime: Timestamp.fromDate(taskStartTime), 
                     endTime: Timestamp.fromDate(endTime),       
                     duration: duration,
                     memo: (statusData.memo || "") + " [管理者による強制停止]",
                 };
                 const batch = writeBatch(db);
                 const logsCollectionRef = collection(db, "work_logs");
                 batch.set(doc(logsCollectionRef), logData); 
                 await batch.commit(); 
                 console.log(`Work log created for ${userNameToStop} (forced stop).`);
             }
        } 

        await updateDoc(statusRef, {
            isWorking: false,
            currentTask: null,
            currentGoalId: null,
            currentGoalTitle: null,
            startTime: null, 
            preBreakTask: null, 
        });
        console.log(`Status updated to not working for ${userNameToStop}.`);
        alert(`${userNameToStop}さんの業務を停止しました。`); 

    } catch (error) {
        console.error(`Error forcing stop for user ${userNameToStop}:`, error);
        alert(`ユーザー ${userNameToStop} の強制停止中にエラーが発生しました。`);
    }
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

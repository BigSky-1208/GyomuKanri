// js/views/host/statusDisplay.js

import { db } from "../../main.js"; 
import { collection, query, onSnapshot, getDoc, doc, writeBatch, Timestamp, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; 
import { formatDuration, getJSTDateString } from "../../utils.js"; 
import { showConfirmationModal, hideConfirmationModal } from "../../components/modal.js"; 
// ユーザー管理モジュールへデータを渡すためにインポート
import { updateStatusesCache } from "./userManagement.js";

// --- Module State ---
let statusListenerUnsubscribe = null; 
let wordListenerUnsubscribe = null;
let hostViewIntervals = []; 
let currentAllStatuses = []; 

// --- DOM Element references ---
const statusListContainer = document.getElementById("status-list"); 
const taskSummaryContainer = document.getElementById("task-summary-list"); 

/**
 * 監視を開始する（host.jsから呼ばれる）
 */
export function startListeningForStatusUpdates() {
    stopListeningForStatusUpdates(); 

    if (!statusListContainer || !taskSummaryContainer) {
        console.error("Host view status display elements not found.");
        return;
    }

    console.log("Starting listener for work status updates...");

    // UIの準備: 今日の一言エリアがない場合は作成して追加
    setupDailyWordUI();

    // 1. 稼働状況の監視
    const q = query(collection(db, `work_status`));

    statusListenerUnsubscribe = onSnapshot(q, (snapshot) => {
        // 更新のたびにタイマーをリセット
        hostViewIntervals.forEach(clearInterval);
        hostViewIntervals = [];
        
        // コンテナのクリア
        statusListContainer.innerHTML = "";
        taskSummaryContainer.innerHTML = "";

        // データの取得
        currentAllStatuses = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        // ユーザー管理モジュールへ最新情報を渡す
        updateStatusesCache(currentAllStatuses);

        // 稼働中のユーザーのみフィルタリング
        const workingClientsData = currentAllStatuses.filter(
            (data) => data.isWorking && data.userName 
        );

        // 業務名でソート
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

        // 強制退勤ボタンのリスナー設定（再描画ごとに行う）
        setupForceStopListeners();

    }, (error) => {
        console.error("Error listening for status updates:", error);
        statusListContainer.innerHTML = '<p class="text-red-500">ステータスの読み込み中にエラーが発生しました。</p>';
    });

    // 2. 今日の一言の監視
    setupDailyWordMonitoring();
}

/**
 * 監視を停止する（host.jsから呼ばれる）
 */
export function stopListeningForStatusUpdates() {
    if (statusListenerUnsubscribe) {
        console.log("Stopping listener for work status updates.");
        statusListenerUnsubscribe();
        statusListenerUnsubscribe = null;
    }
    if (wordListenerUnsubscribe) {
        wordListenerUnsubscribe();
        wordListenerUnsubscribe = null;
    }
    hostViewIntervals.forEach(clearInterval);
    hostViewIntervals = [];
}

/**
 * 業務サマリー（左上）の描画
 */
function renderTaskSummary(workingClientsData) {
    if (!taskSummaryContainer) return;
    
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

/**
 * 稼働中ユーザーリスト（左下）の描画
 */
function renderWorkingClientList(workingClientsData) {
    if (!statusListContainer) return;

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
        // 休憩中は色を変える
        const isBreak = data.currentTask === "休憩";
        const borderColor = isBreak ? "border-orange-400" : "border-blue-600";
        const taskColor = isBreak ? "text-orange-600" : "text-blue-600";

        card.className = `p-4 bg-gray-50 rounded-lg border-l-4 ${borderColor} shadow-sm mb-2`;
        card.id = `status-card-${userId}`; 

        card.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <div>
                    <p class="font-semibold ${taskColor}">${escapeHtml(displayKeyClean)}</p>
                    <p class="text-sm text-gray-500 mt-1">${escapeHtml(userName)}</p>
                </div>
                <p id="timer-${userId}" class="font-mono text-lg text-gray-700">--:--:--</p>
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

        if (startTime && timerElement) {
            const updateTimer = () => {
                const now = new Date();
                if (startTime instanceof Date && !isNaN(startTime)) {
                    const elapsed = Math.max(0, Math.floor((now - startTime) / 1000)); 
                    
                    const currentTimerElement = document.getElementById(`timer-${userId}`);
                    if (currentTimerElement) {
                       currentTimerElement.textContent = formatDuration(elapsed);
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

// --- 今日の一言 機能 ---

function setupDailyWordUI() {
    // 既存のコンテナを探す
    let wordContainer = document.getElementById("host-daily-word-display");
    
    // statusListContainer (activeUsersContainer) の親要素に追加
    if (!wordContainer && statusListContainer && statusListContainer.parentNode) {
        wordContainer = document.createElement("div");
        wordContainer.id = "host-daily-word-display";
        wordContainer.className = "mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm";
        wordContainer.innerHTML = `
            <h3 class="font-bold text-gray-700 mb-2 flex items-center">
                <span class="text-xl mr-2">📢</span> 今日の一言
            </h3>
            <p id="host-daily-word-text" class="text-gray-600 whitespace-pre-wrap">読み込み中...</p>
            <p id="host-daily-word-info" class="text-xs text-gray-400 mt-2 text-right"></p>
        `;
        
        statusListContainer.parentNode.appendChild(wordContainer);
    }
}

function setupDailyWordMonitoring() {
    const wordRef = doc(db, "settings", "daily_word");
    
    wordListenerUnsubscribe = onSnapshot(wordRef, (docSnap) => {
        const textElem = document.getElementById("host-daily-word-text");
        const infoElem = document.getElementById("host-daily-word-info");
        
        if (docSnap.exists() && textElem) {
            const data = docSnap.data();
            textElem.textContent = data.text || "（設定されていません）";
            
            if (data.updatedBy) {
                let timeStr = "";
                if (data.updatedAt && data.updatedAt.toDate) {
                    const d = data.updatedAt.toDate();
                    timeStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
                }
                infoElem.textContent = `Updated by ${data.updatedBy} (${timeStr})`;
            } else {
                infoElem.textContent = "";
            }
        } else if (textElem) {
            textElem.textContent = "（未設定）";
        }
    }, (error) => {
        console.error("Error listening to daily word:", error);
    });
}

// --- 強制停止（強制退勤）機能 ---

function setupForceStopListeners() {
     if (!statusListContainer) return;
     // 重複登録を防ぐため、一度クローンするか、既存の仕組みを使う
     // ここではシンプルにイベント委譲を使う（innerHTML書き換えでイベントが消えるため、親ではなく毎回設定する場合は注意が必要だが、
     // statusListContainer自体が書き換わるわけではないならOK。今回は中身を書き換えているので、statusListContainerにイベント委譲を設定するのが良い）
     
     // 既存のリスナーがあれば削除したいが、無名関数だと難しい。
     // なので、onclick属性や、毎回生成されるボタンに対して直接イベントをつける方式でも良いが、
     // ここでは安全に、statusListContainerへのイベント委譲を「初回のみ」設定するロジックにするか、
     // あるいは生成時にボタンにaddEventListenerする（renderWorkingClientList内で実施済みなら不要だが、していない）
     
     // renderWorkingClientList の中で innerHTML で生成した後、ボタンを取得してイベントを設定します。
     const buttons = statusListContainer.querySelectorAll(".force-stop-btn");
     buttons.forEach(btn => {
         btn.addEventListener('click', handleForceStopClick);
     });
 }

 function handleForceStopClick(event) {
     const button = event.currentTarget; // addEventListenerならcurrentTarget
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

// js/views/client/client.js

// ★修正: userId を追加インポート（自分の監視に必要）
import { showView, VIEWS, db, userName, userId } from "../../main.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// timer.js から操作関数をインポート
import { 
    handleStartClick, 
    handleStopClick, 
    handleBreakClick, 
    restoreClientState as restoreTimerState,
    stopStatusListener 
} from "./timer.js";

import { listenForUserReservations, handleSaveBreakReservation, handleSetStopReservation, handleCancelStopReservation, deleteReservation } from "./reservations.js";
import { triggerReservationNotification } from "../../components/notification.js";

import { 
    handleTaskSelectionChange, 
    handleGoalSelectionChange, 
    handleDisplaySettingChange, 
    renderTaskOptions, 
    renderTaskDisplaySettings, 
    updateTomuraStatusDisplay,
    injectMessageHistoryButton 
} from "./clientUI.js";

import { handleFixCheckout } from "./clientActions.js";
import { toggleMiniDisplay } from "./miniDisplay.js";
import { openBreakReservationModal, fixCheckoutModal, showHelpModal } from "../../components/modal/index.js";
import { stopColleaguesListener } from "./colleagues.js";

// --- DOM Element references ---
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const breakBtn = document.getElementById("break-btn");
const taskSelect = document.getElementById("task-select");
const goalSelect = document.getElementById("goal-select");
const otherTaskInput = document.getElementById("other-task-input");
const taskDisplaySettingsList = document.getElementById("task-display-settings-list");

// Reservation UI elements
const addBreakReservationBtn = document.getElementById("add-break-reservation-btn");
const breakReservationList = document.getElementById("break-reservation-list");
const breakReservationSaveBtn = document.getElementById("break-reservation-save-btn");
const setStopReservationBtn = document.getElementById("set-stop-reservation-btn");
const cancelStopReservationBtn = document.getElementById("cancel-stop-reservation-btn");

// Navigation/Other buttons
const backButton = document.getElementById("back-to-selection-client");
const myRecordsButton = document.getElementById("my-records-btn");
const viewMyProgressButton = document.getElementById("view-my-progress-btn");
const fixCheckoutButton = document.getElementById("fix-yesterday-checkout-btn");
const fixCheckoutSaveBtn = document.getElementById("fix-checkout-save-btn");

// Help Button
const helpButton = document.querySelector('#client-view .help-btn');

// リスナー解除用変数
let tomuraStatusInterval = null; // Unsubscribe から Interval に変更
let myStatusUnsubscribe = null;
/**
 * クライアント画面を離れる際、または初期化前のクリーンアップ処理
 */
export function cleanupClientView() {
    console.log("Cleaning up Client View listeners...");
    
    // 1. 【修正】戸村さんのステータス監視（タイマー）を止める
    if (tomuraStatusInterval) {
        clearInterval(tomuraStatusInterval);
        tomuraStatusInterval = null;
    }
    // 2. ★追加: 自分自身のステータス監視を止める
    if (myStatusUnsubscribe) {
        myStatusUnsubscribe();
        myStatusUnsubscribe = null;
    }
    
    // 3. 同僚の監視を止める
    stopColleaguesListener();
    
    // 4. タイマー関連の監視（ステータス監視やループ）を止める
    stopStatusListener();
}

/**
 * クライアント画面の初期化
 */
export async function initializeClientView() {
    console.log("Initializing Client View...");
    
    // 以前のリスナーが残っている場合に備えて掃除を行う
    cleanupClientView();

    await restoreTimerState();

    // ★追加: 自分自身のステータス変化を監視開始 (自動切り替えに必須)
    listenForMyStatus();

    listenForUserReservations();
    
    renderTaskOptions();
    renderTaskDisplaySettings(); 
    
    injectMessageHistoryButton();
    
    listenForTomuraStatus();
    
    // 前の画面のリスナーを停止
    stopColleaguesListener();
}

/**
 * ★追加: 自分自身のステータスをリアルタイム監視する関数
 * Workerが裏でステータスを変更した際に、画面を即座に同期させます。
 */
// ★追加: 自分自身のステータスをリアルタイム監視する関数
function listenForMyStatus() {
    if (!userId) return;
    
    if (myStatusUnsubscribe) {
        myStatusUnsubscribe();
    }

    // Firestoreの自分のドキュメントを監視
    myStatusUnsubscribe = onSnapshot(doc(db, "work_status", userId), async (docSnap) => { // asyncにする
        if (docSnap.exists()) {
            const data = docSnap.data();

            // --- [DEBUG] データ受信確認 ---
            console.group("🔥 Firestore Update Detected");
            console.log("Raw Data:", data);
            // -----------------------------

            // ★追加判定：Workerによって更新されたばかりかどうか
            const isWorkerUpdate = data.lastUpdatedBy === 'worker';
            // 以前の状態（ローカル）と比較
            const prevTask = localStorage.getItem("currentTask");
            
            // FirestoreのTimestamp型対策
            let dbStartTime = data.startTime;
            if (dbStartTime && typeof dbStartTime.toDate === 'function') {
                dbStartTime = dbStartTime.toDate().toISOString();
            }

            // --- [DEBUG] 条件判定の確認 ---
            console.log("🔍 Condition Check:", {
                isWorkerUpdate: isWorkerUpdate,
                currentTaskIsBreak: data.currentTask === '休憩',
                prevTaskIsNotBreak: prevTask !== '休憩',
                localPrevTask: prevTask
            });
            // -----------------------------

            // ■■■ Worker対応追加ブロック ■■■
            if (isWorkerUpdate && data.currentTask === '休憩' && prevTask !== '休憩') {
                console.log("✅ Workerブロックに突入しました！"); // [DEBUG]
                triggerReservationNotification("休憩開始");

                console.log("Workerによる休憩開始を検知。ローカル状態を強制同期します（ログ保存はスキップ）。");
                
                // 1. LocalStorageを強制上書き
                localStorage.setItem("isWorking", "1");
                localStorage.setItem("currentTask", "休憩");
                if (dbStartTime) localStorage.setItem("startTime", dbStartTime);

                // ▼▼▼ 追加: 休憩に入ったので、ローカルに残っている工数情報を確実に消す！ ▼▼▼
                localStorage.removeItem("currentGoalId");
                localStorage.removeItem("currentGoal");
                // ▲▲▲ 追加ここまで ▲▲▲
                
                // 2. 休憩前のタスク情報があれば保存
                if (data.preBreakTask) {

                    // ▼▼▼ 【追加】データが「文字列」のままなら、オブジェクトに変換する ▼▼▼
                    if (typeof data.preBreakTask === 'string') {
                        try {
                            data.preBreakTask = JSON.parse(data.preBreakTask);
                            console.log("⚠️ 文字列のpreBreakTaskをオブジェクトに変換しました");
                        } catch (e) {
                            console.error("❌ preBreakTaskのパースに失敗:", e);
                        }
                    }
                    // ▲▲▲ 追加ここまで ▲▲▲

                    const goalSelect = document.getElementById("goal-select");
                    const currentGoalId = goalSelect ? goalSelect.value : null;
                    
                    // 修正: オブジェクトに対して goalId をセットするのでエラーになりません
                    if (currentGoalId && (!data.preBreakTask.goalId || data.preBreakTask.goalId === "")) {
                        data.preBreakTask.goalId = currentGoalId;
                        console.log("🔄 画面の値を使って goalId を補完しました:", currentGoalId);
                    }                    
                    console.log("💾 preBreakTaskを保存します:", data.preBreakTask); // [DEBUG]

                    // LocalStorageへ保存
                    localStorage.setItem("preBreakTask", JSON.stringify(data.preBreakTask));
                    
                    // ステートへ保存（awaitを使って、完了を確実に待つ）
                    const State = await import("./timerState.js");
                    State.setPreBreakTask(data.preBreakTask);
                } else {
                    console.warn("⚠️ data.preBreakTask が存在しません！"); // [DEBUG]
                }

                // 3. UIと内部ステートだけ更新して終了
                await restoreTimerState(); // ここも念の為 await しておくと安心
                
                console.log("🛑 Workerブロック処理完了。returnします。"); // [DEBUG]
                console.groupEnd();
                return; 
            } else {
                console.log("⏭️ Workerブロックをスキップしました（条件不一致）。"); // [DEBUG]
            }
            // ■■■ ここまで ■■■


            const dbIsWorking = data.isWorking === 1 || data.isWorking === true;
            console.log("Standard Logic Check - dbIsWorking:", dbIsWorking); // [DEBUG]

            if (dbIsWorking) {
                // DBが「稼働中（休憩含む）」の場合
                localStorage.setItem("isWorking", "1");
                
                if (data.currentTask) {
                    localStorage.setItem("currentTask", data.currentTask);
                }
                
                if (dbStartTime) {
                    localStorage.setItem("startTime", dbStartTime);
                }

                // 工数情報の同期
                if (data.currentGoalId) {
                    localStorage.setItem("currentGoalId", data.currentGoalId);
                } else {
                    localStorage.removeItem("currentGoalId");
                }

                const goalTitle = data.currentGoalTitle || data.currentGoal;
                if (goalTitle) {
                    localStorage.setItem("currentGoal", goalTitle);
                } else {
                    localStorage.removeItem("currentGoal");
                }

            } else {
                console.log("⬇️ 業務終了（停止中）ルートに入りました"); // [DEBUG]

                // ★追加: Workerによる自動停止（帰宅）だった場合に通知を出す
if (isWorkerUpdate) {
                    // 更新時刻をチェックして、古すぎる通知（ログイン時など）を防ぐ
                    let lastUpdate = null;
                    if (data.updatedAt) {
                        // FirestoreのTimestamp型か、文字列(ISO)かを判定してDate化
                        if (typeof data.updatedAt.toDate === 'function') {
                            lastUpdate = data.updatedAt.toDate();
                        } else {
                            lastUpdate = new Date(data.updatedAt);
                        }
                    }

                    // 現在時刻との差分（秒）を計算
                    const now = new Date();
                    const diffSeconds = lastUpdate ? (now - lastUpdate) / 1000 : 999999;

                    // 「10分以内（600秒）」に行われた変更の場合のみ通知する
                    // ※PCの時計ズレも考慮して少し余裕を持たせています
                    if (diffSeconds < 600) {
                        triggerReservationNotification("帰宅");
                    }
                }                
                // DBが「停止中（帰宅済）」の場合
                localStorage.removeItem("isWorking");
                localStorage.removeItem("currentTask");
                localStorage.removeItem("startTime");
                localStorage.removeItem("currentGoal");
                localStorage.removeItem("currentGoalId");
                localStorage.removeItem("preBreakTask");
                localStorage.removeItem("gyomu_timer_current_status");
            }

            // 念のため、休憩前タスクがあれば必ず保存しておく
            if (data.preBreakTask) {

                // ▼▼▼ 追加: goalId チェックと補完ロジック ▼▼▼
                    if (!data.preBreakTask.goalId && data.preBreakTask.goalTitle) {
                        console.warn("⚠️ goalId が欠落しています。goalTitle から復旧を試みます:", data.preBreakTask.goalTitle);
                        
                        // 現在の画面にあるゴールプルダウンの選択肢から、同じタイトルの ID を探す
                        // (※プルダウンの ID が "#goal-select" だと仮定した場合の例です。適宜IDを合わせてください)
                        const goalSelect = document.getElementById("goal-select"); // ← ここのIDを確認してください
                        if (goalSelect) {
                            const matchingOption = Array.from(goalSelect.options).find(opt => opt.text.trim() === data.preBreakTask.goalTitle.trim());
                            if (matchingOption) {
                                data.preBreakTask.goalId = matchingOption.value;
                                console.log("✅ goalId を復元しました:", data.preBreakTask.goalId);
                            } else {
                                console.error("❌ 一致するゴールが見つかりませんでした。");
                            }
                        }
                    }
                    // ▲▲▲ 追加ここまで ▲▲▲
                
                localStorage.setItem("preBreakTask", JSON.stringify(data.preBreakTask));
                import("./timerState.js").then(State => State.setPreBreakTask(data.preBreakTask));
            }

            await restoreTimerState();
            console.groupEnd();
            console.log("🛑 Workerブロック処理完了。returnします。"); // [DEBUG]
            return;

        } 
    }, (error) => {
        console.error("Error listening to my status:", error);
    });
}

/**
 * イベントリスナーの設定
 */
export function setupClientEventListeners() {
    console.log("Setting up Client View event listeners...");

    // Timer control buttons
if (startBtn) startBtn.onclick = handleStartClick;
if (stopBtn) stopBtn.onclick = () => handleStopClick(false);
if (breakBtn) breakBtn.onclick = () => handleBreakClick(false);
    
    // Task and Goal selection
    taskSelect?.addEventListener("change", handleTaskSelectionChange);
    goalSelect?.addEventListener("change", handleGoalSelectionChange);

    // Other task input
    otherTaskInput?.addEventListener("change", handleTaskSelectionChange);
    otherTaskInput?.addEventListener("blur", handleTaskSelectionChange);

    // Task display preferences
    taskDisplaySettingsList?.addEventListener("change", handleDisplaySettingChange);
    
    // ミニ表示ボタン
    taskDisplaySettingsList?.addEventListener("click", (e) => {
        if (e.target.id === "toggle-mini-display-btn") {
            toggleMiniDisplay();
        }
    });

    // --- Reservation UI Listeners ---
    addBreakReservationBtn?.addEventListener("click", () => openBreakReservationModal());
    
    breakReservationList?.addEventListener("click", (event) => {
        const target = event.target;
        const id = target.dataset.id;
        if (!id) return;

        if (target.classList.contains("edit-break-reservation-btn")) {
            openBreakReservationModal(id);
        } else if (target.classList.contains("delete-break-reservation-btn")) {
            deleteReservation(id);
        }
    });

    breakReservationSaveBtn?.addEventListener("click", handleSaveBreakReservation);
    setStopReservationBtn?.addEventListener("click", handleSetStopReservation);
    cancelStopReservationBtn?.addEventListener("click", handleCancelStopReservation);

    // --- Navigation and Other Buttons ---
    backButton?.addEventListener("click", () => showView(VIEWS.MODE_SELECTION));

    myRecordsButton?.addEventListener("click", () => {
        if (userName) {
            showView(VIEWS.PERSONAL_DETAIL, { userName: userName });
        } else {
            console.error("Cannot show personal records: userName is not defined.");
        }
    });

    viewMyProgressButton?.addEventListener("click", () => {
        window.isProgressViewReadOnly = true;
        showView(VIEWS.PROGRESS);
    });

    fixCheckoutButton?.addEventListener("click", () => {
        if (fixCheckoutModal) {
            const dateInput = fixCheckoutModal.querySelector("#fix-checkout-date-input");
            const cancelBtn = fixCheckoutModal.querySelector("#fix-checkout-cancel-btn");
            const descP = fixCheckoutModal.querySelector("p");

            if (cancelBtn) cancelBtn.style.display = "inline-block";

            if (descP) {
                descP.textContent = "修正したい日付と、その日の正しい退勤時刻を入力してください。入力した時刻でその日の最後の業務が終了され、それ以降の記録は削除されます。";
                descP.classList.remove("text-red-600", "font-bold");
            }

            if (dateInput) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                dateInput.value = yesterday.toISOString().split("T")[0];
            }
            fixCheckoutModal.classList.remove("hidden");
        } else {
            console.error("Fix checkout modal not found.");
        }
    });

    fixCheckoutSaveBtn?.addEventListener("click", handleFixCheckout);

    // Help Button
    helpButton?.addEventListener('click', () => showHelpModal('client'));

    console.log("Client View event listeners set up complete.");
}

// 【修正】戸村さんの状況をD1から取得して表示する関数
function listenForTomuraStatus() {
    // すでに動いているタイマーがあれば止める
    if (tomuraStatusInterval) {
        clearInterval(tomuraStatusInterval);
    }

    const WORKER_URL = "https://muddy-night-4bd4.sora-yamashita.workers.dev";
    const todayStr = new Date().toISOString().split("T")[0];

    const fetchStatus = async () => {
        try {
            const resp = await fetch(`${WORKER_URL}/get-tomura-status`);
            if (resp.ok) {
                const data = await resp.json();
                
                // 日付が今日のものかチェック（Worker側でも考慮されていますが念のため）
                let statusData = {
                    status: data.status || "声掛けNG",
                    location: data.location || ""
                };

                // もし日付が今日でない場合は、デフォルトに戻す
                if (data.date && data.date !== todayStr) {
                    statusData = { status: "声掛けNG", location: "出社" };
                }
                
                // UI表示を更新（既存のclientUI.jsの関数を呼び出し）
                updateTomuraStatusDisplay(statusData);
            }
        } catch (error) {
            console.error("戸村ステータス(D1)取得エラー:", error);
        }
    };

    // 初回実行
    fetchStatus();
    // 10秒おきに最新の状態を確認
    tomuraStatusInterval = setInterval(fetchStatus, 60000);
}

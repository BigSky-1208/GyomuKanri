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
import { openBreakReservationModal, fixCheckoutModal, showHelpModal } from "../../components/modal.js";
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
    
    // 1. 戸村さんのステータス監視を止める
    if ( tomuraStatusInterval) {
         tomuraStatusInterval();
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
function listenForMyStatus() {
    if (!userId) return;
    
    if (myStatusUnsubscribe) {
        myStatusUnsubscribe();
    }

    // Firestoreの自分のドキュメントを監視
    myStatusUnsubscribe = onSnapshot(doc(db, "work_status", userId), (docSnap) => {
        // データが変更されたら、timer.js の状態復元関数を呼んで画面を同期
        // （自分が操作した時も発火しますが、restoreTimerStateは冪等なので問題ありません）
        restoreTimerState();
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
    startBtn?.addEventListener("click", handleStartClick);
    stopBtn?.addEventListener("click", () => handleStopClick(false));
    breakBtn?.addEventListener("click", () => handleBreakClick(false));

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
    tomuraStatusInterval = setInterval(fetchStatus, 10000);
}

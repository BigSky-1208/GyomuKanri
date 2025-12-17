// js/views/client/client.js

import { showView, VIEWS, db, userName } from "../../main.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// timer.js から操作関数をインポート
import { handleStartClick, handleStopClick, handleBreakClick, restoreClientState as restoreTimerState } from "./timer.js";
import { listenForUserReservations, handleSaveBreakReservation, handleSetStopReservation, handleCancelStopReservation, deleteReservation } from "./reservations.js";
// ★修正: updateTomuraStatusDisplay を追加インポート
import { handleTaskSelectionChange, handleGoalSelectionChange, handleDisplaySettingChange, renderTaskOptions, renderTaskDisplaySettings, updateTomuraStatusDisplay } from "./clientUI.js";

// clientActions.js からは handleFixCheckout のみをインポート
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

// 戸村さんステータス用リスナー解除関数
let tomuraStatusUnsubscribe = null;

/**
 * クライアント画面の初期化
 */
export async function initializeClientView() {
    console.log("Initializing Client View...");
    await restoreTimerState();
    listenForUserReservations();
    
    renderTaskOptions();
    renderTaskDisplaySettings(); 
    
    listenForTomuraStatus();
    
    // 前の画面のリスナーを停止
    stopColleaguesListener();

    // ★追加: 保存されていた書きかけのメモがあれば復元する
    const memoInput = document.getElementById("task-memo-input");
    const savedMemo = localStorage.getItem("tempTaskMemo");
    if (memoInput && savedMemo) {
        memoInput.value = savedMemo;
    }
}

/**
 * イベントリスナーの設定
 */
export function setupClientEventListeners() {
    console.log("Setting up Client View event listeners...");

    // Timer control buttons (timer.jsの関数を使用)
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

            // 手動オープンのためキャンセルボタンを表示
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

    // ★追加: メモ入力時にリアルタイムでlocalStorageに保存する
    const memoInput = document.getElementById("task-memo-input");
    memoInput?.addEventListener("input", (e) => {
        localStorage.setItem("tempTaskMemo", e.target.value);
    });

    console.log("Client View event listeners set up complete.");
}

// 戸村さんの状況を監視して表示する関数
function listenForTomuraStatus() {
    if (tomuraStatusUnsubscribe) {
        tomuraStatusUnsubscribe();
        tomuraStatusUnsubscribe = null;
    }

    const statusRef = doc(db, "settings", "tomura_status");
    const todayStr = new Date().toISOString().split("T")[0];

    tomuraStatusUnsubscribe = onSnapshot(statusRef, (docSnap) => {
        let statusData = {
            status: "声掛けNG",
            location: "" // デフォルト
        };

        if (docSnap.exists()) {
            const data = docSnap.data();
            // 日付が今日の場合のみ有効
            if (data.date === todayStr) {
                statusData.status = data.status || "声掛けNG";
                statusData.location = data.location || ""; // 場所情報を取得
            }
        }
        
        // ★修正: clientUI.js の表示更新関数を使用
        updateTomuraStatusDisplay(statusData);

    }, (error) => {
        console.error("Error listening for Tomura's status:", error);
    });
}

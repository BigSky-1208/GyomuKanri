// js/main.js - アプリケーションのメインロジック（最適化版）

import { db, isFirebaseConfigValid } from './firebase.js';
import { checkOktaAuthentication, handleOktaLogout } from './okta.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { initMessaging, listenForMessages } from './fcm.js';
import { initializeModeSelectionView, setupModeSelectionEventListeners } from './views/modeSelection.js';
import { initializeTaskSettingsView, setupTaskSettingsEventListeners } from './views/taskSettings.js';
import { initializeHostView, cleanupHostView, setupHostEventListeners } from './views/host/host.js';
// ★修正: cleanupClientView をインポートに追加
import { initializeClientView, cleanupClientView, setupClientEventListeners } from './views/client/client.js';
import { initializePersonalDetailView, cleanupPersonalDetailView, setupPersonalDetailEventListeners } from './views/personalDetail/personalDetail.js';
import { initializeReportView, cleanupReportView, setupReportEventListeners } from './views/report.js';
import { initializeProgressView, setupProgressEventListeners } from './views/progress/progress.js';
import { initializeArchiveView, setupArchiveEventListeners } from './views/archive.js';
const LAST_VIEW_KEY = "gyomu_timer_last_view";
export const worker = new Worker('/timer-worker.js'); // export をつける


import { initializeApprovalView, cleanupApprovalView } from './views/host/approval.js';

import { setupModalEventListeners, adminPasswordView, closeModal } from './components/modal/index.js';
import { setupExcelExportEventListeners } from './excelExport.js';
import { getJSTDateString, escapeHtml } from './utils.js';

export let userId = null;
export let userName = null;
export let authLevel = 'none';
export let allTaskObjects = []; 
export let userDisplayPreferences = { hiddenTasks: [] }; 
export let viewHistory = []; 
export let adminLoginDestination = null; 

export const VIEWS = {
    OKTA_WIDGET: "okta-signin-widget-container",
    MODE_SELECTION: "mode-selection-view",
    TASK_SETTINGS: "task-settings-view",
    HOST: "host-view",
    CLIENT: "client-view",
    PERSONAL_DETAIL: "personal-detail-view",
    REPORT: "report-view",
    PROGRESS: "progress-view",
    ARCHIVE: "archive-view",
    ADMIN_PASSWORD: "admin-password-view", 
    APPROVAL: "approval-view", 
};

// ビューのライフサイクル管理
const viewLifecycle = {
    [VIEWS.MODE_SELECTION]: { init: initializeModeSelectionView },
    [VIEWS.TASK_SETTINGS]: { init: initializeTaskSettingsView },
    [VIEWS.HOST]: { init: initializeHostView, cleanup: cleanupHostView },
    // ★修正: CLIENTビューに cleanup を追加して通信のリークを防ぐ
    [VIEWS.CLIENT]: { init: initializeClientView, cleanup: cleanupClientView }, 
    [VIEWS.PERSONAL_DETAIL]: { init: initializePersonalDetailView, cleanup: cleanupPersonalDetailView },
    [VIEWS.REPORT]: { init: initializeReportView, cleanup: cleanupReportView },
    [VIEWS.PROGRESS]: { init: initializeProgressView },
    [VIEWS.ARCHIVE]: { init: initializeArchiveView },
    [VIEWS.APPROVAL]: { init: initializeApprovalView, cleanup: cleanupApprovalView },
};

function injectApprovalViewHTML() {
    if (document.getElementById(VIEWS.APPROVAL)) return;
    const div = document.createElement("div");
    div.id = VIEWS.APPROVAL;
    div.className = "view p-6 max-w-5xl mx-auto"; 
    div.innerHTML = `
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold text-gray-800">業務時間追加・変更承認</h2>
            <button id="back-from-approval" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded shadow">
                戻る
            </button>
        </div>
        <div id="approval-list-content" class="space-y-4"></div>
    `;
    document.getElementById("app-container").appendChild(div);
    
    document.getElementById("back-from-approval").addEventListener("click", () => {
        showView(VIEWS.HOST);
    });
}

async function initialize() {
    console.log("Initializing application...");
    setupVisibilityReload();

    const appContainer = document.getElementById('app-container');

    if (!isFirebaseConfigValid()) {
        displayInitializationError("Firebaseの設定が無効です。firebase.jsを確認してください。");
        return;
    }
    
    injectApprovalViewHTML();
    setupGlobalEventListeners();

    try {
        await checkOktaAuthentication(async () => {
            await startAppAfterLogin();

            const today = getJSTDateString(new Date());
            const lastLoginDate = localStorage.getItem("last_login_date");

            if (lastLoginDate !== today) {
                console.log("本日最初のログインです。モード選択画面を表示します。");
                localStorage.setItem("last_login_date", today);
                showView(VIEWS.MODE_SELECTION);
            } else {
                const savedViewJson = localStorage.getItem(LAST_VIEW_KEY);
                if (savedViewJson) {
                    const { name, params } = JSON.parse(savedViewJson);
                    showView(name, params);
                } else {
                    showView(VIEWS.MODE_SELECTION);
                }
            }
        });
    } catch(error) {
        console.error("Okta Authentication Check Failed:", error);
        displayInitializationError("認証処理中にエラーが発生しました。");
    }
}

function displayInitializationError(message) {
    const container = document.getElementById("app-container");
    const oktaContainer = document.getElementById("okta-signin-widget-container");
    if(oktaContainer) oktaContainer.classList.add('hidden');

    if (container) {
        container.classList.remove('hidden');
        container.innerHTML = `<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative max-w-lg mx-auto mt-10" role="alert">
            <strong class="font-bold">初期化エラー</strong>
            <span class="block sm:inline">${escapeHtml(message)}</span>
        </div>`;
    }
}

function setupGlobalEventListeners() {
    setupModalEventListeners();
    setupModeSelectionEventListeners();
    setupTaskSettingsEventListeners();
    setupHostEventListeners();
    setupClientEventListeners();
    setupPersonalDetailEventListeners();
    setupReportEventListeners();
    setupProgressEventListeners();
    setupArchiveEventListeners();
    setupExcelExportEventListeners();

    const adminPasswordSubmitBtn = document.getElementById("admin-password-submit-btn");
    const adminPasswordInput = document.getElementById("admin-password-input");
    
    adminPasswordSubmitBtn?.addEventListener("click", handleAdminLogin);
    adminPasswordInput?.addEventListener('keypress', (event) => {
         if (event.key === 'Enter') handleAdminLogin();
     });
}

export function showView(viewId, data = {}) {
    console.log(`Showing view: ${viewId}`, data);
    const targetViewElement = document.getElementById(viewId);
    const appContainer = document.getElementById('app-container');

    if ([VIEWS.CLIENT, VIEWS.HOST, VIEWS.PROGRESS, VIEWS.REPORT, VIEWS.APPROVAL].includes(viewId)) {
        localStorage.setItem(LAST_VIEW_KEY, JSON.stringify({ name: viewId, params: data }));
    }
    
    if (!targetViewElement) return;

    const currentActiveViewElement = document.querySelector(".view.active-view");
    if (currentActiveViewElement && currentActiveViewElement.id !== viewId) {
        const currentViewId = currentActiveViewElement.id;
        const currentLifecycle = viewLifecycle[currentViewId];
        if (currentLifecycle?.cleanup) {
            try {
                currentLifecycle.cleanup();
            } catch (error) {
                 console.error(`Error during cleanup of view ${currentViewId}:`, error);
            }
        }
        currentActiveViewElement.classList.remove("active-view");
    }

    targetViewElement.classList.add("active-view");
    targetViewElement.classList.remove("hidden");

    const newLifecycle = viewLifecycle[viewId];
    if (newLifecycle?.init) {
         try {
             (async () => await newLifecycle.init(data))();
         } catch (error) {
              console.error(`Error during initialization of view ${viewId}:`, error);
         }
    }

    if (viewHistory[viewHistory.length - 1] !== viewId) {
        viewHistory.push(viewId);
    }
    window.scrollTo(0, 0);
}

export function handleGoBack() {
    viewHistory.pop(); 
    const previousViewName = viewHistory[viewHistory.length - 1];
    showView(previousViewName || VIEWS.MODE_SELECTION);
}

/**
 * 【改善】業務マスターを1回だけ取得する（onSnapshotを廃止）
 */
async function fetchTasks() {
    const tasksRef = doc(db, "settings", "tasks");
    try {
        const docSnap = await getDoc(tasksRef);
        if (docSnap.exists() && docSnap.data().list) {
            updateGlobalTaskObjects(docSnap.data().list);
        } else {
             const defaultTasks = [
                 { name: "資料作成", memo: "", goals: [] },
                 { name: "会議", memo: "", goals: [] },
                 { name: "メール対応", memo: "", goals: [] },
                 { name: "開発", memo: "", goals: [] },
                 { name: "休憩", memo: "", goals: [] },
             ];
             await setDoc(tasksRef, { list: defaultTasks });
             updateGlobalTaskObjects(defaultTasks);
        }
        await refreshUIBasedOnTaskUpdate();
    } catch (error) {
        console.error("Error fetching tasks:", error);
    }
}

export async function refreshUIBasedOnTaskUpdate() {
    const { renderTaskOptions, checkIfWarningIsNeeded } = await import('./views/client/clientUI.js');
    const { initializeProgressView } = await import('./views/progress/progress.js');
    const { initializeArchiveView } = await import('./views/archive.js');
    const { renderTaskEditor } = await import('./views/taskSettings.js');

    try {
        if (document.getElementById(VIEWS.CLIENT)?.classList.contains('active-view')) {
            renderTaskOptions();
            checkIfWarningIsNeeded();
        }
        if (document.getElementById(VIEWS.TASK_SETTINGS)?.classList.contains('active-view')) renderTaskEditor();
        if (document.getElementById(VIEWS.PROGRESS)?.classList.contains('active-view')) await initializeProgressView();
        if (document.getElementById(VIEWS.ARCHIVE)?.classList.contains('active-view')) await initializeArchiveView();
    } catch(error) { console.error(error); }
}

/**
 * 【改善】表示設定を1回だけ取得する（onSnapshotを廃止）
 */
export async function fetchDisplayPreferences() {
    if (!userId) {
         userDisplayPreferences = { hiddenTasks: [], notificationIntervalMinutes: 0 };
         refreshUIBasedOnPreferenceUpdate();
        return;
    }
    const prefRef = doc(db, `user_profiles/${userId}/preferences/display`);
    try {
        const docSnap = await getDoc(prefRef);
        const defaults = { hiddenTasks: [], notificationIntervalMinutes: 0 };
        if (docSnap.exists()) {
            const data = docSnap.data();
            userDisplayPreferences = {
                hiddenTasks: Array.isArray(data.hiddenTasks) ? data.hiddenTasks : defaults.hiddenTasks,
                notificationIntervalMinutes: typeof data.notificationIntervalMinutes === 'number' ? data.notificationIntervalMinutes : defaults.notificationIntervalMinutes,
            };
        } else {
            userDisplayPreferences = defaults;
            await setDoc(prefRef, userDisplayPreferences, { merge: true });
        }
        refreshUIBasedOnPreferenceUpdate();
    } catch (error) {
        console.error("Error fetching preferences:", error);
    }
}

async function refreshUIBasedOnPreferenceUpdate() {
    const { renderTaskOptions, renderTaskDisplaySettings } = await import('./views/client/clientUI.js');
    try {
        if (document.getElementById(VIEWS.CLIENT)?.classList.contains('active-view')) {
             renderTaskOptions();
             renderTaskDisplaySettings();
        }
    } catch (error) { console.error(error); }
}

export function setUserId(newUserId) {
    if (userId !== newUserId) {
        userId = newUserId;
        fetchDisplayPreferences(); // 監視から1回取得に変更
    }
}
export function setUserName(newName) {
     if (userName !== newName) userName = newName;
}
export function setAuthLevel(level) {
    if (authLevel !== level) authLevel = level;
}
export function updateGlobalTaskObjects(newTasks) {
    const processedTasks = newTasks.map(task => ({
        ...task,
        goals: (task.goals || []).map(goal => {
            const processedGoal = {...goal};
            if (goal.completedAt && goal.completedAt.toDate) {
                processedGoal.completedAt = goal.completedAt.toDate();
            }
            return processedGoal;
        })
    }));
    if (JSON.stringify(allTaskObjects) !== JSON.stringify(processedTasks)) {
        allTaskObjects = processedTasks;
    }
}

async function handleAdminLogin() {
    const input = document.getElementById("admin-password-input");
    const errorEl = document.getElementById("admin-password-error");
    if (!input || !errorEl) return;
    const password = input.value;
    errorEl.textContent = "";
    if (!password) {
        errorEl.textContent = "パスワードを入力してください。";
        return;
    }
    try {
        const passwordDoc = await getDoc(doc(db, "settings", "admin_password"));
        if (passwordDoc.exists() && passwordDoc.data().password === password) {
            setAuthLevel('admin'); 
            input.value = "";
            closeModal(adminPasswordView);
            showView(adminLoginDestination || VIEWS.HOST);
            adminLoginDestination = null;
        } else {
            errorEl.textContent = "パスワードが違います。";
            input.select();
        }
    } catch (error) {
        errorEl.textContent = "確認中にエラーが発生しました。";
    }
}

export async function startAppAfterLogin() {
    console.log("Authentication successful. Starting data sync...");
    initMessaging(userId);
    listenForMessages();

    // 【改善】常時監視を止め、初期化時に1回だけ取得する
    await fetchTasks();
    await fetchDisplayPreferences();
}

function setupVisibilityReload() {
    if (document.wasDiscarded) {
        window.location.reload();
        return;
    }
    let lastActiveTime = Date.now();
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            const idleDuration = Date.now() - lastActiveTime;
            if (idleDuration > 30 * 60 * 1000) window.location.reload();
        } else {
            lastActiveTime = Date.now();
        }
    });
}

// Workerからメッセージが来た時の処理
worker.onmessage = function(e) {
  const data = e.data;

  if (data.type === 'tick') {
    // 【画面更新】ここでDOMを書き換える
    document.getElementById('timer-display').innerText = data.time + '秒';
  } 
  
  if (data.type === 'notify') {
    // 【通知】ブラウザ通知を出す
    new Notification('タイマー', { body: data.message });
  }
};

// 開始ボタンでWorkerに指令を送る
document.getElementById('start-btn').onclick = function() {
  worker.postMessage('start');
};

export function getAllTaskObjects() {
    return allTaskObjects;
}
    
export { db, escapeHtml, getJSTDateString };
document.addEventListener("DOMContentLoaded", initialize);


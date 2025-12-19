// js/main.js

import { db, isFirebaseConfigValid } from './firebase.js';
import { checkOktaAuthentication, handleOktaLogout } from './okta.js';
import { doc, onSnapshot, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { initMessaging, listenForMessages } from './fcm.js';
import { initializeModeSelectionView, setupModeSelectionEventListeners } from './views/modeSelection.js';
import { initializeTaskSettingsView, setupTaskSettingsEventListeners } from './views/taskSettings.js';
import { initializeHostView, cleanupHostView, setupHostEventListeners } from './views/host/host.js';
import { initializeClientView, setupClientEventListeners } from './views/client/client.js';
import { initializePersonalDetailView, cleanupPersonalDetailView, setupPersonalDetailEventListeners } from './views/personalDetail/personalDetail.js';
import { initializeReportView, cleanupReportView, setupReportEventListeners } from './views/report.js';
import { initializeProgressView, setupProgressEventListeners } from './views/progress/progress.js';
import { initializeArchiveView, setupArchiveEventListeners } from './views/archive.js';
const LAST_VIEW_KEY = "gyomu_timer_last_view";

import { initializeApprovalView, cleanupApprovalView } from './views/host/approval.js';

import { setupModalEventListeners, adminPasswordView, closeModal } from './components/modal.js';
import { setupExcelExportEventListeners } from './excelExport.js';
import { getJSTDateString, escapeHtml } from './utils.js';

export let userId = null;
export let userName = null;
export let authLevel = 'none';
export let allTaskObjects = []; 
export let userDisplayPreferences = { hiddenTasks: [] }; 
export let viewHistory = []; 
export let adminLoginDestination = null; 
export let preferencesUnsubscribe = null; 

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

const viewLifecycle = {
    [VIEWS.MODE_SELECTION]: { init: initializeModeSelectionView },
    [VIEWS.TASK_SETTINGS]: { init: initializeTaskSettingsView },
    [VIEWS.HOST]: { init: initializeHostView, cleanup: cleanupHostView },
    [VIEWS.CLIENT]: { init: initializeClientView },
    [VIEWS.PERSONAL_DETAIL]: { init: initializePersonalDetailView, cleanup: cleanupPersonalDetailView },
    [VIEWS.REPORT]: { init: initializeReportView, cleanup: cleanupReportView },
    [VIEWS.PROGRESS]: { init: initializeProgressView },
    [VIEWS.ARCHIVE]: { init: initializeArchiveView },
    [VIEWS.APPROVAL]: { init: initializeApprovalView, cleanup: cleanupApprovalView },
};

// ★修正: hidden クラスを削除しました
function injectApprovalViewHTML() {
    if (document.getElementById(VIEWS.APPROVAL)) return;
    const div = document.createElement("div");
    div.id = VIEWS.APPROVAL;
    // hidden を削除し、初期状態はCSSの .view で制御させる
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
    
    // イベントリスナーは要素作成直後に登録するのが確実
    document.getElementById("back-from-approval").addEventListener("click", () => {
        showView(VIEWS.HOST);
    });
}

async function initialize() {
    console.log("Initializing application...");
    
    // ★追加：タブ復帰リロードの監視開始
    setupVisibilityReload();

    const appContainer = document.getElementById('app-container');

    if (!isFirebaseConfigValid()) {
        displayInitializationError("Firebaseの設定が無効です。firebase.jsを確認してください。");
        return;
    }
    
    injectApprovalViewHTML();
    setupGlobalEventListeners();

    try {
        // Okta認証チェック。認証成功時に startAppAfterLogin を呼ぶように設定
await checkOktaAuthentication(async () => {
            // ① まずFCM等の初期設定を行う
            await startAppAfterLogin();

            // ★追加: その日初めてのログイン判定
            const today = getJSTDateString(new Date()); // utils.jsからインポート済みの関数を使用
            const lastLoginDate = localStorage.getItem("last_login_date");

            if (lastLoginDate !== today) {
                // その日初めてのログイン、または日付が変わっている場合
                console.log("本日最初のログインです。モード選択画面を表示します。");
                
                // 日付を更新
                localStorage.setItem("last_login_date", today);
                
                // 強制的にモード選択画面へ
                showView(VIEWS.MODE_SELECTION);
            } else {
                // 同日内の再アクセス、またはリロードの場合
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
    console.error("Initialization Error:", message);
}

function setupGlobalEventListeners() {
    console.log("Setting up global event listeners...");
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
         if (event.key === 'Enter') {
             handleAdminLogin();
         }
     });

    console.log("Global event listeners set up complete.");
}

export function showView(viewId, data = {}) {
    console.log(`Showing view: ${viewId}`, data);
    const targetViewElement = document.getElementById(viewId);
    const appContainer = document.getElementById('app-container');

    // ★追加：現在のビューを保存（ログイン後の主要な画面のみ）
if ([VIEWS.CLIENT, VIEWS.HOST, VIEWS.PROGRESS, VIEWS.REPORT, VIEWS.APPROVAL].includes(viewId)) {
        localStorage.setItem(LAST_VIEW_KEY, JSON.stringify({ name: viewId, params: data }));
    }
    
    if (!targetViewElement) {
        if (viewId === VIEWS.OKTA_WIDGET) {
            const oktaContainer = document.getElementById(VIEWS.OKTA_WIDGET);
            if(oktaContainer) {
                appContainer?.classList.add('hidden');
                document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
                oktaContainer.classList.remove('hidden');
            }
            return;
        } else {
            console.error(`View element not found: ${viewId}`);
            return;
        }
    }

     const oktaContainer = document.getElementById(VIEWS.OKTA_WIDGET);
     if(oktaContainer) oktaContainer.classList.add('hidden');
     if(appContainer) appContainer.classList.remove('hidden');

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
    // ★修正: 念のため hidden クラスがあれば強制的に削除する
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

    if (previousViewName) {
        showView(previousViewName);
    } else {
        showView(VIEWS.MODE_SELECTION);
        viewHistory = [VIEWS.MODE_SELECTION];
    }
}

async function listenForTasks() {
    const tasksRef = doc(db, "settings", "tasks");
    let isFirstLoad = true;

    onSnapshot(tasksRef, async (docSnap) => {
        if (docSnap.exists() && docSnap.data().list) {
            const newTasks = docSnap.data().list;
            updateGlobalTaskObjects(newTasks);

            if (!isFirstLoad) {
                 await refreshUIBasedOnTaskUpdate();
            }
        } else if (!docSnap.metadata.hasPendingWrites) {
             const defaultTasks = [
                 { name: "資料作成", memo: "", goals: [] },
                 { name: "会議", memo: "", goals: [] },
                 { name: "メール対応", memo: "", goals: [] },
                 { name: "開発", memo: "", goals: [] },
                 { name: "休憩", memo: "", goals: [] },
             ];
             try {
                 await setDoc(tasksRef, { list: defaultTasks });
                 updateGlobalTaskObjects(defaultTasks);
                 await refreshUIBasedOnTaskUpdate();
             } catch (error) {
                 console.error("Error creating default tasks:", error);
             }
        }
        isFirstLoad = false;
    });
}

async function refreshUIBasedOnTaskUpdate() {
    const { renderTaskOptions, checkIfWarningIsNeeded } = await import('./views/client/clientUI.js');
    const { initializeProgressView } = await import('./views/progress/progress.js');
    const { initializeArchiveView } = await import('./views/archive.js');
    const { renderTaskEditor } = await import('./views/taskSettings.js');

    try {
        if (document.getElementById(VIEWS.CLIENT)?.classList.contains('active-view')) {
            renderTaskOptions();
            checkIfWarningIsNeeded();
        }
        if (document.getElementById(VIEWS.TASK_SETTINGS)?.classList.contains('active-view')) {
             renderTaskEditor();
        }
        if (document.getElementById(VIEWS.PROGRESS)?.classList.contains('active-view')) {
            await initializeProgressView();
        }
        if (document.getElementById(VIEWS.ARCHIVE)?.classList.contains('active-view')) {
            await initializeArchiveView();
        }
    } catch(error) { console.error(error); }
}

export function listenForDisplayPreferences() {
    if (preferencesUnsubscribe) preferencesUnsubscribe();
    if (!userId) {
         userDisplayPreferences = { hiddenTasks: [], notificationIntervalMinutes: 0 };
         preferencesUnsubscribe = null;
         refreshUIBasedOnPreferenceUpdate();
        return;
    }
    const prefRef = doc(db, `user_profiles/${userId}/preferences/display`);
    preferencesUnsubscribe = onSnapshot(prefRef, (docSnap) => {
        const defaults = { hiddenTasks: [], notificationIntervalMinutes: 0 };
        if (docSnap.exists()) {
            const data = docSnap.data();
            userDisplayPreferences = {
                hiddenTasks: Array.isArray(data.hiddenTasks) ? data.hiddenTasks : defaults.hiddenTasks,
                notificationIntervalMinutes: typeof data.notificationIntervalMinutes === 'number' ? data.notificationIntervalMinutes : defaults.notificationIntervalMinutes,
            };
        } else {
            userDisplayPreferences = defaults;
             if(!docSnap.exists() && !docSnap.metadata.hasPendingWrites) {
                 setDoc(prefRef, userDisplayPreferences, { merge: true }).catch(console.error);
             }
        }
        refreshUIBasedOnPreferenceUpdate();
    });
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
        listenForDisplayPreferences();
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
export function setAdminLoginDestination(viewId) {
    adminLoginDestination = viewId;
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
            if (adminLoginDestination) {
                showView(adminLoginDestination);
                adminLoginDestination = null;
            } else {
                showView(VIEWS.HOST);
            }
        } else {
            errorEl.textContent = "パスワードが違います。";
            input.select();
        }
    } catch (error) {
        errorEl.textContent = "パスワードの確認中にエラーが発生しました。";
    }
}

export async function startAppAfterLogin() {
    console.log("Authentication successful. Starting data sync...");
    console.log("FCM初期化を開始します...");
    
    // ★追加: 通知の初期化
    initMessaging(userId);
    listenForMessages();

    await listenForTasks();
}

function setupVisibilityReload() {
    // 1. ブラウザによって「破棄（休止）」されていたかどうかのフラグを確認
    // document.wasDiscarded は休止状態から戻った時のみ true になります
    if (document.wasDiscarded) {
        console.log("このタブは休止状態から復帰しました。リロードします。");
        window.location.reload();
        return;
    }

    // 2. フォールバック（wasDiscardedが未対応のブラウザや、長時間放置対策）
    // 最後に操作してから一定時間（例：30分）以上経過してタブに戻った場合のみリロードする
    let lastActiveTime = Date.now();

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            const idleDuration = Date.now() - lastActiveTime;
            const THIRTY_MINUTES = 50 * 60 * 1000;

            if (idleDuration > THIRTY_MINUTES) {
                console.log("長期間非アクティブだったため、最新状態にリロードします...");
                window.location.reload();
            }
        } else {
            // タブを離れた時刻を記録
            lastActiveTime = Date.now();
        }
    });
}
    
export { db, escapeHtml, getJSTDateString };
document.addEventListener("DOMContentLoaded", initialize);

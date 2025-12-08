// js/main.js - アプリケーションのエントリーポイント兼全体管理

// --- Firebaseと認証関連のインポート ---
import { db, isFirebaseConfigValid } from './firebase.js';
import { checkOktaAuthentication, handleOktaLogout } from './okta.js';

// --- Firestore関連のインポート ---
import { doc, onSnapshot, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- 各ビューモジュールのインポート ---
import { initializeModeSelectionView, setupModeSelectionEventListeners } from './views/modeSelection.js';
import { initializeTaskSettingsView, setupTaskSettingsEventListeners } from './views/taskSettings.js';
import { initializeHostView, cleanupHostView, setupHostEventListeners } from './views/host/host.js';
import { initializeClientView, setupClientEventListeners } from './views/client/client.js';
import { initializePersonalDetailView, cleanupPersonalDetailView, setupPersonalDetailEventListeners } from './views/personalDetail/personalDetail.js';
import { initializeReportView, cleanupReportView, setupReportEventListeners } from './views/report.js';
import { initializeProgressView, setupProgressEventListeners } from './views/progress/progress.js';
import { initializeArchiveView, setupArchiveEventListeners } from './views/archive.js';

// --- コンポーネント/ユーティリティモジュールのインポート ---
import { setupModalEventListeners, adminPasswordView, closeModal } from './components/modal.js';
import { setupExcelExportEventListeners } from './excelExport.js';
import { getJSTDateString, escapeHtml } from './utils.js';

// --- グローバル状態変数 ---
export let userId = null; // 現在のユーザーの Firestore Profile ID
export let userName = null; // 現在のユーザー名
export let authLevel = 'none'; // 認証レベル ('none', 'task_editor', 'admin')
export let allTaskObjects = []; // 全タスクとその目標（Firestoreから取得）
// ★ allUserLogs (全ログデータ) は削除しました。各ビューが必要なデータを個別に取得します。
export let userDisplayPreferences = { hiddenTasks: [] }; // ユーザーの表示設定
export let viewHistory = []; // 表示したビューの履歴（戻る機能用）
export let adminLoginDestination = null; // 管理者ログイン後に遷移するビュー
export let preferencesUnsubscribe = null; // 表示設定リスナーの解除関数

// --- 定数 ---
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
};

// ビュー名と初期化/クリーンアップ関数のマップ
const viewLifecycle = {
    [VIEWS.MODE_SELECTION]: { init: initializeModeSelectionView },
    [VIEWS.TASK_SETTINGS]: { init: initializeTaskSettingsView },
    [VIEWS.HOST]: { init: initializeHostView, cleanup: cleanupHostView },
    [VIEWS.CLIENT]: { init: initializeClientView },
    [VIEWS.PERSONAL_DETAIL]: { init: initializePersonalDetailView, cleanup: cleanupPersonalDetailView },
    [VIEWS.REPORT]: { init: initializeReportView, cleanup: cleanupReportView },
    [VIEWS.PROGRESS]: { init: initializeProgressView },
    [VIEWS.ARCHIVE]: { init: initializeArchiveView },
};


// --- アプリケーション初期化 ---
async function initialize() {
    console.log("Initializing application...");
    const appContainer = document.getElementById('app-container');

    if (!isFirebaseConfigValid()) {
        displayInitializationError("Firebaseの設定が無効です。firebase.jsを確認してください。");
        return;
    }

    // --- グローバルリスナーとイベントリスナーの設定 ---
    setupGlobalEventListeners();

    // --- Okta認証チェック ---
    try {
        // ★修正: ここで startAppAfterLogin をコールバックとして渡す
        // これにより、ログイン成功後にこの関数が okta.js 側で実行されます
        await checkOktaAuthentication(startAppAfterLogin);
    } catch(error) {
        console.error("Okta Authentication Check Failed:", error);
        displayInitializationError("認証処理中にエラーが発生しました。");
    }

    // ★修正: ここでの listenForTasks() 呼び出しは削除 (startAppAfterLoginに移動)
    
    console.log("Initialization sequence potentially complete (waiting for Okta status).");
}

// ★追加: 認証成功後に呼び出すデータ同期開始関数
// この関数を okta.js から呼び出してもらいます（コールバックとして渡されるため）
export async function startAppAfterLogin() {
    console.log("Authentication successful. Starting data sync...");
    await listenForTasks(); // タスク情報を取得・監視開始
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


// --- グローバルイベントリスナー設定 ---
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


// --- ビュー管理 ---
export function showView(viewId, data = {}) {
    console.log(`Showing view: ${viewId}`, data);
    const targetViewElement = document.getElementById(viewId);
    const appContainer = document.getElementById('app-container');

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

    // --- クリーンアップ ---
    const currentActiveViewElement = document.querySelector(".view.active-view");
    if (currentActiveViewElement && currentActiveViewElement.id !== viewId) {
        const currentViewId = currentActiveViewElement.id;
        const currentLifecycle = viewLifecycle[currentViewId];
        if (currentLifecycle?.cleanup) {
            console.log(`Cleaning up view: ${currentViewId}`);
            try {
                currentLifecycle.cleanup();
            } catch (error) {
                 console.error(`Error during cleanup of view ${currentViewId}:`, error);
            }
        }
        currentActiveViewElement.classList.remove("active-view");
    } else if (currentActiveViewElement && currentActiveViewElement.id === viewId) {
         const currentLifecycle = viewLifecycle[viewId];
         if (currentLifecycle?.init) {
            console.log(`Re-initializing view: ${viewId}`);
             try {
                 (async () => await currentLifecycle.init(data))();
             } catch (error) {
                  console.error(`Error during re-initialization of view ${viewId}:`, error);
             }
         }
         return;
    }


    // --- ビューの表示と初期化 ---
    targetViewElement.classList.add("active-view");
    const newLifecycle = viewLifecycle[viewId];
    if (newLifecycle?.init) {
        console.log(`Initializing view: ${viewId}`);
         try {
             (async () => await newLifecycle.init(data))();
         } catch (error) {
              console.error(`Error during initialization of view ${viewId}:`, error);
              targetViewElement.innerHTML = `<p class="text-red-500 p-4">ビューの読み込み中にエラーが発生しました。</p>`;
         }
    }

    // --- 履歴管理 ---
    const currentViewFromHistory = viewHistory[viewHistory.length - 1];
    if (currentViewFromHistory !== viewId) {
        viewHistory.push(viewId);
    }

    window.scrollTo(0, 0);
}

export function handleGoBack() {
    console.log("Handling Go Back. Current History:", viewHistory);
    viewHistory.pop(); // 現在のビューを履歴から削除
    const previousViewName = viewHistory[viewHistory.length - 1];

    if (previousViewName) {
        console.log("Navigating back to:", previousViewName);
        showView(previousViewName);
    } else {
        console.warn("View history empty or invalid, navigating to default view (Mode Selection).");
        showView(VIEWS.MODE_SELECTION);
        viewHistory = [VIEWS.MODE_SELECTION];
    }
}


// --- グローバルFirestoreリスナー ---
async function listenForTasks() {
    console.log("Starting listener for tasks...");
    const tasksRef = doc(db, "settings", "tasks");
    let isFirstLoad = true;

    const unsubscribe = onSnapshot(tasksRef, async (docSnap) => {
        if (docSnap.exists() && docSnap.data().list) {
            console.log("Tasks updated from Firestore snapshot.");
            const newTasks = docSnap.data().list;
            updateGlobalTaskObjects(newTasks);

            if (!isFirstLoad) {
                 await refreshUIBasedOnTaskUpdate();
            }

        } else if (!docSnap.metadata.hasPendingWrites) {
             console.warn("Tasks document unexpectedly deleted or empty. Creating default tasks...");
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
                 updateGlobalTaskObjects([]);
             }

        }
        isFirstLoad = false;
    }, (error) => {
         console.error("Error listening for task updates:", error);
         updateGlobalTaskObjects([]);
         isFirstLoad = false;
    });
}

async function refreshUIBasedOnTaskUpdate() {
    console.log("Refreshing UI based on task update...");
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
    } catch(error) {
         console.error("Error refreshing UI after task update:", error);
    }
}

export function listenForDisplayPreferences() {
    if (preferencesUnsubscribe) preferencesUnsubscribe();
    if (!userId) {
         userDisplayPreferences = { hiddenTasks: [], notificationIntervalMinutes: 0 };
         preferencesUnsubscribe = null;
         console.log("User logged out or not set, reset display preferences to default.");
         refreshUIBasedOnPreferenceUpdate();
        return;
    }

    console.log(`Starting listener for display preferences for user: ${userId}`);
    const prefRef = doc(db, `user_profiles/${userId}/preferences/display`);

    preferencesUnsubscribe = onSnapshot(prefRef, (docSnap) => {
        const defaults = { hiddenTasks: [], notificationIntervalMinutes: 0 };
        if (docSnap.exists()) {
            const data = docSnap.data();
            userDisplayPreferences = {
                hiddenTasks: Array.isArray(data.hiddenTasks) ? data.hiddenTasks : defaults.hiddenTasks,
                notificationIntervalMinutes: typeof data.notificationIntervalMinutes === 'number' ? data.notificationIntervalMinutes : defaults.notificationIntervalMinutes,
            };
            console.log("Display preferences updated:", userDisplayPreferences);
        } else {
            console.log("No display preferences found, using default.");
            userDisplayPreferences = defaults;
             if(!docSnap.exists() && !docSnap.metadata.hasPendingWrites) {
                 setDoc(prefRef, userDisplayPreferences, { merge: true }).catch(err => console.error("Error creating default preferences:", err));
             }
        }
        refreshUIBasedOnPreferenceUpdate();

    }, (error) => {
         console.error(`Error listening for display preferences for user ${userId}:`, error);
         userDisplayPreferences = { hiddenTasks: [], notificationIntervalMinutes: 0 };
         refreshUIBasedOnPreferenceUpdate();
    });
}

async function refreshUIBasedOnPreferenceUpdate() {
    console.log("Refreshing UI based on preference update...");
    const { renderTaskOptions, renderTaskDisplaySettings } = await import('./views/client/clientUI.js');
    try {
        if (document.getElementById(VIEWS.CLIENT)?.classList.contains('active-view')) {
             renderTaskOptions();
             renderTaskDisplaySettings();
        }
    } catch (error) {
         console.error("Error refreshing UI after preference update:", error);
    }
}

// --- グローバル状態更新関数 ---
export function setUserId(newUserId) {
    if (userId !== newUserId) {
        userId = newUserId;
        console.log("Global userId set:", userId);
        listenForDisplayPreferences();
    }
}
export function setUserName(newName) {
     if (userName !== newName) {
        userName = newName;
        console.log("Global userName set:", userName);
     }
}
export function setAuthLevel(level) {
    if (authLevel !== level) {
        authLevel = level;
        console.log("Global authLevel set:", authLevel);
    }
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
        console.log("Global task objects updated:", allTaskObjects.length, "tasks");
    } else {
        console.log("Global task objects received from Firestore, but no change detected.");
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
            console.log("Admin password correct.");
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
            console.warn("Admin password incorrect.");
            errorEl.textContent = "パスワードが違います。";
            input.select();
        }
    } catch (error) {
        console.error("Error checking admin password:", error);
        errorEl.textContent = "パスワードの確認中にエラーが発生しました。";
    }
}

export { db, escapeHtml, getJSTDateString };

document.addEventListener("DOMContentLoaded", initialize);

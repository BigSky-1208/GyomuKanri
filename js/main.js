// js/main.js - アプリケーションのエントリーポイント兼全体管理

// --- Firebaseと認証関連のインポート ---
// dbインスタンス、設定検証関数をfirebase.jsからインポート
import { db, isFirebaseConfigValid } from './firebase.js';
// Okta認証関連の関数をokta.jsからインポート
import { checkOktaAuthentication, handleOktaLogout } from './okta.js';

// --- Firestore関連のインポート ---
import { doc, onSnapshot, getDoc, collection, getDocs, query, where, Timestamp, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- 各ビューモジュールのインポート ---
// 各ビューの初期化関数とイベントリスナー設定関数をインポート
import { initializeProfileSetupView, setupProfileSetupEventListeners } from './views/profileSetup.js'; // ProfileSetupはOkta Widget表示用なので中身はほぼ不要になるかも
import { initializeModeSelectionView, setupModeSelectionEventListeners } from './views/modeSelection.js';
import { initializeTaskSettingsView, setupTaskSettingsEventListeners } from './views/taskSettings.js';
import { initializeHostView, cleanupHostView, setupHostEventListeners } from './views/host/host.js'; // Hostディレクトリ内のhost.jsをインポート
import { initializeClientView, setupClientEventListeners, resetClientStateUI } from './views/client/client.js'; // Clientディレクトリ内のclient.jsをインポート
import { initializePersonalDetailView, cleanupPersonalDetailView, setupPersonalDetailEventListeners } from './views/personalDetail.js';
import { initializeReportView, cleanupReportView, setupReportEventListeners } from './views/report.js';
import { initializeProgressView, setupProgressEventListeners } from './views/progress.js';
import { initializeArchiveView, setupArchiveEventListeners } from './views/archive.js';
import { updateStatusesCache } from './views/host/userManagement.js'; // host.jsがstatusをuserManagementに渡すためインポート

// --- コンポーネント/ユーティリティモジュールのインポート ---
import { setupModalEventListeners, adminPasswordView, confirmationModal, closeModal, showHelpModal } from './components/modal.js';
import { setupExcelExportEventListeners } from './excelExport.js';
import { checkForCheckoutCorrection, getJSTDateString, escapeHtml } from './utils.js'; // 退勤忘れチェック関数など

// --- グローバル状態変数 ---
export let userId = null; // 現在のユーザーの Firestore Profile ID
export let userName = null; // 現在のユーザー名
export let authLevel = 'none'; // 認証レベル ('none', 'task_editor', 'admin')
export let allTaskObjects = []; // 全タスクとその目標（Firestoreから取得）
export let allUserLogs = []; // 全ユーザーのログ（Firestoreから取得、必要に応じて更新）
export let userDisplayPreferences = { hiddenTasks: [] }; // ユーザーの表示設定
export let viewHistory = []; // 表示したビューの履歴（戻る機能用）
export let adminLoginDestination = null; // 管理者ログイン後に遷移するビュー (Okta移行により不要になる可能性)
export let preferencesUnsubscribe = null; // 表示設定リスナーの解除関数
// TODO: isProgressViewReadOnly の管理方法を改善する (例: showViewのdataで渡す)
export let isProgressViewReadOnly = false; // Progress Viewが読み取り専用かどうかのフラグ

// --- 定数 ---
// ビューIDと対応する初期化/クリーンアップ関数をマッピング
export const VIEWS = {
    // PROFILE_SETUP はOkta Widgetコンテナに置き換わる想定
    OKTA_WIDGET: "okta-signin-widget-container", // Okta Widget用コンテナID
    MODE_SELECTION: "mode-selection-view",
    TASK_SETTINGS: "task-settings-view",
    HOST: "host-view",
    CLIENT: "client-view",
    PERSONAL_DETAIL: "personal-detail-view",
    REPORT: "report-view",
    PROGRESS: "progress-view",
    ARCHIVE: "archive-view",
};

// ビュー名と初期化/クリーンアップ関数のマップ
const viewLifecycle = {
    // [VIEWS.PROFILE_SETUP]: { init: initializeProfileSetupView }, // Okta Widgetが表示されるので不要
    [VIEWS.MODE_SELECTION]: { init: initializeModeSelectionView },
    [VIEWS.TASK_SETTINGS]: { init: initializeTaskSettingsView },
    [VIEWS.HOST]: { init: initializeHostView, cleanup: cleanupHostView },
    [VIEWS.CLIENT]: { init: initializeClientView }, // cleanupは handleGoBack で resetClientStateUI を呼ぶ等で対応
    [VIEWS.PERSONAL_DETAIL]: { init: initializePersonalDetailView, cleanup: cleanupPersonalDetailView },
    [VIEWS.REPORT]: { init: initializeReportView, cleanup: cleanupReportView },
    [VIEWS.PROGRESS]: { init: initializeProgressView },
    [VIEWS.ARCHIVE]: { init: initializeArchiveView },
};


// --- アプリケーション初期化 ---

/**
 * アプリケーション全体の初期化処理
 */
async function initialize() {
    console.log("Initializing application...");
    const appContainer = document.getElementById('app-container');

    // Firebase設定の有効性を確認
    if (!isFirebaseConfigValid()) {
        displayInitializationError("Firebaseの設定が無効です。firebase.jsを確認してください。");
        return;
    }

    // --- グローバルリスナーとイベントリスナーの設定 ---
    // 先にモーダルなどの共通リスナーを設定（DOM要素が存在するため）
    setupGlobalEventListeners();

    // --- Okta認証チェックを開始 ---
    // これが認証状態を確認し、未認証ならWidget表示、認証済みならhandleOktaLoginSuccessを呼び出す
    try {
        await checkOktaAuthentication(); // okta.js の関数を呼び出し
        // checkOktaAuthentication内で認証成功時にhandleOktaLoginSuccessが呼ばれ、
        // そこでuserId, userName, authLevelが設定され、各種リスナーが開始され、
        // 最終的にshowView(VIEWS.MODE_SELECTION)が呼ばれる想定
    } catch(error) {
        console.error("Okta Authentication Check Failed:", error);
        displayInitializationError("認証処理中にエラーが発生しました。");
        // 必要に応じてOkta Widgetを再表示する処理をここに追加
        // renderSignInWidget(); // okta.jsからインポートする場合
    }

    // --- グローバルデータリスナー開始 ---
    // これらはOkta認証成功後 (userId設定後) に開始するのが望ましいが、
    // 先に開始しても問題ない場合もある（権限チェックはFirestoreルールで行うため）
    // 認証前にタスクが見えても問題なければここでOK
    await listenForTasks(); // タスク情報を取得・監視開始
    // listenForDisplayPreferences(); // これはuserId設定後にokta.jsから呼ぶ方が良い
    await fetchAllUserLogs(); // 初回ログ取得

    // 定期的なログフェッチを設定 (例: 5分ごと)
    setInterval(fetchAllUserLogs, 5 * 60 * 1000);

    console.log("Initialization sequence potentially complete (waiting for Okta status).");
}


/**
 * Firebase初期化失敗などのエラーメッセージを表示
 * @param {string} message - 表示するエラーメッセージ
 */
function displayInitializationError(message) {
    const container = document.getElementById("app-container");
    // Okta Widgetコンテナも非表示にする
    const oktaContainer = document.getElementById("okta-signin-widget-container");
    if(oktaContainer) oktaContainer.classList.add('hidden');

    if (container) {
        container.classList.remove('hidden'); // エラー表示のために表示する
        container.innerHTML = `<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative max-w-lg mx-auto mt-10" role="alert">
            <strong class="font-bold">初期化エラー</strong>
            <span class="block sm:inline">${escapeHtml(message)}</span>
        </div>`;
    }
    console.error("Initialization Error:", message);
}


// --- グローバルイベントリスナー設定 ---
/**
 * アプリ全体で共通のイベントリスナーを設定
 */
function setupGlobalEventListeners() {
    console.log("Setting up global event listeners...");
    // --- モーダル関連リスナー ---
    setupModalEventListeners(); // modal.js内のリスナーを設定

    // --- 各ビュー固有リスナー ---
    // (各ビューモジュールからインポートして呼び出し)
    // setupProfileSetupEventListeners(); // Okta Widgetに置き換わるので不要
    setupModeSelectionEventListeners();
    setupTaskSettingsEventListeners();
    setupHostEventListeners();
    setupClientEventListeners();
    setupPersonalDetailEventListeners();
    setupReportEventListeners();
    setupProgressEventListeners();
    setupArchiveEventListeners();

    // --- その他共通リスナー ---
    setupExcelExportEventListeners(); // excelExport.js内のリスナーを設定

    // --- 管理者パスワードモーダル関連は削除 ---
    // const adminPasswordSubmitBtn = document.getElementById("admin-password-submit-btn");
    // const adminPasswordCancelBtn = document.getElementById("admin-password-cancel-btn");
    // const adminPasswordInput = document.getElementById("admin-password-input");
    // adminPasswordSubmitBtn?.removeEventListener("click", handleAdminLogin); // リスナー解除
    // adminPasswordCancelBtn?.removeEventListener("click", closeModal);
    // adminPasswordInput?.removeEventListener('keypress', handleAdminPasswordEnter);

    console.log("Global event listeners set up complete.");
}


// --- ビュー管理 ---

/**
 * 指定されたビューを表示し、他のビューを非表示にする。
 * 必要に応じて初期化・クリーンアップ関数を呼び出す。
 * @param {string} viewId - 表示するビューのID (VIEWS定数を使用)
 * @param {object} [data={}] - ビューの初期化時に渡すデータ (例: { userName: 'Taro' })
 */
export function showView(viewId, data = {}) {
    console.log(`Showing view: ${viewId}`, data);
    const targetViewElement = document.getElementById(viewId);
    const appContainer = document.getElementById('app-container');

    if (!targetViewElement) {
        // Okta Widget コンテナを表示する場合
        if (viewId === VIEWS.OKTA_WIDGET) {
            const oktaContainer = document.getElementById(VIEWS.OKTA_WIDGET);
            if(oktaContainer) {
                appContainer?.classList.add('hidden'); // Hide main app content
                // Hide all '.view' elements explicitly
                document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
                oktaContainer.classList.remove('hidden'); // Show Okta widget container
                 console.log(`Showing Okta Widget container: ${viewId}`);
                // Okta Widgetの描画は okta.js の renderSignInWidget で行う
            } else {
                 console.error(`Okta widget container element not found: ${viewId}`);
            }
            return;
        } else {
            console.error(`View element not found: ${viewId}`);
            return; // 通常のビューが見つからない場合は終了
        }
    }

     // 通常のビューを表示する場合、Okta Widgetコンテナを隠し、Appコンテナを表示
     const oktaContainer = document.getElementById(VIEWS.OKTA_WIDGET);
     if(oktaContainer) oktaContainer.classList.add('hidden');
     if(appContainer) appContainer.classList.remove('hidden');

    // --- クリーンアップ ---
    // 現在アクティブなビューを探し、クリーンアップ関数があれば実行
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
         // 同じビューを表示しようとした場合、初期化だけ実行する（リフレッシュ目的）
         const currentLifecycle = viewLifecycle[viewId];
         if (currentLifecycle?.init) {
            console.log(`Re-initializing view: ${viewId}`);
             try {
                 // init 関数が Promise を返す可能性を考慮して await を使う
                 await currentLifecycle.init(data); // データも渡す
             } catch (error) {
                  console.error(`Error during re-initialization of view ${viewId}:`, error);
             }
         }
         return; // ビュー切り替えは不要
    }


    // --- ビューの表示と初期化 ---
    targetViewElement.classList.add("active-view");
    const newLifecycle = viewLifecycle[viewId];
    if (newLifecycle?.init) {
        console.log(`Initializing view: ${viewId}`);
         try {
             // init 関数が Promise を返す可能性を考慮
             await newLifecycle.init(data); // 初期化関数にデータを渡す
         } catch (error) {
              console.error(`Error during initialization of view ${viewId}:`, error);
              // エラー発生時のフォールバック処理 (例: エラーメッセージ表示)
              targetViewElement.innerHTML = `<p class="text-red-500 p-4">ビューの読み込み中にエラーが発生しました。</p>`;
         }
    }

    // --- 履歴管理 ---
    const currentViewFromHistory = viewHistory[viewHistory.length - 1];
    if (currentViewFromHistory !== viewId) { // 同じビューを連続で追加しない
        viewHistory.push(viewId);
    }
    // console.log("View History:", viewHistory); // デバッグ用

    window.scrollTo(0, 0); // 画面遷移時にトップにスクロール
}

/**
 * 一つ前のビューに戻る
 */
export function handleGoBack() {
    console.log("Handling Go Back. Current History:", viewHistory);
    viewHistory.pop(); // 現在のビューを履歴から削除
    const previousViewName = viewHistory[viewHistory.length - 1]; // 履歴の最後（＝戻り先）を取得（popしない）

    if (previousViewName) {
        console.log("Navigating back to:", previousViewName);
        // showView内で再度履歴に追加されるので、ここではpopしない
        showView(previousViewName);
    } else {
        // 履歴がない場合はデフォルトのビュー（モード選択など）に戻る
        console.warn("View history empty or invalid, navigating to default view (Mode Selection).");
        showView(VIEWS.MODE_SELECTION);
        // 履歴をクリアしておく
        viewHistory = [VIEWS.MODE_SELECTION]; // モード選択を履歴の起点とする
    }
}


// --- グローバルFirestoreリスナー ---

/**
 * Firestoreからタスクリストを取得し、変更を監視する
 */
async function listenForTasks() {
    console.log("Starting listener for tasks...");
    const tasksRef = doc(db, "settings", "tasks");
    let isFirstLoad = true; // 初回ロードかどうかのフラグ

    const unsubscribe = onSnapshot(tasksRef, async (docSnap) => { // リスナー関数をasyncに
        if (docSnap.exists() && docSnap.data().list) {
            console.log("Tasks updated from Firestore snapshot.");
            const newTasks = docSnap.data().list;
            updateGlobalTaskObjects(newTasks); // グローバル状態を更新

            // 初回ロード時以外、または特定のビューが表示されている場合のみUI更新
            if (!isFirstLoad) {
                 await refreshUIBasedOnTaskUpdate();
            }

        } else if (!docSnap.metadata.hasPendingWrites) { // 保留中の書き込みがない場合のみ処理
             console.warn("Tasks document unexpectedly deleted or empty. Creating default tasks...");
             // ドキュメントが存在しない or listがない場合 (初回起動時など)
             const defaultTasks = [
                 { name: "資料作成", memo: "", goals: [] },
                 { name: "会議", memo: "", goals: [] },
                 { name: "メール対応", memo: "", goals: [] },
                 { name: "開発", memo: "", goals: [] },
                 { name: "休憩", memo: "", goals: [] }, // 休憩は必須
             ];
             try {
                 await setDoc(tasksRef, { list: defaultTasks }); // デフォルトタスクを保存
                 updateGlobalTaskObjects(defaultTasks); // グローバル状態更新
                 await refreshUIBasedOnTaskUpdate(); // UIも更新
             } catch (error) {
                 console.error("Error creating default tasks:", error);
                 updateGlobalTaskObjects([]); // エラー時は空にする
             }

        }
        isFirstLoad = false; // 初回ロードフラグを下ろす
    }, (error) => {
         console.error("Error listening for task updates:", error);
         updateGlobalTaskObjects([]); // エラー時は空にする
         isFirstLoad = false;
    });
    // 必要に応じてリスナーを解除できるように関数を返すか、グローバル変数に保存
    // return unsubscribe;
}

/**
 * タスクデータ更新時に、現在表示中のビューに応じて関連UIをリフレッシュする
 */
async function refreshUIBasedOnTaskUpdate() {
    console.log("Refreshing UI based on task update...");
    // client.js の renderTaskOptions は clientUI.js に移動した想定
    const { renderTaskOptions, checkIfWarningIsNeeded } = await import('./views/client/clientUI.js');
    const { initializeProgressView } = await import('./views/progress.js');
    const { initializeArchiveView } = await import('./views/archive.js');
    const { renderTaskEditor } = await import('./views/taskSettings.js');

    try {
        if (document.getElementById(VIEWS.CLIENT)?.classList.contains('active-view')) {
            renderTaskOptions(); // clientUI.jsから
            checkIfWarningIsNeeded(); // clientUI.jsから
        }
        if (document.getElementById(VIEWS.TASK_SETTINGS)?.classList.contains('active-view')) {
             renderTaskEditor(); // taskSettings.jsから
        }
        if (document.getElementById(VIEWS.PROGRESS)?.classList.contains('active-view')) {
            await initializeProgressView(); // 再初期化
        }
        if (document.getElementById(VIEWS.ARCHIVE)?.classList.contains('active-view')) {
            await initializeArchiveView(); // 再初期化
        }
    } catch(error) {
         console.error("Error refreshing UI after task update:", error);
    }
}


/**
 * Firestoreから全ユーザーのログを取得し、グローバル変数 `allUserLogs` を更新する。
 * これはリアルタイムリスナーではなく、必要な時に呼び出す想定。
 */
export async function fetchAllUserLogs() {
    console.log("Fetching all user logs...");
    try {
        const logsSnapshot = await getDocs(collection(db, "work_logs"));
        // Timestamp を Date に変換
        allUserLogs = logsSnapshot.docs.map((d) => {
             const data = d.data();
             const log = { id: d.id, ...data };
             if (log.startTime && log.startTime.toDate) log.startTime = log.startTime.toDate();
             if (log.endTime && log.endTime.toDate) log.endTime = log.endTime.toDate();
             // completedAt など他のTimestampフィールドも必要なら変換
             return log;
        });
        console.log(`Fetched ${allUserLogs.length} log entries.`);

        // ログ取得後に、ログデータに依存するビュー（Report, Progress, Archiveなど）を更新
        if(document.getElementById(VIEWS.REPORT)?.classList.contains('active-view')) {
             await initializeReportView(); // 再初期化してチャートを更新
        }
        if (document.getElementById(VIEWS.PROGRESS)?.classList.contains('active-view')) {
             await initializeProgressView(); // 再初期化してデータ更新
        }
         if (document.getElementById(VIEWS.ARCHIVE)?.classList.contains('active-view')) {
             await initializeArchiveView(); // 再初期化してデータ更新
        }
         // Hostビューの担当者別時間表示なども更新が必要な場合がある
         // if(document.getElementById(VIEWS.HOST)?.classList.contains('active-view')) {
         //    // host.js の renderUserAccountList をトリガーするなど
         // }


    } catch (error) {
        console.error("Error fetching all user logs:", error);
        allUserLogs = []; // エラー時は空にする
    }
}


/**
 * Firestoreから現在のユーザーの表示設定を取得し、変更を監視する
 */
export function listenForDisplayPreferences() {
    if (preferencesUnsubscribe) preferencesUnsubscribe(); // 既存のリスナーを解除
    if (!userId) {
         userDisplayPreferences = { hiddenTasks: [] };
         preferencesUnsubscribe = null;
         console.log("User logged out or not set, reset display preferences to default.");
         // 必要なら関連UIを更新 (例: クライアントビューのタスクドロップダウン)
         refreshUIBasedOnPreferenceUpdate();
        return;
    }

    console.log(`Starting listener for display preferences for user: ${userId}`);
    const prefRef = doc(db, `user_profiles/${userId}/preferences/display`);

    preferencesUnsubscribe = onSnapshot(prefRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().hiddenTasks && Array.isArray(docSnap.data().hiddenTasks)) {
            userDisplayPreferences = docSnap.data();
            console.log("Display preferences updated:", userDisplayPreferences);
        } else {
            console.log("No display preferences found or invalid format, using default.");
            userDisplayPreferences = { hiddenTasks: [] };
            // Optionally, create the document with default settings if it doesn't exist and no pending writes
             if(!docSnap.exists() && !docSnap.metadata.hasPendingWrites) {
                 setDoc(prefRef, userDisplayPreferences, { merge: true }).catch(err => console.error("Error creating default preferences:", err));
             }
        }
        // 設定が変更されたら、関連するUIを更新
        refreshUIBasedOnPreferenceUpdate();

    }, (error) => {
         console.error(`Error listening for display preferences for user ${userId}:`, error);
         userDisplayPreferences = { hiddenTasks: [] }; // エラー時はデフォルトに戻す
         refreshUIBasedOnPreferenceUpdate(); // UIもデフォルト状態に更新
    });
}

/**
 * ユーザーの表示設定更新時に、関連するUIをリフレッシュする
 */
async function refreshUIBasedOnPreferenceUpdate() {
    console.log("Refreshing UI based on preference update...");
    // client.js の renderTaskOptions/renderTaskDisplaySettings は clientUI.js に移動した想定
    const { renderTaskOptions, renderTaskDisplaySettings } = await import('./views/client/clientUI.js');
    try {
        if (document.getElementById(VIEWS.CLIENT)?.classList.contains('active-view')) {
             renderTaskOptions(); // clientUI.js から
             renderTaskDisplaySettings(); // clientUI.js から
        }
        // 他のビューも必要に応じて更新
    } catch (error) {
         console.error("Error refreshing UI after preference update:", error);
    }
}

// --- グローバル状態更新関数 ---
export function setUserId(newUserId) {
    if (userId !== newUserId) {
        userId = newUserId;
        console.log("Global userId set:", userId);
        listenForDisplayPreferences(); // ユーザーが変わったら設定リスナーも更新/リセット
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
        // 権限レベル変更に応じてUI要素の表示/非表示を更新する必要があるかもしれない
        // 例：管理者ボタンの表示制御など (これは各ビューの初期化時に行う方が良いかも)
    }
}
export function updateGlobalTaskObjects(newTasks) {
    // TimestampオブジェクトをDateオブジェクトに変換（ログと同様に）
    const processedTasks = newTasks.map(task => ({
        ...task,
        goals: (task.goals || []).map(goal => {
            const processedGoal = {...goal};
            if (goal.completedAt && goal.completedAt.toDate) {
                processedGoal.completedAt = goal.completedAt.toDate();
            }
             // Date strings (YYYY-MM-DD) are stored directly, no conversion needed usually
            // if (goal.deadline && goal.deadline.toDate) { // Example if stored as Timestamp
            //     processedGoal.deadline = getJSTDateString(goal.deadline.toDate());
            // }
            // if (goal.effortDeadline && goal.effortDeadline.toDate) { // Example if stored as Timestamp
            //     processedGoal.effortDeadline = getJSTDateString(goal.effortDeadline.toDate());
            // }
            return processedGoal;
        })
    }));

     // 変更があったかどうかの簡易チェック (JSON文字列表記での比較)
     if (JSON.stringify(allTaskObjects) !== JSON.stringify(processedTasks)) {
        allTaskObjects = processedTasks;
        console.log("Global task objects updated:", allTaskObjects.length, "tasks");
        // UI更新はリスナー内の refreshUIBasedOnTaskUpdate で行う
    } else {
        console.log("Global task objects received from Firestore, but no change detected.");
    }

}
// adminLoginDestinationの設定関数 (Okta移行により不要になる可能性が高いが残しておく)
export function setAdminLoginDestination(viewId) {
    adminLoginDestination = viewId;
}

// --- アプリケーション開始 ---
// DOMが完全に読み込まれたら初期化処理を開始
document.addEventListener("DOMContentLoaded", initialize);


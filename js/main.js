// js/main.js - アプリケーションのエントリーポイント兼全体管理

// --- Firebaseと認証関連のインポート ---
// db, authインスタンス、設定検証関数をfirebase.jsからインポート
import { db, auth, isFirebaseConfigValid } from './firebase.js';
// signInAnonymouslyは初期ロード時に使用、onAuthStateChangedはFirebase Authの状態監視（Okta/Auth0利用時は役割が変わる可能性あり）
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// ログアウト処理と管理者認証処理をauth.jsからインポート (Okta利用時はokta.jsからインポートするように変更)
import { handleLogout, handleAdminLogin, checkAdminPassword, authLevel as currentAuthLevel } from './auth.js'; // authLevelもインポート

// --- Firestore関連のインポート ---
import { doc, onSnapshot, getDoc, collection, getDocs, query, where, Timestamp, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- 各ビューモジュールのインポート ---
// 各ビューの初期化関数とイベントリスナー設定関数をインポート
import { initializeProfileSetupView, setupProfileSetupEventListeners } from './views/profileSetup.js';
import { initializeModeSelectionView, setupModeSelectionEventListeners } from './views/modeSelection.js';
import { initializeTaskSettingsView, setupTaskSettingsEventListeners } from './views/taskSettings.js';
import { initializeHostView, cleanupHostView, setupHostEventListeners } from './views/host.js';
import { initializeClientView, setupClientEventListeners, resetClientStateUI, checkIfWarningIsNeeded } from './views/client.js'; // resetClientStateUI もインポート
import { initializePersonalDetailView, cleanupPersonalDetailView, setupPersonalDetailEventListeners } from './views/personalDetail.js';
import { initializeReportView, cleanupReportView, setupReportEventListeners } from './views/report.js';
import { initializeProgressView, setupProgressEventListeners } from './views/progress.js';
import { initializeArchiveView, setupArchiveEventListeners } from './views/archive.js';
import { updateStatusesCache } from './views/host/userManagement.js'; // host.jsがstatusをuserManagementに渡すためインポート

// --- コンポーネント/ユーティリティモジュールのインポート ---
import { setupModalEventListeners, adminPasswordView, confirmationModal, closeModal } from './components/modal.js';
import { setupExcelExportEventListeners } from './excelExport.js';
import { checkForCheckoutCorrection } from './utils.js'; // 退勤忘れチェック関数

// --- グローバル状態変数 ---
export let userId = null; // 現在のユーザーID (Firebase Auth UID または profile ID)
export let userName = null; // 現在のユーザー名
export let authLevel = 'none'; // 認証レベル ('none', 'task_editor', 'admin') - auth.jsから初期値を取得
export let allTaskObjects = []; // 全タスクとその目標（Firestoreから取得）
export let allUserLogs = []; // 全ユーザーのログ（Firestoreから取得、必要に応じて更新）
export let userDisplayPreferences = { hiddenTasks: [] }; // ユーザーの表示設定
export let viewHistory = []; // 表示したビューの履歴（戻る機能用）
export let adminLoginDestination = null; // 管理者ログイン後に遷移するビュー
export let preferencesUnsubscribe = null; // 表示設定リスナーの解除関数

// --- 定数 ---
// ビューIDと対応する初期化/クリーンアップ関数をマッピング
export const VIEWS = {
    PROFILE_SETUP: "profile-setup-view",
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
    [VIEWS.PROFILE_SETUP]: { init: initializeProfileSetupView },
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

    // Firebase設定の有効性を確認
    if (!isFirebaseConfigValid()) {
        displayInitializationError("Firebaseの設定が無効です。firebase.jsを確認してください。");
        return;
    }

    // Firebase Authの状態を監視（匿名ログイン用）
    // Okta/Auth0導入時は、ここでのユーザー処理は変わる可能性が高い
    onAuthStateChanged(auth, async (user) => {
        if (user && !userId) { // 匿名ユーザーがサインインし、まだログインしていない場合
            console.log("Firebase Anonymous User Signed In:", user.uid);
            // ここでは userId を設定しない。profileSetup で名前を入力してログインした際に設定する。
            enableLoginButton(); // ログインボタンを有効化
        } else if (user && userId) {
             // すでにログイン済み (localStorageから復元済み)
             console.log("User already logged in:", userName, `(UID: ${userId})`);
        } else if (!user && !userId) {
             // 匿名サインインが必要
             console.log("No user signed in. Attempting anonymous sign-in...");
             try {
                await signInAnonymously(auth);
                console.log("Signed in anonymously.");
                enableLoginButton(); // 匿名サインイン後にログインボタンを有効化
             } catch (error) {
                 console.error("Anonymous sign-in failed:", error);
                 displayInitializationError("匿名認証に失敗しました。");
             }
        } else if (!user && userId) {
             // ログアウトした場合など
             console.log("Firebase user logged out, but local state might persist. Handling logout...");
             // handleLogout(); // 必要なら強制ログアウト処理を呼ぶ
        }
    });

    // --- グローバルリスナーとイベントリスナーの設定 ---
    setupGlobalEventListeners(); // 先にモーダルなどの共通リスナーを設定
    await listenForTasks(); // タスク情報を最初に取得・監視開始
    listenForDisplayPreferences(); // ユーザー設定を監視開始
    await fetchAllUserLogs(); // 初回ログ取得

    // --- ユーザー状態の復元と初期ビュー表示 ---
    const savedUser = localStorage.getItem("workTrackerUser");
    if (savedUser) {
        try {
            const { uid: savedUid, name } = JSON.parse(savedUser);
            // 保存されたユーザー情報で状態を更新
            setUserId(savedUid);
            setUserName(name);
            console.log("Restored user from localStorage:", userName, `(UID: ${userId})`);

            // localStorageからの復元時にもFirestoreのステータスをオンラインにする
            const statusRef = doc(db, "work_status", userId);
            await setDoc(statusRef, { userName: name, onlineStatus: true, userId: userId }, { merge: true });

            await checkForCheckoutCorrection(userId); // 退勤忘れチェック
            listenForDisplayPreferences(); // ユーザー設定の監視を開始

            showView(VIEWS.MODE_SELECTION); // モード選択画面を表示
        } catch (error) {
            console.error("Error parsing saved user data:", error);
            localStorage.removeItem("workTrackerUser"); // 不正なデータは削除
            showView(VIEWS.PROFILE_SETUP); // プロフィール設定画面を表示
        }
    } else {
        // 保存されたユーザー情報がない場合
        showView(VIEWS.PROFILE_SETUP); // プロフィール設定画面を表示
    }

    // 定期的なログフェッチを設定 (例: 5分ごと)
    setInterval(fetchAllUserLogs, 5 * 60 * 1000);

     // グローバルな状態更新を反映するためのUI更新 (例: タスクドロップダウン)
     // これは各ビューの初期化や状態変更時に行う方が適切かもしれない
     // updateAllTaskDropdowns(); // 仮の関数名
}


/**
 * Firebase初期化失敗などのエラーメッセージを表示
 * @param {string} message - 表示するエラーメッセージ
 */
function displayInitializationError(message) {
    const container = document.getElementById("app-container");
    if (container) {
        container.innerHTML = `<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative max-w-lg mx-auto mt-10" role="alert">
            <strong class="font-bold">初期化エラー</strong>
            <span class="block sm:inline">${message}</span>
        </div>`;
    }
    console.error("Initialization Error:", message);
}

/**
 * ログインボタンを有効化する
 */
function enableLoginButton() {
     const loginButton = document.getElementById('save-profile-btn');
     if (loginButton) {
         loginButton.disabled = false;
         loginButton.textContent = 'ログイン'; // Ensure text is correct
     }
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
    setupProfileSetupEventListeners();
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

    // --- 管理者パスワードモーダル ---
    const adminPasswordSubmitBtn = document.getElementById("admin-password-submit-btn");
    const adminPasswordCancelBtn = document.getElementById("admin-password-cancel-btn");
    const adminPasswordInput = document.getElementById("admin-password-input");

    adminPasswordSubmitBtn?.addEventListener("click", handleAdminLogin); // auth.jsの関数を呼び出し
    adminPasswordCancelBtn?.addEventListener("click", () => closeModal(adminPasswordView));
    // Enterキーで送信
    adminPasswordInput?.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleAdminLogin();
        }
    });

    console.log("Global event listeners set up complete.");
}


// --- ビュー管理 ---

/**
 * 指定されたビューを表示し、他のビューを非表示にする。
 * 必要に応じて初期化・クリーンアップ関数を呼び出す。
 * @param {string} viewName - 表示するビューのID (VIEWS定数を使用)
 * @param {object} [data={}] - ビューの初期化時に渡すデータ (例: { userName: 'Taro' })
 */
export function showView(viewName, data = {}) {
    console.log(`Showing view: ${viewName}`, data);
    const targetViewElement = document.getElementById(viewName);

    if (!targetViewElement) {
        console.error(`View element not found: ${viewName}`);
        return;
    }

    // --- クリーンアップ ---
    // 現在アクティブなビューを探し、クリーンアップ関数があれば実行
    const currentActiveViewElement = document.querySelector(".view.active-view");
    if (currentActiveViewElement && currentActiveViewElement.id !== viewName) {
        const currentViewId = currentActiveViewElement.id;
        const currentLifecycle = viewLifecycle[currentViewId];
        if (currentLifecycle?.cleanup) {
            console.log(`Cleaning up view: ${currentViewId}`);
            currentLifecycle.cleanup();
        }
        currentActiveViewElement.classList.remove("active-view");
    } else if (currentActiveViewElement && currentActiveViewElement.id === viewName) {
         // 同じビューを表示しようとした場合、初期化だけ実行する（リフレッシュ目的）
         const currentLifecycle = viewLifecycle[viewName];
         if (currentLifecycle?.init) {
            console.log(`Re-initializing view: ${viewName}`);
            currentLifecycle.init(data); // データも渡す
         }
         return; // ビュー切り替えは不要
    }


    // --- ビューの表示と初期化 ---
    targetViewElement.classList.add("active-view");
    const newLifecycle = viewLifecycle[viewName];
    if (newLifecycle?.init) {
        console.log(`Initializing view: ${viewName}`);
        newLifecycle.init(data); // 初期化関数にデータを渡す
    }

    // --- 履歴管理 ---
    // 戻るボタンで戻らないビュー（ログイン画面など）は履歴に追加しない
    const nonHistoryViews = [VIEWS.PROFILE_SETUP];
    const currentViewFromHistory = viewHistory[viewHistory.length - 1];
    if (currentViewFromHistory !== viewName && !nonHistoryViews.includes(viewName)) {
        viewHistory.push(viewName);
    }

    window.scrollTo(0, 0); // 画面遷移時にトップにスクロール
}

/**
 * 一つ前のビューに戻る
 */
export function handleGoBack() {
    console.log("Handling Go Back. History:", viewHistory);
    viewHistory.pop(); // 現在のビューを履歴から削除
    const previousViewName = viewHistory.pop(); // 一つ前のビュー名を取得
    if (previousViewName) {
        showView(previousViewName);
    } else {
        // 履歴がない場合はデフォルトのビュー（モード選択など）に戻る
        showView(VIEWS.MODE_SELECTION);
        console.warn("View history empty, navigating to default view.");
    }
}


// --- グローバルFirestoreリスナー ---

/**
 * Firestoreからタスクリストを取得し、変更を監視する
 */
async function listenForTasks() {
    console.log("Starting listener for tasks...");
    const tasksRef = doc(db, "settings", "tasks");

    // 初回取得
    try {
        const docSnap = await getDoc(tasksRef);
        if (docSnap.exists() && docSnap.data().list) {
            updateGlobalTaskObjects(docSnap.data().list);
        } else {
            // ドキュメントが存在しない or listがない場合 (初回起動時など)
            console.log("No tasks found in settings. Creating default tasks...");
            const defaultTasks = [
                { name: "資料作成", memo: "", goals: [] },
                { name: "会議", memo: "", goals: [] },
                { name: "メール対応", memo: "", goals: [] },
                { name: "開発", memo: "", goals: [] },
                { name: "休憩", memo: "", goals: [] }, // 休憩は必須
            ];
            await setDoc(tasksRef, { list: defaultTasks }); // デフォルトタスクを保存
            updateGlobalTaskObjects(defaultTasks);
        }
    } catch (error) {
         console.error("Error fetching initial tasks:", error);
         // エラー時も空配列で初期化を試みる
         updateGlobalTaskObjects([]);
    }


    // 変更監視
    onSnapshot(tasksRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().list) {
            console.log("Tasks updated from Firestore.");
            updateGlobalTaskObjects(docSnap.data().list);
             // タスク更新時に、関連するUI（例：クライアントビューのドロップダウン）を更新
             // checkIfWarningIsNeeded(); // 実行中のタスクと比較して警告を更新
             if(document.getElementById(VIEWS.CLIENT)?.classList.contains('active-view')) {
                 // クライアントビューが表示されている場合のみ更新
                 // renderTaskOptions(); // clientUI.jsからインポートして使用
             }
             if(document.getElementById(VIEWS.TASK_SETTINGS)?.classList.contains('active-view')) {
                  // renderTaskEditor(); // taskSettings.jsからインポートして使用
             }
              // 他のビュー（Progress, Archiveなど）も必要に応じて更新
              if (document.getElementById(VIEWS.PROGRESS)?.classList.contains('active-view')) {
                  // initializeProgressView(); // 再初期化してリストを更新
              }
              if (document.getElementById(VIEWS.ARCHIVE)?.classList.contains('active-view')) {
                 // initializeArchiveView(); // 再初期化してリストを更新
              }


        } else {
             console.warn("Tasks document unexpectedly deleted or empty.");
             updateGlobalTaskObjects([]); // タスクが空になった場合
        }
    }, (error) => {
         console.error("Error listening for task updates:", error);
    });
}

/**
 * Firestoreから全ユーザーのログを取得し、グローバル変数 `allUserLogs` を更新する。
 * これはリアルタイムリスナーではなく、必要な時に呼び出す想定。
 */
export async function fetchAllUserLogs() {
    console.log("Fetching all user logs...");
    try {
        const logsSnapshot = await getDocs(collection(db, "work_logs"));
        allUserLogs = logsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        console.log(`Fetched ${allUserLogs.length} log entries.`);
         // ログ取得後に、ログデータに依存するビュー（Report, Hostの担当者時間など）を更新する必要があるかもしれない
         // 例: Hostビューが表示されていればステータスキャッシュを更新
         if(document.getElementById(VIEWS.HOST)?.classList.contains('active-view')) {
             // updateStatusesCache(currentAllStatuses); // ステータス自体は変わらないが、再描画トリガーとして使う？
             // renderUserAccountList(); // userManagementのを呼び出す
         }
         // レポートビューが表示されていれば再描画
          if(document.getElementById(VIEWS.REPORT)?.classList.contains('active-view')) {
             // initializeReportView(); // 再初期化してチャートを更新
          }

    } catch (error) {
        console.error("Error fetching all user logs:", error);
        allUserLogs = []; // エラー時は空にする
    }
}


/**
 * Firestoreから現在のユーザーの表示設定を取得し、変更を監視する
 */
function listenForDisplayPreferences() {
    if (preferencesUnsubscribe) preferencesUnsubscribe(); // 既存のリスナーを解除
    if (!userId) {
         // ユーザーIDがない場合（ログアウト後など）はデフォルト設定に戻す
         userDisplayPreferences = { hiddenTasks: [] };
         preferencesUnsubscribe = null;
         console.log("User logged out, reset display preferences to default.");
         // 必要なら関連UIを更新
         // renderTaskOptions(); // 例：クライアントビューのタスクドロップダウン
        return;
    }

    console.log(`Starting listener for display preferences for user: ${userId}`);
    const prefRef = doc(db, `user_profiles/${userId}/preferences/display`);

    preferencesUnsubscribe = onSnapshot(prefRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().hiddenTasks) {
            userDisplayPreferences = docSnap.data();
            console.log("Display preferences updated:", userDisplayPreferences);
        } else {
            // ドキュメントがない場合はデフォルト設定を使用し、必要なら作成する
            console.log("No display preferences found, using default.");
            userDisplayPreferences = { hiddenTasks: [] };
            // Optionally, create the document with default settings if it doesn't exist
            // setDoc(prefRef, userDisplayPreferences, { merge: true }).catch(err => console.error("Error creating default preferences:", err));
        }

        // 設定が変更されたら、関連するUI（例：クライアントビューのタスクドロップダウン）を更新
        if (document.getElementById(VIEWS.CLIENT)?.classList.contains('active-view')) {
             // renderTaskOptions(); // clientUI.js からインポートして使用
             // renderTaskDisplaySettings(); // clientUI.js からインポートして使用
        }
         // 他のビューも必要に応じて更新

    }, (error) => {
         console.error(`Error listening for display preferences for user ${userId}:`, error);
         userDisplayPreferences = { hiddenTasks: [] }; // エラー時はデフォルトに戻す
         // 必要なら関連UIを更新
         if (document.getElementById(VIEWS.CLIENT)?.classList.contains('active-view')) {
             // renderTaskOptions();
             // renderTaskDisplaySettings();
         }

    });
}


// --- グローバル状態更新関数 ---
export function setUserId(newUserId) {
    userId = newUserId;
    listenForDisplayPreferences(); // ユーザーが変わったら設定リスナーも更新
}
export function setUserName(newName) {
    userName = newName;
}
export function updateGlobalTaskObjects(newTasks) {
    // TimestampオブジェクトをDateオブジェクトに変換（必要な場合）
    // Firestoreから直接取得したTimestampは、そのままでは比較やJSON化で問題が起きることがある
    const processedTasks = newTasks.map(task => ({
        ...task,
        goals: (task.goals || []).map(goal => {
            const processedGoal = {...goal};
            // completedAtやdeadlineがTimestampオブジェクトならDateに変換
            if (goal.completedAt && goal.completedAt.toDate) {
                processedGoal.completedAt = goal.completedAt.toDate();
            }
             if (goal.deadline && typeof goal.deadline !== 'string') { // DeadlineがTimestampの場合の考慮（文字列として保存推奨）
                 // console.warn("Goal deadline might be a Timestamp, expected string:", goal.deadline);
                 // 暫定対応：文字列に変換しようとする (YYYY-MM-DD)
                 if(goal.deadline.toDate){
                     try {
                         processedGoal.deadline = getJSTDateString(goal.deadline.toDate());
                     } catch (e) { console.error("Error converting deadline timestamp:", e); }
                 }
             }
              if (goal.effortDeadline && typeof goal.effortDeadline !== 'string') {
                 if(goal.effortDeadline.toDate){
                     try {
                         processedGoal.effortDeadline = getJSTDateString(goal.effortDeadline.toDate());
                     } catch (e) { console.error("Error converting effortDeadline timestamp:", e); }
                 }
             }

            return processedGoal;
        })
    }));

    allTaskObjects = processedTasks;
    console.log("Global task objects updated:", allTaskObjects.length, "tasks");

    // タスク更新後、依存するUIを更新するトリガー（例）
    if (document.getElementById(VIEWS.CLIENT)?.classList.contains('active-view')) {
       // クライアントビューが表示中ならタスクドロップダウン等を更新
       // renderTaskOptions(); // clientUI.jsから
       // checkIfWarningIsNeeded(); // clientUI.jsから
    }
     if (document.getElementById(VIEWS.TASK_SETTINGS)?.classList.contains('active-view')) {
       // 設定画面が表示中ならエディタを更新
       // renderTaskEditor(); // taskSettings.jsから
    }
     // ProgressやArchiveビューも同様に更新トリガーをかける
      if (document.getElementById(VIEWS.PROGRESS)?.classList.contains('active-view')) {
         // initializeProgressView(); // 再初期化
      }
      if (document.getElementById(VIEWS.ARCHIVE)?.classList.contains('active-view')) {
         // initializeArchiveView(); // 再初期化
      }

}

export function setAdminLoginDestination(viewId) {
    adminLoginDestination = viewId;
}

// --- アプリケーション開始 ---
// DOMが完全に読み込まれたら初期化処理を開始
document.addEventListener("DOMContentLoaded", initialize);

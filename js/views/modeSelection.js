// js/views/modeSelection.js

import { showView, VIEWS, userId, userName, db } from "../main.js"; // userNameを追加
import { showPasswordModal } from "../components/modal.js";
import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// DOM要素
const clientBtn = document.getElementById("select-client-btn");
const hostBtn = document.getElementById("select-host-btn");
const settingsBtn = document.getElementById("task-settings-btn");
const logoutBtn = document.getElementById("logout-btn-selection");
const userNameDisplay = document.getElementById("user-name-display"); // 追加
const wordInput = document.getElementById("word-of-the-day-input"); // 追加
const saveWordBtn = document.getElementById("save-word-btn"); // 追加

let wordUnsubscribe = null; // リスナー解除用

/**
 * モード選択画面の初期化
 */
export function initializeModeSelectionView() {
    console.log("Initializing Mode Selection View...");
    
    // ユーザー名の表示
    if (userNameDisplay) {
        userNameDisplay.textContent = userName || "ユーザー";
    }

    // 今日の一言を監視開始
    subscribeToWordOfTheDay();
}

/**
 * モード選択画面終了時の処理（リスナー解除など）
 * main.jsで cleanup として登録されていなくても、
 * showViewのロジックで呼び出される可能性があります。
 */
export function cleanupModeSelectionView() {
    if (wordUnsubscribe) {
        console.log("Unsubscribing from word of the day...");
        wordUnsubscribe();
        wordUnsubscribe = null;
    }
}

/**
 * イベントリスナーの設定
 */
export function setupModeSelectionEventListeners() {
    console.log("Setting up Mode Selection event listeners...");

    // モード選択ボタン
    clientBtn?.addEventListener("click", () => handleModeSelect(VIEWS.CLIENT));
    hostBtn?.addEventListener("click", () => handleModeSelect(VIEWS.HOST));
    settingsBtn?.addEventListener("click", () => showView(VIEWS.TASK_SETTINGS));

    // ログアウトボタン（簡易実装：リロードなど。必要に応じてauth.signOutなどを呼ぶ）
    logoutBtn?.addEventListener("click", () => {
        if(confirm("ログアウトしますか？")) {
             // 簡易的なリロード（実際のログアウト処理はokta.js等に依存）
             location.reload(); 
        }
    });

    // 今日の一言保存ボタン
    saveWordBtn?.addEventListener("click", handleSaveWord);
}

/**
 * 今日の一言をFirestoreから監視する
 */
function subscribeToWordOfTheDay() {
    if (wordUnsubscribe) return; // 既に監視中なら何もしない

    const wordRef = doc(db, "settings", "daily_word");
    
    wordUnsubscribe = onSnapshot(wordRef, (docSnap) => {
        if (docSnap.exists() && wordInput) {
            const text = docSnap.data().text || "";
            // 自分が編集中の場合は上書きしない制御を入れても良いが、
            // ここではシンプルに常に最新を表示する（共有事項のため）
            if (document.activeElement !== wordInput) {
                wordInput.value = text;
            }
        }
    }, (error) => {
        console.error("Error listening to word of the day:", error);
    });
}

/**
 * 今日の一言を保存する
 */
async function handleSaveWord() {
    if (!wordInput) return;
    const text = wordInput.value.trim();

    try {
        const btnOriginalText = saveWordBtn.textContent;
        saveWordBtn.textContent = "保存中...";
        saveWordBtn.disabled = true;

        await setDoc(doc(db, "settings", "daily_word"), {
            text: text,
            updatedBy: userName,
            updatedAt: new Date()
        });
        
        alert("今日の一言を保存しました！");
    } catch (error) {
        console.error("Error saving word of the day:", error);
        alert("保存に失敗しました。");
    } finally {
        if (saveWordBtn) {
            saveWordBtn.textContent = "保存";
            saveWordBtn.disabled = false;
        }
    }
}

/**
 * モード選択時の処理
 */
async function handleModeSelect(mode) {
    // 1. 一般画面（Client）は無条件で移動
    if (mode === VIEWS.CLIENT) {
        showView(VIEWS.CLIENT);
        return;
    }

    // 2. 権限チェック (管理者 or 業務管理者)
    const hasPermission = await checkUserPermission(mode);

    if (hasPermission) {
        console.log(`Permission granted for ${mode} via user role.`);
        showView(mode);
        return;
    }

    // 3. 権限がない場合はパスワード入力を求める
    if (mode === VIEWS.HOST) {
        showPasswordModal("host", () => showView(VIEWS.HOST));
    } 
}

/**
 * ユーザーの権限を確認する関数
 */
async function checkUserPermission(targetView) {
    if (!userId) return false;

    try {
        const userRef = doc(db, "user_profiles", userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) return false;

        const role = userSnap.data().role;

        if (targetView === VIEWS.HOST) {
            return role === "host" || role === "manager";
        }

        return false;
    } catch (error) {
        console.error("Permission check failed:", error);
        return false;
    }
}

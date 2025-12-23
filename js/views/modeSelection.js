// js/views/modeSelection.js

import { showView, VIEWS, userId, userName, db } from "../main.js";
import { showPasswordModal } from "../components/modal/index.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// DOM要素
const clientBtn = document.getElementById("select-client-btn");
const hostBtn = document.getElementById("select-host-btn");
const settingsBtn = document.getElementById("task-settings-btn");
const logoutBtn = document.getElementById("logout-btn-selection");
const userNameDisplay = document.getElementById("user-name-display");
const wordInput = document.getElementById("word-of-the-day-input");
const saveWordBtn = document.getElementById("save-word-btn");

/**
 * モード選択画面の初期化
 */
export async function initializeModeSelectionView() {
    console.log("Initializing Mode Selection View...");
    
    // ユーザー名の表示
    if (userNameDisplay) {
        userNameDisplay.textContent = userName || "ユーザー";
    }

    // 今日の一言の初期表示（ローカルストレージ優先、無ければFirestore）
    if (wordInput) {
        const localWord = localStorage.getItem('wordOfTheDay');
        if (localWord) {
            wordInput.value = localWord;
        }

        // Firestoreから最新を取得して上書き（もしあれば）
        if (userId) {
            try {
                const statusDoc = await getDoc(doc(db, "work_status", userId));
                if (statusDoc.exists() && statusDoc.data().wordOfTheDay) {
                    const serverWord = statusDoc.data().wordOfTheDay;
                    wordInput.value = serverWord;
                    // ローカルも更新しておく
                    localStorage.setItem('wordOfTheDay', serverWord);
                }
            } catch (error) {
                console.error("Error fetching word of the day:", error);
            }
        }
    }
}

/**
 * クリーンアップ（今回はリスナーを使っていないので特に処理なし）
 */
export function cleanupModeSelectionView() {
    // 特になし
}

/**
 * イベントリスナーの設定
 */
export function setupModeSelectionEventListeners() {
    console.log("Setting up Mode Selection event listeners...");

    clientBtn?.addEventListener("click", () => handleModeSelect(VIEWS.CLIENT));
    hostBtn?.addEventListener("click", () => handleModeSelect(VIEWS.HOST));
    settingsBtn?.addEventListener("click", () => showView(VIEWS.TASK_SETTINGS));

    logoutBtn?.addEventListener("click", () => {
        if(confirm("ログアウトしますか？")) {
             location.reload(); 
        }
    });

    // 今日の一言保存ボタン
    saveWordBtn?.addEventListener("click", handleSaveWordOfTheDay);
}

/**
 * 今日の一言を保存する (ユーザー提示コードを踏襲)
 */
async function handleSaveWordOfTheDay() {
    if (!wordInput) return;

    const word = wordInput.value.trim();

    // ★修正2: ローカルストレージに保存（次回即座に表示するため）
    localStorage.setItem('wordOfTheDay', word);

    if (!userId) {
        // ユーザーIDがまだ無い場合でも、ローカル保存はできたのでアラートは控えめにするか、
        // ローカルだけで動作するように振る舞う
        alert("一時的に保存しました。（サーバーへの同期はログイン後に行われます）");
        return;
    }

    const statusRef = doc(db, "work_status", userId);

    try {
        const btnOriginalText = saveWordBtn.textContent;
        saveWordBtn.textContent = "保存中...";
        saveWordBtn.disabled = true;

        // Update the 'wordOfTheDay' field in the user's status document.
        // Use setDoc with merge:true to create the document if it doesn't exist,
        // or update the field without overwriting other status info.
        await setDoc(statusRef, { wordOfTheDay: word }, { merge: true });
        
        // Optionally show a success message to the user
        alert("今日の一言を保存しました。");
    } catch (error) {
        // console.error("Error saving word of the day:", error); 
        alert("サーバーへの保存中にエラーが発生しましたが、ブラウザには保存されました。");
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
    if (mode === VIEWS.CLIENT) {
        showView(VIEWS.CLIENT);
        return;
    }

    const hasPermission = await checkUserPermission(mode);

    if (hasPermission) {
        console.log(`Permission granted for ${mode} via user role.`);
        showView(mode);
        return;
    }

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

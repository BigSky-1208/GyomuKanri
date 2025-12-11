// js/views/modeSelection.js
// ★修正: js/views/modeSelection.js から見て main.js は ../main.js
import { db, userId, userName, authLevel, showView, VIEWS, setAdminLoginDestination } from "../main.js"; 
import { handleOktaLogout } from "../okta.js"; // Import logout function from okta.js
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Import Firestore functions
// ★追加: adminPasswordView を modal.js からインポート
import { adminPasswordView } from "../components/modal.js";

// --- DOM Element references ---
const userNameDisplay = document.getElementById("user-name-display"); // User name in selection view
const wordOfTheDayInput = document.getElementById("word-of-the-day-input");
const saveWordButton = document.getElementById("save-word-btn");
const selectHostButton = document.getElementById("select-host-btn");
const selectClientButton = document.getElementById("select-client-btn");
const taskSettingsButton = document.getElementById("task-settings-btn");
const logoutButton = document.getElementById("logout-btn-selection");


/**
 * Initializes the Mode Selection view when it becomes active.
 * Displays the username and fetches/displays the word of the day.
 */
export function initializeModeSelectionView() {
    if (userNameDisplay && userName) {
        userNameDisplay.textContent = userName; // Display the logged-in username
    } else if (userNameDisplay) {
        userNameDisplay.textContent = '取得エラー'; // Fallback text
    }

    // ★修正1: まずローカルストレージから読み込んで即座に表示する
    const localWord = localStorage.getItem('wordOfTheDay');
    if (wordOfTheDayInput && localWord) {
        wordOfTheDayInput.value = localWord;
    }

    fetchAndDisplayWordOfTheDay(); // Fetch and show the current word of the day
}

/**
 * Sets up event listeners for the Mode Selection view.
 * Should be called once during application initialization.
 */
export function setupModeSelectionEventListeners() {
    // Mode selection buttons
    selectHostButton?.addEventListener("click", () => {
        if (authLevel === "admin") {
            showView(VIEWS.HOST); // Go directly to host view if admin
        } else {
            // Ask for admin password first
            setAdminLoginDestination(VIEWS.HOST); // Tell main.js where to go after login
            if (adminPasswordView) adminPasswordView.classList.remove("hidden");
        }
    });

    selectClientButton?.addEventListener("click", () => showView(VIEWS.CLIENT));

    taskSettingsButton?.addEventListener("click", () => {
        if (authLevel === "admin" || authLevel === "task_editor") {
            showView(VIEWS.TASK_SETTINGS); // Go directly if authorized
        } else {
            // Ask for password first (admin or task editor allowed)
            setAdminLoginDestination(VIEWS.TASK_SETTINGS); // Tell main.js where to go after login
            if (adminPasswordView) adminPasswordView.classList.remove("hidden");
        }
    });

    // Word of the Day
    saveWordButton?.addEventListener("click", handleSaveWordOfTheDay);

    // Logout Button
    logoutButton?.addEventListener("click", handleOktaLogout); // Call imported logout function
}


/**
 * Saves the "Word of the Day" entered by the user to their status document in Firestore.
 */
async function handleSaveWordOfTheDay() {
    if (!wordOfTheDayInput) return;

    const word = wordOfTheDayInput.value.trim();

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
        // Update the 'wordOfTheDay' field in the user's status document.
        await setDoc(statusRef, { wordOfTheDay: word }, { merge: true });
        alert("今日の一言を保存しました。");
    } catch (error) {
        alert("サーバーへの保存中にエラーが発生しましたが、ブラウザには保存されました。");
    }
}

/**
 * Fetches the current user's "Word of the Day" from Firestore and displays it in the input field.
 */
async function fetchAndDisplayWordOfTheDay() {
    if (!userId || !wordOfTheDayInput) {
        return;
    }

    const statusRef = doc(db, "work_status", userId);
    try {
        const docSnap = await getDoc(statusRef);

        if (docSnap.exists() && docSnap.data().wordOfTheDay !== undefined) {
             // If document exists and has the field, display it
             const remoteWord = docSnap.data().wordOfTheDay;
             wordOfTheDayInput.value = remoteWord;
             
             // ★修正3: サーバーのデータでローカルストレージも更新（同期）
             localStorage.setItem('wordOfTheDay', remoteWord);
        }
    } catch (error) {
        // エラー時はローカルストレージの値を維持するので、クリア処理は削除
    }
}

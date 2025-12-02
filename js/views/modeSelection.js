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
    // console.log("Initializing Mode Selection View..."); // 修正 2: console.log を削除
    if (userNameDisplay && userName) {
        userNameDisplay.textContent = userName; // Display the logged-in username
    } else if (userNameDisplay) {
        userNameDisplay.textContent = '取得エラー'; // Fallback text
    }
    fetchAndDisplayWordOfTheDay(); // Fetch and show the current word of the day
}

/**
 * Sets up event listeners for the Mode Selection view.
 * Should be called once during application initialization.
 */
export function setupModeSelectionEventListeners() {
    // console.log("Setting up Mode Selection event listeners..."); // 修正 3: console.log を削除

    // Mode selection buttons
    selectHostButton?.addEventListener("click", () => {
        if (authLevel === "admin") {
            showView(VIEWS.HOST); // Go directly to host view if admin
        } else {
            // Ask for admin password first
            setAdminLoginDestination(VIEWS.HOST); // Tell main.js where to go after login
            if (adminPasswordView) adminPasswordView.classList.remove("hidden");
            // else console.error("Admin password view element not found."); // 修正 4: console.error を削除
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
            // else console.error("Admin password view element not found."); // 修正 5: console.error を削除
        }
    });

    // Word of the Day
    saveWordButton?.addEventListener("click", handleSaveWordOfTheDay);

    // Logout Button
    // 修正 6: handleLogout ではなく handleOktaLogout を呼ぶ（これはインポート修正で解決）
    logoutButton?.addEventListener("click", handleOktaLogout); // Call imported logout function
}


/**
 * Saves the "Word of the Day" entered by the user to their status document in Firestore.
 */
async function handleSaveWordOfTheDay() {
    if (!userId || !wordOfTheDayInput) {
        // console.error("Cannot save word of the day: userId or input element missing."); // 修正 7: console.error を削除
        alert("ユーザー情報が見つからないため、保存できません。");
        return;
    }

    const word = wordOfTheDayInput.value.trim();
    const statusRef = doc(db, "work_status", userId);

    try {
        // Update the 'wordOfTheDay' field in the user's status document.
        // Use setDoc with merge:true to create the document if it doesn't exist,
        // or update the field without overwriting other status info.
        await setDoc(statusRef, { wordOfTheDay: word }, { merge: true });
        // console.log("Word of the day saved:", word); // 修正 8: console.log を削除
        // Optionally show a success message to the user (e.g., using a temporary notification)
        alert("今日の一言を保存しました。");
    } catch (error) {
        // console.error("Error saving word of the day:", error); // 修正 9: console.error を削除
        alert("今日の一言の保存中にエラーが発生しました。");
    }
}

/**
 * Fetches the current user's "Word of the Day" from Firestore and displays it in the input field.
 */
async function fetchAndDisplayWordOfTheDay() {
    if (!userId || !wordOfTheDayInput) {
        // console.warn("Cannot fetch word of the day: userId or input element missing.");
        if(wordOfTheDayInput) wordOfTheDayInput.value = ""; // Clear input if no user ID
        return;
    }

    const statusRef = doc(db, "work_status", userId);
    try {
        const docSnap = await getDoc(statusRef);

        if (docSnap.exists() && docSnap.data().wordOfTheDay !== undefined) {
             // If document exists and has the field, display it
            wordOfTheDayInput.value = docSnap.data().wordOfTheDay;
        } else {
            // Otherwise, clear the input field
            wordOfTheDayInput.value = "";
        }
    } catch (error) {
        // console.error("Error fetching word of the day:", error); // 修正 10: console.error を削除
        wordOfTheDayInput.value = ""; // Clear input on error
        // Optionally inform the user about the fetch error
    }
}

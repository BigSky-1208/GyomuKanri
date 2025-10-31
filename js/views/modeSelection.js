// js/views/modeSelection.js
import { db, userId, userName, authLevel, showView, VIEWS, adminPasswordView, setAdminLoginDestination } from "../../main.js"; // Import global state and functions
import { handleLogout } from "../okta.js"; // Import logout function (adjust path if using okta.js)
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Import Firestore functions

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
    console.log("Initializing Mode Selection View...");
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
    console.log("Setting up Mode Selection event listeners...");

    // Mode selection buttons
    selectHostButton?.addEventListener("click", () => {
        if (authLevel === "admin") {
            showView(VIEWS.HOST); // Go directly to host view if admin
        } else {
            // Ask for admin password first
            setAdminLoginDestination(VIEWS.HOST); // Tell main.js where to go after login
            if (adminPasswordView) adminPasswordView.classList.remove("hidden");
            else console.error("Admin password view element not found.");
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
            else console.error("Admin password view element not found.");
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
    if (!userId || !wordOfTheDayInput) {
        console.error("Cannot save word of the day: userId or input element missing.");
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
        console.log("Word of the day saved:", word);
        // Optionally show a success message to the user (e.g., using a temporary notification)
        alert("今日の一言を保存しました。");
    } catch (error) {
        console.error("Error saving word of the day:", error);
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
        console.error("Error fetching word of the day:", error);
        wordOfTheDayInput.value = ""; // Clear input on error
        // Optionally inform the user about the fetch error
    }
}

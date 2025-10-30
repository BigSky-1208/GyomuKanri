// js/views/profileSetup.js
import { db, setUserId, setUserName, showView, VIEWS, checkForCheckoutCorrection } from "../../main.js"; // Import global state/functions
import { collection, query, where, getDocs, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Import Firestore functions
// Import functions needed after login (might be called from main.js instead)
// import { listenForUserReservations } from './client/reservations.js';
// import { listenForDisplayPreferences } from './client/clientUI.js'; // Assuming preferences listener setup is moved

// --- DOM Element references ---
const usernameInput = document.getElementById("profile-username");
const saveProfileButton = document.getElementById("save-profile-btn");
const profileError = document.getElementById("profile-error");

/**
 * Initializes the Profile Setup view.
 * (Currently minimal, could add focus to input).
 */
export function initializeProfileSetupView() {
    console.log("Initializing Profile Setup View...");
    if (usernameInput) {
         usernameInput.value = ''; // Clear input on view load
         usernameInput.focus();
    }
     if (profileError) {
         profileError.textContent = ''; // Clear error message
     }
     if (saveProfileButton) {
         // The button might be disabled initially until auth is ready in main.js
         // Ensure it's enabled if needed, though main.js might handle this better.
         // saveProfileButton.disabled = false;
     }
}

/**
 * Sets up event listeners for the Profile Setup view.
 */
export function setupProfileSetupEventListeners() {
    console.log("Setting up Profile Setup event listeners...");
    saveProfileButton?.addEventListener("click", handleLogin);
     // Optional: Add Enter key listener to input field
     usernameInput?.addEventListener('keypress', (event) => {
         if (event.key === 'Enter') {
             handleLogin();
         }
     });
}

/**
 * Handles the login process when the user clicks the "ログイン" button.
 * Validates the username, checks Firestore for existence, updates status,
 * stores user info, and navigates to the mode selection view.
 */
async function handleLogin() {
    // Ensure elements exist
    if (!usernameInput || !profileError || !saveProfileButton) {
        console.error("Profile setup elements not found.");
        return;
    }

    const name = usernameInput.value.trim();
    profileError.textContent = ""; // Clear previous errors
    saveProfileButton.disabled = true; // Disable button during processing
    saveProfileButton.textContent = "ログイン中..."; // Provide feedback

    // --- Input Validation ---
    if (!name) {
        profileError.textContent = "ユーザー名を入力してください。";
        saveProfileButton.disabled = false; // Re-enable button
        saveProfileButton.textContent = "ログイン";
        usernameInput.focus();
        return;
    }
     // Optional: Add whitespace check if needed (though handled in user creation)
     if (/\s/.test(name)) {
         profileError.textContent = "ユーザー名に空白は含めません。";
         saveProfileButton.disabled = false;
         saveProfileButton.textContent = "ログイン";
         usernameInput.focus();
         return;
     }

    // --- Check Firestore for User Profile ---
    const q = query(collection(db, "user_profiles"), where("name", "==", name));
    try {
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            // User does not exist
            profileError.textContent = "このユーザー名は登録されていません。管理者に確認してください。";
            saveProfileButton.disabled = false; // Re-enable button
            saveProfileButton.textContent = "ログイン";
            usernameInput.select(); // Select text for easy correction
        } else {
            // User exists, proceed with login
            const userDoc = querySnapshot.docs[0];
            const profileUserId = userDoc.id; // Get the Firestore document ID as the userId

            console.log(`User found: ${name} (ID: ${profileUserId})`);

            // --- Update Global State and localStorage ---
            setUserId(profileUserId); // Update userId in main.js state
            setUserName(name);        // Update userName in main.js state

            // Store in localStorage for persistence across page loads/refreshes
            localStorage.setItem(
                "workTrackerUser",
                JSON.stringify({ uid: profileUserId, name: name })
            );

            // --- Update Firestore Status ---
            const statusRef = doc(db, "work_status", profileUserId);
            // Set online status and ensure userName is up-to-date in status doc
            await setDoc(
                statusRef,
                { userName: name, onlineStatus: true, userId: profileUserId }, // Also store userId in status for easier querying
                { merge: true } // Merge to avoid overwriting existing status fields (like isWorking)
            );
            console.log(`Status updated for user ${name}.`);

            // --- Post-Login Actions ---
            await checkForCheckoutCorrection(profileUserId); // Check if correction is needed

            // Trigger listeners/initialization needed after login (handled in main.js?)
            // For example, main.js's onAuthStateChanged might now trigger these based on userId being set:
            // listenForUserReservations();
            // listenForDisplayPreferences();

            // --- Navigate to Next View ---
            showView(VIEWS.MODE_SELECTION);

            // No need to re-enable button here as we are navigating away
        }

    } catch (error) {
        console.error("Error during login check:", error);
        profileError.textContent = "ログイン処理中にエラーが発生しました。";
        saveProfileButton.disabled = false; // Re-enable button on error
        saveProfileButton.textContent = "ログイン";
    }
}

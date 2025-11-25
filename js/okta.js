// js/okta.js
import { db, setUserId, setUserName, setAuthLevel, showView, VIEWS, listenForDisplayPreferences, updateGlobalTaskObjects } from './main.js'; 
// ★修正: checkForCheckoutCorrection は utils.js からインポート
import { checkForCheckoutCorrection } from './utils.js'; 

// Import Okta Sign-In Widget CSS (make sure index.html includes the JS)
// Note: Okta Auth JS SDK is typically included via CDN in index.html for widget usage
// If using npm: import OktaSignIn from '@okta/okta-signin-widget';
//              import { OktaAuth } from '@okta/okta-auth-js';

import { collection, query, where, getDocs, doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Okta Configuration (Replace with your actual values) ---
const OKTA_DOMAIN = "YOUR_OKTA_DOMAIN"; // 例: dev-123456.okta.com
const CLIENT_ID = "YOUR_CLIENT_ID";     // OktaアプリケーションのClient ID
const REDIRECT_URI = window.location.origin + window.location.pathname; // 通常はアプリのルートURL
const ISSUER = `https://${OKTA_DOMAIN}/oauth2/default`; // 例: https://dev-123456.okta.com/oauth2/default (Authorization Server)
// Scope for requesting user info and groups
const SCOPES = ['openid', 'profile', 'email', 'groups']; // 'groups' を追加してグループ情報を要求

// Okta Auth JS Client Initialization
const oktaAuthClient = new OktaAuth({
    issuer: ISSUER,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    scopes: SCOPES,
    pkce: true // Recommended for SPAs
});

// Okta Sign-In Widget Initialization
const signInWidget = new OktaSignIn({
    baseUrl: `https://${OKTA_DOMAIN}`,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    authClient: oktaAuthClient, // Use the same Auth JS client
    authParams: {
        issuer: ISSUER,
        scopes: SCOPES,
        pkce: true
    },
    features: {
        // Registration, Password Recoveryなどの機能を有効/無効にする場合
        // registration: true,
    },
    // logo: '/path/to/your/logo.png', // Optional: Custom logo
    // brandName: 'Your Application Name' // Optional: Custom brand name
});

// --- Authentication Functions ---

/**
 * Renders the Okta Sign-In Widget in the specified container.
 * Handles login success by redirecting or using tokens.
 */
export function renderSignInWidget() {
    const widgetContainer = document.getElementById('okta-signin-widget-container');
    const appContainer = document.getElementById('app-container');

    if (!widgetContainer || !appContainer) {
        console.error("Okta widget container or app container not found.");
        return;
    }

    // Hide main app, show widget container
    appContainer.classList.add('hidden');
    widgetContainer.classList.remove('hidden');

    signInWidget.showSignInToGetTokens({
        el: '#okta-signin-widget-container',
        scopes: SCOPES
    }).then(tokens => {
        // Handle successful sign-in, store tokens, get user info
        console.log("Okta Sign-In Widget success:", tokens);
        signInWidget.remove(); // Remove widget after success
        oktaAuthClient.tokenManager.setTokens(tokens);
        handleOktaLoginSuccess(); // Process login and navigate
    }).catch(error => {
        // Handle errors (e.g., invalid credentials, network issues)
        console.error("Okta Sign-In Widget error:", error);
        // Optionally display an error message to the user
        widgetContainer.innerHTML = `<p class="text-red-500 text-center">ログインエラー: ${error.message || '不明なエラー'}</p>`;
    });
}

/**
 * Checks for existing Okta session or handles token redirect.
 * Called on application initialization.
 */
export async function checkOktaAuthentication() {
    console.log("Checking Okta authentication status...");
    try {
        // Handle redirect from Okta if tokens are in the URL
        if (oktaAuthClient.isLoginRedirect()) {
            console.log("Handling Okta redirect...");
            await oktaAuthClient.handleLoginRedirect(); // Parses tokens from URL
             // No need to manually set tokens here, handleLoginRedirect does it.
             console.log("Redirect handled.");
             // Proceed to login success handling
        }

        // Check if a session already exists or tokens are now available
        const isAuthenticated = await oktaAuthClient.isAuthenticated();
        console.log("Is Authenticated:", isAuthenticated);

        if (isAuthenticated) {
            console.log("User is authenticated with Okta.");
            await handleOktaLoginSuccess(); // Process login
        } else {
            console.log("User is not authenticated. Rendering Sign-In Widget.");
            renderSignInWidget(); // Show login widget if not authenticated
        }
    } catch (error) {
        console.error("Error during Okta authentication check:", error);
        // Fallback to rendering the widget in case of errors
        renderSignInWidget();
    }
}


/**
 * Processes successful Okta authentication.
 * Fetches user info, finds/creates Firestore profile, updates state, and navigates.
 */
async function handleOktaLoginSuccess() {
    try {
        // 1. Get user claims from Okta (includes profile info and groups)
        const userClaims = await oktaAuthClient.getUser();
        console.log("Okta User Claims:", userClaims);

        const oktaEmail = userClaims.email;
        const oktaName = userClaims.name || oktaEmail; // Fallback to email if name is not available
        const oktaUserId = userClaims.sub; // Okta's unique user ID (subject)
        const oktaGroups = userClaims.groups || []; // User's Okta groups

        if (!oktaEmail) {
             throw new Error("Email not found in Okta user claims.");
        }


        // 2. Determine Application `userId` and `userName` based on Okta info
        //    **Crucial Step**: Link Okta user to Firestore `user_profiles` document.
        //    Strategy: Query Firestore `user_profiles` by email (assuming email is unique).
        //    If found, use that document's ID as the application `userId`.
        //    If not found, report error (as per previous logic requiring existing profile).
        let appUserId = null;
        let appUserName = oktaName; // Use Okta name by default, might be overwritten by profile

        const profileQuery = query(collection(db, "user_profiles"), where("email", "==", oktaEmail)); // Assuming 'email' field exists in Firestore profiles
        const profileSnapshot = await getDocs(profileQuery);

        if (!profileSnapshot.empty) {
            // Found existing profile matching Okta email
            const userDoc = profileSnapshot.docs[0];
            appUserId = userDoc.id;
            appUserName = userDoc.data().name || appUserName; // Prefer name from Firestore profile
            console.log(`Linked Okta user ${oktaEmail} to existing Firestore profile ID: ${appUserId}, Name: ${appUserName}`);

             // Optional: Store Okta User ID in the Firestore profile for future reference/lookup
             await updateDoc(doc(db, "user_profiles", appUserId), { oktaUserId: oktaUserId });


        } else {
            // No matching profile found in Firestore for this Okta email.
            // **Action Required**: Decide how to handle this.
            // Option A: Deny login, show error.
            console.error(`No Firestore user_profile found for Okta email: ${oktaEmail}. Login denied.`);
            alert(`ログインエラー: Oktaアカウント (${oktaEmail}) に紐づく業務管理アプリのユーザーが見つかりません。管理者に連絡してください。`);
            await handleOktaLogout(); // Log out from Okta session
            return; // Stop login process

            // Option B: Auto-create profile (If desired, implement carefully)
            /*
            console.log(`Creating new Firestore profile for Okta user: ${oktaEmail}`);
            const newUserProfile = {
                name: appUserName, // Use Okta name
                email: oktaEmail, // Store email for future lookup
                oktaUserId: oktaUserId, // Store Okta ID
                createdAt: Timestamp.now(),
                // createdBy: 'Okta Auto-Registration' // Indicate source
            };
            const docRef = await addDoc(collection(db, "user_profiles"), newUserProfile);
            appUserId = docRef.id;
            console.log(`Created new profile with ID: ${appUserId}`);
            */
        }

        // 3. Determine Auth Level based on Okta Groups
        let appAuthLevel = 'none';
        if (oktaGroups.includes('Admin')) { // Check if user is in 'Admin' group
            appAuthLevel = 'admin';
        } else if (oktaGroups.includes('TaskEditor')) { // Check if user is in 'TaskEditor' group
            appAuthLevel = 'task_editor';
        }
        console.log("Determined Auth Level:", appAuthLevel, "based on groups:", oktaGroups);
        setAuthLevel(appAuthLevel); // Update global authLevel state in main.js

        // 4. Update Global State and localStorage
        setUserId(appUserId);
        setUserName(appUserName);
        localStorage.setItem("workTrackerUser", JSON.stringify({ uid: appUserId, name: appUserName }));

        // 5. Update Firestore Status (Mark as online)
        const statusRef = doc(db, "work_status", appUserId);
        await setDoc(statusRef, { userName: appUserName, onlineStatus: true, userId: appUserId }, { merge: true });

        // 6. Post-Login Actions (like checking for checkout correction)
        await checkForCheckoutCorrection(appUserId);
        listenForDisplayPreferences(); // Start listening for user-specific settings

        // 7. Show the main application UI and navigate
        const widgetContainer = document.getElementById('okta-signin-widget-container');
        const appContainer = document.getElementById('app-container');
        if (widgetContainer) widgetContainer.classList.add('hidden'); // Hide widget
        if (appContainer) appContainer.classList.remove('hidden'); // Show app

        showView(VIEWS.MODE_SELECTION); // Navigate to mode selection screen

    } catch (error) {
        console.error("Error processing Okta login success:", error);
        alert(`ログイン処理中にエラーが発生しました: ${error.message}`);
        // Attempt to log out cleanly if processing failed
        await handleOktaLogout();
    }
}


/**
 * Handles user logout from Okta and the application.
 */
export async function handleOktaLogout() {
    console.log("Handling Okta logout...");
    const widgetContainer = document.getElementById('okta-signin-widget-container');
    const appContainer = document.getElementById('app-container');

    try {
        // const userIdToLogout = userId; // Get current userId before clearing state (imported from main.js)
        // userId is imported from main.js, assume it's current

        // Mark user as offline in Firestore *before* signing out
        /*
        if (userId) {
            const statusRef = doc(db, "work_status", userId);
            await updateDoc(statusRef, { onlineStatus: false }); // Don't merge, just update online status
             console.log(`User ${userName} marked as offline.`);
        }
        */

        // Sign out from Okta session
        await oktaAuthClient.signOut();
        console.log("Signed out from Okta.");

    } catch (error) {
        console.error("Error during Okta sign out or Firestore update:", error);
        // Continue cleanup even if sign out fails
    } finally {
        // Clear tokens and local storage regardless of sign-out success
        oktaAuthClient.tokenManager.clear();
        localStorage.removeItem("workTrackerUser");
        console.log("Cleared Okta tokens and localStorage.");

        // Reset global application state
        setUserId(null);
        setUserName(null);
        setAuthLevel('none'); // Reset auth level
        // viewHistory = []; // Optionally clear view history

        // Hide app container, show widget container (or redirect)
        if (appContainer) appContainer.classList.add('hidden');
        if (widgetContainer) widgetContainer.classList.remove('hidden');

        // Re-render the sign-in widget to allow logging in again
        renderSignInWidget();
    }
}

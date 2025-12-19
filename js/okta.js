// js/okta.js

// ★修正: インポート名を fetchDisplayPreferences に変更
import { db, setUserId, setUserName, setAuthLevel, showView, VIEWS, fetchDisplayPreferences, updateGlobalTaskObjects } from './main.js'; 
import { checkForCheckoutCorrection } from './utils.js'; 
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { oktaConfig } from "./config.js";

// --- Okta Configuration ---
const OKTA_DOMAIN = oktaConfig.domain; 
const CLIENT_ID = oktaConfig.clientId;
const REDIRECT_URI = window.location.origin + window.location.pathname; 
const ISSUER = `https://${OKTA_DOMAIN}`;
const SCOPES = ['openid', 'profile', 'email', 'groups']; 

let oktaAuthClient;
let signInWidget;

let onLoginSuccessCallback = null;

function initializeOkta() {
    const OktaAuth = window.OktaAuth;
    const OktaSignIn = window.OktaSignIn;

    if (!OktaAuth || !OktaSignIn) {
        console.error("Okta SDKs are not loaded.");
        return false;
    }
    
    if (!OKTA_DOMAIN || !CLIENT_ID) {
        console.warn("Okta config is missing.");
        return false;
    }

    oktaAuthClient = new OktaAuth({
        issuer: ISSUER,
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        scopes: SCOPES,
        pkce: true
    });

    signInWidget = new OktaSignIn({
        baseUrl: `https://${OKTA_DOMAIN}`,
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        useInteractionCodeFlow: false, 
        useClassicEngine: true,
        authClient: oktaAuthClient,
        authParams: {
            issuer: ISSUER,
            scopes: SCOPES,
            pkce: true
        }
    });
    return true;
}

export function renderSignInWidget(successCallback) {
    if (successCallback) onLoginSuccessCallback = successCallback;

    if (!oktaAuthClient && !initializeOkta()) {
        const widgetContainer = document.getElementById('okta-signin-widget-container');
        if (widgetContainer) widgetContainer.innerHTML = '<p class="text-red-500 text-center">Okta設定の読み込みに失敗しました。</p>';
        return;
    }

    const widgetContainer = document.getElementById('okta-signin-widget-container');
    const appContainer = document.getElementById('app-container');

    if (!widgetContainer || !appContainer) return;

    appContainer.classList.add('hidden');
    widgetContainer.classList.remove('hidden');

    signInWidget.showSignInToGetTokens({
        el: '#okta-signin-widget-container',
        scopes: SCOPES
    }).then(tokens => {
        signInWidget.remove();
        oktaAuthClient.tokenManager.setTokens(tokens);
        handleOktaLoginSuccess();
    }).catch(error => {
        console.error("Okta Sign-In Widget error:", error);
        widgetContainer.innerHTML = `<p class="text-red-500 text-center">ログインエラー: ${error.message}</p>`;
    });
}

export async function checkOktaAuthentication(successCallback) {
    console.log("Checking Okta authentication status...");
    if (successCallback) onLoginSuccessCallback = successCallback;
    
    if (!initializeOkta()) {
        console.warn("Okta initialization failed.");
        return;
    }

    try {
        if (oktaAuthClient.isLoginRedirect()) {
            await oktaAuthClient.handleLoginRedirect();
        }

        const isAuthenticated = await oktaAuthClient.isAuthenticated();

        if (isAuthenticated) {
            await handleOktaLoginSuccess();
        } else {
            renderSignInWidget(successCallback);
        }
    } catch (error) {
        console.error("Error during Okta authentication check:", error);
        renderSignInWidget(successCallback);
    }
}

async function handleOktaLoginSuccess() {
    try {
        const userClaims = await oktaAuthClient.getUser();
        console.log("Okta User Claims:", userClaims);

        const oktaEmail = userClaims.email;
        const oktaUserId = userClaims.sub;
        const oktaGroups = userClaims.groups || [];

        let oktaName = userClaims.name;
        if (userClaims.family_name || userClaims.given_name) {
            oktaName = `${userClaims.family_name || ''}${userClaims.given_name || ''}`.trim();
        }
        if (!oktaName) oktaName = oktaEmail;

        let appUserId = null;
        let appUserName = oktaName;

        let profileQuery = query(collection(db, "user_profiles"), where("email", "==", oktaEmail));
        let profileSnapshot = await getDocs(profileQuery);

        if (profileSnapshot.empty) {
            profileQuery = query(collection(db, "user_profiles"), where("name", "==", oktaName));
            profileSnapshot = await getDocs(profileQuery);
        }

        if (!profileSnapshot.empty) {
            const userDoc = profileSnapshot.docs[0];
            appUserId = userDoc.id;
            appUserName = userDoc.data().name || appUserName;
            
            const updateData = { oktaUserId: oktaUserId };
            if (!userDoc.data().email) updateData.email = oktaEmail;
            await updateDoc(doc(db, "user_profiles", appUserId), updateData);

        } else {
            alert(`ログインエラー: ユーザー登録が見つかりません。\nEmail: ${oktaEmail}\nName: ${oktaName}`);
            return;
        }

        let appAuthLevel = 'none';
        if (oktaGroups.includes('Admin')) appAuthLevel = 'admin';
        else if (oktaGroups.includes('TaskEditor')) appAuthLevel = 'task_editor';
        
        setAuthLevel(appAuthLevel);
        setUserId(appUserId);
        setUserName(appUserName);
        localStorage.setItem("workTrackerUser", JSON.stringify({ uid: appUserId, name: appUserName }));

        const statusRef = doc(db, "work_status", appUserId);
        await setDoc(statusRef, { userName: appUserName, onlineStatus: true, userId: appUserId }, { merge: true });

        await checkForCheckoutCorrection(appUserId);
        
        // ★修正: 監視用関数ではなく、取得用関数を呼ぶ
        await fetchDisplayPreferences();

        const widgetContainer = document.getElementById('okta-signin-widget-container');
        const appContainer = document.getElementById('app-container');
        if (widgetContainer) widgetContainer.classList.add('hidden');
        if (appContainer) appContainer.classList.remove('hidden');

        if (onLoginSuccessCallback) {
            console.log("Executing post-login callback...");
            onLoginSuccessCallback();
        }

        showView(VIEWS.MODE_SELECTION);

    } catch (error) {
        console.error("Error processing Okta login success:", error);
        alert(`ログイン処理エラー: ${error.message}`);
    }
}

export async function handleOktaLogout() {
    const LAST_VIEW_KEY = "gyomu_timer_last_view";
    localStorage.removeItem(LAST_VIEW_KEY);
    const widgetContainer = document.getElementById('okta-signin-widget-container');
    const appContainer = document.getElementById('app-container');

    if (!oktaAuthClient && !initializeOkta()) {
         localStorage.removeItem("workTrackerUser");
         window.location.reload();
         return;
    }

    try {
        await oktaAuthClient.signOut();
    } catch (error) {
        console.error("Error during Okta sign out:", error);
    } finally {
        if (oktaAuthClient) oktaAuthClient.tokenManager.clear();
        localStorage.removeItem("workTrackerUser");
        
        setUserId(null);
        setUserName(null);
        setAuthLevel('none');

        if (appContainer) appContainer.classList.add('hidden');
        if (widgetContainer) widgetContainer.classList.remove('hidden');
        
        renderSignInWidget(null);
    }
}

// js/okta.js
// ★修正: checkForCheckoutCorrection を utils.js からインポート (main.jsからは削除)
import { db, setUserId, setUserName, setAuthLevel, showView, VIEWS, listenForDisplayPreferences, updateGlobalTaskObjects } from './main.js'; 
import { checkForCheckoutCorrection } from './utils.js'; 
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ★生成された config.js から設定を読み込む
import { oktaConfig } from "./config.js";

// --- Okta Configuration ---
const OKTA_DOMAIN = oktaConfig.domain; 
const CLIENT_ID = oktaConfig.clientId;
const REDIRECT_URI = window.location.origin + window.location.pathname; 
// ★修正: /oauth2/default を削除して、Org Authorization Server を使用するように変更
// const ISSUER = `https://${OKTA_DOMAIN}/oauth2/default`; 
const ISSUER = `https://${OKTA_DOMAIN}`;
const SCOPES = ['openid', 'profile', 'email', 'groups']; 

// Okta Client & Widget Variables
let oktaAuthClient;
let signInWidget;

// 初期化関数（グローバル変数のOktaAuth/OktaSignInを使用）
function initializeOkta() {
    const OktaAuth = window.OktaAuth;
    const OktaSignIn = window.OktaSignIn;

    if (!OktaAuth || !OktaSignIn) {
        console.error("Okta SDKs are not loaded.");
        return false;
    }
    
    if (!OKTA_DOMAIN || !CLIENT_ID) {
        console.warn("Okta config is missing. Please check environment variables.");
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
        // ★修正: Interaction Code をサーバー側で許可するため、クライアント側の無効化設定は削除します
        // useInteractionCodeFlow: false, 
        authClient: oktaAuthClient,
        authParams: {
            issuer: ISSUER,
            scopes: SCOPES,
            pkce: true
        }
    });
    return true;
}

// --- Authentication Functions ---

export function renderSignInWidget() {
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

export async function checkOktaAuthentication() {
    console.log("Checking Okta authentication status...");
    
    if (!initializeOkta()) {
        console.warn("Okta initialization failed, skipping auth check.");
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
            renderSignInWidget();
        }
    } catch (error) {
        console.error("Error during Okta authentication check:", error);
        renderSignInWidget();
    }
}

async function handleOktaLoginSuccess() {
    try {
        const userClaims = await oktaAuthClient.getUser();
        const oktaEmail = userClaims.email;
        const oktaName = userClaims.name || oktaEmail;
        const oktaUserId = userClaims.sub;
        const oktaGroups = userClaims.groups || [];

        let appUserId = null;
        let appUserName = oktaName;

        const profileQuery = query(collection(db, "user_profiles"), where("email", "==", oktaEmail));
        const profileSnapshot = await getDocs(profileQuery);

        if (!profileSnapshot.empty) {
            const userDoc = profileSnapshot.docs[0];
            appUserId = userDoc.id;
            appUserName = userDoc.data().name || appUserName;
            await updateDoc(doc(db, "user_profiles", appUserId), { oktaUserId: oktaUserId });
        } else {
            console.error(`No Firestore user_profile found for ${oktaEmail}.`);
            alert(`ログインエラー: ユーザーが見つかりません。`);
            await handleOktaLogout();
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
        listenForDisplayPreferences();

        const widgetContainer = document.getElementById('okta-signin-widget-container');
        const appContainer = document.getElementById('app-container');
        if (widgetContainer) widgetContainer.classList.add('hidden');
        if (appContainer) appContainer.classList.remove('hidden');

        showView(VIEWS.MODE_SELECTION);

    } catch (error) {
        console.error("Error processing Okta login success:", error);
        alert(`ログイン処理エラー: ${error.message}`);
        await handleOktaLogout();
    }
}

export async function handleOktaLogout() {
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
        
        renderSignInWidget();
    }
}

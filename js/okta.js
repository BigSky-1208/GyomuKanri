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
        // ★修正: Interaction Code Flow を確実に無効化するための設定
        useInteractionCodeFlow: false, 
        useClassicEngine: true, // ★追加: これにより強制的に標準のOIDCフロー(Classic)を使用させます
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
        console.log("Okta User Claims:", userClaims); // ★デバッグ用: 取得したクレームを出力

        const oktaEmail = userClaims.email;
        const oktaUserId = userClaims.sub;
        const oktaGroups = userClaims.groups || [];

        // --- 名前決定ロジックの修正 ---
        // デフォルトは name クレームを使用
        let oktaName = userClaims.name;

        // もし family_name や given_name があれば、それらを結合して使用する（優先度高）
        // ★修正: 空白なしで結合するように変更
        if (userClaims.family_name || userClaims.given_name) {
            oktaName = `${userClaims.family_name || ''}${userClaims.given_name || ''}`.trim();
        }

        // それでも名前が空ならメールアドレスをフォールバックとして使用
        if (!oktaName) {
            oktaName = oktaEmail;
        }
        // -----------------------------

        let appUserId = null;
        let appUserName = oktaName;

        // ★修正: まずEmailで検索
        let profileQuery = query(collection(db, "user_profiles"), where("email", "==", oktaEmail));
        let profileSnapshot = await getDocs(profileQuery);

        // ★追加: Emailで見つからなければ、結合した名前で再検索
        if (profileSnapshot.empty) {
            console.log(`User not found by email (${oktaEmail}). Trying search by name: ${oktaName}`);
            profileQuery = query(collection(db, "user_profiles"), where("name", "==", oktaName));
            profileSnapshot = await getDocs(profileQuery);
        }

        if (!profileSnapshot.empty) {
            // 既存ユーザーの場合
            const userDoc = profileSnapshot.docs[0];
            appUserId = userDoc.id;
            
            // ★シンプルに「登録済みならその名前を使う」場合:
            appUserName = userDoc.data().name || appUserName;

            // Okta IDを紐付け
            // もしEmailが登録されていなければ、次回のためにEmailも保存しておく
            const updateData = { oktaUserId: oktaUserId };
            if (!userDoc.data().email) {
                updateData.email = oktaEmail;
            }
            await updateDoc(doc(db, "user_profiles", appUserId), updateData);

        } else {
            // 新規ユーザーの場合（自動登録する場合）
            console.error(`No Firestore user_profile found for ${oktaEmail} or name ${oktaName}.`);
            
            // ★変更箇所: エラー発生時にログアウトせず、アラート後に停止させる
            alert(`ログインエラー: ユーザー登録が見つかりません。\n\n管理者に以下の情報を伝えて登録を依頼してください。\nEmail: ${oktaEmail}\nName: ${oktaName}\n(このまま画面を閉じてもログアウトされません。確認用に残しています)`);
            
            // エラー表示用にUIを切り替えるなどの処理を追加しても良いですが、
            // 今回は console.log と alert だけで停止させます。
            // await handleOktaLogout(); // ← これをコメントアウトして実行を停止
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
        // ★ここもコメントアウトしてエラー状態で止める場合
        // await handleOktaLogout(); 
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

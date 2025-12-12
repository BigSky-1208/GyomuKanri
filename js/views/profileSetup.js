// js/views/profileSetup.js
import { db, setUserId, setUserName, showView, VIEWS } from "../../main.js"; 
import { checkForCheckoutCorrection } from "../../utils.js"; 
// ★追加: addDoc をインポート
import { collection, query, where, getDocs, doc, setDoc, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; 

// --- DOM Element references ---
const usernameInput = document.getElementById("profile-username");
const saveProfileButton = document.getElementById("save-profile-btn");
const profileError = document.getElementById("profile-error");

/**
 * Initializes the Profile Setup view.
 */
export function initializeProfileSetupView() {
    console.log("Initializing Profile Setup View...");
    if (usernameInput) {
         usernameInput.value = ''; 
         usernameInput.focus();
    }
     if (profileError) {
         profileError.textContent = ''; 
     }
}

/**
 * Sets up event listeners for the Profile Setup view.
 */
export function setupProfileSetupEventListeners() {
    console.log("Setting up Profile Setup event listeners...");
    saveProfileButton?.addEventListener("click", handleLogin);
     usernameInput?.addEventListener('keypress', (event) => {
         if (event.key === 'Enter') {
             handleLogin();
         }
     });
}

/**
 * Handles the login process.
 * ★修正: ユーザーが存在しない場合は自動作成する
 */
async function handleLogin() {
    if (!usernameInput || !profileError || !saveProfileButton) {
        console.error("Profile setup elements not found.");
        return;
    }

    const name = usernameInput.value.trim();
    profileError.textContent = ""; 
    saveProfileButton.disabled = true; 
    saveProfileButton.textContent = "ログイン中..."; 

    if (!name) {
        profileError.textContent = "ユーザー名を入力してください。";
        saveProfileButton.disabled = false; 
        saveProfileButton.textContent = "ログイン";
        usernameInput.focus();
        return;
    }
     if (/\s/.test(name)) {
         profileError.textContent = "ユーザー名に空白は含めません。";
         saveProfileButton.disabled = false;
         saveProfileButton.textContent = "ログイン";
         usernameInput.focus();
         return;
     }

    // --- Check Firestore for User Profile ---
    const q = query(collection(db, "user_profiles"), where("name", "==", name)); // 'displayName' ではなく 'name' で検索している前提
    try {
        const querySnapshot = await getDocs(q);
        let profileUserId = null;

        if (querySnapshot.empty) {
            // ★変更: ユーザーが存在しない場合、新規作成する
            console.log(`User not found: ${name}. Creating new profile...`);
            
            const newUserRef = await addDoc(collection(db, "user_profiles"), {
                name: name,
                displayName: name, // 表示名としても使用
                role: "client", // デフォルト権限
                createdAt: new Date()
            });
            profileUserId = newUserRef.id;
            console.log(`New user created with ID: ${profileUserId}`);

        } else {
            // ユーザーが存在する場合
            const userDoc = querySnapshot.docs[0];
            profileUserId = userDoc.id; 
            console.log(`User found: ${name} (ID: ${profileUserId})`);
        }

        // --- 以下、ログイン共通処理 ---

        // Update Global State and localStorage
        setUserId(profileUserId); 
        setUserName(name);        

        localStorage.setItem(
            "workTrackerUser",
            JSON.stringify({ uid: profileUserId, name: name })
        );

        // Update Firestore Status
        const statusRef = doc(db, "work_status", profileUserId);
        await setDoc(
            statusRef,
            { userName: name, onlineStatus: true, userId: profileUserId }, 
            { merge: true } 
        );
        console.log(`Status updated for user ${name}.`);

        // Post-Login Actions
        await checkForCheckoutCorrection(profileUserId); 

        // Navigate to Next View
        showView(VIEWS.MODE_SELECTION);

    } catch (error) {
        console.error("Error during login/creation:", error);
        profileError.textContent = "ログイン処理中にエラーが発生しました。";
        saveProfileButton.disabled = false; 
        saveProfileButton.textContent = "ログイン";
    }
}

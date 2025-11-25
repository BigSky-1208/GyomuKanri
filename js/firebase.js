// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// ★生成された config.js から設定を読み込む
import { firebaseConfig } from "./config.js";

// --- Firebase Initialization and Exports ---
let app;
let db;
let auth;
let initializationError = null;

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("Firebase initialized successfully.");
} catch (error) {
    console.error("Firebase Initialization Error in firebase.js:", error);
    initializationError = error;
}

export { app, db, auth, firebaseConfig, initializationError };

/**
 * Checks if the Firebase configuration is valid.
 */
export function isFirebaseConfigValid() {
    return firebaseConfig &&
           firebaseConfig.apiKey &&
           !firebaseConfig.apiKey.startsWith("YOUR_") && // 環境変数がセットされていない場合のチェック
           firebaseConfig.projectId;
}

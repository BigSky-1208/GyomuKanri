// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// ローカル設定の読み込み（フォールバック用）
import { firebaseConfig as localConfig } from "./config.js";

// --- Configuration Setup ---
let firebaseConfig;

// 1. プレビュー環境の自動設定を確認
if (typeof __firebase_config !== 'undefined') {
    try {
        firebaseConfig = JSON.parse(__firebase_config);
        console.log("Using preview environment Firebase config.");
    } catch (e) {
        console.error("Failed to parse __firebase_config:", e);
        firebaseConfig = localConfig;
    }
} else {
    // 2. ローカル/本番環境（Cloudflare Pagesなど）の場合は config.js を使用
    firebaseConfig = localConfig;
}

// --- Firebase Initialization ---
let app;
let db;
let auth;
let initializationError = null;

try {
    if (!firebaseConfig || !firebaseConfig.apiKey) {
        throw new Error("Firebase config is missing or invalid.");
    }
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

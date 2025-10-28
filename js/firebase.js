// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js"; // Auth is still needed for anonymous sign-in initially

// --- Firebase Configuration ---
// IMPORTANT: Replace with your actual Firebase configuration
// Consider moving this to a separate configuration file and adding it to .gitignore
const firebaseConfig = {
    apiKey: "YOUR_API_KEY", // Replace with your actual API key
    authDomain: "YOUR_AUTH_DOMAIN", // Replace with your actual auth domain
    projectId: "YOUR_PROJECT_ID", // Replace with your actual project ID
    storageBucket: "YOUR_STORAGE_BUCKET", // Replace with your actual storage bucket
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // Replace with your actual sender ID
    appId: "YOUR_APP_ID", // Replace with your actual app ID
    measurementId: "YOUR_MEASUREMENT_ID" // Optional: Replace with your actual measurement ID
};

// --- Firebase Initialization and Exports ---
let app;
let db;
let auth;

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app); // Initialize Auth, still needed for potential anonymous sign-in or other Firebase services
    console.log("Firebase initialized successfully.");
} catch (error) {
    console.error("Firebase Initialization Error:", error);
    // Handle initialization error (e.g., display message to user)
    // You might want to stop the application or show an error state
    alert("Firebaseの初期化に失敗しました。設定を確認してください。");
    // Optionally throw the error again if you want calling modules to handle it
    // throw error;
}

// Export the initialized instances for use in other modules
// Ensure instances are exported even if initialization failed,
// but they might be undefined, so check in consuming modules.
export { app, db, auth, firebaseConfig }; // Export config too if needed elsewhere

/**
 * Checks if the Firebase configuration is valid (basic check).
 * @returns {boolean} True if config seems valid, false otherwise.
 */
export function isFirebaseConfigValid() {
    return firebaseConfig &&
           firebaseConfig.apiKey &&
           !firebaseConfig.apiKey.startsWith("YOUR_") && // Basic check if placeholders are replaced
           firebaseConfig.projectId &&
           !firebaseConfig.projectId.startsWith("YOUR_");
}

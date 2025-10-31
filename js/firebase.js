// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// AuthはOkta移行後もFirestoreルール等で必要になる可能性があるので残す
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

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
let initializationError = null; // Store initialization error

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app); // Initialize Auth
    console.log("Firebase initialized successfully in firebase.js.");
} catch (error) {
    console.error("Firebase Initialization Error in firebase.js:", error);
    initializationError = error; // Store the error
    // Don't alert here, let main.js handle UI feedback if needed
}

// Export the initialized instances (even if null/undefined on error)
export { app, db, auth, firebaseConfig, initializationError };

/**
 * Checks if the Firebase configuration is valid (basic check).
 * @returns {boolean} True if config seems valid, false otherwise.
 */
export function isFirebaseConfigValid() {
    return firebaseConfig &&
           firebaseConfig.apiKey &&
           !firebaseConfig.apiKey.startsWith("YOUR_") &&
           firebaseConfig.projectId &&
           !firebaseConfig.projectId.startsWith("YOUR_");
}


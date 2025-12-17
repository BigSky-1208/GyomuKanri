const fs = require('fs');

// --- 診断用ログ出力 ---
console.log("--- [DEBUG] Environment Variable Check ---");
console.log("FIREBASE_API_KEY exists:", !!process.env.FIREBASE_API_KEY);
console.log("VAPID_KEY exists:", !!process.env.VAPID_KEY); // ★追加: 確認用ログ
console.log("------------------------------------------");

// ★修正: fcmConfig を追加
const configContent = `
export const firebaseConfig = {
    apiKey: "${process.env.FIREBASE_API_KEY || ''}",
    authDomain: "${process.env.FIREBASE_AUTH_DOMAIN || ''}",
    projectId: "${process.env.FIREBASE_PROJECT_ID || ''}",
    storageBucket: "${process.env.FIREBASE_STORAGE_BUCKET || ''}",
    messagingSenderId: "${process.env.FIREBASE_MESSAGING_SENDER_ID || ''}",
    appId: "${process.env.FIREBASE_APP_ID || ''}",
    measurementId: "${process.env.FIREBASE_MEASUREMENT_ID || ''}"
};

export const oktaConfig = {
    domain: "${process.env.OKTA_DOMAIN || ''}",
    clientId: "${process.env.OKTA_CLIENT_ID || ''}"
};

export const groqConfig = {
    apiKey: "${process.env.GROQ_API_KEY || ''}"
};

export const fcmConfig = {
    vapidKey: "${process.env.VAPID_KEY || ''}"
};
`;

// ... (以下変更なし)
if (!fs.existsSync('./js')) {
    fs.mkdirSync('./js');
}

fs.writeFileSync('./js/config.js', configContent);
console.log('js/config.js generated successfully.');

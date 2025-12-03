const fs = require('fs');

// --- 診断用ログ出力 (キーの値は見せずに、設定されているかだけ確認) ---
console.log("--- [DEBUG] Environment Variable Check ---");
console.log("FIREBASE_API_KEY exists:", !!process.env.FIREBASE_API_KEY); // trueならOK, falseなら空
console.log("OKTA_DOMAIN exists:", !!process.env.OKTA_DOMAIN);
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("------------------------------------------");

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
`;

// js/config.js ファイルを生成
// ディレクトリが存在しない場合の対策も念のため追加
if (!fs.existsSync('./js')) {
    fs.mkdirSync('./js');
}

fs.writeFileSync('./js/config.js', configContent);
console.log('js/config.js generated successfully.');

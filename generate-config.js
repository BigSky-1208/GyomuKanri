const fs = require('fs');

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

// js/config.js ファイルを生成（なければ作成、あれば上書き）
fs.writeFileSync('./js/config.js', configContent);
console.log('js/config.js generated from environment variables.');

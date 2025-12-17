import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getMessaging, onBackgroundMessage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js";

// ★ここが変更点: 生成済みの config.js をインポートする
import { firebaseConfig } from './js/config.js';

// initializeApp にインポートした config を渡す
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// バックグラウンド通知の処理（変更なし）
onBackgroundMessage(messaging, (payload) => {
    console.log('[firebase-messaging-sw.js] Background message: ', payload);
    
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/512.pngs32.png', // アイコンファイル名に合わせて修正
        badge: '/512.pngs32.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

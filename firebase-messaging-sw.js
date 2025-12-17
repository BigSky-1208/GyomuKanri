// ★ESMのimportではなく、importScriptsを使用
importScripts("https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js");

// ★URLパラメータから設定値を取り出す
const params = new URLSearchParams(self.location.search);
const config = Object.fromEntries(params);

// Firebase初期化 (compat版なので firebase.initializeApp を使う)
firebase.initializeApp(config);

const messaging = firebase.messaging();

// バックグラウンド通知ハンドラ
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Background message: ', payload);
    
    // 通知の表示
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/512.pngs32.png',
        badge: '/512.pngs32.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

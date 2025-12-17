import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js";
import { app, db, auth } from "./firebase.js";
import { doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { fcmConfig, firebaseConfig } from "./config.js"; // ★firebaseConfigもインポート

const messaging = getMessaging(app);
const VAPID_KEY = fcmConfig.vapidKey;

export async function initMessaging() {
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('通知の許可が拒否されました。');
            return;
        }

        let registration;
        if ('serviceWorker' in navigator) {
            // ★変更: ConfigをURLパラメータに変換して渡す
            const params = new URLSearchParams(firebaseConfig).toString();
            const swUrl = `/firebase-messaging-sw.js?${params}`;

            // ★変更: type: 'module' を削除（クラシックモードで登録）
            registration = await navigator.serviceWorker.register(swUrl);
            console.log('Service Worker registered (Classic Mode)');
        }

        const token = await getToken(messaging, { 
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration 
        });
        
        if (token && auth.currentUser) {
            console.log('FCM Token:', token);
            const userRef = doc(db, "user_profiles", auth.currentUser.uid);
            await updateDoc(userRef, {
                fcmTokens: arrayUnion(token)
            }).catch(e => console.error("トークン保存エラー:", e));
        }
    } catch (error) {
        console.error('FCM初期化エラー:', error);
    }
}

export function listenForMessages() {
    onMessage(messaging, (payload) => {
        console.log('フォアグラウンド通知受信:', payload);
        const { title, body } = payload.notification;
        new Notification(title, { body });
    });
}

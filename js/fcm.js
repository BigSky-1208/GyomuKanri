import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js";
import { app, db, auth } from "./firebase.js"; // userIdは削除してもOK（auth.currentUserを使うため）
import { doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { fcmConfig } from "./config.js";

const messaging = getMessaging(app);
const VAPID_KEY = fcmConfig.vapidKey;

export async function initMessaging() {
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('通知の許可が拒否されました。');
            return;
        }

        // ★追加: Service Worker を { type: 'module' } で明示的に登録する
        // これがないと sw.js 内での import がエラーになります
        let registration;
        if ('serviceWorker' in navigator) {
            registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                type: 'module' // ここが重要
            });
            console.log('Service Worker registered with type: module');
        }

        // トークン取得時に、登録した registration を渡す
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

// ... (listenForMessages はそのまま)
export function listenForMessages() {
    onMessage(messaging, (payload) => {
        console.log('フォアグラウンド通知受信:', payload);
        const { title, body } = payload.notification;
        new Notification(title, { body });
    });
}

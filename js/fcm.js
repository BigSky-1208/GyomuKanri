// js/fcm.js

// ★修正: onMessage が足りていなかったので追加
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js";
import { app, db, auth } from "./firebase.js";
import { doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// ★修正: firebaseConfig をインポート
import { fcmConfig, firebaseConfig } from "./config.js";

const messaging = getMessaging(app);
const VAPID_KEY = fcmConfig.vapidKey;

export async function initMessaging(passedUserId) {
    console.log("initMessaging 関数が呼ばれました。ID:", passedUserId);

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn("通知権限が許可されませんでした");
            return;
        }

        let registration;
        if ('serviceWorker' in navigator) {
            // ここで firebaseConfig を使用するため、インポートが必須でした
            const params = new URLSearchParams(firebaseConfig).toString();
            const swUrl = `/firebase-messaging-sw.js?${params}`;
            registration = await navigator.serviceWorker.register(swUrl);
            console.log("Service Worker 登録成功");
        }

        const token = await getToken(messaging, { 
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration 
        });
        
        if (token) {
            console.log('★FCM Token 取得成功:', token);

            const saveTokenToFirestore = async (uid) => {
                const userRef = doc(db, "user_profiles", uid);
                // フィールドの上書きではなく、配列への追加 (arrayUnion)
                await updateDoc(userRef, {
                    fcmTokens: arrayUnion(token)
                });
                console.log("Firestoreにトークンを保存しました:", uid);
            };

            if (passedUserId) {
                await saveTokenToFirestore(passedUserId);
            } else if (auth.currentUser) {
                await saveTokenToFirestore(auth.currentUser.uid);
            } else {
                console.log("Auth状態の確定を待っています...");
                auth.onAuthStateChanged(async (user) => {
                    if (user) await saveTokenToFirestore(user.uid);
                });
            }
        }
    } catch (error) {
        console.error('FCM初期化中にエラーが発生しました:', error);
    }
}

export function listenForMessages() {
    console.log("listenForMessages を開始しました");
    onMessage(messaging, (payload) => {
        console.log('フォアグラウンド通知受信:', payload);
        const { title, body } = payload.notification;
        
        // ブラウザ通知を表示
        new Notification(title, { 
            body: body,
            icon: "/512.png" 
        });
    });
}

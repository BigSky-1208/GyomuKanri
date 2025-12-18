// js/fcm.js

import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js";
import { app, db, auth } from "./firebase.js";
import { doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { fcmConfig, firebaseConfig } from "./config.js";

const messaging = getMessaging(app);
const VAPID_KEY = fcmConfig.vapidKey;

export async function initMessaging() {
    console.log("initMessaging 関数が呼ばれました");

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        let registration;
        if ('serviceWorker' in navigator) {
            const params = new URLSearchParams(firebaseConfig).toString();
            const swUrl = `/firebase-messaging-sw.js?${params}`;
            registration = await navigator.serviceWorker.register(swUrl);
        }

        const token = await getToken(messaging, { 
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration 
        });
        
        if (token) {
            console.log('★FCM Token 取得成功:', token);

            // ★修正: Firebaseの認証状態が確定するのを待つ、または現在のユーザーを確認
            const saveToken = async (user) => {
                if (user) {
                    const userRef = doc(db, "user_profiles", user.uid);
                    await updateDoc(userRef, {
                        fcmTokens: arrayUnion(token)
                    });
                    console.log("Firestoreにトークンを保存しました:", user.uid);
                }
            };

            if (auth.currentUser) {
                // すでにログイン済みなら即保存
                await saveToken(auth.currentUser);
            } else {
                // まだなら、ログイン状態が変わるのを待って保存
                console.log("Auth状態の確定を待っています...");
                auth.onAuthStateChanged(async (user) => {
                    if (user) await saveToken(user);
                });
            }
        }
    } catch (error) {
        console.error('FCM初期化中にエラーが発生しました:', error);
    }
}

export function listenForMessages() {
    onMessage(messaging, (payload) => {
        console.log('フォアグラウンド通知受信:', payload);
        const { title, body } = payload.notification;
        new Notification(title, { body });
    });
}

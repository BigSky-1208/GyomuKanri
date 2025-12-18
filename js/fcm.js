// js/fcm.js

import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js";
import { app, db, auth } from "./firebase.js";
import { doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { fcmConfig, firebaseConfig } from "./config.js";

console.log("js/fcm.js が読み込まれました"); // ★ファイル読み込み確認

const messaging = getMessaging(app);
const VAPID_KEY = fcmConfig.vapidKey;

export async function initMessaging() {
    console.log("initMessaging 関数が呼ばれました"); // ★関数呼び出し確認

    try {
        // 1. 通知許可の確認
        const permission = await Notification.requestPermission();
        console.log("通知権限の状態:", permission); // ★権限状態ログ

        if (permission !== 'granted') {
            console.warn('通知の許可が拒否されました (または未設定)');
            return;
        }

        // 2. Service Workerの登録
        let registration;
        if ('serviceWorker' in navigator) {
            try {
                const params = new URLSearchParams(firebaseConfig).toString();
                const swUrl = `/firebase-messaging-sw.js?${params}`;
                
                registration = await navigator.serviceWorker.register(swUrl);
                console.log('Service Worker 登録成功:', registration);
            } catch (swError) {
                console.error('Service Worker 登録失敗:', swError);
                return;
            }
        } else {
            console.error('このブラウザはService Workerに対応していません');
            return;
        }

        // 3. トークンの取得
        console.log("FCMトークンを取得しようとしています...");
        const token = await getToken(messaging, { 
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration 
        });
        
        if (token) {
            console.log('★FCM Token 取得成功:', token); // ★これが重要

            if (auth.currentUser) {
                const userRef = doc(db, "user_profiles", auth.currentUser.uid);
                await updateDoc(userRef, {
                    fcmTokens: arrayUnion(token)
                });
                console.log("Firestoreにトークンを保存しました");
            } else {
                console.warn("ユーザーがログインしていないため、トークンを保存できませんでした");
            }
        } else {
            console.warn('トークンが取得できませんでした (権限はあるがトークン生成に失敗)');
        }

    } catch (error) {
        console.error('FCM初期化中にエラーが発生しました:', error);
    }
}

export function listenForMessages() {
    onMessage(messaging, (payload) => {
        console.log('フォアグラウンド通知受信:', payload);
        const { title, body } = payload.notification;
        // 既にブラウザ通知が出ている場合は重複する可能性がありますが、確認用に出します
        new Notification(title, { body });
    });
}

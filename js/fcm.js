// js/fcm.js

// 引数に passedUserId を追加
export async function initMessaging(passedUserId) {
    console.log("initMessaging 関数が呼ばれました。ID:", passedUserId);

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

            // 保存用関数
            const saveTokenToFirestore = async (uid) => {
                const userRef = doc(db, "user_profiles", uid);
                await updateDoc(userRef, {
                    fcmTokens: arrayUnion(token)
                });
                console.log("Firestoreにトークンを保存しました:", uid);
            };

            // 1. まず引数で渡されたIDがあればそれを使う
            if (passedUserId) {
                await saveTokenToFirestore(passedUserId);
            } 
            // 2. なければ現在の Auth 状態を確認する
            else if (auth.currentUser) {
                await saveTokenToFirestore(auth.currentUser.uid);
            } 
            // 3. それでもなければ待機する
            else {
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

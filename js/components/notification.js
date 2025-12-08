// js/components/notification.js

/**
 * 経過時間に基づいて通知をトリガーします。
 * AI機能は使用せず、ローカルストレージから業務名を取得して定型文を表示します。
 * @param {number} elapsedSeconds - 経過秒数
 * @param {string} type - 通知タイプ ('encouragement' | 'breather')
 */
export async function triggerEncouragementNotification(elapsedSeconds, type = 'encouragement') {
    // 1. ローカルストレージから業務名を取得 (保存されていない場合は '業務' とする)
    const taskName = localStorage.getItem('currentTaskName') || '業務';

    // 2. 時間の計算
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);

    let timeString = "";
    if (hours > 0) {
        timeString += `${hours}時間`;
    }
    timeString += `${minutes}分`;

    // 3. メッセージ作成
    // 「【業務名】を〇時間〇分継続しています！」
    const message = `【${taskName}】を${timeString}継続しています！`;
    
    // 4. タイトル決定
    let title = "お疲れ様です！";
    if (type === 'breather') {
        title = "そろそろ一息つきませんか？";
    }

    // 5. 通知を表示
    await showBrowserNotification(title, message);
}

// ブラウザ通知を表示する共通関数
async function showBrowserNotification(title, message) {
    if (!("Notification" in window)) return;

    let permission = Notification.permission;

    if (permission === "granted") {
        createNotification(title, message);
    } else if (permission !== "denied") {
        try {
            permission = await Notification.requestPermission();
            if (permission === "granted") {
                createNotification(title, message);
            }
        } catch (error) {
            console.error("Error requesting notification permission:", error);
        }
    }
}

function createNotification(title, message) {
    try {
        const notification = new Notification(title, {
            body: message,
            tag: "gyomukanri-notification", // タグを指定して通知の重複を防ぐ
            renotify: true,
            silent: false,
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };

        // 15秒後に自動的に閉じる
        setTimeout(() => {
            notification.close();
        }, 15000);

    } catch (error) {
        console.error("Error creating notification:", error);
    }
}

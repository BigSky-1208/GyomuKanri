// js/components/notification.js

/**
 * 経過時間に基づいて通知をトリガーします。
 * @param {number} elapsedSeconds - 経過秒数
 * @param {string} type - 通知タイプ ('encouragement' | 'breather')
 * @param {string} taskName - 現在の業務名 (追加)
 */
export async function triggerEncouragementNotification(elapsedSeconds, type = 'encouragement', taskName = '業務') {
    // 経過時間を「〇時間〇分」の形式に計算
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);

    let timeString = "";
    if (hours > 0) {
        timeString += `${hours}時間`;
    }
    timeString += `${minutes}分`;

    // メッセージの作成
    const message = `【${taskName}】を${timeString}継続しています！`;
    
    // タイトルの決定
    let title = "お疲れ様です！";
    if (type === 'breather') {
        title = "そろそろ一息つきませんか？";
    }

    // ブラウザ通知を表示
    await showBrowserNotification(title, message);
}

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
            tag: "gyomukanri-notification",
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

// js/components/notification.js

/**
 * 経過時間に基づいて通知をトリガーします。
 * AI機能は使用せず、ローカルストレージから業務名を取得して定型文を表示します。
 * @param {number} elapsedSeconds - 経過秒数
 * @param {string} type - 通知タイプ ('encouragement' | 'breather')
 */
export async function triggerEncouragementNotification(elapsedSeconds, type = 'encouragement') {
    const latestTaskName = localStorage.getItem("currentTask") || "業務";
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);

    let timeString = "";
    if (hours > 0) {
        timeString += `${hours}時間`;
    }
    timeString += `${minutes}分`;

    const message = `【${latestTaskName}】を${timeString}継続しています！`;
    
    let title = "お疲れ様です！";
    if (type === 'breather') {
        title = "そろそろ一息つきませんか？";
    }

    await showBrowserNotification(title, message);
}

// 予約実行時の通知
export async function triggerReservationNotification(actionName) {
    const title = "自動実行";
    const message = `予約設定で${actionName}しました`;
    await showBrowserNotification(title, message);
}

// 休憩経過時間の通知
export async function triggerBreakNotification(elapsedSeconds) {
    const minutes = Math.floor(elapsedSeconds / 60);
    const title = "休憩中";
    const message = `休憩中…${minutes}分`;
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
            // tag: "gyomukanri-notification", // ★削除: 上書きを防ぐため削除
            renotify: false, // tagがない場合はfalse推奨（またはtrueでも可）
            silent: false,
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };

        // 自動で閉じる（15秒）
        setTimeout(() => {
            notification.close();
        }, 15000);

    } catch (error) {
        console.error("Error creating notification:", error);
    }
}

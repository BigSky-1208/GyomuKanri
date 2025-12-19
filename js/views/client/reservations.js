// js/views/client/reservations.js

// WorkerのURL（実際のURLに合わせて調整してください）
const WORKER_URL = "https://muddy-night-4bd4.sora-yamashita.workers.dev";

/**
 * 休憩予約を保存する関数 (D1対応版)
 */
export async function handleSaveBreakReservation(userId, userName) {
    const timeInput = document.getElementById("break-reservation-time-input");
    if (!timeInput || !timeInput.value) {
        alert("時刻を選択してください。");
        return;
    }

    // 1. 予約日時（scheduledTime）を計算 (ISO形式)
    const scheduledTime = calculateScheduledTime(timeInput.value);
    
    // 2. D1保存用のデータ作成
    // IDは "userId_break" のように固定すると、毎日上書き更新（INSERT OR REPLACE）されます
    const reservationData = {
        id: `${userId}_break`,
        userId: userId,
        userName: userName,
        action: "break",
        scheduledTime: scheduledTime.toISOString()
    };

    try {
        console.log("D1へ予約を送信中...", reservationData);

        // 3. Worker API を叩く
        const response = await fetch(`${WORKER_URL}/save-reservation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reservationData)
        });

        if (!response.ok) throw new Error("Workerへの保存に失敗しました");

        const result = await response.json();
        if (result.success) {
            alert(`休憩予約を保存しました: ${timeInput.value}\n(Cloudflare D1に保存されました)`);
        }
    } catch (error) {
        console.error("保存エラー:", error);
        alert("予約の保存に失敗しました。コンソールを確認してください。");
    }
}

/**
 * 時刻文字列から本日（または明日）の Date オブジェクトを生成するヘルパー
 */
function calculateScheduledTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const now = new Date();
    const scheduledDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

    // すでに過ぎている時刻なら翌日に設定
    if (scheduledDate <= now) {
        scheduledDate.setDate(scheduledDate.getDate() + 1);
    }
    return scheduledDate;
}

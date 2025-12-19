// js/views/client/reservations.js

const WORKER_URL = "https://muddy-night-4bd4.sora-yamashita.workers.dev";

/**
 * ★追加: 特定ユーザーの予約情報をD1から取得する関数
 * modal.js から呼び出されるため export が必要です
 */
export async function userReservations(userId) {
    try {
        const response = await fetch(`${WORKER_URL}/get-user-reservations?userId=${userId}`);
        if (!response.ok) return [];
        const data = await response.json();
        return data; // 予約情報の配列を返す
    } catch (error) {
        console.error("予約取得エラー:", error);
        return [];
    }
}

/**
 * 休憩予約を保存する関数 (D1対応版)
 */
export async function handleSaveBreakReservation(userId, userName) {
    const timeInput = document.getElementById("break-reservation-time-input");
    if (!timeInput || !timeInput.value) {
        alert("時刻を選択してください。");
        return;
    }

    const scheduledTime = calculateScheduledTime(timeInput.value);
    
    const reservationData = {
        id: `${userId}_break`,
        userId: userId,
        userName: userName,
        action: "break",
        scheduledTime: scheduledTime.toISOString()
    };

    try {
        const response = await fetch(`${WORKER_URL}/save-reservation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reservationData)
        });

        if (!response.ok) throw new Error("保存失敗");
        alert(`休憩予約を保存しました: ${timeInput.value}`);
    } catch (error) {
        console.error("保存エラー:", error);
    }
}

function calculateScheduledTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const now = new Date();
    const scheduledDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    if (scheduledDate <= now) scheduledDate.setDate(scheduledDate.getDate() + 1);
    return scheduledDate;
}

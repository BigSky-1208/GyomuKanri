// js/views/client/reservations.js
import { userId, userName } from "../../main.js";

// WorkerのURL
const WORKER_URL = "https://muddy-night-4bd4.sora-yamashita.workers.dev";

// 取得した予約データを保持する配列
export let userReservations = [];

/**
 * D1から特定のユーザーの全予約を取得し、画面を更新する
 */
export async function listenForUserReservations() {
    if (!userId) return;
    try {
        const response = await fetch(`${WORKER_URL}/get-user-reservations?userId=${userId}`);
        if (!response.ok) throw new Error("予約取得失敗");
        const data = await response.json();

        userReservations = data.map(res => {
            const date = new Date(res.scheduledTime);
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return { ...res, time: `${hours}:${minutes}` };
        });

        userReservations.sort((a, b) => a.time.localeCompare(b.time));
        updateReservationDisplay();
    } catch (error) {
        console.error("予約取得エラー:", error);
    }
}

/**
 * 画面の表示を更新する
 */
export function updateReservationDisplay() {
    const breakList = document.getElementById("break-reservation-list");
    const stopSetter = document.getElementById("stop-reservation-setter");
    const stopStatus = document.getElementById("stop-reservation-status");
    const stopStatusText = document.getElementById("stop-reservation-status-text");

    if (breakList) {
        breakList.innerHTML = "";
        const breakReservations = userReservations.filter(r => r.action === "break");
        if (breakReservations.length > 0) {
            breakReservations.forEach(res => {
                const div = document.createElement("div");
                div.className = "flex justify-between items-center p-2 bg-gray-100 rounded-lg mb-2";
                div.innerHTML = `
                    <span class="font-mono text-lg">${res.time} <span class="text-xs text-gray-500">(毎日)</span></span>
                    <button class="delete-break-reservation-btn text-xs bg-red-500 text-white font-bold py-1 px-2 rounded hover:bg-red-600" data-id="${res.id}">削除</button>
                `;
                breakList.appendChild(div);
            });
        } else {
            breakList.innerHTML = '<p class="text-center text-sm text-gray-500">休憩予約はありません</p>';
        }
    }

    if (stopSetter && stopStatus) {
        const stopReservation = userReservations.find(r => r.action === "stop");
        if (stopReservation) {
            if(stopStatusText) stopStatusText.textContent = `予約時刻: ${stopReservation.time} (毎日)`;
            stopSetter.classList.add("hidden");
            stopStatus.classList.remove("hidden");
        } else {
            stopSetter.classList.remove("hidden");
            stopStatus.classList.add("hidden");
        }
    }
}

/**
 * 休憩予約を保存する
 */
export async function handleSaveBreakReservation() {
    const timeInput = document.getElementById("break-reservation-time-input");
    // ★ここで「modal」という名前で要素を捕まえます
    const modal = document.getElementById("break-reservation-modal"); 
    
    if (!timeInput?.value) return;

    const scheduledTime = calculateScheduledTime(timeInput.value);
    
    try {
        await fetch(`${WORKER_URL}/save-reservation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: `${userId}_break_${timeInput.value.replace(':','')}`,
                userId, 
                userName, 
                action: "break",
                scheduledTime: scheduledTime.toISOString()
            })
        });

        // 保存後にリストを更新
        await listenForUserReservations();

        // ★ここで modal を使って画面を閉じます
        if (modal) {
            modal.classList.add("hidden");
        }
        
        // 入力欄をリセット
        timeInput.value = "";

    } catch (error) {
        console.error("保存エラー:", error);
    }
}

/**
 * 帰宅予約をセットする
 */
export async function handleSetStopReservation() {
    const timeInput = document.getElementById("stop-reservation-time-input");
    if (!timeInput?.value) return;
    const scheduledTime = calculateScheduledTime(timeInput.value);
    try {
        await fetch(`${WORKER_URL}/save-reservation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: `${userId}_stop`,
                userId, userName, action: "stop",
                scheduledTime: scheduledTime.toISOString()
            })
        });
        await listenForUserReservations();
    } catch (error) {
        console.error("保存エラー:", error);
    }
}

/**
 * ★追加: 帰宅予約をキャンセルする (client.jsのエラー解消用)
 */
export async function handleCancelStopReservation() {
    const existing = userReservations.find(r => r.action === "stop");
    if (existing) {
        await deleteReservation(existing.id);
    }
}

/**
 * 予約を削除する
 */
export async function deleteReservation(id) {
    if (!id || !confirm("この予約を取り消しますか？")) return;
    try {
        await fetch(`${WORKER_URL}/delete-reservation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        await listenForUserReservations();
    } catch (error) {
        console.error("削除エラー:", error);
    }
}

/**
 * ★追加: 全ての予約をクリアする (インポートエラー防止用の空関数)
 */
export async function cancelAllReservations() {
    console.log("cancelAllReservations called (D1版では個別削除を推奨)");
}

function calculateScheduledTime(timeStr) {
    const now = new Date();
    const [hours, minutes] = timeStr.split(":");
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes), 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    return target;
}

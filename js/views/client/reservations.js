// js/views/client/reservations.js
import { userId, userName } from "../../main.js";

// WorkerのURL（実際のURLに合わせて調整してください）
const WORKER_URL = "https://muddy-night-4bd4.sora-yamashita.workers.dev";

// 取得した予約データを保持する配列（他のファイルから参照されるため export）
export let userReservations = [];

/**
 * D1から特定のユーザーの全予約を取得し、画面を更新する
 */
export async function listenForUserReservations() {
    if (!userId) return;

    try {
        console.log(`D1から予約情報を取得します... User: ${userId}`);
        const response = await fetch(`${WORKER_URL}/get-user-reservations?userId=${userId}`);
        if (!response.ok) throw new Error("予約取得失敗");

        const data = await response.json();

        // データの加工（表示用時刻の作成など）
        userReservations = data.map(res => {
            const date = new Date(res.scheduledTime);
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return {
                ...res,
                time: `${hours}:${minutes}`
            };
        });

        // ソート
        userReservations.sort((a, b) => a.time.localeCompare(b.time));

        // 画面（DOM）の更新
        updateReservationDisplay();

    } catch (error) {
        console.error("予約取得エラー:", error);
    }
}

/**
 * 画面のHTML要素を更新する（古いコードのロジックを継承）
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
 * 休憩予約を保存する (D1)
 */
export async function handleSaveBreakReservation() {
    const timeInput = document.getElementById("break-reservation-time-input");
    if (!timeInput?.value) return;

    const scheduledTime = calculateScheduledTime(timeInput.value);
    
    try {
        await fetch(`${WORKER_URL}/save-reservation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: `${userId}_break_${timeInput.value.replace(':','')}`, // 複数持てるように時刻をIDに含める
                userId, userName, action: "break",
                scheduledTime: scheduledTime.toISOString()
            })
        });
        await listenForUserReservations(); // 再取得
    } catch (error) {
        console.error("保存エラー:", error);
    }
}

/**
 * 帰宅予約を保存する (D1)
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
                id: `${userId}_stop`, // 帰宅は1つなので固定
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
 * 予約を削除する (D1)
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
 * 補助関数: 時刻計算
 */
function calculateScheduledTime(timeStr) {
    const now = new Date();
    const [hours, minutes] = timeStr.split(":");
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes), 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    return target;
}

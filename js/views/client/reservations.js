// js/views/client/reservations.js
import { db, userId, userName } from "../../main.js";
import { collection, query, where, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { handleBreakClick, handleStopClick } from "./timer.js";

// ★修正: 指定されたCloudflare WorkersのURLを設定
const WORKER_URL = "https://muddy-night-4bd4.sora-yamashita.workers.dev/update-schedule";

export let userReservations = []; 
let reservationTimers = []; 
let reservationsUnsubscribe = null;

// --- DOM参照 ---
const getBreakList = () => document.getElementById("break-reservation-list");
const getStopSetter = () => document.getElementById("stop-reservation-setter");
const getStopStatus = () => document.getElementById("stop-reservation-status");
const getStopStatusText = () => document.getElementById("stop-reservation-status-text");
const getStopTimeInput = () => document.getElementById("stop-reservation-time-input");

async function notifyWorker() {
    if (WORKER_URL) {
        try {
            await fetch(WORKER_URL);
            console.log("Cloudflare Workersにスケジュール更新を通知しました");
        } catch (e) {
            console.error("Cloudflareへの通知に失敗:", e);
        }
    }
}

export function listenForUserReservations() {
    if (reservationsUnsubscribe) reservationsUnsubscribe();
    if (!userId) return;

    // "reserved" ステータスのものを取得
    const q = query(
        collection(db, "work_logs"),
        where("userId", "==", userId),
        where("status", "==", "reserved")
    );

    reservationsUnsubscribe = onSnapshot(q, (snapshot) => {
        userReservations = snapshot.docs.map((d) => {
            const data = d.data();
            let timeDisplay = "??:??";
            
            // 読み取りロジックの強化: scheduledTimeがない場合でも time (旧形式) から復元を試みる
            if (data.scheduledTime) {
                const date = new Date(data.scheduledTime);
                if (!isNaN(date)) {
                    const hours = date.getHours().toString().padStart(2, '0');
                    const minutes = date.getMinutes().toString().padStart(2, '0');
                    timeDisplay = `${hours}:${minutes}`;
                }
            } else if (data.time) {
                // 旧データ(time: "HH:MM")がある場合はそれを表示に使う
                timeDisplay = data.time;
            }

            return { id: d.id, time: timeDisplay, ...data };
        });
        
        processReservations(); 
        updateReservationDisplay(); 
    });
}

export function processReservations() {
    reservationTimers.forEach(clearTimeout);
    reservationTimers = [];

    const now = new Date();

    userReservations.forEach(async (res) => {
        let targetTime;

        if (res.scheduledTime) {
            targetTime = new Date(res.scheduledTime);
        } else if (res.time) {
            // 旧データ対応: "HH:MM" 文字列から今日の日付のDateオブジェクトを作る
            targetTime = calculateScheduledTime(res.time);
        } else {
            return; // 時間情報がない場合はスキップ
        }

        // ★追加機能: もし予約時間が「過去」になっていたら、自動的に「明日」等の未来に更新する
        // (Workerが動かなかった場合や、ブラウザを久しぶりに開いた場合のリカバリー)
        if (targetTime <= now) {
            console.log(`予約 ${res.time} は過去の時間です。次回（明日以降）に更新します。`);
            
            // 現在時刻より未来になるまで1日ずつ足す
            const nextTarget = new Date(targetTime);
            while (nextTarget <= now) {
                nextTarget.setDate(nextTarget.getDate() + 1);
            }

            // DB更新 (scheduledTimeを書き換え)
            try {
                await updateDoc(doc(db, "work_logs", res.id), {
                    scheduledTime: nextTarget.toISOString()
                });
                // Workerにも通知して次回実行を予約
                notifyWorker();
            } catch (e) {
                console.error("予約の自動更新に失敗:", e);
            }
            return; // 今回はタイマーセットせず、更新後のスナップショットを待つ
        }

        // 未来の予約ならタイマーセット (24時間以内)
        const diff = targetTime.getTime() - now.getTime();
        if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
            const timerId = setTimeout(() => {
                executeAction(res.action, res.id, targetTime);
            }, diff);
            reservationTimers.push(timerId);
        }
    });
}

async function executeAction(action, id, prevDate) {
    console.log(`Executing reservation action: ${action}`);
    
    // 1. アクション実行
    if (action === "break") {
        handleBreakClick(true);
    } else if (action === "stop") {
        handleStopClick(true);
    }

    // 2. 翌日の同じ時間に更新する (毎日繰り返し)
    try {
        const nextDate = new Date(prevDate);
        nextDate.setDate(nextDate.getDate() + 1); // 1日進める

        await updateDoc(doc(db, "work_logs", id), {
            scheduledTime: nextDate.toISOString()
        });
        
        console.log(`予約を翌日(${nextDate.toISOString()})に更新しました`);
        notifyWorker(); // スケジュール再計算を依頼
    } catch (e) {
        console.error("予約更新エラー:", e);
    }
}

export function updateReservationDisplay() {
    const breakList = getBreakList();
    const stopSetter = getStopSetter();
    const stopStatus = getStopStatus();
    const stopStatusText = getStopStatusText();
    const getStopTimeInput = () => document.getElementById("stop-reservation-time-input"); // 再取得

    if (!breakList || !stopSetter) return;

    // 休憩予約リスト
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

    // 帰宅予約表示
    const stopReservation = userReservations.find(r => r.action === "stop");
    if (stopReservation) {
        if(stopStatusText) stopStatusText.textContent = `予約時刻: ${stopReservation.time} (毎日)`;
        stopSetter.classList.add("hidden");
        stopStatus.classList.remove("hidden");
    } else {
        stopSetter.classList.remove("hidden");
        stopStatus.classList.add("hidden");
        const input = getStopTimeInput();
        if(input) input.value = "";
    }
}

// --- ユーザー操作ハンドラ ---

function calculateScheduledTime(timeStr) {
    const now = new Date();
    const [hours, minutes] = timeStr.split(":");
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes), 0, 0);
    
    // 過去の時間なら明日に設定
    if (target <= now) {
        target.setDate(target.getDate() + 1);
    }
    return target;
}

export async function handleSaveBreakReservation() {
    const timeInput = document.getElementById("break-reservation-time-input");
    const modal = document.getElementById("break-reservation-modal");
    
    if (!timeInput || !timeInput.value) {
        alert("時刻を入力してください");
        return;
    }

    const scheduledTime = calculateScheduledTime(timeInput.value);

    try {
        await addDoc(collection(db, "work_logs"), {
            userId,
            userName,
            status: "reserved",
            action: "break",
            scheduledTime: scheduledTime.toISOString(),
            createdAt: new Date().toISOString()
        });
        
        await notifyWorker(); 
        
        if (modal) modal.classList.add("hidden");
        
    } catch (error) {
        console.error("予約保存エラー:", error);
        alert("エラーが発生しました");
    }
}

export async function handleSetStopReservation() {
    const timeInput = getStopTimeInput();
    if (!timeInput.value) {
        alert("時刻を入力してください");
        return;
    }

    const scheduledTime = calculateScheduledTime(timeInput.value);

    try {
        const existing = userReservations.find(r => r.action === "stop");
        if (existing) {
            await deleteDoc(doc(db, "work_logs", existing.id));
        }

        await addDoc(collection(db, "work_logs"), {
            userId,
            userName,
            status: "reserved",
            action: "stop",
            scheduledTime: scheduledTime.toISOString(),
            createdAt: new Date().toISOString()
        });

        await notifyWorker(); 

    } catch (error) {
        console.error("帰宅予約エラー:", error);
    }
}

export async function handleCancelStopReservation() {
    const existing = userReservations.find(r => r.action === "stop");
    if (existing) {
        await deleteReservation(existing.id);
    }
}

export async function deleteReservation(id) {
    if (!id) return;
    try {
        await deleteDoc(doc(db, "work_logs", id));
        await notifyWorker(); 
    } catch (error) {
        console.error("削除エラー:", error);
    }
}

export async function cancelAllReservations() {
    reservationTimers.forEach(clearTimeout);
    reservationTimers = [];
}

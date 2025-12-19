// js/views/client/reservations.js
import { db, userId, userName } from "../../main.js";
import { collection, query, where, doc, addDoc, deleteDoc, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Cloudflare WorkersのURL
const WORKER_URL = "https://muddy-night-4bd4.sora-yamashita.workers.dev/update-schedule";

export let userReservations = []; 

// --- DOM参照 ---
const getBreakList = () => document.getElementById("break-reservation-list");
const getStopSetter = () => document.getElementById("stop-reservation-setter");
const getStopStatus = () => document.getElementById("stop-reservation-status");
const getStopStatusText = () => document.getElementById("stop-reservation-status-text");
const getStopTimeInput = () => document.getElementById("stop-reservation-time-input");

async function notifyWorker() {
    if (WORKER_URL) {
        try {
            console.log("Cloudflare Workersへ通知を送信中...");
            await fetch(WORKER_URL, { mode: 'cors' });
            console.log("Cloudflare Workersにスケジュール更新を通知しました");
        } catch (e) {
            console.error("Cloudflareへの通知に失敗:", e.message);
        }
    }
}

/**
 * 古い予約データ(user_profiles)を新しい場所(work_logs)に移行する関数
 */
async function migrateOldReservations() {
    if (!userId) return;
    const oldCollectionRef = collection(db, `user_profiles/${userId}/reservations`);
    try {
        const snapshot = await getDocs(oldCollectionRef);
        if (snapshot.empty) return; 

        console.log(`古い予約データ移行開始...`);
        const batch = writeBatch(db);
        let hasData = false;

        snapshot.docs.forEach(oldDoc => {
            const data = oldDoc.data();
            if (data.time) {
                const target = calculateScheduledTime(data.time);
                const newDocRef = doc(collection(db, "work_logs"));
                batch.set(newDocRef, {
                    userId,
                    userName: userName || "不明",
                    status: "reserved",
                    action: data.action || "break",
                    time: data.time, 
                    scheduledTime: target.toISOString(),
                    createdAt: new Date().toISOString(),
                    memo: "旧データからの移行"
                });
                batch.delete(oldDoc.ref);
                hasData = true;
            }
        });

        if (hasData) {
            await batch.commit();
            await notifyWorker(); 
        }
    } catch (error) {
        console.error("移行エラー:", error);
    }
}

/**
 * 【最適化】予約情報を1回だけ取得する
 * (client.js の initializeClientView から1回呼ばれる想定)
 */
export async function listenForUserReservations() {
    if (!userId) return;

    // 移行処理を1回実行
    await migrateOldReservations();

    console.log(`予約情報を取得します (getDocs)... User: ${userId}`);

    const q = query(
        collection(db, "work_logs"),
        where("userId", "==", userId),
        where("status", "==", "reserved")
    );

    try {
        const snapshot = await getDocs(q);
        userReservations = snapshot.docs.map((d) => {
            const data = d.data();
            let timeDisplay = "??:??";
            
            if (data.scheduledTime) {
                const date = new Date(data.scheduledTime);
                if (!isNaN(date)) {
                    const hours = date.getHours().toString().padStart(2, '0');
                    const minutes = date.getMinutes().toString().padStart(2, '0');
                    timeDisplay = `${hours}:${minutes}`;
                }
            } else if (data.time) {
                timeDisplay = data.time;
            }
            return { id: d.id, time: timeDisplay, ...data };
        });

        userReservations.sort((a, b) => {
            if (a.time === "??:??") return 1;
            if (b.time === "??:??") return -1;
            return a.time.localeCompare(b.time);
        });
        
        updateReservationDisplay(); 
    } catch (error) {
        console.error("予約取得エラー:", error);
    }
}

export function updateReservationDisplay() {
    const breakList = getBreakList();
    const stopSetter = getStopSetter();
    const stopStatus = getStopStatus();
    const stopStatusText = getStopStatusText();
    const stopTimeInput = document.getElementById("stop-reservation-time-input");

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
            if(stopTimeInput) stopTimeInput.value = "";
        }
    }
}

function calculateScheduledTime(timeStr) {
    const now = new Date();
    const [hours, minutes] = timeStr.split(":");
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes), 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    return target;
}

export async function handleSaveBreakReservation() {
    const timeInput = document.getElementById("break-reservation-time-input");
    const modal = document.getElementById("break-reservation-modal");
    if (!timeInput?.value) return;

    const scheduledTime = calculateScheduledTime(timeInput.value);
    try {
        await addDoc(collection(db, "work_logs"), {
            userId, userName, status: "reserved", action: "break",
            scheduledTime: scheduledTime.toISOString(), createdAt: new Date().toISOString()
        });
        await notifyWorker(); 
        if (modal) modal.classList.add("hidden");
        // 最新の状態に更新
        await listenForUserReservations();
    } catch (error) {
        console.error("保存エラー:", error);
    }
}

export async function handleSetStopReservation() {
    const timeInput = document.getElementById("stop-reservation-time-input");
    if (!timeInput?.value) return;

    const scheduledTime = calculateScheduledTime(timeInput.value);
    try {
        const existing = userReservations.find(r => r.action === "stop");
        if (existing) await deleteDoc(doc(db, "work_logs", existing.id));

        await addDoc(collection(db, "work_logs"), {
            userId, userName, status: "reserved", action: "stop",
            scheduledTime: scheduledTime.toISOString(), createdAt: new Date().toISOString()
        });
        await notifyWorker(); 
        await listenForUserReservations();
    } catch (error) {
        console.error("帰宅予約エラー:", error);
    }
}

export async function handleCancelStopReservation() {
    const existing = userReservations.find(r => r.action === "stop");
    if (existing) await deleteReservation(existing.id);
}

export async function deleteReservation(id) {
    if (!id) return;
    try {
        await deleteDoc(doc(db, "work_logs", id));
        await notifyWorker(); 
        await listenForUserReservations();
    } catch (error) {
        console.error("削除エラー:", error);
    }
}

export async function cancelAllReservations() {
    // 監視停止後のクリーンアップが必要な場合はここに記述
}

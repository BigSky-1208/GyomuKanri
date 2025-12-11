// js/views/client/reservations.js
import { db, userId, userName } from "../../main.js";
import { collection, query, where, onSnapshot, doc, addDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { handleBreakClick, handleStopClick } from "./timer.js";

// ★★★ ここにCloudflare WorkersのURLを貼り付けてください ★★★
// (末尾に /update-schedule を忘れずに！)
const WORKER_URL = "https://muddy-night-4bd4.sora-yamashita.workers.dev/update-schedule";

export let userReservations = []; // 予約リスト
let reservationTimers = []; // ローカルタイマー（ブラウザ用）
let reservationsUnsubscribe = null;

// --- DOM参照 ---
const getBreakList = () => document.getElementById("break-reservation-list");
const getStopSetter = () => document.getElementById("stop-reservation-setter");
const getStopStatus = () => document.getElementById("stop-reservation-status");
const getStopStatusText = () => document.getElementById("stop-reservation-status-text");
const getStopTimeInput = () => document.getElementById("stop-reservation-time-input");

/**
 * Cloudflare Workersに更新を通知する関数
 */
async function notifyWorker() {
    if (WORKER_URL && !WORKER_URL.includes("あなたのアカウント名")) {
        try {
            await fetch(WORKER_URL);
            console.log("Cloudflare Workersにスケジュール更新を通知しました");
        } catch (e) {
            console.error("Cloudflareへの通知に失敗:", e);
        }
    } else {
        console.warn("Worker URLが設定されていないため、通知をスキップしました");
    }
}

/**
 * 予約の監視を開始 (work_logsコレクションの status: 'reserved' を監視)
 */
export function listenForUserReservations() {
    if (reservationsUnsubscribe) reservationsUnsubscribe();
    if (!userId) return;

    // Workerと連携するため、'work_logs' コレクションを使います
    const q = query(
        collection(db, "work_logs"),
        where("userId", "==", userId),
        where("status", "==", "reserved")
    );

    console.log("Starting listener for reservations...");
    reservationsUnsubscribe = onSnapshot(q, (snapshot) => {
        userReservations = snapshot.docs.map((d) => {
            const data = d.data();
            // ISO文字列から HH:MM を復元して表示用に加工
            let timeDisplay = "??:??";
            if (data.scheduledTime) {
                const date = new Date(data.scheduledTime);
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                timeDisplay = `${hours}:${minutes}`;
            }
            return { id: d.id, time: timeDisplay, ...data };
        });
        
        processReservations(); // ブラウザ上のタイマーもセット
        updateReservationDisplay(); // UI更新
    });
}

/**
 * 予約の処理（ブラウザが開いている間の自動実行用）
 */
export function processReservations() {
    reservationTimers.forEach(clearTimeout);
    reservationTimers = [];

    const now = new Date();

    userReservations.forEach(res => {
        const targetTime = new Date(res.scheduledTime);
        
        // すでに過ぎている、かつ1分以内なら即実行（ブラウザ再開時などの対策）
        const diff = targetTime.getTime() - now.getTime();
        
        if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
            // 未来の予約（24時間以内）
            const timerId = setTimeout(() => {
                executeAction(res.action, res.id);
            }, diff);
            reservationTimers.push(timerId);
        }
    });
}

async function executeAction(action, id) {
    console.log(`Executing reservation action: ${action}`);
    if (action === "break") {
        handleBreakClick(true);
    } else if (action === "stop") {
        handleStopClick(true);
    }
    // 実行済みとしてマーク（Firestoreから削除 or status変更）
    // Worker側で処理されている可能性もあるが、ブラウザ側でも念のため
    try {
        await deleteDoc(doc(db, "work_logs", id));
        notifyWorker(); // スケジュール再計算を依頼
    } catch (e) {
        console.error("予約消去エラー:", e);
    }
}

/**
 * 予約の表示更新
 */
export function updateReservationDisplay() {
    const breakList = getBreakList();
    const stopSetter = getStopSetter();
    const stopStatus = getStopStatus();
    const stopStatusText = getStopStatusText();
    const stopTimeInput = getStopTimeInput();

    if (!breakList || !stopSetter) return;

    // 休憩予約リスト
    breakList.innerHTML = "";
    const breakReservations = userReservations.filter(r => r.action === "break");
    
    if (breakReservations.length > 0) {
        breakReservations.forEach(res => {
            const div = document.createElement("div");
            div.className = "flex justify-between items-center p-2 bg-gray-100 rounded-lg mb-2";
            div.innerHTML = `
                <span class="font-mono text-lg">${res.time}</span>
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
        stopStatusText.textContent = `予約時刻: ${stopReservation.time}`;
        stopSetter.classList.add("hidden");
        stopStatus.classList.remove("hidden");
    } else {
        stopSetter.classList.remove("hidden");
        stopStatus.classList.add("hidden");
    }
}

// --- ユーザー操作ハンドラ ---

// 次回の指定時刻（Dateオブジェクト）を計算するヘルパー
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
            status: "reserved", // Workerが検索するキー
            action: "break",
            scheduledTime: scheduledTime.toISOString(),
            createdAt: new Date().toISOString()
        });
        
        await notifyWorker(); // Cloudflareに通知
        
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
        // 既存の帰宅予約があれば削除
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

        await notifyWorker(); // Cloudflareに通知

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
        await notifyWorker(); // 削除も通知してスケジュール再計算させる
    } catch (error) {
        console.error("削除エラー:", error);
    }
}

export async function cancelAllReservations() {
    // ブラウザ上のタイマーのみクリア（DBは触らない）
    reservationTimers.forEach(clearTimeout);
    reservationTimers = [];
}

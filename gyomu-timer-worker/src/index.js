// src/index.js
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let db;

function initFirebase(env) {
  if (!db) {
    const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
    const app = initializeApp({
      credential: cert(serviceAccount)
    });
    db = getFirestore(app);
  }
  return db;
}

// 待機用の関数
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/update-schedule') {
        return new Response("OK");
    }
    return new Response("OK");
  },

  async scheduled(event, env, ctx) {
    console.log("Starting scheduled tasks...");
    const firestore = initFirebase(env);
    const now = new Date();

    // サーバー時計のズレやフライング起動を考慮し、60秒後までの予約を対象にする
    const searchLimit = new Date(now.getTime() + 60000);

    const reservationsSnapshot = await firestore.collection('reservations') 
      .where('status', '==', 'reserved')
      .where('scheduledTime', '<=', searchLimit.toISOString())
      .get();

    if (reservationsSnapshot.empty) {
      console.log("実行対象の予約は見つかりませんでした");
      return;
    }

    // 待機時間の計算
    let maxWaitTime = 0;
    const realTimeNow = new Date().getTime();

    reservationsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const scheduled = new Date(data.scheduledTime).getTime();
        if (scheduled > realTimeNow) {
            const diff = scheduled - realTimeNow;
            if (diff > maxWaitTime) maxWaitTime = diff;
        }
    });

    if (maxWaitTime > 0 && maxWaitTime <= 15000) {
        console.log(`Waiting for ${maxWaitTime}ms to synchronize...`);
        await sleep(maxWaitTime);
    }
    
    // トランザクション処理
    try {
        await firestore.runTransaction(async (transaction) => {
            const executionTime = new Date();
            const resRefs = reservationsSnapshot.docs.map(doc => doc.ref);
            const resDocs = await Promise.all(resRefs.map(ref => transaction.get(ref)));

            for (const resDoc of resDocs) {
                if (!resDoc.exists) continue;
                const resData = resDoc.data();
                if (resData.status !== 'reserved') continue;

                if (new Date(resData.scheduledTime) > executionTime) {
                    continue;
                }

                const userId = resData.userId;
                const userStatusRef = firestore.collection('work_status').doc(userId);
                const userStatusSnap = await transaction.get(userStatusRef);

                if (userStatusSnap.exists) {
                    const currentStatus = userStatusSnap.data();

                    // ■データの安全な取得（バックアップ付き）
                    // タイトルは currentGoalTitle または currentGoal から取得
                    const safeGoalTitle = currentStatus.currentGoalTitle || currentStatus.currentGoal || null;
                    // IDは空文字ならnullにする
                    const safeGoalId = (currentStatus.currentGoalId && currentStatus.currentGoalId !== "") ? currentStatus.currentGoalId : null;

                    console.log(`[Worker Check] Saving Log -> Task: "${currentStatus.currentTask}", Goal: "${safeGoalTitle}"`);

                    // ■直前の業務ログ保存
                    if (currentStatus.isWorking && currentStatus.currentTask && currentStatus.startTime) {
                        const prevStartTime = new Date(currentStatus.startTime);
                        const duration = Math.floor((executionTime.getTime() - prevStartTime.getTime()) / 1000);

                        if (duration > 0) {
                            const prevLogId = `log_prev_${resDoc.id}`;
                            const prevLogRef = firestore.collection('work_logs').doc(prevLogId);
                            
                            transaction.set(prevLogRef, {
                                userId: userId,
                                userName: currentStatus.userName || 'Unknown',
                                task: currentStatus.currentTask,
                                goalId: safeGoalId,    // 修正済みのIDを使用
                                goalTitle: safeGoalTitle, // 修正済みのタイトルを使用
                                date: prevStartTime.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '-'),
                                startTime: currentStatus.startTime,
                                endTime: executionTime.toISOString(),
                                duration: duration,
                                memo: "（予約休憩により自動中断）", // ※不要なら "" にしてください
                                source: "worker_reservation"
                                // type: "work"  <-- ★削除: クライアントと挙動を合わせるため削除しました
                            });
                        }
                    }
                    
                    // ■ステータスを「休憩」に更新
                    const preBreakTaskData = {
                        task: currentStatus.currentTask || '',
                        goalId: safeGoalId,
                        goalTitle: safeGoalTitle
                    };

                    transaction.update(userStatusRef, {
                        currentTask: '休憩',
                        isWorking: true,
                        startTime: executionTime.toISOString(),
                        preBreakTask: preBreakTaskData,
                        updatedAt: executionTime.toISOString(),
                        lastUpdatedBy: 'worker',
                        currentGoalId: null,
                        currentGoalTitle: null,
                        currentGoal: null,
                        debug_workerSeenGoalId: safeGoalId || "NULL_OR_EMPTY"
                    });
                }

                transaction.update(resDoc.ref, { 
                    status: 'executed',
                    executedAt: executionTime.toISOString()
                });
            }
        });
        console.log("Transaction successfully committed!");
    } catch (e) {
        console.error("Transaction failed: ", e);
    }
    
    await env.SCHEDULE.delete('NEXT_JOB_TIME');
  }
};

// src/index.js
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let db;

// Firebaseに接続する関数
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

export default {
  // ブラウザから「予約入れたよ！」と連絡を受ける部分
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // スケジュール更新のリクエストが来たら
    if (url.pathname === '/update-schedule') {
      try {
        const firestore = initFirebase(env);
        const now = new Date().toISOString();

        const snapshot = await firestore.collection('work_logs')
          .where('status', '==', 'reserved')
          .where('scheduledTime', '>', now)
          .orderBy('scheduledTime', 'asc')
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const nextTask = snapshot.docs[0].data();
          await env.SCHEDULE.put('NEXT_JOB_TIME', nextTask.scheduledTime);
          return new Response(`Next check scheduled at: ${nextTask.scheduledTime}`);
        } else {
          await env.SCHEDULE.delete('NEXT_JOB_TIME');
          return new Response("No pending reservations.");
        }
      } catch (err) {
        return new Response(`Error: ${err.message}`, { status: 500 });
      }
    }
    return new Response("OK");
  },

  // 1分ごとに自動で実行される部分
  async scheduled(event, env, ctx) {
    const now = new Date();
    
    // 1. 深夜0時のチェック
    const isMidnight = (now.getUTCHours() === 15 && now.getUTCMinutes() === 0);

    // 2. KVを見て「予約時間」が来ているかチェック
    const nextJobTimeStr = await env.SCHEDULE.get('NEXT_JOB_TIME');
    let isReservationTime = false;

    if (nextJobTimeStr) {
      const nextJobTime = new Date(nextJobTimeStr);
      if (now >= nextJobTime) {
        isReservationTime = true;
      }
    }

    if (!isMidnight && !isReservationTime) {
      console.log("No tasks to run. Skipping.");
      return;
    }

    console.log("Starting scheduled tasks...");
    const firestore = initFirebase(env);

    // 1. 実行すべき予約を取得
    const reservationsSnapshot = await firestore.collection('reservations') 
      .where('status', '==', 'reserved')
      .where('scheduledTime', '<=', now.toISOString())
      .get();

    if (reservationsSnapshot.empty) {
      console.log("実行対象の予約は見つかりませんでした");
      return;
    }

    // トランザクションを使って安全に処理する（ここがメイン処理）
    try {
        await firestore.runTransaction(async (transaction) => {
            // トランザクション内でドキュメント参照を取得
            const resRefs = reservationsSnapshot.docs.map(doc => doc.ref);
            // 読み取り（必須）
            const resDocs = await Promise.all(resRefs.map(ref => transaction.get(ref)));

            for (const resDoc of resDocs) {
                if (!resDoc.exists) continue;
                
                const resData = resDoc.data();
                // ステータスがまだ「予約中」か再確認（他で実行済みならスキップ）
                if (resData.status !== 'reserved') continue;

                const userId = resData.userId;
                const userStatusRef = firestore.collection('work_status').doc(userId);
                const userStatusSnap = await transaction.get(userStatusRef);

                if (userStatusSnap.exists) {
                    const currentStatus = userStatusSnap.data();

                    // ■直前の業務ログ保存
                    if (currentStatus.isWorking && currentStatus.currentTask && currentStatus.startTime) {
                        const prevStartTime = new Date(currentStatus.startTime);
                        const duration = Math.floor((now.getTime() - prevStartTime.getTime()) / 1000);

                        if (duration > 0) {
                            // 直前の業務ログのIDを「予約ID + _prev」で固定して重複防止
                            const prevLogId = `log_prev_${resDoc.id}`;
                            const prevLogRef = firestore.collection('work_logs').doc(prevLogId);
                            
                            transaction.set(prevLogRef, {
                                userId: userId,
                                userName: currentStatus.userName || 'Unknown',
                                task: currentStatus.currentTask,
                                goalId: currentStatus.currentGoalId || null,
                                goalTitle: currentStatus.currentGoalTitle || null,
                                date: prevStartTime.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '-'),
                                startTime: currentStatus.startTime,
                                endTime: now.toISOString(),
                                duration: duration,
                                memo: "（予約休憩により自動中断）",
                                source: "worker_reservation",
                                type: "work"
                            });
                        }
                    }
                    
                    // ■ステータスを「休憩」に更新
                    const preBreakTaskData = {
                        task: currentStatus.currentTask || '',
                        goalId: currentStatus.currentGoalId || null,
                        goalTitle: currentStatus.currentGoalTitle || null
                    };

                    transaction.update(userStatusRef, {
                        currentTask: '休憩',
                        isWorking: true,
                        startTime: now.toISOString(),
                        preBreakTask: preBreakTaskData,
                        updatedAt: now.toISOString(),
                        lastUpdatedBy: 'worker' // クライアント側で重複防止するために必要
                    });
                }

                // ■予約を「実行済み」に更新
                transaction.update(resDoc.ref, { 
                    status: 'executed',
                    executedAt: now.toISOString()
                });
            }
        });
        console.log("Transaction successfully committed!");
    } catch (e) {
        console.error("Transaction failed: ", e);
    }
    
    // KVの次回実行時間をクリア
    await env.SCHEDULE.delete('NEXT_JOB_TIME');
  }
};

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
    // ... (fetch部分は変更なし、そのまま記述してください) ...
    const url = new URL(request.url);
    if (url.pathname === '/update-schedule') {
        // ... (既存のコード) ...
        return new Response("OK");
    }
    return new Response("OK");
  },

  async scheduled(event, env, ctx) {
    console.log("Starting scheduled tasks...");
    const firestore = initFirebase(env);
    
    // 現在時刻
    const now = new Date();

    // ★修正1: サーバー時計のズレやフライング起動を考慮し、
    // 「現在時刻 + 15秒」までの予約を対象にする
    const searchLimit = new Date(now.getTime() + 15000);

    // 1. 実行すべき予約を取得
    const reservationsSnapshot = await firestore.collection('reservations') 
      .where('status', '==', 'reserved')
      .where('scheduledTime', '<=', searchLimit.toISOString()) // ★ここを変更
      .get();

    if (reservationsSnapshot.empty) {
      console.log("実行対象の予約は見つかりませんでした");
      return;
    }

    // ★修正2: 取得した予約の中で、まだ時間が来ていないものがあれば、その時間まで待機する
    // (最も遅い予約時間に合わせて待機すれば、全て安全に実行できる)
    let maxWaitTime = 0;
    const realTimeNow = new Date().getTime();

    reservationsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const scheduled = new Date(data.scheduledTime).getTime();
        // もし予約時間が現在より未来なら、待機時間を計算
        if (scheduled > realTimeNow) {
            const diff = scheduled - realTimeNow;
            if (diff > maxWaitTime) maxWaitTime = diff;
        }
    });

    // 最大15秒まで待機（それ以上は異常なので待たない）
    if (maxWaitTime > 0 && maxWaitTime <= 15000) {
        console.log(`Waiting for ${maxWaitTime}ms to synchronize...`);
        await sleep(maxWaitTime);
    }

    // --- ここから下は変更なし（トランザクション処理） ---
    
    // トランザクションを使って安全に処理する
    try {
        await firestore.runTransaction(async (transaction) => {
            // 再度現在時刻を取得（待機した分、進んでいるため）
            const executionTime = new Date();

            const resRefs = reservationsSnapshot.docs.map(doc => doc.ref);
            const resDocs = await Promise.all(resRefs.map(ref => transaction.get(ref)));

            for (const resDoc of resDocs) {
                if (!resDoc.exists) continue;
                
                const resData = resDoc.data();
                if (resData.status !== 'reserved') continue;

                // 念のため最終チェック（待機した結果、時間は過ぎているはずだが）
                if (new Date(resData.scheduledTime) > executionTime) {
                    console.log("Skipping future reservation:", resDoc.id);
                    continue;
                }

                const userId = resData.userId;
                const userStatusRef = firestore.collection('work_status').doc(userId);
                const userStatusSnap = await transaction.get(userStatusRef);

                if (userStatusSnap.exists) {
                    const currentStatus = userStatusSnap.data();

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
                                goalId: currentStatus.currentGoalId || null,
                                goalTitle: currentStatus.currentGoalTitle || null,
                                date: prevStartTime.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '-'),
                                startTime: currentStatus.startTime,
                                endTime: executionTime.toISOString(), // executionTimeを使用
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
                        startTime: executionTime.toISOString(), // executionTimeを使用
                        preBreakTask: preBreakTaskData,
                        updatedAt: executionTime.toISOString(),
                        lastUpdatedBy: 'worker',

                      　currentGoalId: null,
                        currentGoalTitle: null,
                        currentGoal: null
                    });
                }

                // ■予約を「実行済み」に更新
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

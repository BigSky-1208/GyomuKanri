// src/index.js
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let db;

// Firebaseに接続する関数
function initFirebase(env) {
  if (!db) {
    // 秘密鍵などの情報を環境変数から読み込む
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

        // 未来の予約で、まだ実行されていない一番近いものを探す
        const snapshot = await firestore.collection('work_logs') // ※コレクション名は環境に合わせて調整
          .where('status', '==', 'reserved') // 「予約中」のステータス
          .where('scheduledTime', '>', now)
          .orderBy('scheduledTime', 'asc')
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const nextTask = snapshot.docs[0].data();
          // KVに「次は〇〇時に起こして」とメモする
          await env.SCHEDULE.put('NEXT_JOB_TIME', nextTask.scheduledTime);
          return new Response(`Next check scheduled at: ${nextTask.scheduledTime}`);
        } else {
          // 予約がなければメモを消す
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
    
    // 1. 深夜0時のチェック (JST 00:00 = UTC 15:00)
    // サーバー時間はUTCなので、UTCの15時かどうかで判定
    const isMidnight = (now.getUTCHours() === 15 && now.getUTCMinutes() === 0);

    // 2. KVを見て「予約時間」が来ているかチェック
    const nextJobTimeStr = await env.SCHEDULE.get('NEXT_JOB_TIME');
    let isReservationTime = false;

    if (nextJobTimeStr) {
      const nextJobTime = new Date(nextJobTimeStr);
      // 現在時刻が予約時間を過ぎていたら実行
      if (now >= nextJobTime) {
        isReservationTime = true;
      }
    }

    // 時間になっていなければ、ここで終了（Firebase読み取り回数 0回！）
    if (!isMidnight && !isReservationTime) {
      console.log("No tasks to run. Skipping.");
      return;
    }

    console.log("Starting scheduled tasks...");
    const firestore = initFirebase(env);

// ▼▼▼ ここから追加・差し替え ▼▼▼

    // 1. 実行すべき予約を取得（現在時刻を過ぎている、かつ未実行のもの）
    // ※コレクション名 'reservations' は実際の予約データがある場所に書き換えてください
    const reservationsSnapshot = await firestore.collection('reservations') 
      .where('status', '==', 'reserved')
      .where('scheduledTime', '<=', now.toISOString())
      .get();

    if (reservationsSnapshot.empty) {
      console.log("実行対象の予約は見つかりませんでした（タッチの差で実行された可能性があります）");
      return;
    }

    // バッチ処理の準備（複数書き込みを一度に行う）
    const batch = firestore.batch();

    for (const resDoc of reservationsSnapshot.docs) {
      const resData = resDoc.data();
      const userId = resData.userId;
      
      // ユーザーの現在のステータスを取得（休憩前の業務を保存するため）
      const userStatusRef = firestore.collection('work_status').doc(userId);
      const userStatusSnap = await userStatusRef.get();
      
if (userStatusSnap.exists) {
        const currentStatus = userStatusSnap.data();

        // 1. 直前の業務ログを保存 (クライアントがオフラインでも記録を残すため)
        if (currentStatus.isWorking && currentStatus.currentTask && currentStatus.startTime) {
            const prevStartTime = new Date(currentStatus.startTime);
            const duration = Math.floor((now.getTime() - prevStartTime.getTime()) / 1000);
            
            if (duration > 0) {
                // IDを工夫して、万が一クライアントと競合しても大丈夫なようにする（または完全に新規作成）
                const prevLogRef = firestore.collection('work_logs').doc();
                batch.set(prevLogRef, {
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
                    source: "worker_reservation", // ★Workerが作ったことを明記
                    type: "work"
                });
            }
        }

        const preBreakTaskData = {
            task: currentStatus.currentTask || '',
            goalId: currentStatus.currentGoalId || null,
            goalTitle: currentStatus.currentGoalTitle || null
        };

        // 2. ステータスを「休憩」に更新
        batch.update(userStatusRef, {
            currentTask: '休憩',
            isWorking: true,
            startTime: now.toISOString(),
            preBreakTask: preBreakTaskData,
            updatedAt: now.toISOString(),
            lastUpdatedBy: 'worker' // ★誰が更新したか判別可能にする
        });
      }

      /*
      // 3. 休憩の開始ログを作成 (Activeなログ)
      // ここでのポイントは、IDを指定することです。
      const logId = `log_${resDoc.id}`; 
      const newLogRef = firestore.collection('work_logs').doc(logId);

      batch.set(newLogRef, {
        userId: userId,
        task: '休憩',
        startTime: now.toISOString(),
        status: 'active',
        source: 'worker_reservation',
        originalReservationId: resDoc.id
      });
      */
      
      }

      // 【修正2：ログ重複問題への対策】
      // ログのドキュメントIDを「予約ID」を含んだものにして固定する
      // これにより、クライアントとWorkerが同時に書き込んでもIDが同じなので重複しない
      const logId = `log_${resDoc.id}`; 
      const newLogRef = firestore.collection('work_logs').doc(logId);

      batch.set(newLogRef, {
        userId: userId,
        task: '休憩', // または resData.taskName
        startTime: now.toISOString(),
        status: 'active', // 現在進行中のログとして保存
        source: 'worker_reservation', // 調査用にWorker経由であることを記録
        originalReservationId: resDoc.id
      });

      // 予約データを「実行済み」にする
      batch.update(resDoc.ref, { 
        status: 'executed',
        executedAt: now.toISOString()
      });
    }

    // DBへの変更を確定
    await batch.commit();
    console.log(`Processed ${reservationsSnapshot.size} reservations.`);

    // KVの次回実行時間をクリア（または再計算）する処理がここに入るとベスト
    await env.SCHEDULE.delete('NEXT_JOB_TIME');

    // ▲▲▲ 追加・差し替えここまで ▲▲▲

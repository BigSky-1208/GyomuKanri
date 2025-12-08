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

    // ここに実際の「休憩開始」や「退勤」のデータベース書き換え処理を書きます
    // 例: 予約されていたタスクを実行済みにするなど
    
    // 処理が終わったら、次の予約時間をKVにセットし直すために自分自身を呼び出す
    // (ここでは省略しますが、実際は再度KV更新ロジックを走らせます)
  }
};

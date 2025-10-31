// js/components/notification.js

/**
 * 【重要・警告】
 * APIキーをクライアントサイド(JSファイル)に直接記述することは、
 * 非常に危険なセキュリティリスクです。
 * * 公開Webサイトの場合、APIキーが第三者に盗まれ、不正利用される
 * 可能性があります。
 * * 本番環境では、Firebase Cloud Functions などのバックエンドを
 * 経由して、サーバーサイドで Groq API を呼び出すように
 * することを強く推奨します。
 * * このコードは、あくまで「構想」のためのサンプルです。
 */
// TODO: Groq APIキーを安全な方法（Cloud Functionsなど）で管理してください
const GROQ_API_KEY = "YOUR_GROQ_API_KEY_HERE"; 

/**
 * 経過時間に基づいて励ましの通知をトリガーします。
 * @param {number} elapsedSeconds - 経過秒数
 */
export async function triggerEncouragementNotification(elapsedSeconds) {
    // 既に他の通知処理が実行中の場合は、多重実行を防ぐ (簡易的なロック)
    if (window.isNotificationFetching) {
        console.log("Notification fetch already in progress, skipping.");
        return;
    }
    window.isNotificationFetching = true;

    const elapsedMinutes = Math.round(elapsedSeconds / 60);

    try {
        const message = await fetchEncouragementFromGroq(elapsedMinutes);
        if (message) {
            await showBrowserNotification(message);
        }
    } catch (error) {
        console.error("Failed to get encouragement message:", error);
    } finally {
        // 処理が完了したら、一定時間後にロックを解除（API連続呼び出しを防ぐため）
        setTimeout(() => {
            window.isNotificationFetching = false;
        }, 10000); // 10秒間は次の通知をブロック
    }
}

/**
 * Groq APIに接続して励ましの言葉を取得します。
 * @param {number} minutes - 経過分数
 */
async function fetchEncouragementFromGroq(minutes) {
    if (!GROQ_API_KEY || GROQ_API_KEY === "YOUR_GROQ_API_KEY_HERE") {
        console.warn("Groq API Key is not set in js/components/notification.js. Skipping notification.");
        return null; // APIキーが設定されていなければ何もしない
    }

    // ユーザーのプロンプト通り、業務名は含めない
    const prompt = `同じ業務を${minutes}分続けている人を褒める言葉をください。簡潔に、労う内容でお願いします。`;

    try {
        // Groq APIのエンドポイント
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-8b-8192", // Llama 3 8Bモデル (高速)
                messages: [
                    { 
                        role: "system", 
                        content: "あなたはユーザーを優しく励ますアシスタントです。日本のビジネス文化に合った、丁寧かつ前向きなメッセージを生成してください。" 
                    },
                    { 
                        role: "user", 
                        content: prompt 
                    }
                ],
                temperature: 0.8, // 少し創造的に
                max_tokens: 100, // 短いメッセージで十分
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Groq API Error Response:", errorBody);
            throw new Error(`Groq API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const message = data.choices[0]?.message?.content;
        
        if (message) {
            console.log("Groq API response:", message);
            // メッセージから不要な引用符などを取り除く
            return message.replace(/["「」]/g, ''); 
        } else {
            return "お疲れ様です！順調ですね。"; // APIが空の応答を返した場合のフォールバック
        }

    } catch (error) {
        console.error("Error calling Groq API:", error);
        // APIエラー時はデフォルトのメッセージを返す
        return `素晴らしい集中力ですね！${minutes}分経過しました。`;
    }
}

/**
 * ブラウザの通知機能を使ってメッセージを表示します。
 * @param {string} message - 表示するメッセージ
 */
async function showBrowserNotification(message) {
    // 1. ブラウザが通知に対応しているかチェック
    if (!("Notification" in window)) {
        console.warn("This browser does not support desktop notification.");
        return;
    }

    // 2. 通知の許可状態をチェック
    let permission = Notification.permission;

    if (permission === "granted") {
        // 許可済みなら通知を作成
        createNotification(message);
    } else if (permission !== "denied") {
        // まだ許可も拒否もされていない場合、許可を求める
        // (注: ユーザー操作（クリックなど）なしにrequestPermissionを呼ぶと、
        //  ブラウザにブロックされる可能性があります。
        //  初回はユーザーが手動で通知を許可するボタンを設けるのがベストプラクティスです)
        try {
            permission = await Notification.requestPermission();
            if (permission === "granted") {
                createNotification(message);
            }
        } catch (error) {
            console.error("Error requesting notification permission:", error);
        }
    }
    // "denied" (拒否) されている場合は何もしない
}

/**
 * 実際に通知オブジェクトを作成します。
 * @param {string} message 
 */
function createNotification(message) {
    const options = {
        body: message,
        // icon: "/path/to/icon.png", // （オプション）アプリアイコンのパス
        badge: "/path/to/badge.png", // （オプション）Androidで表示される小さなバッジ
        tag: "gyomukanri-encouragement", // （オプション）同じタグの通知は置き換える
        renotify: false, // （オプション）置き換え時に音を鳴らさない
        silent: false, // （オプション）音を鳴らす
    };

    try {
        const notification = new Notification("お疲れ様です！", options);
        
        // （オプション）通知をクリックしたときの動作
        notification.onclick = () => {
            window.focus(); // アプリのウィンドウをフォーカスする
            notification.close();
        };

        // （オプション）数秒後に自動で閉じる
        setTimeout(() => {
            notification.close();
        }, 10000); // 10秒後に閉じる

    } catch (error) {
        console.error("Error creating notification:", error);
    }
}

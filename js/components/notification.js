// js/components/notification.js

// ★生成された config.js から設定を読み込む
import { groqConfig } from "../config.js";

const GROQ_API_KEY = groqConfig.apiKey;

/**
 * 経過時間に基づいて励ましの通知をトリガーします。
 * @param {number} elapsedSeconds - 経過秒数
 */
export async function triggerEncouragementNotification(elapsedSeconds) {
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
        setTimeout(() => {
            window.isNotificationFetching = false;
        }, 10000); 
    }
}

async function fetchEncouragementFromGroq(minutes) {
    if (!GROQ_API_KEY) {
        // APIキーがない場合は何もしない（エラーにはしない）
        return null; 
    }

    const prompt = `同じ業務を${minutes}分続けている人を褒める言葉をください。簡潔に、労う内容でお願いします。`;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: [
                    { 
                        role: "system", 
                        content: "あなたはユーザーを優しく励ますアシスタントです。日本のビジネス文化に合った、丁寧かつ前向きなメッセージを生成してください。" 
                    },
                    { role: "user", content: prompt }
                ],
                temperature: 0.8,
                max_tokens: 100,
            })
        });

        if (!response.ok) {
            throw new Error(`Groq API Error: ${response.status}`);
        }

        const data = await response.json();
        const message = data.choices[0]?.message?.content;
        
        if (message) {
            return message.replace(/["「」]/g, ''); 
        } else {
            return "お疲れ様です！順調ですね。";
        }

    } catch (error) {
        console.error("Error calling Groq API:", error);
        return null;
    }
}

async function showBrowserNotification(message) {
    if (!("Notification" in window)) return;

    let permission = Notification.permission;

    if (permission === "granted") {
        createNotification(message);
    } else if (permission !== "denied") {
        try {
            permission = await Notification.requestPermission();
            if (permission === "granted") {
                createNotification(message);
            }
        } catch (error) {
            console.error("Error requesting notification permission:", error);
        }
    }
}

function createNotification(message) {
    try {
        const notification = new Notification("お疲れ様です！", {
            body: message,
            tag: "gyomukanri-encouragement",
            renotify: false,
            silent: false,
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };

        setTimeout(() => {
            notification.close();
        }, 10000);

    } catch (error) {
        console.error("Error creating notification:", error);
    }
}

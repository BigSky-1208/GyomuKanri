// js/components/notification.js

import { groqConfig } from "../config.js";

const GROQ_API_KEY = groqConfig.apiKey;

/**
 * 経過時間に基づいて通知をトリガーします。
 * @param {number} elapsedSeconds - 経過秒数
 * @param {string} type - 通知タイプ ('encouragement' | 'breather')
 */
export async function triggerEncouragementNotification(elapsedSeconds, type = 'encouragement') {
    if (window.isNotificationFetching) {
        console.log("Notification fetch already in progress, skipping.");
        return;
    }
    window.isNotificationFetching = true;

    const elapsedMinutes = Math.round(elapsedSeconds / 60);

    try {
        const message = await fetchMessageFromGroq(elapsedMinutes, type);
        if (message) {
            let title = "お疲れ様です！";
            if (type === 'breather') {
                title = "そろそろ一息つきませんか？";
            }
            await showBrowserNotification(title, message);
        }
    } catch (error) {
        console.error("Failed to get notification message:", error);
    } finally {
        setTimeout(() => {
            window.isNotificationFetching = false;
        }, 10000); 
    }
}

async function fetchMessageFromGroq(minutes, type) {
    if (!GROQ_API_KEY) {
        if (type === 'breather') {
            return `業務を始めて${minutes}分が経過しました。少し休憩してリフレッシュしましょう！`;
        }
        return "お疲れ様です！順調ですね。"; 
    }

    let prompt = `同じ業務を${minutes}分続けている人を褒める言葉をください。簡潔に、労う内容でお願いします。`;
    
    if (type === 'breather') {
        prompt = `ユーザーが同じ業務を${minutes}分続けています。過集中を防ぐため、優しく休憩を促すメッセージをください。50文字以内で簡潔に。`;
    }

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
                        content: "あなたはユーザーを優しくサポートするアシスタントです。日本のビジネス文化に合った、丁寧かつ前向きなメッセージを生成してください。" 
                    },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7,
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
            return type === 'breather' ? "少し休憩しませんか？" : "お疲れ様です！";
        }

    } catch (error) {
        console.error("Error calling Groq API:", error);
        return null;
    }
}

async function showBrowserNotification(title, message) {
    if (!("Notification" in window)) return;

    let permission = Notification.permission;

    if (permission === "granted") {
        createNotification(title, message);
    } else if (permission !== "denied") {
        try {
            permission = await Notification.requestPermission();
            if (permission === "granted") {
                createNotification(title, message);
            }
        } catch (error) {
            console.error("Error requesting notification permission:", error);
        }
    }
}

function createNotification(title, message) {
    try {
        const notification = new Notification(title, {
            body: message,
            tag: "gyomukanri-notification",
            renotify: true, // Re-notify even if tag is same
            silent: false,
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };

        // Auto close after a while
        setTimeout(() => {
            notification.close();
        }, 15000);

    } catch (error) {
        console.error("Error creating notification:", error);
    }
}

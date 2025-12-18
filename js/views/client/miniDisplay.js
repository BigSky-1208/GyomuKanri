// js/views/client/miniDisplay.js

/**
 * Document Picture-in-Picture API を使用して
 * 常に前面に表示されるミニウィンドウを作成・管理します。
 */

let miniWindow = null;
let updateInterval = null;

export async function toggleMiniDisplay() {
    // 既に開いている場合は閉じる（トグル動作）
    if (miniWindow && !miniWindow.closed) {
        miniWindow.close();
        miniWindow = null;
        return;
    }

    try {
        // 1. ウィンドウを開く
        if ("documentPictureInPicture" in window) {
            // Document Picture-in-Picture API (常に前面に表示)
            miniWindow = await window.documentPictureInPicture.requestWindow({
                width: 300,
                height: 180,
            });
        } else {
            // 非対応ブラウザ用のフォールバック (通常のポップアップ)
            const width = 300;
            const height = 180;
            const left = window.screen.width - width - 100;
            const top = window.screen.height - height - 100;
            miniWindow = window.open("", "miniDisplay", `width=${width},height=${height},left=${left},top=${top},popup=yes`);
        }

        if (!miniWindow) return;

        // 2. スタイルを適用 (Tailwind CSSを読み込む)
        // ※メインウィンドウと同じスタイルシートをコピー、もしくはCDNを直接指定
        const tailwindLink = document.createElement("script");
        tailwindLink.src = "https://cdn.tailwindcss.com";
        miniWindow.document.head.appendChild(tailwindLink);

        // 少し待ってからスタイル調整（CDN読み込み待ち）
        setTimeout(() => {
            const style = document.createElement("style");
            style.textContent = `
                body { margin: 0; padding: 16px; background-color: #f8fafc; font-family: sans-serif; overflow: hidden; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; }
                .timer { font-variant-numeric: tabular-nums; }
            `;
            miniWindow.document.head.appendChild(style);
        }, 100);

        // 3. HTMLコンテンツの初期構築
        updateContent();

        // 4. 定期更新 (メイン画面のDOMから情報を取得して同期)
        if (updateInterval) clearInterval(updateInterval);
        updateInterval = setInterval(() => {
            if (miniWindow.closed) {
                clearInterval(updateInterval);
                miniWindow = null;
                return;
            }
            updateContent();
        }, 1000);

        // ウィンドウが閉じられた時のクリーンアップ
        miniWindow.addEventListener("pagehide", () => {
            clearInterval(updateInterval);
            miniWindow = null;
        });

    } catch (error) {
        console.error("ミニ表示の起動に失敗しました:", error);
        alert("ミニ表示を開けませんでした。ポップアップブロック設定などを確認してください。");
    }
}

function updateContent() {
    if (!miniWindow || !miniWindow.document) return;

    // メイン画面から現在の情報を取得
    const mainTimerText = document.getElementById("timer-display")?.textContent || "00:00:00";
    
    // 業務名と工数名の取得ロジック (DOMまたは変数から)
    // clientUI.js でセットされている currentTaskDisplay の内容をパースする、
    // または localStorage から読むのが確実
    let currentTaskName = localStorage.getItem('currentTaskName') || "未開始";
    
    // status情報があればそこから詳細を取得（工数名など）
    // 簡易的にDOMから取得する場合:
    const mainTaskDisplay = document.getElementById("current-task-display");
    let fullTaskText = mainTaskDisplay ? mainTaskDisplay.textContent : currentTaskName;

    // 表示内容の構築
    const body = miniWindow.document.body;
    
    // DOMの再構築（ちらつき防止のためinnerHTMLは内容が変わった時のみ更新したいが、簡易実装として毎回上書きでも軽量ならOK）
    // ここでは要素が存在しなければ作成し、あれば更新する方式をとる
    
    let container = body.querySelector("#mini-container");
    if (!container) {
        container = miniWindow.document.createElement("div");
        container.id = "mini-container";
        container.className = "text-center w-full";
        body.appendChild(container);
    }

    // HTMLの更新
    container.innerHTML = `
        <div class="mb-2">
            <p class="text-xs text-gray-500 font-bold mb-1">現在の業務</p>
            <h2 class="text-base font-bold text-gray-800 leading-tight line-clamp-2">${escapeHtml(fullTaskText)}</h2>
        </div>
        <div class="mt-2 p-2 bg-white rounded-lg shadow-sm border border-gray-200">
            <p class="text-3xl font-black text-indigo-600 timer tracking-widest">${mainTimerText}</p>
        </div>
        <div class="mt-2 text-center">
             <button id="close-btn" class="text-xs text-gray-400 hover:text-gray-600 underline">閉じる</button>
        </div>
    `;

    // 閉じるボタンのイベント (再生成されるため毎回付与)
    const closeBtn = container.querySelector("#close-btn");
    if (closeBtn) {
        closeBtn.onclick = () => miniWindow.close();
    }
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

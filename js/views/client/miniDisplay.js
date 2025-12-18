// js/views/client/miniDisplay.js

export let miniWindow = null;
let updateInterval = null;
const MINI_DISPLAY_STATE_KEY = "gyomu_timer_mini_display_active";

/**
 * ミニ表示の開閉を切り替える (ボタンクリックから呼ばれる)
 */
export async function toggleMiniDisplay() {
    if (miniWindow && !miniWindow.closed) {
        closeMiniDisplay();
    } else {
        await startMiniDisplay();
    }
}

/**
 * ミニ表示を実際に起動する内部関数
 */
async function startMiniDisplay() {
    try {
        if ("documentPictureInPicture" in window) {
            // Document Picture-in-Picture API
            miniWindow = await window.documentPictureInPicture.requestWindow({
                width: 300,
                height: 180,
            });
        } else {
            // 通常のポップアップ
            const features = "width=300,height=180,menubar=no,toolbar=no,location=no,status=no,resizable=yes";
            miniWindow = window.open("", "GyomuTimerMini", features);
        }

        if (!miniWindow) return;

        // 状態を保存
        localStorage.setItem(MINI_DISPLAY_STATE_KEY, "true");

        // スタイルとコンテンツの初期化
        setupMiniWindowContent();

        // ウィンドウが閉じられた時のクリーンアップ
        miniWindow.addEventListener("pagehide", () => {
            stopUpdateLoop();
        });

    } catch (error) {
        console.error("ミニ表示の起動に失敗しました:", error);
        localStorage.removeItem(MINI_DISPLAY_STATE_KEY);
    }
}

/**
 * コンテンツの構築と定期更新の開始
 */
function setupMiniWindowContent() {
    // Tailwind読み込み
    const tailwind = document.createElement("script");
    tailwind.src = "https://cdn.tailwindcss.com";
    miniWindow.document.head.appendChild(tailwind);

    const style = document.createElement("style");
    style.textContent = `
        body { margin: 0; padding: 16px; background-color: #f8fafc; font-family: sans-serif; overflow: hidden; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; }
        .timer { font-variant-numeric: tabular-nums; }
    `;
    miniWindow.document.head.appendChild(style);

    // 更新ループ開始
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(() => {
        if (!miniWindow || miniWindow.closed) {
            stopUpdateLoop();
            return;
        }
        updateContent();
    }, 1000);
}

function updateContent() {
    // ... (あなたが作成した updateContent の中身と同じでOKです) ...
}

function stopUpdateLoop() {
    clearInterval(updateInterval);
    miniWindow = null;
    localStorage.removeItem(MINI_DISPLAY_STATE_KEY);
    console.log("ミニ表示を終了しました。");
}

export function closeMiniDisplay() {
    if (miniWindow) {
        miniWindow.close();
    }
    stopUpdateLoop();
}

/**
 * リロード後の再開用関数 (main.js から呼ばれる)
 */
export async function checkAndRestoreMiniDisplay() {
    const isActive = localStorage.getItem(MINI_DISPLAY_STATE_KEY) === "true";
    if (isActive) {
        console.log("休止復帰: ミニ表示の再起動を試みます...");
        // ブラウザ制限により自動起動がブロックされる可能性があるため try-catch
        try {
            await startMiniDisplay();
        } catch (e) {
            console.warn("自動リロード後のミニ表示起動がブロックされました。ユーザー操作が必要です。");
        }
    }
}

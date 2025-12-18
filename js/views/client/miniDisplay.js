// js/views/client/miniDisplay.js

export let miniWindow = null;
let updateInterval = null;
const MINI_DISPLAY_STATE_KEY = "gyomu_timer_mini_display_active";

export async function toggleMiniDisplay() {
    if (miniWindow && !miniWindow.closed) {
        closeMiniDisplay();
    } else {
        await startMiniDisplay();
    }
}

async function startMiniDisplay() {
    try {
        if ("documentPictureInPicture" in window) {
            miniWindow = await window.documentPictureInPicture.requestWindow({
                width: 300,
                height: 180,
            });
        } else {
            const features = "width=300,height=180,menubar=no,toolbar=no,popup=yes";
            miniWindow = window.open("", "GyomuTimerMini", features);
        }

        if (!miniWindow) return;

        localStorage.setItem(MINI_DISPLAY_STATE_KEY, "true");

        // ★修正: 白紙を避けるため、即座に中身を書き込む
        const doc = miniWindow.document;
        doc.body.innerHTML = '<div id="mini-container" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; background:#f8fafc;">読み込み中...</div>';

        // スタイル適用
        const tailwind = doc.createElement("script");
        tailwind.src = "https://cdn.tailwindcss.com";
        doc.head.appendChild(tailwind);

        // 更新ループ開始
        startUpdateLoop();

        miniWindow.addEventListener("pagehide", () => stopUpdateLoop());

    } catch (error) {
        console.error("ミニ表示起動エラー:", error);
        localStorage.removeItem(MINI_DISPLAY_STATE_KEY);
        alert("ミニ表示を開けませんでした。ボタンを直接クリックしてください。");
    }
}

function startUpdateLoop() {
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
    if (!miniWindow) return;
    const mainTimer = document.getElementById("timer-display")?.textContent || "00:00:00";
    const mainTask = document.getElementById("current-task-display")?.textContent || "未開始";
    
    const container = miniWindow.document.getElementById("mini-container");
    if (container) {
        container.innerHTML = `
            <div class="text-center p-4">
                <p class="text-xs text-gray-500 font-bold mb-1">現在の業務</p>
                <h2 class="text-sm font-bold text-gray-800 mb-3">${mainTask}</h2>
                <div class="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                    <p class="text-3xl font-black text-indigo-600" style="font-variant-numeric: tabular-nums;">${mainTimer}</p>
                </div>
            </div>
        `;
    }
}

function stopUpdateLoop() {
    clearInterval(updateInterval);
    miniWindow = null;
    localStorage.removeItem(MINI_DISPLAY_STATE_KEY);
}

export function closeMiniDisplay() {
    if (miniWindow) miniWindow.close();
    stopUpdateLoop();
}

// ★修正: 自動で開かず、ユーザーに「再開ボタン」を促す
export function checkAndRestoreMiniDisplay() {
    if (localStorage.getItem(MINI_DISPLAY_STATE_KEY) === "true") {
        // 画面上に小さな案内を出す（例：トースト通知や一時的なボタン）
        console.log("ミニ表示の再開準備完了。ユーザー操作を待機。");
        // 必要であれば、ここで特定のボタンを光らせるなどの処理を追加
    }
}

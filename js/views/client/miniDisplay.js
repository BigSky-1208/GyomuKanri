// js/views/client/miniDisplay.js

const MINI_DISPLAY_STATE_KEY = "gyomu_timer_mini_display_active";

// 既存のウィンドウ変数をエクスポート（main.jsから確認できるように）
export let miniWindow = null;

export function toggleMiniDisplay() {
    if (miniWindow && !miniWindow.closed) {
        closeMiniDisplay();
    } else {
        openMiniDisplay();
    }
}

export function openMiniDisplay() {
    const url = "mini-display.html"; // ミニ表示用のHTML
    const features = "width=300,height=200,menubar=no,toolbar=no,location=no,status=no,resizable=yes";
    
    miniWindow = window.open(url, "GyomuTimerMini", features);
    
    if (miniWindow) {
        // ★追加：ウィンドウが開いている状態を保存
        localStorage.setItem(MINI_DISPLAY_STATE_KEY, "true");

        // ウィンドウが閉じられた時の検知
        const timer = setInterval(() => {
            if (!miniWindow || miniWindow.closed) {
                clearInterval(timer);
                localStorage.removeItem(MINI_DISPLAY_STATE_KEY);
            }
        }, 1000);
    }
}

export function closeMiniDisplay() {
    if (miniWindow) {
        miniWindow.close();
        miniWindow = null;
    }
    localStorage.removeItem(MINI_DISPLAY_STATE_KEY);
}

// ★追加：リロード後の再開用関数
export function checkAndRestoreMiniDisplay() {
    const isActive = localStorage.getItem(MINI_DISPLAY_STATE_KEY) === "true";
    if (isActive) {
        console.log("ミニ表示モードを復元します...");
        openMiniDisplay();
    }
}

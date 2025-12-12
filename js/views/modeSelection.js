// js/views/modeSelection.js

import { showView, VIEWS, userId, db } from "../main.js";
import { showPasswordModal } from "../components/modal.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// DOM要素
const clientBtn = document.getElementById("client-mode-btn");
const managerBtn = document.getElementById("manager-mode-btn");
const hostBtn = document.getElementById("host-mode-btn");

/**
 * モード選択画面の初期化
 */
export function initializeModeSelectionView() {
    console.log("Initializing Mode Selection View...");
    // 必要に応じてボタンの有効化/無効化などをここで行う
}

/**
 * イベントリスナーの設定
 */
export function setupModeSelectionEventListeners() {
    console.log("Setting up Mode Selection event listeners...");

    clientBtn?.addEventListener("click", () => handleModeSelect(VIEWS.CLIENT));
    managerBtn?.addEventListener("click", () => handleModeSelect(VIEWS.MANAGER));
    hostBtn?.addEventListener("click", () => handleModeSelect(VIEWS.HOST));
}

/**
 * モード選択時の処理
 * 権限チェックを行い、権限があればパスワードをスキップする
 */
async function handleModeSelect(mode) {
    // 1. 一般画面（Client）は無条件で移動
    if (mode === VIEWS.CLIENT) {
        showView(VIEWS.CLIENT);
        return;
    }

    // 2. 権限チェック (管理者 or 業務管理者)
    const hasPermission = await checkUserPermission(mode);

    if (hasPermission) {
        console.log(`Permission granted for ${mode} via user role.`);
        showView(mode);
        return;
    }

    // 3. 権限がない場合はパスワード入力を求める (従来通り)
    if (mode === VIEWS.HOST) {
        showPasswordModal("host", () => showView(VIEWS.HOST));
    } else if (mode === VIEWS.MANAGER) {
        showPasswordModal("manager", () => showView(VIEWS.MANAGER));
    }
}

/**
 * ユーザーの権限を確認する関数
 * @param {string} targetView - 移動先のビュー (VIEWS.HOST or VIEWS.MANAGER)
 * @returns {Promise<boolean>} - 権限があれば true
 */
async function checkUserPermission(targetView) {
    if (!userId) return false;

    try {
        const userRef = doc(db, "user_profiles", userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) return false;

        const role = userSnap.data().role;

        // 管理者画面へ行く場合
        if (targetView === VIEWS.HOST) {
            return role === "host";
        }

        // 業務管理者画面へ行く場合
        if (targetView === VIEWS.MANAGER) {
            // "host"(管理者) は "manager"(業務管理者) の画面も入れるようにする
            return role === "manager" || role === "host";
        }

        return false;
    } catch (error) {
        console.error("Permission check failed:", error);
        return false;
    }
}

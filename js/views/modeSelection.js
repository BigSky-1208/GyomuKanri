// js/views/modeSelection.js

import { showView, VIEWS, userId, db } from "../main.js";
import { showPasswordModal } from "../components/modal.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// DOM要素 (HTMLのIDに合わせて修正)
const clientBtn = document.getElementById("select-client-btn");
const hostBtn = document.getElementById("select-host-btn");
const settingsBtn = document.getElementById("task-settings-btn"); // 追加

/**
 * モード選択画面の初期化
 */
export function initializeModeSelectionView() {
    console.log("Initializing Mode Selection View...");
}

/**
 * イベントリスナーの設定
 */
export function setupModeSelectionEventListeners() {
    console.log("Setting up Mode Selection event listeners...");

    // 従業員モード
    clientBtn?.addEventListener("click", () => handleModeSelect(VIEWS.CLIENT));
    
    // 管理者モード
    hostBtn?.addEventListener("click", () => handleModeSelect(VIEWS.HOST));

    // 業務内容設定 (追加)
    settingsBtn?.addEventListener("click", () => {
        showView(VIEWS.TASK_SETTINGS);
    });
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

    // 3. 権限がない場合はパスワード入力を求める
    if (mode === VIEWS.HOST) {
        // "host" という文字列は modal.js の showPasswordModal 内で判定に使われます
        showPasswordModal("host", () => showView(VIEWS.HOST));
    } 
}

/**
 * ユーザーの権限を確認する関数
 * @param {string} targetView - 移動先のビュー
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
            // roleが host または manager ならアクセス許可（要件に合わせて調整してください）
            return role === "host" || role === "manager";
        }

        return false;
    } catch (error) {
        console.error("Permission check failed:", error);
        return false;
    }
}

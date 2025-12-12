// js/components/modal.js

// --- 確認モーダル (Yes/No) ---
export function showConfirmationModal(message, onConfirm, onCancel) {
    const modal = document.getElementById("confirmation-modal");
    const msgEl = document.getElementById("confirmation-message");
    const confirmBtn = document.getElementById("confirm-btn");
    const cancelBtn = document.getElementById("cancel-btn");

    if (!modal) return;

    msgEl.textContent = message;
    modal.classList.remove("hidden");

    // イベントリスナーの重複を防ぐため、onclickプロパティを使用
    confirmBtn.onclick = () => {
        modal.classList.add("hidden");
        if (onConfirm) onConfirm();
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
    };

    cancelBtn.onclick = () => {
        modal.classList.add("hidden");
        if (onCancel) onCancel();
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
    };
}

export function hideConfirmationModal() {
    const modal = document.getElementById("confirmation-modal");
    if (modal) modal.classList.add("hidden");
}

// --- ★追加: パスワード入力モーダル ---
export function showPasswordModal(role, onSuccess) {
    const modal = document.getElementById("password-modal");
    const input = document.getElementById("password-input");
    const submitBtn = document.getElementById("password-submit-btn");
    const cancelBtn = document.getElementById("password-cancel-btn");
    const errorMsg = document.getElementById("password-error-msg");

    // モーダルHTMLが存在しない場合のフォールバック（念のため）
    if (!modal) {
        const password = prompt(role === "host" ? "管理者パスワードを入力:" : "業務管理者パスワードを入力:");
        const isValid = (role === "host" && password === "9999") || (role === "manager" && password === "0000");
        if (isValid) onSuccess();
        else alert("パスワードが違います");
        return;
    }

    // UIリセット
    input.value = "";
    errorMsg.classList.add("hidden");
    input.classList.remove("border-red-500");
    modal.classList.remove("hidden");
    input.focus();

    // クリーンアップ関数
    const cleanup = () => {
        submitBtn.onclick = null;
        if(cancelBtn) cancelBtn.onclick = null;
        input.onkeydown = null;
        modal.classList.add("hidden");
    };

    // パスワードチェック処理
    const checkPassword = () => {
        const val = input.value;
        let isValid = false;

        // ハードコーディングされたパスワード設定
        if (role === "host" && val === "9999") isValid = true;
        if (role === "manager" && val === "0000") isValid = true;

        if (isValid) {
            cleanup();
            onSuccess();
        } else {
            errorMsg.classList.remove("hidden");
            input.classList.add("border-red-500");
            input.value = ""; // 入力をクリア
        }
    };

    // イベント設定
    submitBtn.onclick = checkPassword;
    
    if (cancelBtn) {
        cancelBtn.onclick = cleanup;
    }

    input.onkeydown = (e) => {
        if (e.key === "Enter") checkPassword();
        if (e.key === "Escape") cleanup();
    };
}

// --- ユーザー追加モーダル ---
export function openAddUserModal() {
    const modal = document.getElementById("add-user-modal");
    if (modal) {
        modal.classList.remove("hidden");
        // 閉じるボタンの挙動はHTML側のonclick属性やmain.js等で制御されている前提
        // 必要ならここでリスナーを追加
        const cancelBtn = document.getElementById("add-user-modal-cancel-btn");
        if(cancelBtn) {
            cancelBtn.onclick = () => modal.classList.add("hidden");
        }
    }
}

// --- 休憩予約モーダル ---
export function openBreakReservationModal(editId = null) {
    const modal = document.getElementById("break-reservation-modal");
    const timeInput = document.getElementById("break-reservation-time-input");
    const cancelBtn = document.getElementById("break-reservation-cancel-btn");
    
    if (modal) {
        timeInput.value = ""; // リセット
        modal.classList.remove("hidden");
        timeInput.focus();

        if(cancelBtn) {
            cancelBtn.onclick = () => modal.classList.add("hidden");
        }
    }
}

// --- 退勤修正モーダル用 ---
export const fixCheckoutModal = document.getElementById("fix-checkout-modal");

// --- ヘルプモーダル ---
export function showHelpModal(mode) {
    const modal = document.getElementById('help-modal');
    const content = document.getElementById('help-content');
    const closeBtn = document.getElementById('help-close-btn');

    if (!modal || !content) return;

    let html = "";
    if (mode === 'client') {
        html = `
            <h3 class="font-bold text-lg mb-2 text-indigo-600">従業員画面の使い方</h3>
            <ul class="list-disc pl-5 space-y-2 text-sm text-gray-700">
                <li><b>業務開始:</b> リストから業務を選んで「業務開始」を押します。</li>
                <li><b>休憩:</b> 「休憩開始」ボタンで休憩に入ります。戻るときは再度押します。</li>
                <li><b>退勤:</b> 「業務終了」ボタンで退勤します。日報が送信されます。</li>
                <li><b>予約機能:</b> 「予約設定」から休憩や帰宅時間を予約できます。ブラウザを閉じていても、時間になると自動で切り替わります。</li>
                <li><b>ミニ表示:</b> 「ミニ表示モード」で小さなタイマーを最前面に表示できます。</li>
            </ul>
        `;
    } else if (mode === 'manager') {
        html = `
            <h3 class="font-bold text-lg mb-2 text-indigo-600">業務管理者画面の使い方</h3>
            <ul class="list-disc pl-5 space-y-2 text-sm text-gray-700">
                <li><b>リアルタイム状況:</b> 現在稼働中のメンバーと業務内容が表示されます。</li>
                <li><b>詳細確認:</b> 「詳細」ボタンでその人の本日の記録を確認できます。</li>
            </ul>
        `;
    } else if (mode === 'host') {
         html = `
            <h3 class="font-bold text-lg mb-2 text-indigo-600">管理者画面の使い方</h3>
            <ul class="list-disc pl-5 space-y-2 text-sm text-gray-700">
                <li><b>ユーザー管理:</b> ユーザーの追加・削除・権限変更ができます。</li>
                <li><b>Excel出力:</b> 「Excel出力」ボタンから期間指定でデータをダウンロードできます。</li>
                <li><b>戸村さんステータス:</b> 従業員画面に表示される戸村さんの状況を変更できます。</li>
            </ul>
        `;
    }

    content.innerHTML = html;
    modal.classList.remove("hidden");
    
    if (closeBtn) {
        closeBtn.onclick = () => modal.classList.add("hidden");
    }
}

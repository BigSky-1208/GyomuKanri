// js/components/modal/utils.js
import { showModal, closeModal } from "./core.js";
import { userReservations } from '../../views/client/reservations.js';

// --- 要素の取得 ---
export const helpModal = document.getElementById("help-modal");
export const goalDetailsModal = document.getElementById("goal-details-modal");
export const breakReservationModal = document.getElementById("break-reservation-modal");

/**
 * ヘルプモーダルを表示する
 * @param {string} pageKey - 表示するヘルプのカテゴリ (client, host, etc.)
 */
export function showHelpModal(pageKey) {
    const titleEl = document.getElementById("help-modal-title");
    const contentEl = document.getElementById("help-modal-content");
    if (!helpModal || !titleEl || !contentEl) return;

    let title = "ヘルプ";
    let content = "<p>ヘルプコンテンツが見つかりません。</p>";

    const helpContents = {
        client: {
            title: "従業員画面ヘルプ",
            content: `
                <p class="font-semibold mb-2">業務時間を記録するためのメイン画面です。</p>
                <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>業務開始:</strong> 業務内容を選択し「開始」を押します。</li>
                    <li><strong>予約機能:</strong> 「予約」ボタンから休憩や帰宅の時間をセットできます。</li>
                    <li><strong>自動実行:</strong> セットした時間になると、ブラウザが裏側にいても自動でステータスが切り替わります。</li>
                </ul>`
        },
        host: {
            title: "管理者画面ヘルプ",
            content: `
                <p class="font-semibold mb-2">チーム全体の稼働状況を管理する画面です。</p>
                <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>リアルタイム監視:</strong> 全員の現在の業務と経過時間が確認できます。</li>
                    <li><strong>メッセージ:</strong> 特定の業務中の人に一括で通知を送れます。</li>
                </ul>`
        },
        taskSettings: { title: "業務内容設定ヘルプ", content: "<p>業務マスターの追加・編集・削除を行えます。</p>" },
        progress: { title: "業務進捗ページヘルプ", content: "<p>各工数（Goal）の達成状況を確認・編集できます。</p>" }
    };

    if (helpContents[pageKey]) {
        title = helpContents[pageKey].title;
        content = helpContents[pageKey].content;
    }

    titleEl.textContent = title;
    contentEl.innerHTML = content;
    showModal(helpModal);
}

/**
 * 工数（Goal）のメモ詳細などを表示する
 */
export function openGoalDetailsModal(title, contentHtml) {
    const titleEl = document.getElementById("goal-details-modal-title");
    const contentEl = document.getElementById("goal-details-modal-content");
    if (!goalDetailsModal || !titleEl || !contentEl) return;

    titleEl.textContent = title;
    contentEl.innerHTML = contentHtml;
    showModal(goalDetailsModal);
}

/**
 * 休憩予約の追加・編集モーダルを開く
 * @param {string|null} id - 編集対象の予約ID（新規の場合はnull）
 */
export function openBreakReservationModal(id = null) {
    const titleEl = document.getElementById("break-reservation-modal-title");
    const timeInput = document.getElementById("break-reservation-time-input");
    const idInput = document.getElementById("break-reservation-id");
    if (!breakReservationModal || !titleEl || !timeInput) return;

    if (id) {
        titleEl.textContent = "休憩予約の編集";
        // reservations.js からインポートした予約リストから検索
        const reservation = userReservations?.find((r) => r.id === id);
        if (reservation) {
            timeInput.value = reservation.scheduledTime ? reservation.scheduledTime.substring(11, 16) : "";
            idInput.value = id;
        }
    } else {
        titleEl.textContent = "休憩予約の追加";
        timeInput.value = "";
        idInput.value = "";
    }

    showModal(breakReservationModal);
    timeInput.focus();
}

// 閉じる処理の共通化（core.jsのcloseModalを呼び出すラップ）
export const closeHelpModal = () => closeModal(helpModal);
export const closeGoalDetailsModal = () => closeModal(goalDetailsModal);
export const closeBreakReservationModal = () => closeModal(breakReservationModal);

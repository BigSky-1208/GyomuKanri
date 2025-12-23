// js/components/modal/utils.js
import { showModal, closeModal } from "./core.js";
import { userReservations } from '../../views/client/reservations.js';

// --- DOM要素の取得 ---
export const helpModal = document.getElementById("help-modal");
export const goalDetailsModal = document.getElementById("goal-details-modal");
export const breakReservationModal = document.getElementById("break-reservation-modal");

/**
 * 1. ヘルプモーダルを表示する
 * 元の長い if-else 分岐をオブジェクト形式にまとめて短縮しましたが、
 * 内容（client, host, taskSettings, progress, approval）はすべて保持しています。
 */
export function showHelpModal(pageKey) {
    const titleEl = document.getElementById("help-modal-title");
    const contentEl = document.getElementById("help-modal-content");
    if (!helpModal || !titleEl || !contentEl) return;

    const helpContents = {
        client: {
            title: "従業員画面ヘルプ",
            content: `
                <p class="font-semibold mb-2">業務記録のメイン画面です。</p>
                <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>業務の記録:</strong> 内容を選択し「業務変更」で開始します。</li>
                    <li><strong>休憩/帰宅:</strong> 対応するボタンで記録します。予約も可能です。</li>
                </ul>`
        },
        host: {
            title: "管理者画面ヘルプ",
            content: `
                <p class="font-semibold mb-2">チームの稼働状況を把握・管理する画面です。</p>
                <ul class="list-disc list-inside ml-4 space-y-1 text-sm text-gray-700">
                    <li><strong>メッセージ:</strong> 従業員にリアルタイム通知を送信します。</li>
                    <li><strong>稼働監視:</strong> 全員の現在のタスクを確認できます。</li>
                </ul>`
        },
        taskSettings: { title: "業務内容設定ヘルプ", content: "<p>業務マスターの追加・編集・削除を行えます。</p>" },
        progress: { title: "業務進捗ページヘルプ", content: "<p>各工数（Goal）の進捗確認や、完了・削除操作を行えます。</p>" },
        approval: { title: "申請承認画面ヘルプ", content: "<p>従業員からの修正申請を確認・承認する画面です。</p>" }
    };

    const data = helpContents[pageKey] || { title: "ヘルプ", content: "<p>ヘルプコンテンツが見つかりません。</p>" };
    titleEl.textContent = data.title;
    contentEl.innerHTML = data.content;
    showModal(helpModal);
}

/**
 * 2. 工数（Goal）の詳細情報を表示する
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
 * 3. 休憩予約の追加・編集モーダルを開く
 * DBから取得した ISOString (2025-12-23T15:00...) から時刻部分(15:00)を
 * 正確に抜き出して入力欄にセットするロジックを完備しています。
 */
export function openBreakReservationModal(id = null) {
    const titleEl = document.getElementById("break-reservation-modal-title");
    const timeIn = document.getElementById("break-reservation-time-input");
    const idIn = document.getElementById("break-reservation-id");
    if (!breakReservationModal || !titleEl || !timeIn) return;

    if (id) {
        titleEl.textContent = "休憩予約の編集";
        const res = userReservations?.find(r => r.id === id);
        if (res) {
            // ISO形式(scheduledTime)と簡易形式(time)の両方に対応
            let displayTime = "";
            if (res.scheduledTime && res.scheduledTime.includes("T")) {
                displayTime = res.scheduledTime.substring(11, 16);
            } else {
                displayTime = res.time || "";
            }
            timeIn.value = displayTime;
            idIn.value = id;
        }
    } else {
        titleEl.textContent = "休憩予約の追加";
        timeIn.value = "";
        idIn.value = "";
    }
    showModal(breakReservationModal);
    timeIn.focus();
}

// 閉じる処理のショートカット
export const closeHelpModal = () => closeModal(helpModal);
export const closeGoalDetailsModal = () => closeModal(goalDetailsModal);
export const closeBreakReservationModal = () => closeModal(breakReservationModal);

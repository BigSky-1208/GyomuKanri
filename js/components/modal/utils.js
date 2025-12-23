// js/components/modal/utils.js
import { 
    showModal, 
    closeModal, 
    helpModal,           // ← これが足りないとエラーになります
    goalDetailsModal, 
    breakReservationModal 
} from "./core.js";
import { userReservations } from '../../views/client/reservations.js';

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
        title: "従業員画面（業務記録）ヘルプ",
        content: `
            <p class="font-semibold mb-2 text-gray-800">日々の業務内容と時間を記録するメイン画面です。</p>
            <div class="space-y-3 text-sm text-gray-600">
                <div>
                    <strong class="text-gray-700 block">📝 業務の開始・変更</strong>
                    <p>リストから「大項目」「小項目」を選択し、<span class="text-blue-600 font-bold">「業務変更」</span>ボタンを押すと記録が開始されます。</p>
                </div>
                <div>
                    <strong class="text-gray-700 block">☕ 休憩・帰宅</strong>
                    <p>離席時は「休憩」、業務終了時は「帰宅」を押してください。ステータスが切り替わります。</p>
                </div>
                <div>
                    <strong class="text-gray-700 block">📅 予約機能（未来の予定）</strong>
                    <p>「13:00に休憩」など、あらかじめ時間を指定してボタンを押すと、その時間に自動でステータスが切り替わります（予約中と表示されます）。</p>
                </div>
                <div>
                    <strong class="text-gray-700 block">✏️ 修正申請</strong>
                    <p>過去の履歴や、押し忘れがあった場合は「履歴タブ」から修正申請を行ってください。管理者の承認後に反映されます。</p>
                </div>
            </div>`
    },
    host: {
        title: "管理者画面（モニタリング）ヘルプ",
        content: `
            <p class="font-semibold mb-2 text-gray-800">チーム全体の稼働状況をリアルタイムで把握・管理します。</p>
            <div class="space-y-3 text-sm text-gray-600">
                <div>
                    <strong class="text-gray-700 block">👀 リアルタイム監視</strong>
                    <p>現在「誰が」「何の業務を」「どれくらいの時間」行っているかが一覧表示されます。休憩中や帰宅済みのメンバーも確認可能です。</p>
                </div>
                <div>
                    <strong class="text-gray-700 block">📢 メッセージ送信</strong>
                    <p>特定の従業員、または全員に対してポップアップメッセージを送信できます。業務指示や全体周知にご利用ください。</p>
                </div>
                <div>
                    <strong class="text-gray-700 block">📊 データの確認</strong>
                    <p>従業員の記録データは自動的に集計され、レポートや進捗画面に反映されます。</p>
                </div>
            </div>`
    },
    taskSettings: {
        title: "業務マスター設定ヘルプ",
        content: `
            <p class="font-semibold mb-2 text-gray-800">従業員が選択する業務リスト（マスター）を管理します。</p>
            <ul class="list-disc list-inside ml-2 space-y-1 text-sm text-gray-600">
                <li><strong>新規追加:</strong> 業務の大項目（プロジェクト名など）と小項目（タスク名など）を登録します。</li>
                <li><strong>目標設定（Goal）:</strong> その業務に対する目標件数や時間を設定できます（進捗画面で利用）。</li>
                <li><strong>編集・削除:</strong> 既存の業務名を変更したり、不要になった業務を削除できます。削除すると従業員の選択肢から消えます。</li>
                <li><strong>並び順:</strong> フォーム上の表示順序を調整できる場合があります。</li>
            </ul>`
    },
    progress: {
        title: "業務進捗管理ヘルプ",
        content: `
            <p class="font-semibold mb-2 text-gray-800">設定された目標（Goal）に対する進捗状況を可視化します。</p>
            <div class="space-y-3 text-sm text-gray-600">
                <div>
                    <strong class="text-gray-700 block">📈 進捗の確認</strong>
                    <p>各業務ごとの「消化工数」や「達成率」がバーグラフ等で表示されます。遅れが生じている業務の早期発見に役立ちます。</p>
                </div>
                <div>
                    <strong class="text-gray-700 block">✅ 完了ステータス管理</strong>
                    <p>業務が終了したら「完了」にステータスを変更してください。一覧から整理され、過去ログとして保存されます。</p>
                </div>
                <div>
                    <strong class="text-gray-700 block">🗑️ 削除操作</strong>
                    <p>誤って作成された進捗データ等はここから削除可能です（慎重に操作してください）。</p>
                </div>
            </div>`
    },
    approval: {
        title: "申請承認・修正ヘルプ",
        content: `
            <p class="font-semibold mb-2 text-gray-800">従業員からの打刻修正申請を管理します。</p>
            <ul class="list-disc list-inside ml-2 space-y-1 text-sm text-gray-600">
                <li><strong>申請の確認:</strong> 「打刻忘れ」「時間間違い」などの申請一覧が表示されます。理由を確認してください。</li>
                <li><strong>承認:</strong> 内容に問題がなければ承認します。承認と同時に従業員のタイムラインデータが書き換わります。</li>
                <li><strong>否認:</strong> 内容に不備がある場合は否認できます。否認理由は従業員に通知されます。</li>
                <li><strong>履歴:</strong> 過去に承認・否認した履歴を確認できます。</li>
            </ul>`
    }
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

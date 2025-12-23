// js/components/modal/message.js
import { showModal, closeModal } from "./core.js";

/**
 * 管理者用メッセージ送信モーダルを開く
 * @param {Array} allUsers - 全ユーザーリスト
 * @param {Object} workingData - 稼働状況データ ({all: [ids], byTask: {taskName: [ids]}})
 * @param {Function} onSendCallback - 送信ボタン押下時の処理
 */
export function openMessageModal(allUsers, workingData, onSendCallback) {
    const messageModal = document.getElementById("message-modal");
    if (!messageModal) return;

    // --- 要素の取得 ---
    const titleInput = document.getElementById("message-title-input");
    const bodyInput = document.getElementById("message-body-input");
    const sendBtn = document.getElementById("message-send-btn");
    const cancelBtn = document.getElementById("message-cancel-btn");
    const targetRadios = document.getElementsByName("message-target-type");
    
    const userSelect = document.getElementById("message-user-select");
    const manualList = document.getElementById("message-manual-list");
    const workingInfo = document.getElementById("message-target-working-info");
    const workingTaskSelect = document.getElementById("message-working-task-select");

    const individualContainer = document.getElementById("message-target-individual-container");
    const workingContainer = workingInfo.parentElement; // ラベルの親
    const manualContainer = document.getElementById("message-target-manual-container");

    // --- 1. 初期化 (リセット) ---
    titleInput.value = "";
    bodyInput.value = "";
    if (targetRadios[0]) targetRadios[0].checked = true;

    // ターゲットUIの表示切り替えヘルパー
    const updateTargetUI = (type) => {
        individualContainer.classList.add("hidden");
        workingContainer.classList.add("hidden");
        manualContainer.classList.add("hidden");

        if (type === "individual") individualContainer.classList.remove("hidden");
        else if (type === "working") workingContainer.classList.remove("hidden");
        else if (type === "manual") manualContainer.classList.remove("hidden");
    };
    updateTargetUI("individual");

    // ラジオボタンにイベント設定
    Array.from(targetRadios).forEach(radio => {
        radio.onclick = () => updateTargetUI(radio.value);
    });

    // --- 2. リスト生成 (プルダウン・チェックボックス) ---

    // 個人選択
    userSelect.innerHTML = "";
    allUsers.forEach(user => {
        const opt = document.createElement("option");
        opt.value = user.id;
        opt.textContent = user.displayName || user.name || "名称未設定";
        userSelect.appendChild(opt);
    });

    // 稼働中タスク別選択
    const allCount = workingData.all.length;
    workingInfo.textContent = `現在、${allCount}名が稼働中です。`;
    workingTaskSelect.innerHTML = "";
    
    const allOpt = document.createElement("option");
    allOpt.value = "all";
    allOpt.textContent = `全員 (${allCount}名)`;
    workingTaskSelect.appendChild(allOpt);

    Object.keys(workingData.byTask).sort().forEach(taskName => {
        const count = workingData.byTask[taskName].length;
        const opt = document.createElement("option");
        opt.value = taskName;
        opt.textContent = `${taskName} (${count}名)`;
        workingTaskSelect.appendChild(opt);
    });

    // 手動選択 (チェックボックス形式)
    manualList.innerHTML = "";
    allUsers.forEach(user => {
        const label = document.createElement("label");
        label.className = "flex items-center p-2 hover:bg-gray-50 border-b border-gray-100 cursor-pointer";
        label.innerHTML = `
            <input type="checkbox" value="${user.id}" class="manual-target-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded mr-2">
            <span class="text-sm text-gray-700">${user.displayName || user.name || "名称未設定"}</span>
        `;
        manualList.appendChild(label);
    });

    // --- 3. ボタン処理 ---

    sendBtn.onclick = () => {
        const title = titleInput.value.trim();
        const body = bodyInput.value.trim();
        if (!title || !body) {
            alert("タイトルと本文を入力してください。");
            return;
        }

        const targetType = Array.from(targetRadios).find(r => r.checked)?.value;
        let targetIds = [];

        if (targetType === "individual") {
            targetIds = [userSelect.value];
        } else if (targetType === "working") {
            const selectedTask = workingTaskSelect.value;
            targetIds = selectedTask === "all" ? workingData.all : (workingData.byTask[selectedTask] || []);
        } else if (targetType === "manual") {
            const checkboxes = manualList.querySelectorAll(".manual-target-checkbox:checked");
            checkboxes.forEach(cb => targetIds.push(cb.value));
        }

        if (targetIds.length === 0) {
            alert("送信対象が選択されていません。");
            return;
        }

        // コールバック実行
        onSendCallback(targetIds, title, body);
        closeModal(messageModal);
    };

    cancelBtn.onclick = () => closeModal(messageModal);

    showModal(messageModal);
}

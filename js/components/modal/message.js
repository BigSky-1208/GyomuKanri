// js/components/modal/adminAction.js
import { showModal, closeModal } from "./core.js";

// --- 要素の取得 ---
export const addUserModal = document.getElementById("add-user-modal");
const addUserModalNameInput = document.getElementById("add-user-modal-name-input");
const addUserModalError = document.getElementById("add-user-modal-error");

/**
 * 1. 管理者用メッセージ送信モーダルを開く
 */
export function openMessageModal(allUsers, workingData, onSendCallback) {
    const messageModal = document.getElementById("message-modal");
    if (!messageModal) return;

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
    const workingContainer = workingInfo.parentElement; 
    const manualContainer = document.getElementById("message-target-manual-container");

    // リセット
    titleInput.value = "";
    bodyInput.value = "";
    if (targetRadios[0]) targetRadios[0].checked = true;

    const updateTargetUI = (type) => {
        individualContainer.classList.add("hidden");
        workingContainer.classList.add("hidden");
        manualContainer.classList.add("hidden");
        if (type === "individual") individualContainer.classList.remove("hidden");
        else if (type === "working") workingContainer.classList.remove("hidden");
        else if (type === "manual") manualContainer.classList.remove("hidden");
    };
    updateTargetUI("individual");

    Array.from(targetRadios).forEach(radio => {
        radio.onclick = () => updateTargetUI(radio.value);
    });

    // リスト生成
    userSelect.innerHTML = "";
    allUsers.forEach(user => {
        const opt = document.createElement("option");
        opt.value = user.id;
        opt.textContent = user.displayName || user.name || "名称未設定";
        userSelect.appendChild(opt);
    });

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

    sendBtn.onclick = () => {
        const title = titleInput.value.trim();
        const body = bodyInput.value.trim();
        if (!title || !body) return alert("入力してください");

        const targetType = Array.from(targetRadios).find(r => r.checked)?.value;
        let targetIds = [];
        if (targetType === "individual") targetIds = [userSelect.value];
        else if (targetType === "working") {
            const sel = workingTaskSelect.value;
            targetIds = sel === "all" ? workingData.all : (workingData.byTask[sel] || []);
        } else if (targetType === "manual") {
            manualList.querySelectorAll(".manual-target-checkbox:checked").forEach(cb => targetIds.push(cb.value));
        }

        if (targetIds.length === 0) return alert("送信対象がいません");
        onSendCallback(targetIds, title, body);
        closeModal(messageModal);
    };
    cancelBtn.onclick = () => closeModal(messageModal);
    showModal(messageModal);
}

/**
 * 2. ユーザー追加モーダルを開く
 */
export function openAddUserModal() {
    if (!addUserModal || !addUserModalNameInput || !addUserModalError) return;
    addUserModalNameInput.value = "";
    addUserModalError.textContent = "";
    showModal(addUserModal);
    addUserModalNameInput.focus();
}

export function closeAddUserModal() {
    closeModal(addUserModal);
}

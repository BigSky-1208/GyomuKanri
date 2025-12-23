// js/components/modal/adminAction.js
import { showModal, closeModal } from "./core.js";

export const addUserModal = document.getElementById("add-user-modal");

export function openMessageModal(allUsers, workingData, onSendCallback) {
    const messageModal = document.getElementById("message-modal");
    if (!messageModal) return;

    // 要素取得
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

    // 初期化
    titleInput.value = ""; bodyInput.value = "";
    if (targetRadios[0]) targetRadios[0].checked = true;

    const updateUI = (type) => {
        [individualContainer, workingContainer, manualContainer].forEach(c => c.classList.add("hidden"));
        if (type === "individual") individualContainer.classList.remove("hidden");
        else if (type === "working") workingContainer.classList.remove("hidden");
        else if (type === "manual") manualContainer.classList.remove("hidden");
    };
    updateUI("individual");
    Array.from(targetRadios).forEach(r => r.onclick = () => updateUI(r.value));

    // リスト生成
    userSelect.innerHTML = "";
    allUsers.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.id; opt.textContent = u.displayName || u.name || "名称未設定";
        userSelect.appendChild(opt);
    });

    const allCount = workingData.all.length;
    workingInfo.textContent = `現在、${allCount}名の従業員が業務中です。`;
    workingTaskSelect.innerHTML = "";
    const allOpt = document.createElement("option");
    allOpt.value = "all"; allOpt.textContent = `全員 (${allCount}名)`;
    workingTaskSelect.appendChild(allOpt);

    Object.keys(workingData.byTask).sort().forEach(taskName => {
        const opt = document.createElement("option");
        opt.value = taskName; opt.textContent = `${taskName} (${workingData.byTask[taskName].length}名)`;
        workingTaskSelect.appendChild(opt);
    });

    manualList.innerHTML = "";
    allUsers.forEach(u => {
        const label = document.createElement("label");
        label.className = "flex items-center p-2 hover:bg-gray-50 border-b cursor-pointer";
        label.innerHTML = `<input type="checkbox" value="${u.id}" class="manual-target-checkbox mr-2"><span class="text-sm">${u.displayName || u.name || "名称未設定"}</span>`;
        manualList.appendChild(label);
    });

    sendBtn.onclick = () => {
        const title = titleInput.value.trim(), body = bodyInput.value.trim();
        if (!title || !body) { alert("タイトルと本文を入力してください。"); return; }
        const type = Array.from(targetRadios).find(r => r.checked)?.value;
        let ids = [];
        if (type === "individual") ids = [userSelect.value];
        else if (type === "working") ids = workingTaskSelect.value === "all" ? workingData.all : (workingData.byTask[workingTaskSelect.value] || []);
        else if (type === "manual") manualList.querySelectorAll(".manual-target-checkbox:checked").forEach(cb => ids.push(cb.value));

        if (ids.length === 0) { alert("送信対象が選択されていません。"); return; }
        onSendCallback(ids, title, body);
        closeModal(messageModal);
    };
    cancelBtn.onclick = () => closeModal(messageModal);
    showModal(messageModal);
}

export function openAddUserModal() {
    const input = document.getElementById("add-user-modal-name-input");
    const error = document.getElementById("add-user-modal-error");
    if (!addUserModal || !input) return;
    input.value = ""; error.textContent = "";
    showModal(addUserModal); input.focus();
}

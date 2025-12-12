// js/views/host/userManagement.js
import { db } from "../../firebase.js";
import { collection, onSnapshot, doc, deleteDoc, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmationModal, hideConfirmationModal } from "../../components/modal.js";

let userListUnsubscribe = null;
let currentStatuses = []; // キャッシュ用

// ステータス表示モジュールから最新情報を受け取る関数
export function updateStatusesCache(newStatuses) {
    currentStatuses = newStatuses;
    // 必要であればここで再描画をトリガーできますが、
    // 基本はonSnapshotの更新に任せます
}

// 初期化関数
export function initializeUserManagement() {
    console.log("Initializing User Management...");
    const userListContainer = document.getElementById("user-list-tbody");
    if (!userListContainer) {
        console.error("User list container not found.");
        return;
    }

    // 既存のリスナーがあれば解除
    if (userListUnsubscribe) {
        userListUnsubscribe();
    }

    // ユーザー一覧を監視
    const q = collection(db, "user_profiles");
    userListUnsubscribe = onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderUserList(users, userListContainer);
    }, (error) => {
        console.error("Error fetching user list:", error);
        userListContainer.innerHTML = '<tr><td colspan="5" class="text-center text-red-500 py-4">ユーザーリストの読み込みに失敗しました。</td></tr>';
    });
}

// ★復元: 新規ユーザー追加処理
export async function handleAddNewUser() {
    const nameInput = document.getElementById("new-user-name");
    const emailInput = document.getElementById("new-user-email");

    if (!nameInput || !nameInput.value.trim()) {
        alert("ユーザー名を入力してください。");
        return;
    }

    const name = nameInput.value.trim();
    const email = emailInput ? emailInput.value.trim() : "";

    try {
        await addDoc(collection(db, "user_profiles"), {
            name: name,
            email: email,
            role: "client", // デフォルトは一般権限
            createdAt: new Date().toISOString()
        });
        
        // 入力欄をクリア
        nameInput.value = "";
        if (emailInput) emailInput.value = "";

        // ※リストはonSnapshotで自動更新されるため手動追加は不要
        console.log(`User ${name} added.`);
        
    } catch (error) {
        console.error("Error adding new user:", error);
        alert("ユーザーの追加に失敗しました。");
    }
}

// ユーザーリスト描画関数
function renderUserList(users, container) {
    container.innerHTML = "";

    if (users.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">登録ユーザーがいません。</td></tr>';
        return;
    }

    // 名前順にソート
    users.sort((a, b) => a.name.localeCompare(b.name, "ja"));

    users.forEach(user => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-gray-50 border-b";

        // 現在の稼働ステータスを確認
        const status = currentStatuses.find(s => s.id === user.id);
        const isWorking = status ? status.isWorking : false;
        const statusText = isWorking ? 
            `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">稼働中</span>` : 
            `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">未稼働</span>`;

        // 権限設定 (デフォルトは client)
        const currentRole = user.role || 'client'; 
        
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHtml(user.name)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.email || "-"}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${statusText}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <select class="role-select border rounded p-1 text-sm focus:ring-indigo-500 focus:border-indigo-500" data-id="${user.id}">
                    <option value="client" ${currentRole === 'client' ? 'selected' : ''}>一般</option>
                    <option value="manager" ${currentRole === 'manager' ? 'selected' : ''}>業務管理者</option>
                    <option value="host" ${currentRole === 'host' ? 'selected' : ''}>管理者</option>
                </select>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button class="delete-user-btn text-red-600 hover:text-red-900 ml-4" data-id="${user.id}" data-name="${escapeHtml(user.name)}">削除</button>
            </td>
        `;

        container.appendChild(tr);
    });

    // イベントリスナー設定
    
    // 1. 権限変更の監視
    container.querySelectorAll(".role-select").forEach(select => {
        select.addEventListener("change", async (e) => {
            const userId = e.target.dataset.id;
            const newRole = e.target.value;
            await updateUserRole(userId, newRole);
        });
    });

    // 2. 削除ボタンの監視
    container.querySelectorAll(".delete-user-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const userId = e.target.dataset.id;
            const userName = e.target.dataset.name;
            showConfirmationModal(
                `${userName} さんのアカウントを削除しますか？\nこの操作は取り消せません。`,
                () => deleteUser(userId),
                hideConfirmationModal
            );
        });
    });
}

// 権限更新関数
async function updateUserRole(userId, newRole) {
    try {
        const userRef = doc(db, "user_profiles", userId);
        await updateDoc(userRef, {
            role: newRole
        });
        console.log(`User ${userId} role updated to ${newRole}`);
    } catch (error) {
        console.error("Error updating user role:", error);
        alert("権限の更新に失敗しました。");
    }
}

// ユーザー削除関数
async function deleteUser(userId) {
    try {
        await deleteDoc(doc(db, "user_profiles", userId));
        hideConfirmationModal();
    } catch (error) {
        console.error("Error deleting user:", error);
        alert("ユーザーの削除中にエラーが発生しました。");
    }
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

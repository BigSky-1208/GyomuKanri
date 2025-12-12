// js/views/host/userManagement.js
import { db } from "../../firebase.js";
import { collection, onSnapshot, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmationModal, hideConfirmationModal } from "../../components/modal.js";

let userListUnsubscribe = null;

// キャッシュ用（statusDisplay.jsから更新を受け取る）
let currentStatuses = []; 

export function updateStatusesCache(newStatuses) {
    currentStatuses = newStatuses;
    // ステータス更新時にリストも再描画したい場合はここで renderUserList を呼ぶことも可能ですが、
    // 頻度が高いため、基本は userListUnsubscribe 側の更新または手動更新に任せます。
    // 必要に応じて実装を追加してください。
}

export function initializeUserManagement() {
    console.log("Initializing User Management...");
    const userListContainer = document.getElementById("user-list-tbody"); // テーブルのtbodyを取得
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

        // 現在のステータスを探す
        const status = currentStatuses.find(s => s.id === user.id);
        const isWorking = status ? status.isWorking : false;
        const statusText = isWorking ? 
            `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">稼働中</span>` : 
            `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">未稼働</span>`;

        // ★追加: 権限選択用のセレクトボックス作成
        // role が未設定の場合は 'client' (一般) とする
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

    // イベントリスナーの設定
    // 1. 権限変更
    container.querySelectorAll(".role-select").forEach(select => {
        select.addEventListener("change", async (e) => {
            const userId = e.target.dataset.id;
            const newRole = e.target.value;
            await updateUserRole(userId, newRole);
        });
    });

    // 2. 削除ボタン
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

// ★追加: 権限を更新する関数
async function updateUserRole(userId, newRole) {
    try {
        const userRef = doc(db, "user_profiles", userId);
        await updateDoc(userRef, {
            role: newRole
        });
        console.log(`User ${userId} role updated to ${newRole}`);
        // 成功時のトースト表示などがあると親切ですが、今回はonSnapshotでリストが自動更新されるため省略
    } catch (error) {
        console.error("Error updating user role:", error);
        alert("権限の更新に失敗しました。");
    }
}

async function deleteUser(userId) {
    try {
        await deleteDoc(doc(db, "user_profiles", userId));
        hideConfirmationModal();
        // onSnapshotが自動的にUIを更新します
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

// js/views/host/userManagement.js

import { db } from "../../main.js";
import { collection, getDocs, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmationModal } from "../../components/modal.js";

const userListContainer = document.getElementById("user-management-list");

export function initializeUserManagement() {
    console.log("Initializing User Management...");
    loadUsers();
}

export async function loadUsers() {
    if (!userListContainer) return;
    
    userListContainer.innerHTML = '<p class="text-center text-gray-500">ユーザー情報を読み込み中...</p>';

    try {
        const querySnapshot = await getDocs(collection(db, "user_profiles"));
        
        if (querySnapshot.empty) {
            userListContainer.innerHTML = '<p class="text-center text-gray-500">登録ユーザーがいません。</p>';
            return;
        }

        let tableHtml = `
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white border border-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="py-2 px-3 border-b text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">名前</th>
                            <th class="py-2 px-3 border-b text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">役職/部署</th>
                            <th class="py-2 px-3 border-b text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">権限</th>
                            <th class="py-2 px-3 border-b text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">操作</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
        `;

        querySnapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const uid = docSnap.id;
            
            // 権限の表示名
            let roleDisplay = "一般";
            let roleClass = "bg-gray-100 text-gray-800";
            
            if (user.role === "host") {
                roleDisplay = "管理者";
                roleClass = "bg-purple-100 text-purple-800";
            } else if (user.role === "manager") {
                roleDisplay = "業務管理者";
                roleClass = "bg-blue-100 text-blue-800";
            }

            tableHtml += `
                <tr>
                    <td class="py-2 px-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                        ${escapeHtml(user.displayName || "未設定")}
                    </td>
                    <td class="py-2 px-3 text-sm text-gray-500">
                        <div>${escapeHtml(user.jobTitle || "-")}</div>
                        <div class="text-xs text-gray-400">${escapeHtml(user.department || "")}</div>
                    </td>
                    <td class="py-2 px-3 text-sm">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${roleClass}">
                            ${roleDisplay}
                        </span>
                    </td>
                    <td class="py-2 px-3 text-sm text-center">
                        <button class="delete-user-btn text-red-600 hover:text-red-900 text-xs border border-red-200 px-2 py-1 rounded hover:bg-red-50" data-uid="${uid}" data-name="${escapeHtml(user.displayName)}">削除</button>
                    </td>
                </tr>
            `;
        });

        tableHtml += `
                    </tbody>
                </table>
            </div>
        `;

        userListContainer.innerHTML = tableHtml;

        // 削除ボタンのイベント設定
        document.querySelectorAll(".delete-user-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const uid = e.target.dataset.uid;
                const name = e.target.dataset.name;
                handleDeleteUser(uid, name);
            });
        });

    } catch (error) {
        console.error("Error loading users:", error);
        userListContainer.innerHTML = '<p class="text-center text-red-500">読み込みに失敗しました。</p>';
    }
}

async function handleDeleteUser(uid, name) {
    showConfirmationModal(
        `ユーザー「${name}」を削除しますか？\n(この操作は元に戻せません)`,
        async () => {
            try {
                await deleteDoc(doc(db, "user_profiles", uid));
                // ※Authenticationの削除はクライアントSDKからは原則できない（Admin SDKが必要）ため、
                // ここではFirestoreのプロフィール削除のみ行い、画面を更新します。
                alert(`ユーザー「${name}」をリストから削除しました。`);
                loadUsers(); // リスト再読み込み
            } catch (error) {
                console.error("Error deleting user:", error);
                alert("削除に失敗しました。");
            }
        }
    );
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

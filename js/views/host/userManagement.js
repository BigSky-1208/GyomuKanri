// js/views/host/userManagement.js

import { db } from "../../main.js";
import { collection, getDocs, doc, deleteDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmationModal, closeModal } from "../../components/modal.js";

const userListContainer = document.getElementById("user-management-list"); // ※HTML上のIDと一致させる必要がありますが、host.jsの定義を見る限り summary-list が使われている可能性があります。
// ただし、host.js では summary-list に対してイベント委譲しているので、ここは描画先のコンテナIDとして "summary-list" を使うのが正しいと思われます。
// もしHTML側に "user-management-list" がない場合は "summary-list" に書き換えてください。
const targetContainerId = "summary-list"; 

let userUnsubscribe = null;

export function startListeningForUsers() {
    console.log("Starting user listener...");
    const container = document.getElementById(targetContainerId);
    if (!container) return;

    container.innerHTML = '<p class="text-center text-gray-500">ユーザー情報を読み込み中...</p>';

    // リアルタイムリスナーに変更
    userUnsubscribe = onSnapshot(collection(db, "user_profiles"), (snapshot) => {
        if (snapshot.empty) {
            container.innerHTML = '<p class="text-center text-gray-500">登録ユーザーがいません。</p>';
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

        snapshot.forEach((docSnap) => {
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
                <tr class="hover:bg-gray-50 transition">
                    <td class="py-2 px-3 text-sm font-medium text-gray-900 whitespace-nowrap cursor-pointer user-detail-trigger" data-uid="${uid}">
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

        container.innerHTML = tableHtml;

    }, (error) => {
        console.error("Error listening for users:", error);
        container.innerHTML = '<p class="text-center text-red-500">読み込みに失敗しました。</p>';
    });
}

export function stopListeningForUsers() {
    if (userUnsubscribe) {
        userUnsubscribe();
        userUnsubscribe = null;
    }
}

// host.js から呼び出されるイベントハンドラ
export function handleUserDetailClick(target) {
    // 削除ボタンのクリック処理
    if (target.classList.contains("delete-user-btn")) {
        const uid = target.dataset.uid;
        const name = target.dataset.name;
        handleDeleteUser(uid, name);
    }
    // 詳細表示などは必要であればここに記述（現在は行クリックで詳細へ飛ぶ実装は保留）
}

// 新規ユーザー追加処理 (host.js から呼び出される)
export async function handleAddNewUser() {
    const nameInput = document.getElementById("add-user-modal-name-input");
    const errorMsg = document.getElementById("add-user-modal-error");
    
    if (!nameInput) return;
    
    const name = nameInput.value.trim();
    if (!name) {
        if(errorMsg) errorMsg.textContent = "名前を入力してください";
        return;
    }

    try {
        // 簡易的なID生成（本来はAuthのUIDを使うべきだが、簡易追加のため）
        const newUserId = "user_" + Date.now();
        
        await setDoc(doc(db, "user_profiles", newUserId), {
            displayName: name,
            role: "general", // デフォルトは一般
            createdAt: new Date()
        });
        
        // モーダルを閉じる
        const modal = document.getElementById("add-user-modal");
        if(modal) closeModal(modal);
        
        nameInput.value = "";
        if(errorMsg) errorMsg.textContent = "";
        alert(`${name} さんを追加しました。`);

    } catch (error) {
        console.error("Error adding new user:", error);
        if(errorMsg) errorMsg.textContent = "追加に失敗しました: " + error.message;
    }
}

// 全ログ削除処理 (host.js から呼び出される)
export async function handleDeleteAllLogs() {
    showConfirmationModal(
        "全従業員の全業務記録を削除しますか？\nこの操作は絶対に元に戻せません！",
        async () => {
            // 本来はCloud Functions等でやるべき重い処理ですが、クライアントでやる場合の簡易実装
            // 今回は要件に含まれていないため、ログのみ出してアラート表示にとどめます
            console.warn("Delete all logs requested. Implementation required backend support for safety.");
            alert("セキュリティのため、この機能は現在無効化されています。（開発者に相談してください）");
        }
    );
}

async function handleDeleteUser(uid, name) {
    showConfirmationModal(
        `ユーザー「${name}」を削除しますか？\n(この操作は元に戻せません)`,
        async () => {
            try {
                await deleteDoc(doc(db, "user_profiles", uid));
                alert(`ユーザー「${name}」を削除しました。`);
                // onSnapshotが自動で画面を更新します
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

// js/views/host/userManagement.js
import { db, showView, VIEWS } from "../../main.js";
import { collection, onSnapshot, doc, deleteDoc, updateDoc, addDoc, getDocs, writeBatch, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmationModal, hideConfirmationModal } from "../../components/modal.js";

let userListUnsubscribe = null;
let currentStatuses = []; // キャッシュ用

// ステータス表示モジュールから最新情報を受け取る関数
export function updateStatusesCache(newStatuses) {
    currentStatuses = newStatuses;
}

// ★修正: host.js の名前に合わせて変更 (ユーザー監視開始)
export function startListeningForUsers() {
    console.log("Starting user list listener...");
    const userListContainer = document.getElementById("summary-list"); // host.jsのIDに合わせる(またはtbody)
    // ※host.jsでは "summary-list" (tbody) を想定していると思われるため取得
    // もしHTML側で tbody の ID が "user-list-tbody" なら適宜読み替えてください。
    // ここでは安全のため両方探します。
    const container = document.getElementById("summary-list") || document.getElementById("user-list-tbody");
    
    if (!container) {
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
        renderUserList(users, container);
    }, (error) => {
        console.error("Error fetching user list:", error);
        container.innerHTML = '<tr><td colspan="5" class="text-center text-red-500 py-4">ユーザーリストの読み込みに失敗しました。</td></tr>';
    });
}

// ★追加: host.js から呼ばれる (ユーザー監視停止)
export function stopListeningForUsers() {
    if (userListUnsubscribe) {
        console.log("Stopping user list listener...");
        userListUnsubscribe();
        userListUnsubscribe = null;
    }
}

// ★修正: host.js のイベント委譲に対応 (クリックされた要素を受け取る)
export function handleUserDetailClick(target) {
    // クリックされた要素が .view-detail-link を持っているか、その内側かを確認
    const link = target.closest(".view-detail-link");
    if (link) {
        // リンククリック時のデフォルト動作（#への移動など）を防ぐ必要がある場合は
        // host.js側で preventDefault() するか、ここで何もしない
        // ここでは画面遷移を実行
        const userId = link.dataset.id;
        const userName = link.dataset.name;
        if (userId && userName) {
            console.log(`Navigating to details for ${userName} (${userId})`);
            showView(VIEWS.PERSONAL_DETAIL, { userId: userId, userName: userName });
        }
    }
}

// 新規ユーザー追加処理
export async function handleAddNewUser() {
    const nameInput = document.getElementById("new-user-name");
    const emailInput = document.getElementById("new-user-email");
    // モーダルを閉じるためのボタン（あれば）
    // const closeBtn = ...

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
            role: "client",
            createdAt: new Date().toISOString()
        });
        
        nameInput.value = "";
        if (emailInput) emailInput.value = "";
        
        // モーダルを閉じる処理（modal.jsの関数を使うか、host.js側で制御するかによるが、
        // ここでは簡易的にDOM操作で隠すか、alertで通知）
        alert(`${name} さんを追加しました。`);
        
        // モーダルを閉じる (modal.jsのID依存)
        const modal = document.getElementById("add-user-modal");
        if(modal) modal.classList.add("hidden");
        
    } catch (error) {
        console.error("Error adding new user:", error);
        alert("ユーザーの追加に失敗しました。");
    }
}

// 全ログ削除処理
export async function handleDeleteAllLogs() {
    showConfirmationModal(
        "全ての業務ログを削除しますか？\nこの操作は取り消せません。\n（ユーザーデータは削除されません）",
        async () => {
            hideConfirmationModal();
            try {
                console.log("Deleting all work logs...");
                const q = query(collection(db, "work_logs"));
                const snapshot = await getDocs(q);
                
                if (snapshot.empty) {
                    alert("削除するログがありません。");
                    return;
                }

                const batch = writeBatch(db);
                snapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });

                await batch.commit();
                alert("全ての業務ログを削除しました。");
            } catch (error) {
                console.error("Error deleting logs:", error);
                alert("ログの削除中にエラーが発生しました。");
            }
        },
        hideConfirmationModal
    );
}

// ユーザーリスト描画関数
function renderUserList(users, container) {
    container.innerHTML = "";

    if (users.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">登録ユーザーがいません。</td></tr>';
        return;
    }

    users.sort((a, b) => a.name.localeCompare(b.name, "ja"));

    users.forEach(user => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-gray-50 border-b";

        const status = currentStatuses.find(s => s.id === user.id);
        const isWorking = status ? status.isWorking : false;
        const statusText = isWorking ? 
            `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">稼働中</span>` : 
            `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">未稼働</span>`;

        const currentRole = user.role || 'client'; 
        
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <a href="#" class="text-indigo-600 hover:text-indigo-900 hover:underline view-detail-link" data-id="${user.id}" data-name="${escapeHtml(user.name)}">
                    ${escapeHtml(user.name)}
                </a>
            </td>
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
    // ※ 詳細リンクへのリスナーは host.js で一括管理するため削除しました
    
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

// js/views/host/userManagement.js

import { db, showView, VIEWS } from "../../main.js";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, query, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmationModal, hideConfirmationModal, closeModal } from "../../components/modal.js";

// --- Module State ---
let userListUnsubscribe = null;
let currentStatuses = []; // ステータス情報を保持するキャッシュ

// --- Exported Functions ---

/**
 * ステータス情報のキャッシュを更新する (statusDisplay.jsから呼ばれる)
 * これにより、ユーザーリストに「稼働中」などの状態を表示できる
 */
export function updateStatusesCache(newStatuses) {
    currentStatuses = newStatuses;
    // リストが表示中であれば再描画したいが、頻繁な更新を避けるため
    // ここではデータ更新のみ行い、次のonSnapshotや操作時に反映される形、
    // または必要に応じて再描画ロジックを入れる。
    // 今回は簡易的に、コンテナがあれば再描画を試みる実装にします。
    const container = document.getElementById("summary-list");
    if (container && userListUnsubscribe) {
        // ※データ(users)を保持していないため、厳密な再描画はFirestoreのキャッシュ再取得が必要。
        // ここでは複雑さを避けるため、変数の更新のみとし、ユーザー追加/変更のタイミングで反映させます。
        // もし即時反映が必要なら、usersデータもモジュール変数に保持する必要があります。
    }
}

/**
 * ユーザーリストの監視を開始する
 */
export function startListeningForUsers() {
    console.log("Starting user list listener...");
    // host.jsでイベント委譲している対象IDは "summary-list"
    const userListContainer = document.getElementById("summary-list");
    
    if (!userListContainer) {
        console.error("User list container (summary-list) not found.");
        return;
    }

    userListContainer.innerHTML = '<p class="text-center text-gray-500 py-4">ユーザー情報を読み込み中...</p>';

    const q = collection(db, "user_profiles");
    userListUnsubscribe = onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderUserList(users, userListContainer);
    }, (error) => {
        console.error("Error fetching user list:", error);
        userListContainer.innerHTML = '<p class="text-center text-red-500 py-4">ユーザーリストの読み込みに失敗しました。</p>';
    });
}

/**
 * ユーザーリストの監視を停止する
 */
export function stopListeningForUsers() {
    if (userListUnsubscribe) {
        console.log("Stopping user list listener...");
        userListUnsubscribe();
        userListUnsubscribe = null;
    }
}

/**
 * ユーザー詳細画面への遷移処理 (host.jsのイベント委譲から呼ばれる)
 */
export function handleUserDetailClick(target) {
    // クリックされた要素が .view-detail-link を持っているか、その内側かを確認
    const link = target.closest(".view-detail-link"); // 名前部分にクラスを付与想定
    
    // または、削除ボタンなどの特定アクション以外を行クリックとみなす場合
    // ここでは .user-detail-trigger クラス（renderUserListで付与）を確認
    const trigger = target.closest(".user-detail-trigger");

    if (trigger) {
        const userId = trigger.dataset.id;
        const userName = trigger.dataset.name; // data-name属性が必要
        if (userId) {
            console.log(`Navigating to details for ${userName} (${userId})`);
            showView(VIEWS.PERSONAL_DETAIL, { userId: userId, userName: userName });
        }
    }
}

/**
 * 新規ユーザー追加処理 (モーダルから呼ばれる)
 */
export async function handleAddNewUser() {
    const nameInput = document.getElementById("add-user-modal-name-input"); // IDはadd-user-modalに合わせる
    // もし古いHTMLのID(new-user-name)を使う場合はそちらもチェック
    const nameInputFallback = document.getElementById("new-user-name");
    
    const input = nameInput || nameInputFallback;

    if (!input || !input.value.trim()) {
        alert("ユーザー名を入力してください。");
        return;
    }

    const name = input.value.trim();

    try {
        // Authenticationとの連携がない簡易版のため、Firestoreにドキュメント追加のみ
        // IDを指定して作成するか、自動IDか。ここでは要件に合わせて自動IDまたはタイムスタンプID
        const newUserId = "user_" + Date.now();
        await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js")
            .then(({ setDoc, doc }) => {
                 setDoc(doc(db, "user_profiles", newUserId), {
                    displayName: name,
                    role: "client", // デフォルト
                    createdAt: new Date().toISOString()
                });
            });

        input.value = "";
        console.log(`User ${name} added.`);
        
        // モーダルを閉じる
        const modal = document.getElementById("add-user-modal");
        if(modal) closeModal(modal);

        alert(`${name} さんを追加しました。`);

    } catch (error) {
        console.error("Error adding new user:", error);
        alert("ユーザー追加に失敗しました。");
    }
}

/**
 * 全ログ削除処理 (管理者アクション)
 */
export async function handleDeleteAllLogs() {
    showConfirmationModal(
        "全従業員の全業務記録を削除しますか？\nこの操作は絶対に元に戻せません！",
        async () => {
            hideConfirmationModal();
            try {
                console.log("Deleting all work logs...");
                // クライアントサイドでの一括削除（件数が多いと失敗する可能性があるため注意）
                const q = query(collection(db, "work_logs"));
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    alert("削除対象の記録はありませんでした。");
                    return;
                }

                const batch = writeBatch(db);
                snapshot.docs.forEach((doc) => {
                    batch.delete(doc.ref);
                });
                
                await batch.commit();
                alert("全業務記録を削除しました。");

            } catch (error) {
                console.error("Error deleting all logs:", error);
                alert("ログの削除中にエラーが発生しました。");
            }
        }
    );
}


// --- Internal Helper Functions ---

function renderUserList(users, container) {
    if (!container) return;
    
    // 名前順にソート
    users.sort((a, b) => (a.displayName || a.name || "").localeCompare((b.displayName || b.name || ""), "ja"));

    let html = `
    <div class="overflow-x-auto">
        <table class="min-w-full bg-white border border-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="py-2 px-3 border-b text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">名前</th>
                    <th class="py-2 px-3 border-b text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">状態</th>
                    <th class="py-2 px-3 border-b text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">権限</th>
                    <th class="py-2 px-3 border-b text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">操作</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
    `;

    users.forEach(user => {
        // プロパティ名のゆらぎ吸収 (displayName or name)
        const userName = user.displayName || user.name || "名称未設定";
        
        // 現在の稼働ステータスを確認 (updateStatusesCacheで更新された情報を使用)
        // statusDisplay.jsから渡されるstatusオブジェクトのIDはuserIdと一致している前提
        const status = currentStatuses.find(s => s.id === user.id);
        const isWorking = status ? status.isWorking : false;
        const statusBadge = isWorking ? 
            `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">稼働中</span>` : 
            `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">未稼働</span>`;

        // 権限設定
        const currentRole = user.role || 'client';
        const roleOptions = `
            <select class="role-select text-xs border border-gray-300 rounded p-1 bg-white focus:ring-indigo-500 focus:border-indigo-500" data-id="${user.id}">
                <option value="client" ${currentRole === 'client' ? 'selected' : ''}>一般</option>
                <option value="manager" ${currentRole === 'manager' ? 'selected' : ''}>業務管理者</option>
                <option value="host" ${currentRole === 'host' ? 'selected' : ''}>管理者</option>
            </select>
        `;

        html += `
            <tr class="hover:bg-gray-50 transition">
                <td class="py-2 px-3 text-sm font-medium text-gray-900 whitespace-nowrap cursor-pointer user-detail-trigger" data-id="${user.id}" data-name="${escapeHtml(userName)}">
                    ${escapeHtml(userName)}
                </td>
                <td class="py-2 px-3 text-sm">
                    ${statusBadge}
                </td>
                <td class="py-2 px-3 text-sm">
                    ${roleOptions}
                </td>
                <td class="py-2 px-3 text-sm text-center">
                    <button class="delete-user-btn text-red-600 hover:text-red-900 text-xs border border-red-200 px-2 py-1 rounded hover:bg-red-50" data-id="${user.id}" data-name="${escapeHtml(userName)}">削除</button>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;

    // イベントリスナー設定 (innerHTML書き換え後のため毎回設定)
    
    // 1. 権限変更
    container.querySelectorAll(".role-select").forEach(select => {
        select.addEventListener("change", async (e) => {
            const userId = e.target.dataset.id;
            const newRole = e.target.value;
            try {
                await updateDoc(doc(db, "user_profiles", userId), { role: newRole });
                console.log(`Role updated for ${userId} to ${newRole}`);
            } catch (err) {
                console.error("Error updating role:", err);
                alert("権限の更新に失敗しました。");
            }
        });
    });

    // 2. 削除ボタン
    container.querySelectorAll(".delete-user-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const userId = e.target.dataset.id;
            const userName = e.target.dataset.name;
            handleDeleteUser(userId, userName);
        });
    });
}

async function handleDeleteUser(uid, name) {
    showConfirmationModal(
        `ユーザー「${name}」を削除しますか？\n(この操作は元に戻せません)`,
        async () => {
            hideConfirmationModal();
            try {
                await deleteDoc(doc(db, "user_profiles", uid));
                alert(`ユーザー「${name}」を削除しました。`);
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

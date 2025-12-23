// js/views/host/userManagement.js

import { db, showView, VIEWS } from "../../main.js";
// ★修正: setDoc をインポートに追加
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, query, getDocs, writeBatch, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmationModal, hideConfirmationModal, closeModal } from "../../components/modal/index.js";

// --- Module State ---
let userListUnsubscribe = null;
let currentStatuses = []; // ステータス情報を保持するキャッシュ

// --- Exported Functions ---

/**
 * ステータス情報のキャッシュを更新する (statusDisplay.jsから呼ばれる)
 */
export function updateStatusesCache(newStatuses) {
    currentStatuses = newStatuses;
    // リストが既に表示されている場合、再描画して最新ステータスを反映
    const container = document.getElementById("summary-list");
    if (container && userListUnsubscribe) {
        // 簡易的な再反映: 現在のDOMに対してクラス操作を行う手もあるが、
        // ここでは安全に statusDisplay.js 側の更新処理に任せるか、
        // もし即時反映したいならここで renderUserList を呼ぶ方法もある。
        // 今回は statusDisplay.js が主導でDOMを書き換えるため、ここはキャッシュ更新のみでOK。
    }
}

/**
 * ユーザーリストの監視を開始する
 */
export function startListeningForUsers() {
    console.log("【UserMng】① ユーザー監視機能を開始します");

    const userListContainer = document.getElementById("summary-list");
    
    if (!userListContainer) {
        console.error("【UserMng】エラー: 表示先の要素(summary-list)が見つかりません。HTMLを確認してください。");
        return;
    }

    userListContainer.innerHTML = '<p class="text-center text-gray-500 py-4">ユーザー情報を読み込み中... (データ取得待ち)</p>';

    // コレクション参照の作成
    console.log("【UserMng】② DB接続(user_profiles)を試みます...");
    const q = collection(db, "user_profiles");
    
    // データ監視の登録
    userListUnsubscribe = onSnapshot(q, (snapshot) => {
        // ★ここが表示されない場合、DBからデータが返ってきていません
        console.log(`【UserMng】③ データ受信成功！ ドキュメント数: ${snapshot.size}`);

        if (snapshot.empty) {
            console.warn("【UserMng】データが0件です。DBの user_profiles コレクションは空ではありませんか？");
        }

        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("【UserMng】④ 取得データ中身:", users);

        // 描画関数の呼び出し
        try {
            renderUserList(users, userListContainer);
            console.log("【UserMng】⑤ 描画処理(renderUserList)が完了しました");
        } catch (e) {
            console.error("【UserMng】描画エラー: renderUserList内でエラーが発生しました", e);
        }

    }, (error) => {
        console.error("【UserMng】DB読み込みエラー:", error);
        userListContainer.innerHTML = `<p class="text-center text-red-500 py-4">読み込みエラー: ${error.message}</p>`;
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
 * ユーザー詳細画面への遷移処理
 */
export function handleUserDetailClick(target) {
    const trigger = target.closest(".user-detail-trigger");

    if (trigger) {
        const userId = trigger.dataset.id;
        const userName = trigger.dataset.name;
        if (userId) {
            console.log(`Navigating to details for ${userName} (${userId})`);
            showView(VIEWS.PERSONAL_DETAIL, { userId: userId, userName: userName });
        }
    }
}

/**
 * 新規ユーザー追加処理
 */
export async function handleAddNewUser() {
    const nameInput = document.getElementById("add-user-modal-name-input");
    const nameInputFallback = document.getElementById("new-user-name");
    
    const input = nameInput || nameInputFallback;

    if (!input || !input.value.trim()) {
        alert("ユーザー名を入力してください。");
        return;
    }

    const name = input.value.trim();

    try {
        const newUserId = "user_" + Date.now();
        // ★修正: 上でインポートした setDoc を使用
        await setDoc(doc(db, "user_profiles", newUserId), {
            displayName: name,
            role: "client",
            createdAt: new Date().toISOString()
        });

        input.value = "";
        console.log(`User ${name} added.`);
        
        const modal = document.getElementById("add-user-modal");
        if(modal) closeModal(modal);

        alert(`${name} さんを追加しました。`);

    } catch (error) {
        console.error("Error adding new user:", error);
        alert("ユーザー追加に失敗しました。");
    }
}

/**
 * 全ログ削除処理
 */
export async function handleDeleteAllLogs() {
    showConfirmationModal(
        "全従業員の全業務記録を削除しますか？\nこの操作は絶対に元に戻せません！",
        async () => {
            hideConfirmationModal();
            try {
                console.log("Deleting all work logs...");
                const q = query(collection(db, "work_logs"));
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    alert("削除対象の記録はありませんでした。");
                    return;
                }

                // FirestoreのBatchは一度に500件までなので分割処理
                const BATCH_SIZE = 450;
                const chunks = [];
                for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
                    chunks.push(snapshot.docs.slice(i, i + BATCH_SIZE));
                }

                for (const chunk of chunks) {
                    const batch = writeBatch(db);
                    chunk.forEach((doc) => {
                        batch.delete(doc.ref);
                    });
                    await batch.commit();
                }
                
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
    
    users.sort((a, b) => (a.displayName || a.name || "").localeCompare((b.displayName || b.name || ""), "ja"));

    let html = `
    <div class="overflow-x-auto">
        <table class="min-w-full bg-white border border-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="py-2 px-3 border-b text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">名前</th>
                    <th class="py-2 px-3 border-b text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">状態</th>
                    <th class="py-2 px-3 border-b text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">現在の業務</th>
                    <th class="py-2 px-3 border-b text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">権限</th>
                    <th class="py-2 px-3 border-b text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">操作</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
    `;

    users.forEach(user => {
        const userName = user.displayName || user.name || "名称未設定";
        
        // currentStatusesから情報を探す
        const status = currentStatuses.find(s => s.userId === user.id); // ※プロパティ名をuserIdに合わせる
        const isWorking = status ? (status.isWorking === 1) : false;
        const currentTask = status ? (status.currentTask || "---") : "---";

        // ★重要: statusDisplay.js が探せるようにクラス名を付与
        const statusBadgeClass = isWorking 
            ? "status-badge inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
            : "status-badge inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800";
        
        const statusText = isWorking ? "稼働中" : "未稼働";

        const currentRole = user.role || 'client';
        const roleOptions = `
            <select class="role-select text-xs border border-gray-300 rounded p-1 bg-white focus:ring-indigo-500 focus:border-indigo-500" data-id="${user.id}">
                <option value="client" ${currentRole === 'client' ? 'selected' : ''}>一般</option>
                <option value="manager" ${currentRole === 'manager' ? 'selected' : ''}>業務管理者</option>
                <option value="host" ${currentRole === 'host' ? 'selected' : ''}>管理者</option>
            </select>
        `;

        // ★重要: TRタグにIDを付与 (user-row-{userId})
        html += `
            <tr id="user-row-${user.id}" class="hover:bg-gray-50 transition">
                <td class="py-2 px-3 text-sm font-medium text-gray-900 whitespace-nowrap cursor-pointer user-detail-trigger" data-id="${user.id}" data-name="${escapeHtml(userName)}">
                    ${escapeHtml(userName)}
                </td>
                <td class="py-2 px-3 text-sm">
                    <span class="${statusBadgeClass}">${statusText}</span>
                </td>
                <td class="py-2 px-3 text-sm text-gray-600 current-task">
                    ${escapeHtml(currentTask)}
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

    // イベントリスナー設定
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
        .replace(/"/g, "&#039;");
}

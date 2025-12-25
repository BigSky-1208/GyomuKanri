// js/views/host/approval.js
import { db, showView, VIEWS, allTaskObjects, updateGlobalTaskObjects } from "../../main.js";
import { collection, query, where, orderBy, onSnapshot, doc, writeBatch, Timestamp, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { escapeHtml } from "../../utils.js";

const approvalListEl = document.getElementById("approval-list");
let unsubscribe = null;

export function initializeApprovalView() {
    console.log("Initializing Approval View...");
    const container = document.getElementById("approval-view");
    if (!container) return; 
    
    const q = query(
        collection(db, "work_log_requests"),
        where("status", "==", "pending"),
        orderBy("createdAt", "asc")
    );

    unsubscribe = onSnapshot(q, (snapshot) => {
        renderApprovalList(snapshot.docs);
    });
}

export function cleanupApprovalView() {
    if (unsubscribe) unsubscribe();
}

function renderApprovalList(docs) {
    const listEl = document.getElementById("approval-list-content");
    if (!listEl) return;
    
    listEl.innerHTML = "";

    if (docs.length === 0) {
        listEl.innerHTML = '<p class="text-gray-500 text-center py-4">未承認の申請はありません。</p>';
        return;
    }

    docs.forEach(docSnap => {
        const req = docSnap.data();
        const card = document.createElement("div");
        card.className = "bg-white p-4 rounded shadow mb-4 border-l-4 border-blue-500";
        
        const typeLabel = req.type === 'add' 
            ? '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">追加申請</span>' 
            : '<span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">変更申請</span>';

        const timeInfo = req.type === 'add' 
            ? `時間: ${req.data.startTime} ~ ${req.data.endTime}` 
            : `<span class="text-gray-400 text-xs">時間は変更されません</span>`;

        const goalInfo = req.data.goalTitle 
            ? `<div class="text-sm">目標: ${escapeHtml(req.data.goalTitle)} (${req.data.count}件)</div>` 
            : "";

        // ★以下の innerHTML を書き換えて削除ボタンを追加
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        ${typeLabel}
                        <span class="font-bold text-lg">${escapeHtml(req.userName)}</span>
                        <span class="text-gray-500 text-sm">${req.requestDate}</span>
                    </div>
                    <div class="mt-2">
                        <div class="font-semibold text-gray-800">業務: ${escapeHtml(req.data.task)}</div>
                        ${goalInfo}
                        <div class="text-sm text-gray-600">${timeInfo}</div>
                        <div class="text-sm text-gray-500 mt-1">メモ: ${escapeHtml(req.data.memo)}</div>
                    </div>
                </div>
                <div class="flex flex-col gap-2">
                    <button class="approve-btn bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 shadow text-sm" data-id="${docSnap.id}">
                        承認
                    </button>
                    <button class="delete-req-btn bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 shadow text-sm" data-id="${docSnap.id}">
                        削除
                    </button>
                </div>
            </div>
        `;
        
        // イベントリスナーを追加
        card.querySelector(".approve-btn").addEventListener("click", () => handleApprove(docSnap));
        card.querySelector(".delete-req-btn").addEventListener("click", () => handleDeleteRequest(docSnap)); // ★ここを追加
        
        listEl.appendChild(card);
    });
}

async function handleApprove(reqDoc) {
    if(!confirm("この申請を承認しますか？")) return;

    const req = reqDoc.data();
    const batch = writeBatch(db);
    const reqRef = doc(db, "work_log_requests", reqDoc.id);

    try {
        if (req.type === "add") {
            // 新規ログ作成
            const newLogRef = doc(collection(db, "work_logs"));
            
            const [sh, sm] = req.data.startTime.split(":");
            const [eh, em] = req.data.endTime.split(":");
            const startD = new Date(req.requestDate);
            startD.setHours(sh, sm, 0);
            const endD = new Date(req.requestDate);
            endD.setHours(eh, em, 0);
            const duration = Math.max(0, (endD - startD) / 1000);

            batch.set(newLogRef, {
                userId: req.userId,
                userName: req.userName,
                date: req.requestDate,
                startTime: startD,
                endTime: endD,
                duration: duration,
                task: req.data.task,
                goalId: req.data.goalId || null,
                goalTitle: req.data.goalTitle || null,
                contribution: req.data.count || 0,
                memo: req.data.memo || "",
                type: req.data.goalId ? "goal" : "work"
            });

            // 目標進捗更新（加算）
            if (req.data.goalId && req.data.count > 0) {
                await updateGoalProgress(req.data.task, req.data.goalId, req.data.count);
            }

        } else if (req.type === "update") {
            // 既存ログ更新
            const logRef = doc(db, "work_logs", req.targetLogId);
            const logSnap = await getDoc(logRef);
            
            if (!logSnap.exists()) {
                alert("対象のログが見つかりません。");
                return;
            }
            const oldLog = logSnap.data();

            batch.update(logRef, {
                task: req.data.task,
                goalId: req.data.goalId || null,
                goalTitle: req.data.goalTitle || null,
                contribution: req.data.count || 0,
                memo: req.data.memo || "",
                type: req.data.goalId ? "goal" : "work"
            });

            // 目標進捗更新（差分）
            if (oldLog.goalId && oldLog.contribution > 0) {
                await updateGoalProgress(oldLog.task, oldLog.goalId, -oldLog.contribution);
            }
            if (req.data.goalId && req.data.count > 0) {
                await updateGoalProgress(req.data.task, req.data.goalId, req.data.count);
            }
        }

        // 申請ステータスを更新
        batch.update(reqRef, { status: "approved" });
        await batch.commit();
        
        alert("承認しました。");
        
    } catch (error) {
        console.error("Approval error:", error);
        alert("承認処理中にエラーが発生しました。");
    }
}

// 目標進捗のグローバル更新ヘルパー
async function updateGoalProgress(taskName, goalId, diff) {
    if (!allTaskObjects) return;
    
    const updatedTasks = JSON.parse(JSON.stringify(allTaskObjects));
    
    const taskIdx = updatedTasks.findIndex(t => t.name === taskName);
    if (taskIdx === -1) return;
    
    const goalIdx = updatedTasks[taskIdx].goals.findIndex(g => g.id === goalId);
    if (goalIdx === -1) return;

    updatedTasks[taskIdx].goals[goalIdx].current = Math.max(0, (updatedTasks[taskIdx].goals[goalIdx].current || 0) + diff);

    await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js")
        .then(({ updateDoc, doc }) => {
            updateDoc(doc(db, "settings", "tasks"), { list: updatedTasks });
        });
    
    updateGlobalTaskObjects(updatedTasks);
}

// js/views/host/approval.js の最後の方に追加

async function handleDeleteRequest(reqDoc) {
    if(!confirm("この申請を削除（却下）しますか？\nこの操作は元に戻せません。")) return;

    try {
        // work_log_requests コレクションからドキュメントを削除
        await deleteDoc(doc(db, "work_log_requests", reqDoc.id));
        alert("申請を削除しました。");
    } catch (error) {
        console.error("Delete error:", error);
        alert("削除中にエラーが発生しました。");
    }
}

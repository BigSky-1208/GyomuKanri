// js/views/client/clientActions.js

import { db, userId } from "../../main.js";
import { collection, query, where, getDocs, doc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmationModal, hideConfirmationModal, fixCheckoutModal } from "../../components/modal/index.js";

/**
 * 退勤忘れを修正するロジック
 * 指定された日付のログを検索し、指定時刻で終了させ、それ以降のログを削除する
 */
export async function handleFixCheckout() {
    const dateInput = document.getElementById("fix-checkout-date-input");
    const timeInput = document.getElementById("fix-checkout-time-input");
    const errorEl = document.getElementById("fix-checkout-error");
    
    if (!dateInput || !timeInput || !errorEl) return;

    const dateValue = dateInput.value;
    const timeValue = timeInput.value;

    if (!dateValue || !timeValue) {
        errorEl.textContent = "日付と時刻を入力してください。";
        return;
    }

    const [hours, minutes] = timeValue.split(":");
    const newEndTime = new Date(dateValue);
    newEndTime.setHours(hours, minutes, 0, 0);

    // 指定日のログを検索
    const q = query(
        collection(db, "work_logs"),
        where("userId", "==", userId),
        where("date", "==", dateValue)
    );
    
    try {
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            errorEl.textContent = "指定された日付の業務記録が見つかりません。";
            return;
        }

        // 開始時間でソート (降順)
        const logsForDay = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => b.startTime.toMillis() - a.startTime.toMillis());

        // 1. 指定時刻より「前」に開始した最後のログを見つける
        const lastLogToUpdate = logsForDay.find(
            (log) => log.startTime.toDate() < newEndTime
        );

        if (!lastLogToUpdate) {
            errorEl.textContent = "指定時刻より前に開始された業務記録が見つかりません。";
            return;
        }

        const batch = writeBatch(db);

        // 2. そのログの終了時刻と経過時間を更新
        const newDuration = Math.max(
            0,
            Math.floor((newEndTime - lastLogToUpdate.startTime.toDate()) / 1000)
        );
        const logRef = doc(db, "work_logs", lastLogToUpdate.id);
        batch.update(logRef, { 
            endTime: newEndTime, 
            duration: newDuration,
            memo: (lastLogToUpdate.memo || "") + " [退勤修正済]"
        });

        // 3. そのログより「後」に開始したログを全て削除
        logsForDay.forEach((log) => {
            if (log.startTime.toMillis() > lastLogToUpdate.startTime.toMillis()) {
                batch.delete(doc(db, "work_logs", log.id));
            }
        });

        // 4. ユーザーのステータスにある「退勤忘れフラグ」を解消する
        const statusRef = doc(db, "work_status", userId);
        batch.update(statusRef, { needsCheckoutCorrection: false });

        await batch.commit();

        // モーダルを閉じてリセット
        if (fixCheckoutModal) fixCheckoutModal.classList.add("hidden");
        timeInput.value = "";
        dateInput.value = "";
        errorEl.textContent = "";

        showConfirmationModal(
            `${dateValue} の退勤時刻を修正しました。`,
            hideConfirmationModal
        );
        
        // 念のためリロード
        setTimeout(() => location.reload(), 1000);

    } catch (error) {
        console.error("Error fixing checkout:", error);
        errorEl.textContent = "修正処理中にエラーが発生しました。";
    }
}

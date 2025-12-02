// js/views/client/clientActions.js - クライアント側のその他のアクション

import { db, userId, showView, VIEWS } from "../../main.js";
import { collection, query, where, getDocs, doc, updateDoc, writeBatch, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmationModal, hideConfirmationModal, fixCheckoutModal } from "../../components/modal.js";

/**
 * Handles the logic for fixing a forgotten checkout.
 * Updates the end time of the last log on the specified date and removes subsequent logs.
 */
export async function handleFixCheckout() {
    const dateInput = document.getElementById("fix-checkout-date-input");
    const timeInput = document.getElementById("fix-checkout-time-input");
    const errorEl = document.getElementById("fix-checkout-error");
    const dateValue = dateInput.value;
    const timeValue = timeInput.value;

    if (!dateValue || !timeValue) {
        errorEl.textContent = "日付と時刻を入力してください。";
        return;
    }

    const [hours, minutes] = timeValue.split(":");
    const newEndTime = new Date(dateValue);
    newEndTime.setHours(hours, minutes, 0, 0);

    // Find logs for the target date
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

        const logsForDay = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => b.startTime.toMillis() - a.startTime.toMillis());

        // 1. Find the last log that started BEFORE the new end time
        const lastLogToUpdate = logsForDay.find(
            (log) => log.startTime.toDate() < newEndTime
        );

        if (!lastLogToUpdate) {
            errorEl.textContent = "指定時刻より前に開始された業務記録が見つかりません。";
            return;
        }

        const batch = writeBatch(db);

        // 2. Update the last log's end time and duration
        const newDuration = Math.max(
            0,
            Math.floor((newEndTime - lastLogToUpdate.startTime.toDate()) / 1000)
        );
        const logRef = doc(db, "work_logs", lastLogToUpdate.id);
        batch.update(logRef, { endTime: newEndTime, duration: newDuration });

        // 3. Delete logs that started AFTER the last log (effectively truncating the day)
        logsForDay.forEach((log) => {
            if (log.startTime.toMillis() > lastLogToUpdate.startTime.toMillis()) {
                batch.delete(doc(db, "work_logs", log.id));
            }
        });

        // ★追加: ユーザーのステータスにある「退勤忘れフラグ」を解消する
        const statusRef = doc(db, "work_status", userId);
        batch.update(statusRef, { needsCheckoutCorrection: false });

        await batch.commit();

        // Close modal and reset form
        fixCheckoutModal.classList.add("hidden");
        timeInput.value = "";
        dateInput.value = "";
        errorEl.textContent = "";

        showConfirmationModal(
            `${dateValue} の退勤時刻を修正しました。`,
            hideConfirmationModal
        );

    } catch (error) {
        console.error("Error fixing checkout:", error);
        errorEl.textContent = "修正処理中にエラーが発生しました。";
    }
}

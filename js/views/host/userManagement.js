// js/views/host/userManagement.js
import { db, userName, showView, VIEWS } from "../../main.js"; // Import global state and functions
import { collection, query, onSnapshot, addDoc, where, getDocs, writeBatch, Timestamp, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Import Firestore functions
import { openAddUserModal, closeAddUserModal, addUserModal, showConfirmationModal, hideConfirmationModal } from "../../components/modal.js"; // Import modal functions/elements

// --- Module State ---
let allUsers = []; // Local cache of user profile data { name, createdBy, createdAt }
let usersListenerUnsubscribe = null; // Firestore listener unsubscribe function
let currentAllStatuses = []; // Local cache of statuses (might be needed for word of the day) - imported or passed

// --- DOM Element references ---
const userListContainer = document.getElementById("summary-list"); // Container for the user account list
const addUserModalNameInput = document.getElementById("add-user-modal-name-input");
const addUserModalError = document.getElementById("add-user-modal-error");

/**
 * Updates the local cache of statuses. Called by host.js when statuses change.
 * @param {Array} statuses - The latest array of status objects.
 */
export function updateStatusesCache(statuses) {
    currentAllStatuses = statuses;
    // Re-render the user list if statuses (like word of the day) might affect its display
    renderUserAccountList();
}


/**
 * Starts the Firestore listener for the 'user_profiles' collection.
 * Updates the `allUsers` cache and renders the user list on changes.
 */
export function startListeningForUsers() {
    stopListeningForUsers(); // Stop previous listener if any

    if (!userListContainer) {
        console.error("Host view user list container ('summary-list') not found.");
        return;
    }

    console.log("Starting listener for user profiles...");
    const qUsers = query(collection(db, "user_profiles"));

    usersListenerUnsubscribe = onSnapshot(qUsers, (snapshot) => {
        allUsers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })); // Store id along with data
        console.log("User profiles updated:", allUsers);
        renderUserAccountList(); // Re-render the list when user data changes
    }, (error) => {
        console.error("Error listening for user profiles:", error);
        userListContainer.innerHTML = '<p class="text-red-500">ユーザーリストの読み込み中にエラーが発生しました。</p>';
        allUsers = []; // Clear local cache on error
    });
}

/**
 * Stops the Firestore listener for the 'user_profiles' collection.
 */
export function stopListeningForUsers() {
    if (usersListenerUnsubscribe) {
        console.log("Stopping listener for user profiles.");
        usersListenerUnsubscribe();
        usersListenerUnsubscribe = null;
    }
    // Optionally clear the list when stopping
    // if (userListContainer) userListContainer.innerHTML = '';
}

/**
 * Renders the list of user accounts in the host view.
 * Incorporates data from `allUsers` and `currentAllStatuses`.
 */
export function renderUserAccountList() {
    // Ensure the container exists and we have the necessary data
    if (!userListContainer || !Array.isArray(allUsers) || !Array.isArray(currentAllStatuses)) {
        // console.warn("Cannot render user list: container or data missing/invalid.", {userListContainer, allUsers, currentAllStatuses});
        if(userListContainer) userListContainer.innerHTML = '<p class="text-gray-500">ユーザー情報を待っています...</p>';
        return;
    }


    // Sort users by name (Japanese locale)
    const sortedUsers = [...allUsers].sort((a, b) => {
        const nameA = a.name || "";
        const nameB = b.name || "";
        return nameA.localeCompare(nameB, "ja");
    });

    userListContainer.innerHTML = ""; // Clear previous list

    if (sortedUsers.length === 0) {
        userListContainer.innerHTML = '<p class="text-gray-500">登録されているユーザーがいません。「ユーザーを追加」ボタンから追加してください。</p>';
        return;
    }

    // Create and append list items for each user
    sortedUsers.forEach((user) => {
        if (!user.name) return; // Skip users without a name

        const card = document.createElement("div");
        card.className = "p-4 bg-gray-50 rounded-lg border user-detail-card"; // Add class for event delegation
        card.dataset.username = user.name; // Store username in dataset for click handler

        // Find the corresponding status to get the word of the day
        const userStatus = currentAllStatuses.find(status => status.userName === user.name);
        const wordOfTheDay = userStatus?.wordOfTheDay || ""; // Safely access wordOfTheDay

        card.innerHTML = `
            <button data-username="${escapeHtml(user.name)}" class="user-detail-btn w-full text-left focus:outline-none focus:ring-2 focus:ring-indigo-300 rounded">
                <div class="flex justify-between items-center">
                    <p class="font-semibold text-gray-800">${escapeHtml(user.name)}</p>
                    <span class="text-xs text-gray-400 hover:text-indigo-600">詳細を見る &rarr;</span>
                </div>
                <p class="text-sm text-gray-500 mt-1 truncate" title="${escapeHtml(wordOfTheDay)}">${escapeHtml(wordOfTheDay) || "今日の一言 未設定"}</p>
            </button>`;
        userListContainer.appendChild(card);
    });

     // Event listener for user detail buttons is now handled in host.js using delegation
}

/**
 * Handles clicks on the user list to navigate to the detail view.
 * This function should be called via event delegation in host.js.
 * @param {EventTarget} target - The element that was clicked.
 */
export function handleUserDetailClick(target) {
     const button = target.closest('.user-detail-btn');
     if (button && button.dataset.username) {
        console.log(`Navigating to details for user: ${button.dataset.username}`);
        showView(VIEWS.PERSONAL_DETAIL, { userName: button.dataset.username });
     } else {
        // Handle clicks on the card but outside the button if needed, or ignore
        const card = target.closest('.user-detail-card');
        if (card && card.dataset.username) {
            console.log(`Navigating to details for user: ${card.dataset.username} (clicked card area)`);
            showView(VIEWS.PERSONAL_DETAIL, { userName: card.dataset.username });
        }
     }
}


/**
 * Handles the process of adding a new user profile via the modal.
 * Validates input, checks for existing names, and adds to Firestore.
 */
export async function handleAddNewUser() {
    if (!addUserModalNameInput || !addUserModalError || !userName) {
        console.error("Add user modal elements or current admin userName not found.");
        return;
    }

    const newName = addUserModalNameInput.value.trim();
    addUserModalError.textContent = ""; // Clear previous errors

    // --- Input Validation ---
    if (!newName) {
        addUserModalError.textContent = "ユーザー名を入力してください。";
        addUserModalNameInput.focus();
        return;
    }
    if (/\s/.test(newName)) { // Check for whitespace
        addUserModalError.textContent = "ユーザー名に空白は使用できません。";
        addUserModalNameInput.focus();
        return;
    }
    // Basic length check (optional)
    if (newName.length > 50) {
        addUserModalError.textContent = "ユーザー名は50文字以内で入力してください。";
        addUserModalNameInput.focus();
        return;
    }
    // --- End Validation ---


    // --- Check for Existing User ---
    // Query user_profiles collection for a document where 'name' field equals newName
    const q = query(collection(db, "user_profiles"), where("name", "==", newName));
    try {
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            addUserModalError.textContent = `ユーザー名「${escapeHtml(newName)}」は既に使用されています。`;
            addUserModalNameInput.select(); // Select existing text for easy replacement
            return; // Stop execution if name exists
        }
    } catch (error) {
        console.error("Error checking for existing user name:", error);
        addUserModalError.textContent = "ユーザー名の確認中にエラーが発生しました。";
        return; // Stop execution on error
    }
    // --- End Check ---


    // --- Add New User to Firestore ---
    try {
        const newUserProfile = {
            name: newName,
            createdBy: userName, // Record who added the user (current admin)
            createdAt: Timestamp.now(), // Record creation timestamp
        };
        const docRef = await addDoc(collection(db, "user_profiles"), newUserProfile);
        console.log("New user added successfully with ID:", docRef.id);

        closeAddUserModal(); // Close modal on success
        // No need to manually update `allUsers` here, the listener will catch the change.

    } catch (error) {
        console.error("Error adding new user to Firestore:", error);
        addUserModalError.textContent = "ユーザーの追加中にエラーが発生しました。";
    }
    // --- End Add User ---
}


/**
 * Handles the deletion of ALL work log entries for ALL users.
 * Prompts for confirmation before proceeding.
 * Note: User profiles are NOT deleted by this action.
 */
export function handleDeleteAllLogs() {
    showConfirmationModal(
        `本当に全従業員の全ての業務記録（work_logs）を削除しますか？\n\nユーザープロフィール自体は削除されません。\n\nこの操作は元に戻せません。`,
        async () => {
            console.warn("Attempting to delete all work logs...");
            hideConfirmationModal(); // Hide modal immediately

            try {
                const logsCollectionRef = collection(db, "work_logs");
                const snapshot = await getDocs(logsCollectionRef); // Get all documents in the collection

                if (snapshot.empty) {
                     console.log("No work logs found to delete.");
                     alert("削除対象の業務記録はありませんでした。");
                     return;
                }

                // Firestore batch writes are limited (e.g., 500 operations).
                // If there could be many logs, process in smaller batches.
                const batchSize = 400; // Keep slightly under limit
                let batch = writeBatch(db);
                let count = 0;
                let totalDeleted = 0;

                console.log(`Found ${snapshot.size} log documents to delete.`);

                for (const docSnapshot of snapshot.docs) {
                    batch.delete(docSnapshot.ref);
                    count++;
                    if (count >= batchSize) {
                        console.log(`Committing batch delete of ${count} logs...`);
                        await batch.commit();
                        totalDeleted += count;
                        batch = writeBatch(db); // Start a new batch
                        count = 0;
                        // Optional: Add a small delay between batches if hitting rate limits
                        // await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }

                // Commit any remaining deletes in the last batch
                if (count > 0) {
                    console.log(`Committing final batch delete of ${count} logs...`);
                    await batch.commit();
                    totalDeleted += count;
                }

                console.log(`Successfully deleted ${totalDeleted} work log documents.`);
                alert("全ての業務記録を削除しました。");

            } catch (error) {
                console.error("Error deleting all work logs:", error);
                alert("業務記録の削除中にエラーが発生しました。");
            }
        },
        () => {
             console.log("Deletion of all logs cancelled by user."); // Log cancellation
        }
    );
}

/**
 * Simple HTML escaping function to prevent XSS.
 * @param {string | null | undefined} unsafe - The potentially unsafe string.
 * @returns {string} The escaped string.
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

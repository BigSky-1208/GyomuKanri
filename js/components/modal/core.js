/**
 * パスワード入力モーダルを表示する
 */
export function showPasswordModal(role, onSuccess) {
    const adminPasswordInput = document.getElementById("admin-password-input");
    const adminPasswordError = document.getElementById("admin-password-error");
    const adminPasswordSubmitBtn = document.getElementById("admin-password-submit-btn");

    if (!adminPasswordView || !adminPasswordInput) return;

    adminPasswordInput.value = "";
    if (adminPasswordError) adminPasswordError.classList.add("hidden");
    
    showModal(adminPasswordView);
    adminPasswordInput.focus();

    const checkPassword = () => {
        const val = adminPasswordInput.value;
        const isValid = (role === "host" && val === "9999") || (role === "manager" && val === "0000");

        if (isValid) {
            closeModal(adminPasswordView);
            onSuccess();
        } else {
            if (adminPasswordError) {
                adminPasswordError.textContent = "パスワードが違います";
                adminPasswordError.classList.remove("hidden");
            }
        }
    };

    adminPasswordSubmitBtn.onclick = checkPassword;
    adminPasswordInput.onkeydown = (e) => { if (e.key === "Enter") checkPassword(); };
}

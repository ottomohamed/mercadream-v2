// navigation.js - DISABLED VERSION (no auto redirects)
console.log("Navigation.js loaded - DISABLED MODE");

// لا نقوم بأي إعادة توجيه تلقائية أبداً
// فقط نحدث الأزرار إذا وجدت

function updateButtonsOnly() {
    var isLoggedIn = localStorage.getItem('sb_session') === 'true' || localStorage.getItem('sb_session') === '1';
    
    var loginBtn = document.getElementById('btn-login');
    if (loginBtn) {
        if (isLoggedIn) {
            loginBtn.textContent = 'LOG OUT';
            loginBtn.onclick = function() { localStorage.clear(); window.location.href = 'index.html'; };
        } else {
            loginBtn.textContent = 'LOG IN';
            loginBtn.onclick = function() { window.location.href = 'login.html'; };
        }
    }
    
    var registerBtn = document.getElementById('btn-register');
    if (registerBtn) {
        if (isLoggedIn) {
            registerBtn.textContent = 'PROFILE';
            registerBtn.onclick = function() { window.location.href = 'profile.html'; };
        } else {
            registerBtn.textContent = 'START FREE ';
            registerBtn.onclick = function() { window.location.href = 'register.html'; };
        }
    }
}

// تحديث الأزرار فقط - بدون إعادة توجيه
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateButtonsOnly);
} else {
    updateButtonsOnly();
}

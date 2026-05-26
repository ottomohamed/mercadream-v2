// MERCADREAM - navigation.js (CORRECTED)
(function() {
    console.log('Navigation.js loaded - checking auth status');
    
    function updateUIForAuth() {
        var isLoggedIn = localStorage.getItem('sb_session') === 'true' || localStorage.getItem('sb_session') === '1';
        var email = localStorage.getItem('md_email') || '';
        var credits = localStorage.getItem('md_credits') || '0';
        
        console.log('Auth status - Logged in:', isLoggedIn);
        
        // 1. تحديث زر LOGIN/LOGOUT
        var loginBtn = document.getElementById('btn-login');
        if (loginBtn) {
            if (isLoggedIn) {
                loginBtn.textContent = 'LOG OUT';
                loginBtn.onclick = function(e) {
                    e.preventDefault();
                    localStorage.clear();
                    window.location.href = 'index.html';
                };
            } else {
                loginBtn.textContent = 'LOG IN';
                loginBtn.onclick = function(e) {
                    e.preventDefault();
                    window.location.href = 'login.html';
                };
            }
        }
        
        // 2.  الزر الأصفر - يتحول إلى PROFILE وليس STUDIO
        var registerBtn = document.getElementById('btn-register');
        if (registerBtn) {
            if (isLoggedIn) {
                registerBtn.textContent = 'PROFILE';
                registerBtn.onclick = function(e) {
                    e.preventDefault();
                    window.location.href = 'profile.html';
                };
            } else {
                registerBtn.textContent = 'START FREE ';
                registerBtn.onclick = function(e) {
                    e.preventDefault();
                    window.location.href = 'register.html';
                };
            }
        }
        
        // 3. تحديث عرض الرصيد (للمستخدمين المسجلين فقط)
        var creditsEl = document.getElementById('header-credits');
        if (creditsEl) {
            if (isLoggedIn) {
                creditsEl.style.display = 'flex';
                var creditsSpan = creditsEl.querySelector('[data-credits]');
                if (creditsSpan) creditsSpan.textContent = credits + ' CR';
            } else {
                creditsEl.style.display = 'none';
            }
        }
    }
    
    // تشغيل التحديث فوراً
    updateUIForAuth();
    
    // وبعد تحميل الصفحة بالكامل
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateUIForAuth);
    }
    
    // مراقبة التغييرات في localStorage
    window.addEventListener('storage', updateUIForAuth);
    
    // مراقبة التغييرات في session (للتحديث الفوري)
    setInterval(updateUIForAuth, 1000);
})();

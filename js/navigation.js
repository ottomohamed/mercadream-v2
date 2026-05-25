// ═══════════════════════════════════════════════════════
// MERCADREAM — js/navigation.js
// ═══════════════════════════════════════════════════════

(function() {

  const ROUTES = {
    'home':       'index.html',
    'directors':  'directors.html',
    'studio':     'studio.html',
    'assembly':   'assembly.html',
    'login':      'login.html',
    'register':   'register.html',
    'pricing':    'pricing.html',
    'profile':    'profile.html',
    'upscale':    'upscale.html'
  };

  const TX = {
    en: {
      nav_home:'Home', nav_directors:'Directors', nav_studio:'Studio',
      nav_assembly:'Assembly', nav_pricing:'Pricing',
      btn_login:'LOG IN', btn_logout:'LOG OUT',
      btn_register:'START FREE →', btn_new:'New Session',
      btn_back:'← Back', btn_studio:'Enter Studio',
      btn_generate:'Generate', btn_assembly:'Send to Assembly Room',
      btn_export:'Export Film', btn_recharge:'+ Recharge',
      credits:'Credits', status_active:'Active', status_ready:'Ready'
    },
    es: {
      nav_home:'Inicio', nav_directors:'Directores', nav_studio:'Estudio',
      nav_assembly:'Montaje', nav_pricing:'Precios',
      btn_login:'INICIAR SESIÓN', btn_logout:'CERRAR SESIÓN',
      btn_register:'EMPEZAR GRATIS →', btn_new:'Nueva Sesión',
      btn_back:'← Atrás', btn_studio:'Entrar al Estudio',
      btn_generate:'Generar', btn_assembly:'Enviar a Sala de Montaje',
      btn_export:'Exportar Película', btn_recharge:'+ Recargar',
      credits:'Créditos', status_active:'Activo', status_ready:'Listo'
    },
    ar: {
      nav_home:'الرئيسية', nav_directors:'المخرجون', nav_studio:'الاستوديو',
      nav_assembly:'المونتاج', nav_pricing:'الأسعار',
      btn_login:'تسجيل الدخول', btn_logout:'تسجيل الخروج',
      btn_register:'ابدأ مجاناً ←', btn_new:'جلسة جديدة',
      btn_back:'رجوع →', btn_studio:'ادخل الاستوديو',
      btn_generate:'توليد', btn_assembly:'إرسال لغرفة المونتاج',
      btn_export:'تصدير الفيلم', btn_recharge:'+ شحن رصيد',
      credits:'رصيد', status_active:'نشط', status_ready:'جاهز'
    }
  };

  var lang = localStorage.getItem('md_lang') || 'en';

  function t(key) { return (TX[lang] && TX[lang][key]) || TX.en[key] || key; }
  function navigate(page) { window.location.href = ROUTES[page] || page; }
  function getCredits() { return parseInt(localStorage.getItem('md_credits') || '0'); }
  function isLoggedIn() { return !!localStorage.getItem('sb_session'); }

  // ── تحديث الرصيد في كل الصفحات ──
  function updateAllCredits() {
    var credits = getCredits();
    var formatted = credits.toLocaleString();
    document.querySelectorAll('[data-credits], #header-credits span:last-child, #footer-credits, #top-credits, #nav-credits').forEach(function(el) {
      el.textContent = formatted + ' CR';
    });
  }

  // ── تحديث زر LOGIN/LOGOUT ──
  function updateAuthButton() {
    var loggedIn = isLoggedIn();
    var email = localStorage.getItem('md_email') || '';

    // كل أزرار login
    document.querySelectorAll('#btn-login, [data-action="login"]').forEach(function(btn) {
      if (loggedIn) {
        btn.textContent = t('btn_logout');
        btn.style.color = '#ff6b6b';
        btn.dataset.action = 'logout';
        btn.onclick = logout;
      } else {
        btn.textContent = t('btn_login');
        btn.style.color = '';
        btn.onclick = function() { navigate('login'); };
      }
    });

    // عرض الإيميل في nav إذا موجود
    var navEmail = document.getElementById('nav-user-email');
    if (navEmail) navEmail.textContent = loggedIn ? email : '';

    // إخفاء/إظهار عناصر حسب الحالة
    document.querySelectorAll('[data-show-logged-in]').forEach(function(el) {
      el.style.display = loggedIn ? '' : 'none';
    });
    document.querySelectorAll('[data-show-logged-out]').forEach(function(el) {
      el.style.display = loggedIn ? 'none' : '';
    });
  }

  // ── تسجيل الخروج ──
  function logout() {
    // مسح كل بيانات الجلسة
    localStorage.removeItem('sb_session');
    localStorage.removeItem('md_user');
    localStorage.removeItem('md_email');
    localStorage.removeItem('md_user_id');
    localStorage.removeItem('md_credits');
    localStorage.removeItem('md_plan');
    localStorage.removeItem('md_6scenes');
    localStorage.removeItem('NEURA_ACTIVE_STREAM');
    // إعادة توجيه للصفحة الرئيسية
    window.location.href = 'index.html';
  }

  // ── اللغة ──
  function setLang(l) {
    lang = l;
    localStorage.setItem('md_lang', l);
    var isRTL = l === 'ar';
    document.documentElement.lang = l;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.body.style.fontFamily = isRTL ? "'Cairo', sans-serif" : '';

    ['en','es','ar'].forEach(function(code) {
      var btn = document.getElementById('lang-' + code);
      if (btn) { btn.style.color = code === l ? '#c8ff00' : ''; btn.style.fontWeight = code === l ? '700' : ''; }
      document.querySelectorAll('[data-lang="' + code + '"]').forEach(function(b) { b.classList.toggle('active-lang', code === l); });
    });

    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      if (t(key)) el.textContent = t(key);
    });

    var input = document.getElementById('chat-input');
    if (input) {
      input.placeholder = {en:"Type your idea here...", es:"Escribe tu idea aquí...", ar:"اكتب فكرتك هنا..."}[l] || "Type your idea here...";
      input.dir = isRTL ? 'rtl' : 'ltr';
    }

    updateAuthButton();
  }

  function fixDeadLinks() {
    document.querySelectorAll('a[href="#"], a[href=""]').forEach(function(a) {
      var txt = a.textContent.trim().toLowerCase();
      if (txt.includes('director')) a.href = ROUTES.directors;
      else if (txt.includes('studio')) a.href = ROUTES.studio;
      else if (txt.includes('assembly')) a.href = ROUTES.assembly;
      else if (txt.includes('pricing')) a.href = ROUTES.pricing;
      else if (txt.includes('home')) a.href = ROUTES.home;
      else a.href = 'javascript:void(0)';
    });
  }

  function wireButtons() {
    ['en','es','ar'].forEach(function(code) {
      var btn = document.getElementById('lang-' + code);
      if (btn) btn.onclick = function() { setLang(code); };
    });

    var loginBtn = document.getElementById('btn-login');
    if (loginBtn) {
      if (isLoggedIn()) {
        loginBtn.textContent = t('btn_logout');
        loginBtn.style.color = '#ff6b6b';
        loginBtn.onclick = logout;
      } else {
        loginBtn.onclick = function() { navigate('login'); };
      }
    }

    var regBtn = document.getElementById('btn-register');
    if (regBtn) regBtn.onclick = function() { navigate('register'); };

    var newBtn = document.getElementById('btn-new-session');
    if (newBtn) newBtn.onclick = function() { navigate('studio'); };

    var backBtn = document.getElementById('btn-back-studio');
    if (backBtn) backBtn.onclick = function() { navigate('studio'); };

    ['btn-wallet','btn-recharge'].forEach(function(id) {
      var btn = document.getElementById(id);
      if (btn) btn.onclick = function() { navigate('pricing'); };
    });

    var assemblyBtn = document.getElementById('btn-assembly');
    if (assemblyBtn) assemblyBtn.onclick = function() { navigate('assembly'); };

    // أزرار START/LOGIN في الصفحات
    document.querySelectorAll('button').forEach(function(btn) {
      if (btn.dataset.wired) return;
      var txt = btn.textContent.trim().toUpperCase();
      if (txt.includes('START YOUR FILM') || txt.includes('EMPIEZA TU FILM')) {
        btn.dataset.wired = '1'; btn.onclick = function() { navigate('directors'); };
      }
      if (txt.includes('START FREE') || txt.includes('EMPEZAR GRATIS')) {
        btn.dataset.wired = '1'; btn.onclick = function() { navigate('register'); };
      }
      if ((txt === 'LOG IN' || txt === 'INICIAR SESIÓN' || txt === 'تسجيل الدخول') && !btn.dataset.wired) {
        btn.dataset.wired = '1';
        if (isLoggedIn()) { btn.textContent = t('btn_logout'); btn.style.color = '#ff6b6b'; btn.onclick = logout; }
        else { btn.onclick = function() { navigate('login'); }; }
      }
    });

    document.querySelectorAll('nav a').forEach(function(a) {
      var txt = a.textContent.trim().toLowerCase();
      if (txt.includes('director')) a.onclick = function(e) { e.preventDefault(); navigate('directors'); };
      else if (txt.includes('studio')) a.onclick = function(e) { e.preventDefault(); navigate('studio'); };
      else if (txt.includes('assembly')) a.onclick = function(e) { e.preventDefault(); navigate('assembly'); };
      else if (txt.includes('pricing')) a.onclick = function(e) { e.preventDefault(); navigate('pricing'); };
      else if (txt.includes('home')) a.onclick = function(e) { e.preventDefault(); navigate('home'); };
    });
  }

  function showLowCreditsModal() {
    var existing = document.getElementById('md-low-credits');
    if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = 'md-low-credits';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = '<div style="background:#0d0d0d;border:1px solid rgba(200,255,0,.35);max-width:400px;width:100%;padding:32px;text-align:center;position:relative">'
      + '<button onclick="document.getElementById(\'md-low-credits\').remove()" style="position:absolute;top:12px;right:14px;background:transparent;border:none;color:#666;cursor:pointer;font-size:18px">✕</button>'
      + '<div style="font-family:Orbitron,monospace;font-size:18px;color:#ffb4ab;margin-bottom:8px">INSUFFICIENT CREDITS</div>'
      + '<div style="font-family:IBM Plex Mono,monospace;font-size:10px;color:#666;margin-bottom:20px;letter-spacing:1px">RECHARGE TO CONTINUE</div>'
      + '<div style="font-family:Orbitron,monospace;font-size:36px;color:#c8ff00;margin-bottom:24px">' + getCredits() + ' CR</div>'
      + '<button onclick="document.getElementById(\'md-low-credits\').remove();window.location.href=\'pricing.html\'" style="width:100%;padding:12px;background:#c8ff00;border:none;font-family:Orbitron,monospace;font-size:10px;font-weight:700;color:#000;cursor:pointer;letter-spacing:2px">+ RECHARGE CREDITS</button>'
      + '</div>';
    document.body.appendChild(modal);
  }

  function init() {
    fixDeadLinks();
    wireButtons();
    updateAllCredits();
    updateAuthButton();
    setLang(lang);

    // مراقبة تغيير الرصيد
    window.addEventListener('storage', function(e) {
      if (e.key === 'md_credits') updateAllCredits();
      if (e.key === 'sb_session') updateAuthButton();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.MD = {
    navigate: navigate, setLang: setLang, t: t,
    getCredits: getCredits, updateCredits: updateAllCredits,
    isLoggedIn: isLoggedIn, logout: logout
  };

})();

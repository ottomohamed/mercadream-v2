// ═══════════════════════════════════════════════════════
// MERCADREAM - Navigation System v3.0
// يقرأ الرصيد من creditsUpdated (Firebase) لا من localStorage
// ═══════════════════════════════════════════════════════

(function() {
  const ROUTES = {
    'home':        'index.html',
    'directors':   'directors.html',
    'studio':      'studio.html',
    'assembly':    'assembly.html',
    'login':       'login.html',
    'register':    'register.html',
    'pricing':     'pricing.html',
    'profile':     'profile.html',
    'upscale':     'upscale.html',
    'animate':     'animate.html',
    'convert':     'convert.html',
    'faceswap':    'faceswap.html',
    'lipsync':     'lipsync.html',
    'deaging':     'deaging.html',
    'grading':     'grading.html'
  };

  const TX = {
    en: {
      nav_home:'Home', nav_directors:'Directors', nav_studio:'Studio',
      nav_assembly:'Assembly', nav_pricing:'Pricing',
      btn_login:'LOG IN', btn_logout:'LOG OUT',
      btn_register:'START FREE', btn_new:'New Session',
      btn_back:'Back', btn_studio:'Enter Studio',
      credits:'Credits'
    },
    es: {
      nav_home:'Inicio', nav_directors:'Directores', nav_studio:'Estudio',
      nav_assembly:'Montaje', nav_pricing:'Precios',
      btn_login:'INICIAR SESIÓN', btn_logout:'CERRAR SESIÓN',
      btn_register:'EMPEZAR GRATIS', btn_new:'Nueva Sesión',
      btn_back:'Atrás', btn_studio:'Entrar al Estudio',
      credits:'Créditos'
    },
    ar: {
      nav_home:'الرئيسية', nav_directors:'المخرجون', nav_studio:'الاستوديو',
      nav_assembly:'المونتاج', nav_pricing:'الأسعار',
      btn_login:'تسجيل الدخول', btn_logout:'تسجيل الخروج',
      btn_register:'ابدأ مجاناً', btn_new:'جلسة جديدة',
      btn_back:'رجوع', btn_studio:'ادخل الاستوديو',
      credits:'رصيد'
    }
  };

  var lang = localStorage.getItem('md_lang') || 'en';

  function t(key) { return (TX[lang] && TX[lang][key]) || TX.en[key] || key; }
  function navigate(page) { window.location.href = ROUTES[page] || page; }

  // ── الرصيد يأتي من Firebase عبر creditsUpdated ──────
  function updateAllCredits(credits) {
    var val = credits !== undefined ? credits : parseInt(localStorage.getItem('md_credits') || '0');
    var formatted = Number(val).toLocaleString();
    document.querySelectorAll(
      '[data-credits], #header-credits span:first-child, ' +
      '#topbar-credit-display, #nav-credits-display, ' +
      '.credits-val, .credits-display'
    ).forEach(function(el) {
      if (el) el.textContent = formatted + ' CRD';
    });
  }

  function isLoggedIn() {
    return localStorage.getItem('sb_session') === 'true' ||
           localStorage.getItem('sb_session') === '1';
  }

  function updateAuthButton() {
    var loggedIn = isLoggedIn();
    document.querySelectorAll('#btn-login, [data-action="login"]').forEach(function(btn) {
      if (!btn) return;
      if (loggedIn) {
        btn.textContent = t('btn_logout');
        btn.onclick = function(e) { e.preventDefault(); logout(); };
      } else {
        btn.textContent = t('btn_login');
        btn.onclick = function(e) { e.preventDefault(); navigate('login'); };
      }
    });
  }

  function logout() {
    // Firebase signOut إن كان متاحاً
    if (window._firebaseAuth && window._firebaseAuth.signOut) {
      window._firebaseAuth.signOut();
    }
    ['sb_session','md_user','md_email','md_credits','md_user_id','md_name'].forEach(function(k) {
      localStorage.removeItem(k);
    });
    window.location.href = 'login.html';
  }

  function setLang(l) {
    lang = l;
    localStorage.setItem('md_lang', l);
    document.documentElement.lang = l;
    document.documentElement.dir  = l === 'ar' ? 'rtl' : 'ltr';
    updateAuthButton();
    updateAllCredits();
  }

  function init() {
    updateAllCredits();
    updateAuthButton();
    setLang(lang);

    // ── استمع لتحديثات Firebase ──────────────────────
    window.addEventListener('creditsUpdated', function(e) {
      updateAllCredits(e.detail.credits);
    });

    // ── استمع لتغيير localStorage (تبويبات أخرى) ─────
    window.addEventListener('storage', function(e) {
      if (e.key === 'md_credits') updateAllCredits(parseInt(e.newValue || '0'));
      if (e.key === 'sb_session') updateAuthButton();
    });
  }

  // ── واجهة عامة window.MD ─────────────────────────
  window.MD = {
    navigate:      navigate,
    setLang:       setLang,
    t:             t,
    getCredits:    function() { return parseInt(localStorage.getItem('md_credits') || '0'); },
    updateCredits: function() { updateAllCredits(); },
    isLoggedIn:    isLoggedIn,
    logout:        logout
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

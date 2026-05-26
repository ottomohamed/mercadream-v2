// MERCADREAM  js/navigation.js (STABLE SESSION VERSION)

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
      btn_register:'START FREE ', btn_new:'New Session',
      btn_back:' Back', btn_studio:'Enter Studio',
      btn_generate:'Generate', btn_assembly:'Send to Assembly Room',
      btn_export:'Export Film', btn_recharge:'+ Recharge',
      credits:'Credits', status_active:'Active', status_ready:'Ready'
    },
    es: {
      nav_home:'Inicio', nav_directors:'Directores', nav_studio:'Estudio',
      nav_assembly:'Montaje', nav_pricing:'Precios',
      btn_login:'INICIAR SESIÓN', btn_logout:'CERRAR SESIÓN',
      btn_register:'EMPEZAR GRATIS ', btn_new:'Nueva Sesión',
      btn_back:' Atrás', btn_studio:'Entrar al Estudio',
      btn_generate:'Generar', btn_assembly:'Enviar a Sala de Montaje',
      btn_export:'Exportar Película', btn_recharge:'+ Recargar',
      credits:'Créditos', status_active:'Activo', status_ready:'Listo'
    },
    ar: {
      nav_home:'الرئيسية', nav_directors:'المخرجون', nav_studio:'الاستوديو',
      nav_assembly:'المونتاج', nav_pricing:'الأسعار',
      btn_login:'تسجيل الدخول', btn_logout:'تسجيل الخروج',
      btn_register:'ابدأ مجاناً ', btn_new:'جلسة جديدة',
      btn_back:'رجوع ', btn_studio:'ادخل الاستوديو',
      btn_generate:'توليد', btn_assembly:'إرسال لغرفة المونتاج',
      btn_export:'تصدير الفيلم', btn_recharge:'+ شحن رصيد',
      credits:'رصيد', status_active:'نشط', status_ready:'جاهز'
    }
  };

  var lang = localStorage.getItem('md_lang') || 'en';

  function t(key) { return (TX[lang] && TX[lang][key]) || TX.en[key] || key; }
  function navigate(page) { window.location.href = ROUTES[page] || page; }
  function getCredits() { return parseInt(localStorage.getItem('md_credits') || '0'); }
  
  function isLoggedIn() { 
    var session = localStorage.getItem('sb_session');
    var hasSession = (session === 'true' || session === '1');
    var hasUser = !!localStorage.getItem('md_user_id');
    return hasSession || hasUser;
  }

  function updateAllCredits() {
    var credits = getCredits();
    var formatted = credits.toLocaleString();
    document.querySelectorAll('[data-credits], #header-credits span:last-child, #footer-credits, #top-credits, #nav-credits').forEach(function(el) {
      if(el) el.textContent = formatted + ' CR';
    });
  }

  function updateAuthButton() {
    var loggedIn = isLoggedIn();
    var email = localStorage.getItem('md_email') || '';

    document.querySelectorAll('#btn-login, [data-action="login"]').forEach(function(btn) {
      if (btn) {
        if (loggedIn) {
          btn.textContent = t('btn_logout');
          btn.style.color = '#ff6b6b';
          btn.dataset.action = 'logout';
          btn.onclick = function(e) {
            e.preventDefault();
            console.log('Manual logout triggered via button click');
            logout();
          };
        } else {
          btn.textContent = t('btn_login');
          btn.style.color = '';
          btn.dataset.action = 'login';
          btn.onclick = function(e) {
            e.preventDefault();
            navigate('login');
          };
        }
      }
    });

    var navEmail = document.getElementById('nav-user-email');
    if (navEmail) navEmail.textContent = loggedIn ? email : '';

    document.querySelectorAll('[data-show-logged-in]').forEach(function(el) {
      if(el) el.style.display = loggedIn ? '' : 'none';
    });
    document.querySelectorAll('[data-show-logged-out]').forEach(function(el) {
      if(el) el.style.display = loggedIn ? 'none' : '';
    });
  }

  function logout() {
    console.warn('Executing logout: Clearing storage.');
    localStorage.removeItem('sb_session');
    localStorage.removeItem('md_user');
    localStorage.removeItem('md_email');
    localStorage.removeItem('md_user_id');
    localStorage.removeItem('md_credits');
    localStorage.removeItem('md_plan');
    localStorage.removeItem('md_name');
    
    if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
        window.location.href = 'index.html';
    }
  }

  function setLang(l) {
    lang = l;
    localStorage.setItem('md_lang', l);
    var isRTL = l === 'ar';
    document.documentElement.lang = l;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.body.style.fontFamily = isRTL ? "'Cairo', sans-serif" : '';

    ['en','es','ar'].forEach(function(code) {
      var btn = document.getElementById('lang-' + code);
      if (btn) { 
        btn.style.color = code === l ? '#c8ff00' : ''; 
        btn.style.fontWeight = code === l ? '700' : ''; 
      }
    });

    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      if (t(key)) el.textContent = t(key);
    });

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
    });
  }

  function wireButtons() {
    ['en','es','ar'].forEach(function(code) {
      var btn = document.getElementById('lang-' + code);
      if (btn) btn.onclick = function() { setLang(code); };
    });

    var regBtn = document.getElementById('btn-register');
    if (regBtn) regBtn.onclick = function() { navigate('register'); };

    ['btn-wallet','btn-recharge'].forEach(function(id) {
      var btn = document.getElementById(id);
      if (btn) btn.onclick = function() { navigate('pricing'); };
    });
  }

  function init() {
    console.log('Navigation init. Session status:', isLoggedIn());
    fixDeadLinks();
    wireButtons();
    updateAllCredits();
    updateAuthButton();
    setLang(lang);

    window.addEventListener('storage', function(e) {
      console.log('Storage event change:', e.key, 'Value:', e.newValue);
      if (e.key === 'md_credits') updateAllCredits();
      if (e.key === 'sb_session' || e.key === 'md_user_id') updateAuthButton();
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

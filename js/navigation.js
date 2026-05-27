<html><head></head><body>// 
// MERCADREAM  js/navigation.js (STABLE SESSION VERSION)
// 

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
      credits:'Credits', status_active:'Active', status_ready:'Ready',
      modal_title: 'PROCESSING COMPLETE',
      modal_desc: 'Your asset has been synthesized with surgical precision. Choose your next protocol.',
      modal_assembly: 'SEND TO ASSEMBLY',
      modal_retry: 'RENDER NEW VERSION',
      modal_back: 'BACK TO COMMAND CENTER'
    },
    es: {
      nav_home:'Inicio', nav_directors:'Directores', nav_studio:'Estudio',
      nav_assembly:'Montaje', nav_pricing:'Precios',
      btn_login:'INICIAR SESIÓN', btn_logout:'CERRAR SESIÓN',
      btn_register:'EMPEZAR GRATIS ', btn_new:'Nueva Sesión',
      btn_back:' Atrás', btn_studio:'Entrar al Estudio',
      btn_generate:'Generar', btn_assembly:'Enviar a Sala de Montaje',
      btn_export:'Exportar Película', btn_recharge:'+ Recargar',
      credits:'Créditos', status_active:'Activo', status_ready:'Listo',
      modal_title: 'PROCESAMIENTO COMPLETADO',
      modal_desc: 'Tu recurso ha sido sintetizado con precisión quirúrgica. Elige tu siguiente protocolo.',
      modal_assembly: 'ENVIAR A MONTAJE',
      modal_retry: 'RENDERIZAR NUEVA VERSIÓN',
      modal_back: 'VOLVER AL CENTRO DE MANDO'
    },
    ar: {
      nav_home:'الرئيسية', nav_directors:'المخرجون', nav_studio:'الاستوديو',
      nav_assembly:'المونتاج', nav_pricing:'الأسعار',
      btn_login:'تسجيل الدخول', btn_logout:'تسجيل الخروج',
      btn_register:'ابدأ مجاناً ', btn_new:'جلسة جديدة',
      btn_back:'رجوع ', btn_studio:'ادخل الاستوديو',
      btn_generate:'توليد', btn_assembly:'إرسال لغرفة المونتاج',
      btn_export:'تصدير الفيلم', btn_recharge:'+ شحن رصيد',
      credits:'رصيد', status_active:'نشط', status_ready:'جاهز',
      modal_title: 'اكتملت المعالجة',
      modal_desc: 'تم تخليق أصولك بدقة جراحية. اختر البروتوكول التالي.',
      modal_assembly: 'إرسال إلى المونتاج',
      modal_retry: 'رندرة نسخة جديدة',
      modal_back: 'العودة لمركز القيادة'
    }
  };

  var lang = localStorage.getItem('md_lang') || 'en';

  function t(key) { return (TX[lang] &amp;&amp; TX[lang][key]) || TX.en[key] || key; }
  function navigate(page) { window.location.href = ROUTES[page] || page; }
  function getCredits() { 
    var raw = localStorage.getItem('md_credits');
    if (raw === null || raw === undefined) return 0;
    return parseInt(raw) || 0; 
  }
  
  function isLoggedIn() { 
    var session = localStorage.getItem('sb_session');
    var hasSession = (session === 'true' || session === '1');
    var hasUser = !!localStorage.getItem('md_user_id');
    return hasSession || hasUser;
  }

  function updateAllCredits() {
    var credits = getCredits();
    var formatted = credits.toLocaleString();
    
    // Update all credit displays including dynamic and static elements
    const elements = document.querySelectorAll('[data-credits], #header-credits span:last-child, #footer-credits, #top-credits, #nav-credits, .credit-display');
    elements.forEach(function(el) {
      if(el) {
        // If it's a value-only container
        if (el.hasAttribute('data-credits-only')) {
          el.textContent = formatted;
        } else {
          el.textContent = formatted + ' CR';
        }
        
        // Visual feedback if credits are low
        if (credits &lt; 10) {
          el.style.color = '#ff4444';
        } else {
          el.style.color = '';
        }
      }
    });
  }

  function showCompletionModal(serviceName) {
    const modalId = 'md-completion-modal';
    if (document.getElementById(modalId)) return;

    const modalOverlay = document.createElement('div');
    modalOverlay.id = modalId;
    modalOverlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md px-4';
    
    const isRTL = lang === 'ar';
    const direction = isRTL ? 'rtl' : 'ltr';

    modalOverlay.innerHTML = `
      <div class="max-w-lg w-full bg-[#0a0a0a] border border-[#c8ff00]/20 p-8 relative overflow-hidden group" dir="${direction}">
<!-- Aesthetic Corner Accents -->
<div class="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#c8ff00]"></div>
<div class="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#c8ff00]"></div>
<div class="relative z-10 text-center">
<div class="w-16 h-16 bg-[#c8ff00]/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#c8ff00]/30">
<span class="material-symbols-outlined text-[#c8ff00] text-4xl">check_circle</span>
</div>
<h2 class="text-[#c8ff00] text-2xl font-bold tracking-tighter mb-2 uppercase">${t('modal_title')}</h2>
<p class="text-zinc-400 text-sm mb-8 font-light leading-relaxed">${t('modal_desc')}</p>
<div class="space-y-3">
<button class="w-full py-4 bg-[#c8ff00] text-black font-black text-sm tracking-widest hover:bg-white transition-colors duration-300" id="modal-btn-assembly">
              ${t('modal_assembly')}
            </button>
<button class="w-full py-4 border border-[#c8ff00]/40 text-[#c8ff00] font-bold text-sm tracking-widest hover:bg-[#c8ff00]/10 transition-colors duration-300" id="modal-btn-retry">
              ${t('modal_retry')}
            </button>
<button class="w-full py-3 text-zinc-500 font-medium text-xs tracking-widest hover:text-white transition-colors duration-300 uppercase" id="modal-btn-back">
              ${t('modal_back')}
            </button>
</div>
</div>
<!-- Background Grid Pattern -->
<div class="absolute inset-0 opacity-[0.03] pointer-events-none" style="background-image: radial-gradient(#c8ff00 1px, transparent 1px); background-size: 20px 20px;"></div>
</div>
    `;

    document.body.appendChild(modalOverlay);

    // Event Listeners
    document.getElementById('modal-btn-assembly').onclick = function() {
      window.location.href = `assembly.html?service=${encodeURIComponent(serviceName || 'unknown')}&amp;status=done`;
    };

    document.getElementById('modal-btn-retry').onclick = function() {
      modalOverlay.remove();
    };

    document.getElementById('modal-btn-back').onclick = function() {
      navigate('profile');
    };
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
    
    if (!window.location.pathname.endsWith('index.html') &amp;&amp; window.location.pathname !== '/') {
        window.location.href = 'index.html';
    } else {
        window.location.reload();
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
      if (e.key === 'md_credits') updateAllCredits();
      if (e.key === 'sb_session' || e.key === 'md_user_id') updateAuthButton();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Exposed API
  window.MD = {
    navigate: navigate, 
    setLang: setLang, 
    t: t,
    getCredits: getCredits, 
    updateCredits: updateAllCredits,
    isLoggedIn: isLoggedIn, 
    logout: logout,
    showCompletionModal: showCompletionModal
  };

})();</body></html>
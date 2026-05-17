// ═══════════════════════════════════════════════════════
// MERCADREAM — js/navigation.js
// Shared navigation + language system for all pages
// Add to every page: <script src="/js/navigation.js"></script>
// ═══════════════════════════════════════════════════════

(function() {

  // ── ROUTES ──
  const ROUTES = {
    'home':       'index.html',
    'directors':  'directors.html',
    'studio':     'studio.html',
    'assembly':   'assembly.html',
    'login':      'login.html',
    'register':   'register.html',
    'pricing':    'pricing.html',
    'upscale':    'upscale.html'
  };

  // ── TRANSLATIONS ──
  const TX = {
    en: {
      nav_home:      'Home',
      nav_directors: 'Directors',
      nav_studio:    'Studio',
      nav_assembly:  'Assembly',
      nav_pricing:   'Pricing',
      btn_login:     'LOG IN',
      btn_register:  'START FREE →',
      btn_new:       'New Session',
      btn_back:      '← Back',
      btn_studio:    'Enter Studio',
      btn_generate:  'Generate',
      btn_assembly:  'Send to Assembly Room',
      btn_export:    'Export Film',
      btn_recharge:  '+ Recharge',
      credits:       'Credits',
      status_active: 'Active',
      status_ready:  'Ready'
    },
    es: {
      nav_home:      'Inicio',
      nav_directors: 'Directores',
      nav_studio:    'Estudio',
      nav_assembly:  'Montaje',
      nav_pricing:   'Precios',
      btn_login:     'INICIAR SESIÓN',
      btn_register:  'EMPEZAR GRATIS →',
      btn_new:       'Nueva Sesión',
      btn_back:      '← Atrás',
      btn_studio:    'Entrar al Estudio',
      btn_generate:  'Generar',
      btn_assembly:  'Enviar a Sala de Montaje',
      btn_export:    'Exportar Película',
      btn_recharge:  '+ Recargar',
      credits:       'Créditos',
      status_active: 'Activo',
      status_ready:  'Listo'
    },
    ar: {
      nav_home:      'الرئيسية',
      nav_directors: 'المخرجون',
      nav_studio:    'الاستوديو',
      nav_assembly:  'المونتاج',
      nav_pricing:   'الأسعار',
      btn_login:     'تسجيل الدخول',
      btn_register:  'ابدأ مجاناً ←',
      btn_new:       'جلسة جديدة',
      btn_back:      'رجوع →',
      btn_studio:    'ادخل الاستوديو',
      btn_generate:  'توليد',
      btn_assembly:  'إرسال لغرفة المونتاج',
      btn_export:    'تصدير الفيلم',
      btn_recharge:  '+ شحن رصيد',
      credits:       'رصيد',
      status_active: 'نشط',
      status_ready:  'جاهز'
    }
  };

  // ── STATE ──
  var lang = localStorage.getItem('md_lang') || 'en';

  // ── HELPERS ──
  function t(key) {
    return (TX[lang] && TX[lang][key]) || TX.en[key] || key;
  }

  function navigate(page) {
    var url = ROUTES[page] || page;
    window.location.href = url;
  }

  function getCredits() {
    return parseInt(localStorage.getItem('md_credits') || '0');
  }

  function updateAllCredits() {
    var credits = getCredits();
    var formatted = credits.toLocaleString();
    document.querySelectorAll(
      '#header-credits span:last-child, #footer-credits, [data-credits]'
    ).forEach(function(el) {
      if (el.id === 'footer-credits') {
        el.textContent = formatted;
      } else {
        el.textContent = formatted + ' CRD';
      }
    });
  }

  // ── LANGUAGE SYSTEM ──
  function setLang(l) {
    lang = l;
    localStorage.setItem('md_lang', l);

    // RTL
    var isRTL = l === 'ar';
    document.documentElement.lang = l;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    if (isRTL) {
      document.body.style.fontFamily = "'Cairo', sans-serif";
    } else {
      document.body.style.fontFamily = '';
    }

    // Update lang buttons
    ['en','es','ar'].forEach(function(code) {
      var btn = document.getElementById('lang-' + code);
      if (btn) {
        btn.style.color = code === l ? '#c8ff00' : '';
        btn.style.fontWeight = code === l ? '700' : '';
      }
      // Also handle text-based lang buttons
      var btns = document.querySelectorAll('[data-lang="' + code + '"]');
      btns.forEach(function(b) {
        b.classList.toggle('active-lang', code === l);
      });
    });

    // Update translatable elements
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      if (t(key)) el.textContent = t(key);
    });

    // Update nav links text
    var navMap = {
      'Home': t('nav_home'),
      'Directors': t('nav_directors'),
      'Studio': t('nav_studio'),
      'Assembly': t('nav_assembly'),
      'Pricing': t('nav_pricing')
    };
    document.querySelectorAll('nav a, nav span').forEach(function(el) {
      var txt = el.textContent.trim();
      if (navMap[txt]) el.textContent = navMap[txt];
    });

    // Update placeholder
    var input = document.getElementById('chat-input');
    if (input) {
      var placeholders = {
        en: "Type your creative directive here...",
        es: "Escribe tu directiva creativa aquí...",
        ar: "اكتب توجيهاتك الإبداعية هنا..."
      };
      input.placeholder = placeholders[l] || placeholders.en;
      input.dir = isRTL ? 'rtl' : 'ltr';
    }
  }

  // ── FIX ALL HREF="#" ──
  function fixDeadLinks() {
    document.querySelectorAll('a[href="#"], a[href=""]').forEach(function(a) {
      var txt = a.textContent.trim().toLowerCase();
      if (txt.includes('director')) a.href = ROUTES.directors;
      else if (txt.includes('studio')) a.href = ROUTES.studio;
      else if (txt.includes('assembly') || txt.includes('montaje') || txt.includes('مونتاج')) a.href = ROUTES.assembly;
      else if (txt.includes('pricing') || txt.includes('precio') || txt.includes('أسعار')) a.href = ROUTES.pricing;
      else if (txt.includes('specialist') || txt.includes('crew') || txt.includes('فريق')) a.href = ROUTES.directors;
      else if (txt.includes('home') || txt.includes('inicio') || txt.includes('رئيسية')) a.href = ROUTES.home;
      else a.href = 'javascript:void(0)';
    });
  }

  // ── WIRE BUTTONS ──
  function wireButtons() {

    // Language buttons
    ['en','es','ar'].forEach(function(code) {
      var btn = document.getElementById('lang-' + code);
      if (btn) btn.onclick = function() { setLang(code); };
    });

    // Login button
    var loginBtn = document.getElementById('btn-login');
    if (loginBtn) loginBtn.onclick = function() { navigate('login'); };

    // Register / Start Free button
    var regBtn = document.getElementById('btn-register');
    if (regBtn) regBtn.onclick = function() { navigate('register'); };

    // New session
    var newBtn = document.getElementById('btn-new-session');
    if (newBtn) newBtn.onclick = function() { navigate('studio'); };

    // Back to studio
    var backBtn = document.getElementById('btn-back-studio');
    if (backBtn) backBtn.onclick = function() { navigate('studio'); };

    // Wallet / recharge
    ['btn-wallet', 'btn-recharge'].forEach(function(id) {
      var btn = document.getElementById(id);
      if (btn) btn.onclick = function() { navigate('directors'); };
    });

    // Assembly room button
    var assemblyBtn = document.getElementById('btn-assembly');
    if (assemblyBtn) assemblyBtn.onclick = function() { navigate('assembly'); };

    // Generate button (directors page)
    var generateBtn = document.getElementById('btn-generate');
    if (generateBtn && !generateBtn.dataset.wired) {
      generateBtn.dataset.wired = '1';
      generateBtn.addEventListener('click', function() {
        var credits = getCredits();
        if (credits < 10) {
          showLowCreditsModal();
          return;
        }
        navigate('studio');
      });
    }

    // START YOUR FILM / START FREE buttons (index page)
    document.querySelectorAll('button').forEach(function(btn) {
      if (btn.dataset.wired) return;
      var txt = btn.textContent.trim().toUpperCase();
      if (txt.includes('START YOUR FILM') || txt.includes('EMPIEZA TU FILM')) {
        btn.dataset.wired = '1';
        btn.onclick = function() { navigate('directors'); };
      }
      if (txt.includes('START FREE') || txt.includes('EMPEZAR GRATIS')) {
        btn.dataset.wired = '1';
        btn.onclick = function() { navigate('register'); };
      }
      if (txt.includes('LOG IN') || txt.includes('INICIAR')) {
        btn.dataset.wired = '1';
        btn.onclick = function() { navigate('login'); };
      }
    });

    // Nav links
    document.querySelectorAll('nav a').forEach(function(a) {
      var txt = a.textContent.trim().toLowerCase();
      if (txt.includes('director')) a.onclick = function(e) { e.preventDefault(); navigate('directors'); };
      else if (txt.includes('studio') || txt.includes('estudio') || txt.includes('استوديو')) a.onclick = function(e) { e.preventDefault(); navigate('studio'); };
      else if (txt.includes('assembly') || txt.includes('montaje') || txt.includes('مونتاج')) a.onclick = function(e) { e.preventDefault(); navigate('assembly'); };
      else if (txt.includes('pricing') || txt.includes('precio') || txt.includes('أسعار')) a.onclick = function(e) { e.preventDefault(); navigate('pricing'); };
      else if (txt.includes('home') || txt.includes('inicio') || txt.includes('رئيسية')) a.onclick = function(e) { e.preventDefault(); navigate('home'); };
    });
  }

  // ── LOW CREDITS MODAL ──
  function showLowCreditsModal() {
    var existing = document.getElementById('md-low-credits');
    if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = 'md-low-credits';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = '<div style="background:#0d0d0d;border:1px solid rgba(200,255,0,.35);max-width:400px;width:100%;padding:32px;text-align:center;position:relative">' +
      '<button onclick="document.getElementById(\'md-low-credits\').remove()" style="position:absolute;top:12px;right:14px;background:transparent;border:none;color:#666;cursor:pointer;font-size:18px">✕</button>' +
      '<div style="font-family:Orbitron,monospace;font-size:18px;color:#ffb4ab;margin-bottom:8px">INSUFFICIENT CREDITS</div>' +
      '<div style="font-family:IBM Plex Mono,monospace;font-size:10px;color:#666;margin-bottom:20px;letter-spacing:1px">YOU NEED 10 CREDITS TO GENERATE A FILM</div>' +
      '<div style="font-family:Orbitron,monospace;font-size:36px;color:#c8ff00;margin-bottom:4px">' + getCredits() + '</div>' +
      '<div style="font-family:IBM Plex Mono,monospace;font-size:9px;color:#666;margin-bottom:24px">CURRENT BALANCE</div>' +
      '<button onclick="document.getElementById(\'md-low-credits\').remove();window.location.href=\'pricing.html\'" style="width:100%;padding:12px;background:#c8ff00;border:none;font-family:Orbitron,monospace;font-size:10px;font-weight:700;color:#000;cursor:pointer;letter-spacing:2px">+ RECHARGE CREDITS</button>' +
    '</div>';
    document.body.appendChild(modal);
  }

  // ── INIT ──
  function init() {
    fixDeadLinks();
    wireButtons();
    updateAllCredits();
    setLang(lang);
  }

  // Run after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose globally
  window.MD = {
    navigate:     navigate,
    setLang:      setLang,
    t:            t,
    getCredits:   getCredits,
    updateCredits: updateAllCredits
  };

})();


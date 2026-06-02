// ═══════════════════════════════════════════════════════
// MERCADREAM — firebase-sync.js
// يُضاف لكل صفحة — يقرأ الرصيد من Firebase دائماً
// ═══════════════════════════════════════════════════════

(function() {
  // انتظر Firebase
  function initSync() {
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
      setTimeout(initSync, 100);
      return;
    }

    firebase.auth().onAuthStateChanged(function(user) {
      if (!user) return;

      // Real-time listener — يُحدّث الرصيد فور أي تغيير في Firebase
      firebase.firestore().collection('users').doc(user.uid).onSnapshot(function(doc) {
        if (!doc.exists) return;
        var data = doc.data();
        var gns = data.credits || 0;

        // حفظ في localStorage
        localStorage.setItem('md_credits', gns);
        localStorage.setItem('md_user_id', user.uid);
        localStorage.setItem('md_name', data.name || user.displayName || 'Creator');
        localStorage.setItem('md_email', user.email || '');
        localStorage.setItem('md_plan', data.plan || 'free');

        // تحديث كل عناصر العرض في الصفحة
        var formatted = gns.toLocaleString();

        // Header GNS displays
        ['top-gns', 'header-gns', 'gns-display', 'top-credits', 'header-gns-display'].forEach(function(id) {
          var el = document.getElementById(id);
          if (el) el.textContent = formatted + ' GNS';
        });

        // Balance displays
        ['balance-display', 'wallet-balance'].forEach(function(id) {
          var el = document.getElementById(id);
          if (el) el.textContent = formatted;
        });

        // Any element with data-gns attribute
        document.querySelectorAll('[data-gns]').forEach(function(el) {
          el.textContent = formatted;
        });
      }, function(error) {
        // Firestore error — fallback to localStorage
        console.warn('Firestore sync error:', error.message);
      });
    });
  }

  // ابدأ بعد تحميل الصفحة
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSync);
  } else {
    initSync();
  }
})();

// ═══════════════════════════════════════════════════════
// MERCADREAM — firebase-sync.js
// يُضاف لكل صفحة — يقرأ الرصيد من Firebase دائماً
// ═══════════════════════════════════════════════════════

(function() {
  function initSync() {
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
      setTimeout(initSync, 100);
      return;
    }

    firebase.auth().onAuthStateChanged(function(user) {
      if (!user) return;

      firebase.firestore().collection('users').doc(user.uid).onSnapshot(function(doc) {
        if (!doc.exists) return;
        var data = doc.data();
        var gns = data.credits || 0;

        localStorage.setItem('md_credits', gns);
        localStorage.setItem('md_user_id', user.uid);
        localStorage.setItem('md_name', data.name || user.displayName || 'Creator');
        localStorage.setItem('md_email', user.email || '');
        localStorage.setItem('md_plan', data.plan || 'free');

        var formatted = gns.toLocaleString();

        ['top-gns', 'header-gns', 'gns-display', 'top-credits', 'header-gns-display'].forEach(function(id) {
          var el = document.getElementById(id);
          if (el) el.textContent = formatted + ' GNS';
        });

        ['balance-display', 'wallet-balance'].forEach(function(id) {
          var el = document.getElementById(id);
          if (el) el.textContent = formatted;
        });

        document.querySelectorAll('[data-gns]').forEach(function(el) {
          el.textContent = formatted;
        });
      }, function(error) {
        console.warn('Firestore sync error:', error.message);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSync);
  } else {
    initSync();
  }
})();

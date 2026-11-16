/* md-firebase.js — MercaDream
 * Shared Firebase setup for pages that did not load Firebase themselves.
 * Needs the 3 compat SDK scripts BEFORE it (app, auth, firestore).
 * Gives every page:
 *   window.mdAuthReady   -> Promise that resolves to the user (or null)
 *   window.__mdGetIdToken -> used by md-auth.js to prove who is paying
 *   'creditsUpdated' event + localStorage md_credits = REAL balance from Firestore
 */
(function () {
  var cfg = {
    apiKey: "AIzaSyBjVzVwEa5tTOjsYtsCB2h3kcqUhyxYOTg",
    authDomain: "mercadream-4b4b3.firebaseapp.com",
    projectId: "mercadream-4b4b3",
    storageBucket: "mercadream-4b4b3.firebasestorage.app",
    messagingSenderId: "257560928442",
    appId: "1:257560928442:web:06983f27629a13eeed6283"
  };
  if (!window.firebase) { console.error('[md-firebase] Firebase SDK not loaded'); return; }
  if (!firebase.apps.length) firebase.initializeApp(cfg);

  function publish(c) {
    localStorage.setItem('md_credits', String(c));
    window.dispatchEvent(new CustomEvent('creditsUpdated', { detail: { credits: c } }));
  }

  window.MD_USER = null;
  window.__mdGetIdToken = function () {
    var u = firebase.auth().currentUser;
    return u ? u.getIdToken() : Promise.resolve(null);
  };

  var unsub = null;
  window.mdAuthReady = new Promise(function (resolve) {
    firebase.auth().onAuthStateChanged(function (user) {
      window.MD_USER = user;
      if (unsub) { unsub(); unsub = null; }
      if (!user) { publish(0); resolve(null); return; }
      unsub = firebase.firestore().collection('users').doc(user.uid).onSnapshot(function (doc) {
        publish(doc.exists ? (Number(doc.data().credits) || 0) : 0);
      }, function (e) { console.error('[md-firebase] balance', e.message); });
      resolve(user);
    });
  });
})();
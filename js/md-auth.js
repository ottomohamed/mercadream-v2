/* md-auth.js — MercaDream
 * Automatically adds the logged-in user's Firebase ID token to every /api/ call,
 * so the server knows who is paying. Load it in every page (before </head>).
 * Works with the compat SDK (window.firebase) and with the modular SDK
 * if firebase-credits.js sets window.__mdGetIdToken.
 */
(function () {
  if (window.__mdAuthFetch) return;
  window.__mdAuthFetch = true;
  var realFetch = window.fetch.bind(window);

  async function getToken() {
    try {
      if (typeof window.__mdGetIdToken === 'function') {
        var t = await window.__mdGetIdToken();
        if (t) return t;
      }
      if (window.firebase && typeof window.firebase.auth === 'function') {
        var u = window.firebase.auth().currentUser;
        if (u) return await u.getIdToken();
      }
    } catch (e) {}
    return null;
  }

  function isApi(url) {
    return url.indexOf('/api/') === 0 ||
           url.indexOf(location.origin + '/api/') === 0 ||
           /^https:\/\/(www\.)?mercadream\.com\/api\//.test(url);
  }

  window.fetch = async function (input, init) {
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (isApi(url)) {
        var token = await getToken();
        if (token) {
          init = Object.assign({}, init || {});
          var headers = new Headers(init.headers || (typeof input !== 'string' && input.headers) || {});
          if (!headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + token);
          init.headers = headers;
        }
      }
    } catch (e) {}
    var res = await realFetch(input, init);
    // Keep the displayed balance in sync with what the server says
    try {
      if (res.ok && isApi(typeof input === 'string' ? input : input.url)) {
        res.clone().json().then(function (d) {
          if (d && typeof d.balance === 'number') {
            localStorage.setItem('md_credits', String(d.balance));
            window.dispatchEvent(new CustomEvent('creditsUpdated', { detail: { credits: d.balance } }));
          }
        }).catch(function () {});
      }
    } catch (e) {}
    return res;
  };
})();
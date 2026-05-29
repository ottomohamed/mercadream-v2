/**
 * MERCADREAM - main.js v3.0
 * Alias لـ app.js — للتوافق مع الصفحات التي تستدعي main.js
 * يعيد توجيه كل شيء لـ MercaDream المُعرَّف في app.js
 */

// انتظر تهيئة app.js ثم اجعل MercaDream متاحاً
window.addEventListener('DOMContentLoaded', () => {
    if (window.MercaDream && !window.MercaDream.state.isInitialized) {
        window.MercaDream.init();
    }
});

/**
 * MERCADREAM - Central Engine v3.0
 * يقرأ الرصيد من Firebase فقط — localStorage للقراءة المتزامنة فقط
 */

const MercaDream = {
    state: {
        credits: 0,
        user: null,
        plan: 'free',
        lang: localStorage.getItem('md_lang') || 'en',
        isInitialized: false
    },

    init() {
        if (this.state.isInitialized) return;
        console.log("MercaDream Central Engine v3.0 — Firebase Mode");
        this._loadUserFromStorage();
        this.bindGlobalEvents();
        this.updateGlobalUI();
        this.state.isInitialized = true;
    },

    // يقرأ فقط بيانات المستخدم (ليس الرصيد — الرصيد يأتي من Firebase)
    _loadUserFromStorage() {
        this.state.plan = localStorage.getItem('md_plan') || 'free';
        this.state.lang = localStorage.getItem('md_lang') || 'en';
        try {
            this.state.user = JSON.parse(localStorage.getItem('md_user') || 'null');
        } catch (e) { this.state.user = null; }
    },

    // يُستدعى من firebase-credits.js عند كل تحديث من Firestore
    setCredits(amount) {
        this.state.credits = amount;
        this.updateGlobalUI();
    },

    updateGlobalUI() {
        const formatted = this.state.credits.toLocaleString();

        // كل العناصر التي تعرض الرصيد
        document.querySelectorAll(
            '[data-credits], .credits-val, .credits-display, ' +
            '#topbar-credit-display, #nav-credits-display, #header-credits span:first-child'
        ).forEach(el => {
            el.textContent = formatted + ' CRD';
        });

        // اسم المستخدم
        if (this.state.user) {
            const name = this.state.user.displayName || this.state.user.email?.split('@')[0] || '';
            document.querySelectorAll('.user-name-display').forEach(el => {
                el.textContent = name.toUpperCase();
            });
        }

        document.documentElement.lang = this.state.lang;
        document.documentElement.dir  = this.state.lang === 'ar' ? 'rtl' : 'ltr';
    },

    // للاستخدام من الأكواد القديمة — يخصم من Firestore إن أمكن
    deductCredits(amount) {
        if (this.state.credits < amount) return false;
        // استخدم Firebase إن كان متاحاً
        if (window.__deductCredits) {
            window.__deductCredits(amount);
            return true;
        }
        // Fallback إذا لم يُحمَّل Firebase بعد
        this.state.credits -= amount;
        localStorage.setItem('md_credits', this.state.credits);
        this.updateGlobalUI();
        return true;
    },

    bindGlobalEvents() {
        // استمع لتحديثات Firebase عبر الحدث المخصص
        window.addEventListener('creditsUpdated', (e) => {
            this.setCredits(e.detail.credits);
        });

        // استمع لتغيير localStorage (من تبويبات أخرى)
        window.addEventListener('storage', (e) => {
            if (e.key === 'md_credits') {
                this.state.credits = parseInt(e.newValue || '0');
                this.updateGlobalUI();
            }
            if (e.key === 'md_plan') {
                this.state.plan = e.newValue || 'free';
            }
        });
    }
};

window.addEventListener('DOMContentLoaded', () => MercaDream.init());
window.MercaDream = MercaDream;

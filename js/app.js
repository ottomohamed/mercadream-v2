/**
 * MERCADREAM - Central Engine (Fixed JS Only)
 * Unified State Management and Video Control
 */

const MercaDream = {
    state: {
        credits: 0,
        user: null,
        isInitialized: false
    },

    init() {
        if (this.state.isInitialized) return;
        console.log("MercaDream Central Engine v1.2 Active");
        this.loadState();
        this.syncUI();
        this.setupGlobalListeners();
        this.state.isInitialized = true;
    },

    loadState() {
        this.state.credits = parseInt(localStorage.getItem('md_credits') || '240');
        try {
            this.state.user = JSON.parse(localStorage.getItem('md_user') || 'null');
        } catch (e) { this.state.user = null; }
    },

    syncUI() {
        const formatted = this.state.credits.toLocaleString();
        document.querySelectorAll('[data-credits], .credits-display, #topbar-credit-display').forEach(el => {
            el.textContent = `${formatted} CRD`;
        });
    },

    deductCredits(amount) {
        if (this.state.credits >= amount) {
            this.state.credits -= amount;
            localStorage.setItem('md_credits', this.state.credits);
            this.syncUI();
            return true;
        }
        return false;
    },

    setupGlobalListeners() {
        window.addEventListener('storage', () => {
            this.loadState();
            this.syncUI();
        });
    }
};

window.addEventListener('DOMContentLoaded', () => MercaDream.init());
window.MercaDream = MercaDream;
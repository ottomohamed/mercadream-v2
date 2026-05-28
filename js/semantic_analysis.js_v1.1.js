/**
 * MERCADREAM - Semantic Analysis Engine v1.1
 * Implementation of State Management, Analysis Logic & UI Rendering
 */

const SemanticEngine = {
    config: {
        cost: 2,
        maxChars: 10000,
        minChars: 50,
        renderInterval: 100
    },
    
    state: {
        isAnalyzing: false,
        selectedParams: ["SCENE PACING"],
        inputLength: 0
    },

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.resetUI();
        console.log("Semantic Engine Synchronized.");
    },

    cacheDOM() {
        this.textarea = document.querySelector("textarea");
        this.charCounter = document.getElementById("char-counter");
        this.analyzeBtn = document.getElementById("btn-semantic");
        this.paramButtons = document.querySelectorAll("#parameters-container button");
        this.statusIndicator = document.getElementById("status-indicator");
        this.statusText = document.getElementById("status-text");
        this.reportId = document.getElementById("report-id");
        this.reportStatusText = document.getElementById("report-status-text");
        this.metricsGrid = document.querySelectorAll("[data-metric]");
    },

    bindEvents() {
        if (this.textarea) {
            this.textarea.addEventListener('input', () => this.handleInput());
        }

        this.paramButtons.forEach(btn => {
            btn.addEventListener('click', () => this.toggleParameter(btn));
        });

        if (this.analyzeBtn) {
            this.analyzeBtn.addEventListener('click', () => this.runAnalysis());
        }
        
        // Listen for global credit updates to refresh UI if needed
        window.addEventListener('storage', () => MercaDream.updateGlobalUI());
    },

    handleInput() {
        const len = this.textarea.value.length;
        this.state.inputLength = len;
        if (this.charCounter) {
            this.charCounter.textContent = `${len.toLocaleString()} / ${this.config.maxChars.toLocaleString()} CHARACTERS`;
            this.charCounter.style.color = len > this.config.maxChars ? "#ff5050" : "#c8ff00";
        }
    },

    toggleParameter(btn) {
        if (this.state.isAnalyzing) return;
        
        const param = btn.getAttribute("data-param");
        const index = this.state.selectedParams.indexOf(param);

        if (index > -1) {
            if (this.state.selectedParams.length > 1) {
                this.state.selectedParams.splice(index, 1);
                btn.classList.remove('param-active');
            } else {
                this.notify("MIN_1_PARAM_REQUIRED", "err");
            }
        } else {
            this.state.selectedParams.push(param);
            btn.classList.add('param-active');
        }
    },

    resetUI() {
        this.metricsGrid.forEach(card => {
            const bar = card.querySelector(".mt-auto .absolute");
            const score = card.querySelector(".text-4xl");
            const icon = card.querySelector(".material-symbols-outlined:not(.text-2xl)");
            
            if (bar) bar.style.width = "0%";
            if (score) score.textContent = "--";
            if (icon) {
                icon.textContent = "lock";
                icon.style.color = "";
            }
            card.style.borderColor = "";
        });
    },

    async runAnalysis() {
        if (this.state.isAnalyzing) return;

        const text = this.textarea.value.trim();
        if (text.length < this.config.minChars) {
            this.notify(`INPUT_TOO_SHORT (MIN ${this.config.minChars})`, "err");
            return;
        }

        if (text.length > this.config.maxChars) {
            this.notify("INPUT_EXCEEDS_LIMIT", "err");
            return;
        }

        // Deduct credits via Central Engine
        if (!MercaDream.deductCredits(this.config.cost)) {
            this.notify("INSUFFICIENT_CREDITS", "err");
            setTimeout(() => window.location.href = "pricing.html", 1500);
            return;
        }

        this.setLoading(true);
        this.resetUI();

        try {
            // Simulated Neural API Processing
            const results = await this.simulateNeuralPath(text);
            this.renderResults(results);
            this.notify("ANALYSIS_COMPLETE", "ok");
        } catch (err) {
            console.error("Neural Error:", err);
            this.notify("SYSTEM_OVERLOAD_RETRY", "err");
            // Refund on failure
            MercaDream.setCredits(MercaDream.state.credits + this.config.cost);
        } finally {
            this.setLoading(false);
        }
    },

    simulateNeuralPath(text) {
        return new Promise((resolve) => {
            // Simulating variable processing time based on text length
            const processingTime = Math.min(5000, 2000 + (text.length / 10));
            setTimeout(() => {
                resolve({
                    pacing: Math.floor(Math.random() * 3 + 7),
                    arc: Math.floor(Math.random() * 4 + 6),
                    dialogue: Math.floor(Math.random() * 2 + 8),
                    emotion: Math.floor(Math.random() * 3 + 7),
                    plot: Math.floor(Math.random() * 4 + 6)
                });
            }, processingTime);
        });
    },

    renderResults(scores) {
        const metrics = [
            { id: "pacing", val: scores.pacing },
            { id: "arc", val: scores.arc },
            { id: "dialogue", val: scores.dialogue },
            { id: "emotion", val: scores.emotion },
            { id: "plot", val: scores.plot }
        ];

        metrics.forEach((m, i) => {
            setTimeout(() => {
                const card = document.querySelector(`[data-metric="${m.id}"]`);
                if (card) {
                    const scoreDisplay = card.querySelector(".text-4xl");
                    const bar = card.querySelector(".mt-auto .absolute");
                    const icon = card.querySelector(".material-symbols-outlined:not(.text-2xl)");
                    
                    if (scoreDisplay) scoreDisplay.textContent = `${m.val}/10`;
                    if (bar) bar.style.width = `${m.val * 10}%`;
                    if (icon) {
                        icon.textContent = "check_circle";
                        icon.style.color = "#c8ff00";
                    }
                    card.style.borderColor = "rgba(200,255,0,0.3)";
                    
                    // Simple sound-like visual ping
                    card.classList.add('animate-pulse');
                    setTimeout(() => card.classList.remove('animate-pulse'), 500);
                }
            }, i * 200);
        });

        if (this.reportId) {
            this.reportId.textContent = `ANALYSIS REPORT // ID: SEM_${Date.now().toString(36).toUpperCase()}`;
        }
        if (this.statusText) {
            this.statusText.textContent = "COMPLETE";
            this.statusText.style.color = "#c8ff00";
        }
        if (this.statusIndicator) {
            this.statusIndicator.style.backgroundColor = "#c8ff00";
            this.statusIndicator.classList.remove('animate-pulse');
        }
    },

    setLoading(active) {
        this.state.isAnalyzing = active;
        if (this.analyzeBtn) {
            this.analyzeBtn.disabled = active;
            const btnText = this.analyzeBtn.querySelector(".btn-text");
            if (active) {
                if (btnText) btnText.textContent = "COMPUTING NEURAL PATHS...";
                if (this.statusText) this.statusText.textContent = "PROCESSING";
                if (this.statusIndicator) this.statusIndicator.classList.add('animate-pulse');
            } else {
                if (btnText) btnText.textContent = `[⚡ ANALYZE — ${this.config.cost} CREDITS]`;
            }
        }
    },

    notify(msg, type) {
        if (this.reportStatusText) {
            this.reportStatusText.textContent = msg;
            this.reportStatusText.style.color = type === "err" ? "#ff5050" : "#c8ff00";
            
            // Auto-reset status message after a delay if it's an error
            if (type === "err") {
                setTimeout(() => {
                    if (this.reportStatusText.textContent === msg) {
                        this.reportStatusText.textContent = "AWAITING SYSTEM EXECUTION";
                        this.reportStatusText.style.color = "";
                    }
                }, 4000);
            }
        }
    }
};

// Launch engine
window.addEventListener('load', () => SemanticEngine.init());
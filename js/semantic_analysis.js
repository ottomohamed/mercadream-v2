/**
 * MERCADREAM - Semantic Analysis Core Logic
 * Implementation of State Management & Error Handling
 */

const SemanticEngine = {
    state: {
        credits: parseInt(localStorage.getItem("md_credits") || "0"),
        cost: 2,
        isAnalyzing: false,
        selectedParams: ["SCENE PACING"],
        inputLength: 0
    },

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.updateUI();
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
    },

    bindEvents() {
        if (this.textarea) {
            this.textarea.oninput = () => this.handleInput();
        }

        this.paramButtons.forEach(btn => {
            btn.onclick = () => this.toggleParameter(btn);
        });

        if (this.analyzeBtn) {
            this.analyzeBtn.onclick = () => this.runAnalysis();
        }

        // Global credits update listener
        window.addEventListener('storage', (e) => {
            if (e.key === 'md_credits') {
                this.state.credits = parseInt(e.newValue || "0");
                this.updateUI();
            }
        });
    },

    handleInput() {
        this.state.inputLength = this.textarea.value.length;
        this.charCounter.textContent = `${this.state.inputLength} / 10,000 CHARACTERS`;
    },

    toggleParameter(btn) {
        const label = btn.getAttribute("data-param");
        const idx = this.state.selectedParams.indexOf(label);
        
        if (idx > -1) {
            if (this.state.selectedParams.length > 1) {
                this.state.selectedParams.splice(idx, 1);
                btn.classList.remove('param-active');
            } else {
                this.showError("Minimal parameter requirement: 1");
            }
        } else {
            this.state.selectedParams.push(label);
            btn.classList.add('param-active');
        }
    },

    updateUI() {
        if (window.MD) window.MD.updateCredits();
    },

    async runAnalysis() {
        if (this.state.isAnalyzing) return;
        
        const text = this.textarea.value.trim();
        if (text.length < 50) {
            this.showError("Input too short. Min 50 characters required.");
            return;
        }

        if (this.state.credits < this.state.cost) {
            this.showError(`Insufficient credits. Required: ${this.state.cost}`);
            setTimeout(() => window.location.href = "pricing.html", 2000);
            return;
        }

        this.setLoadingState(true);

        try {
            // Simulated API Call with Error Handling
            const response = await this.mockApiCall(text);
            this.processResults(response);
        } catch (error) {
            console.error("Neural Analysis Failed:", error);
            this.showError("System Overload: Analysis Interrupted. Credits Preserved.");
        } finally {
            this.setLoadingState(false);
        }
    },

    mockApiCall(text) {
        return new Promise((resolve, reject) => {
            // 5% chance of failure to test error handling
            if (Math.random() < 0.05) {
                setTimeout(() => reject("CONNECTION_TIMEOUT"), 1500);
                return;
            }

            setTimeout(() => {
                resolve({
                    pacing: Math.floor(Math.random() * 3 + 7),
                    arc: Math.floor(Math.random() * 4 + 6),
                    dialogue: Math.floor(Math.random() * 2 + 8),
                    emotion: Math.floor(Math.random() * 3 + 7),
                    plot: Math.floor(Math.random() * 4 + 6)
                });
            }, 3000);
        });
    },

    processResults(scores) {
        const metrics = ["pacing", "arc", "dialogue", "emotion", "plot"];
        metrics.forEach(m => {
            const card = document.querySelector(`[data-metric="${m}"]`);
            if (card) {
                const score = scores[m];
                card.querySelector(".text-4xl").textContent = `${score}/10`;
                card.querySelector(".mt-auto .absolute").style.width = `${score * 10}%`;
                const icon = card.querySelector(".material-symbols-outlined");
                icon.textContent = "check_circle";
                icon.style.color = "#c8ff00";
                card.style.borderColor = "rgba(200,255,0,0.3)";
            }
        });

        this.state.credits -= this.state.cost;
        localStorage.setItem("md_credits", this.state.credits);
        this.updateUI();

        this.reportId.textContent = `ANALYSIS REPORT // ID: SEM_${Date.now().toString(36).toUpperCase()}`;
        this.reportStatusText.textContent = "ANALYSIS COMPLETE";
        this.statusText.textContent = "COMPLETE";
        this.statusText.style.color = "#c8ff00";
        this.statusIndicator.style.backgroundColor = "#c8ff00";
        this.statusIndicator.classList.remove('animate-pulse');
    },

    setLoadingState(active) {
        this.state.isAnalyzing = active;
        const btnText = this.analyzeBtn.querySelector(".btn-text");
        
        if (active) {
            this.analyzeBtn.disabled = true;
            this.analyzeBtn.style.opacity = "0.7";
            btnText.textContent = "COMPUTING NEURAL PATHS...";
            this.statusText.textContent = "PROCESSING";
            this.statusIndicator.classList.add('animate-pulse');
        } else {
            this.analyzeBtn.disabled = false;
            this.analyzeBtn.style.opacity = "1";
            btnText.textContent = `[⚡ ANALYZE — ${this.state.cost} CREDITS]`;
        }
    },

    showError(msg) {
        const originalText = this.reportStatusText.textContent;
        this.reportStatusText.textContent = `ERROR: ${msg}`;
        this.reportStatusText.style.color = "#ff5050";
        
        setTimeout(() => {
            this.reportStatusText.textContent = originalText;
            this.reportStatusText.style.color = "";
        }, 4000);
    }
};

document.addEventListener("DOMContentLoaded", () => SemanticEngine.init());

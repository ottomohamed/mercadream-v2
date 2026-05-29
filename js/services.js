// ═══════════════════════════════════════════════════════
// MERCADREAM — services.js
// خدمات مشتركة: تكلفة كل خدمة + خصم موحد
// ═══════════════════════════════════════════════════════

window.MD_SERVICES = {

  // تكلفة كل خدمة بالكريدت
  COSTS: {
    studio:    12,   // توليد مشهد (يتغير حسب المخرج)
    animate:   10,   // صورة → فيديو
    convert:    3,   // تحويل صيغة
    faceswap:   8,   // تبديل وجه
    deaging:   10,   // تصغير/تكبير السن
    grading:    5,   // تدريج ألوان
    lipsync:   12,   // مزامنة شفاه
    semantic:   2,   // تحليل نصي
    upscale:    6,   // رفع جودة
    assembly:   0    // مونتاج مجاني
  },

  // خصم موحد يمر عبر Firebase
  async spend(service, customCost) {
    const cost = customCost !== undefined ? customCost : (this.COSTS[service] || 0);

    if (cost === 0) return true;

    // استخدم Firebase deductCredits إن كان متاحاً
    if (window.__deductCredits) {
      return await window.__deductCredits(cost);
    }

    // Fallback: localStorage
    const current = parseInt(localStorage.getItem('md_credits') || '0');
    if (current < cost) {
      alert(`رصيدك غير كافٍ. تحتاج ${cost} كريدت، لديك ${current}.`);
      window.location.href = 'pricing.html';
      return false;
    }
    localStorage.setItem('md_credits', current - cost);
    window.dispatchEvent(new CustomEvent('creditsUpdated', { detail: { credits: current - cost } }));
    return true;
  },

  // التحقق من كفاية الرصيد بدون خصم
  canAfford(service, customCost) {
    const cost = customCost !== undefined ? customCost : (this.COSTS[service] || 0);
    const current = parseInt(localStorage.getItem('md_credits') || '0');
    return current >= cost;
  }
};

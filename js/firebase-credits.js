/**
 * firebase-credits.js — v2
 * يقرأ uid من localStorage (يُخزَّن عند تسجيل الدخول)
 * ويستمع لمستند المستخدم الصحيح في Firestore
 */

import { initializeApp }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, onSnapshot, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBjVzVwEa5tTOjsYtsCB2h3kcqUhyxYOTg",
  authDomain:        "mercadream-4b4b3.firebaseapp.com",
  projectId:         "mercadream-4b4b3",
  storageBucket:     "mercadream-4b4b3.firebasestorage.app",
  messagingSenderId: "257560928442",
  appId:             "1:257560928442:web:06983f27629a13eeed6283",
  measurementId:     "G-F0CLDJCV42"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

let _currentCredits = 0;
let _userRef        = null;
let _unsubscribe    = null;

// ── تحديث عناصر الواجهة ──────────────────────────────
function updateCreditsUI(credits) {
  _currentCredits = credits;

  // أي span/p يحتوي رصيد بصيغة "X CREDITS" أو "X CR"
  document.querySelectorAll("span, p").forEach(el => {
    const t = el.textContent.trim();
    if (/^[\d,\.]+k?\s*(CREDITS|CR)$/i.test(t)) {
      const suffix = t.toUpperCase().includes("CREDITS") ? " CREDITS" : " CR";
      el.textContent = Number(credits).toLocaleString() + suffix;
    }
  });

  // assembly — عنصر خاص
  const editorEl = document.getElementById("editorCreditsDisplay");
  if (editorEl) editorEl.textContent = Number(credits).toLocaleString();

  // studio — عناصر خاصة
  const topEl  = document.getElementById("top-credits");
  const footEl = document.getElementById("footer-credits");
  if (topEl)  topEl.innerText  = Number(credits).toLocaleString() + " CR";
  if (footEl) footEl.innerText = Number(credits).toLocaleString() + " CR";

  // مزامنة localStorage للأكواد القديمة
  localStorage.setItem("md_credits", credits);

  // حدث مخصص تستمع إليه الصفحات
  window.dispatchEvent(new CustomEvent("creditsUpdated", { detail: { credits } }));
}

// ── بدء الاستماع لمستند المستخدم ─────────────────────
function startListening(uid) {
  if (_unsubscribe) _unsubscribe(); // إلغاء الاستماع السابق

  _userRef = doc(db, "users", uid);

  _unsubscribe = onSnapshot(_userRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      updateCreditsUI(data.credits ?? 0);
      console.log("✅ Firestore sync — uid:", uid, "| credits:", data.credits ?? 0);
    } else {
      console.warn("⚠️ مستند المستخدم غير موجود في Firestore — uid:", uid);
    }
  }, (err) => {
    console.error("❌ خطأ Firestore:", err.message);
  });
}

// ── خصم كريدت من Firestore ───────────────────────────
export async function deductCredits(cost) {
  if (_currentCredits < cost) {
    alert(`رصيدك غير كافٍ. تحتاج ${cost} كريدت، لديك ${_currentCredits}.`);
    window.location.href = "pricing.html";
    return false;
  }
  if (!_userRef) {
    console.error("❌ لا يوجد مستخدم مسجّل دخول.");
    return false;
  }
  try {
    await updateDoc(_userRef, {
      credits:          increment(-cost),
      renders_executed: increment(1)
    });
    return true;
  } catch (e) {
    console.error("❌ فشل خصم الكريدت:", e.message);
    return false;
  }
}

// ── الحصول على الرصيد الحالي ─────────────────────────
export function getCurrentCredits() {
  return _currentCredits;
}

// ── الحصول على uid المستخدم الحالي ──────────────────
export function getCurrentUid() {
  return auth.currentUser?.uid || localStorage.getItem("md_user_id") || null;
}

// ── تشغيل تلقائي عند تحميل الملف ────────────────────
// أولاً: جرب Firebase Auth مباشرة
onAuthStateChanged(auth, (user) => {
  if (user) {
    // المستخدم مسجّل دخول عبر Firebase Auth
    localStorage.setItem("md_user_id", user.uid);
    startListening(user.uid);
  } else {
    // Fallback: جرب uid المحفوظ في localStorage
    const savedUid = localStorage.getItem("md_user_id");
    if (savedUid) {
      startListening(savedUid);
    } else {
      console.warn("⚠️ لا يوجد مستخدم — الرصيد سيبقى 0 حتى تسجيل الدخول.");
      // توجيه لصفحة اللوجين إذا كانت الصفحة تتطلب مصادقة
      const protectedPages = ["profile.html", "studio.html", "assembly.html", "animate.html", "convert.html"];
      const currentPage = window.location.pathname.split("/").pop();
      if (protectedPages.includes(currentPage)) {
        window.location.href = "login.html";
      }
    }
  }
});

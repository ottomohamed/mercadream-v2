// ═══════════════════════════════════════════════════════
// MERCADREAM — /api/webhook.js
// بروتوكول استقبال التأكيدات المالية من Stripe
// وتحديث حسابات المستخدمين في Supabase
// ═══════════════════════════════════════════════════════

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// إيقاف البارسير الافتراضي لقراءة التوقيع المشفر من Stripe بدقة
module.exports.config = {
  api: { bodyParser: false }
};

// قراءة الـ raw body يدوياً (بديل micro بدون مكتبة خارجية)
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ── SUPABASE CLIENT HELPER ──
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

async function supabase(path, method, body) {
  method = method || 'GET';
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Database credentials not configured.');
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
    },
    body: body ? JSON.stringify(body) : null
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message || `Supabase error ${res.status}`);
  }
  return res.json().catch(() => null);
}

// ── DATABASE OPERATIONS ──
async function injectCreditsToDatabase(userId, amount) {
  console.log(`[DB] Injecting ${amount} credits for user: ${userId}`);
  const credits = await supabase(`credits?user_id=eq.${userId}&select=balance`);
  const current = credits && credits[0] ? credits[0].balance : 0;
  const newBalance = current + amount;

  await supabase(`credits?user_id=eq.${userId}`, 'PATCH', {
    balance: newBalance,
    updated_at: new Date().toISOString()
  });

  await supabase('transactions', 'POST', {
    user_id: userId,
    type: 'topup',
    amount: amount,
    description: 'Credit top-up (Stripe Checkout)'
  });

  console.log(`[DB] Success — New balance: ${newBalance}`);
}

async function upgradeUserPlanInDatabase(userId, plan, bonus) {
  console.log(`[DB] Upgrading user: ${userId} → ${plan} (+${bonus} credits)`);

  await supabase(`users?id=eq.${userId}`, 'PATCH', {
    type: plan.toLowerCase()
  });

  const credits = await supabase(`credits?user_id=eq.${userId}&select=balance`);
  const current = credits && credits[0] ? credits[0].balance : 0;
  const newBalance = current + bonus;

  await supabase(`credits?user_id=eq.${userId}`, 'PATCH', {
    balance: newBalance,
    updated_at: new Date().toISOString()
  });

  await supabase('transactions', 'POST', {
    user_id: userId,
    type: 'topup',
    amount: bonus,
    description: `Subscription: ${plan.toUpperCase()} plan activation bonus`
  });

  console.log(`[DB] Success — Upgraded to ${plan}, new balance: ${newBalance}`);
}

// ── MAIN HANDLER ──
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const buf = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // معالجة حدث إتمام عملية الدفع
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const userId          = session.client_reference_id;
    const transactionType = session.metadata && session.metadata.transaction_type;
    const creditsAmount   = parseInt((session.metadata && session.metadata.credits_amount) || '0');
    const planName        = session.metadata && session.metadata.plan_name;

    console.log(`[Webhook] Transaction for user: ${userId} | type: ${transactionType}`);

    try {
      if (transactionType === 'credits') {
        await injectCreditsToDatabase(userId, creditsAmount);
      } else if (transactionType === 'subscription') {
        const subscriptionBonus = { creator: 300, pro: 1000, studio: 5000 };
        const bonus = subscriptionBonus[(planName || '').toLowerCase()] || 0;
        await upgradeUserPlanInDatabase(userId, planName, bonus);
      }
    } catch (dbErr) {
      console.error(`[Webhook] DB update failed: ${dbErr.message}`);
      // نرجع 200 لـ Stripe حتى لا يعيد الإرسال، لكن نسجل الخطأ
    }
  }

  return res.status(200).json({ received: true });
};

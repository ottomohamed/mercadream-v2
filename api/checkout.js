// ═══════════════════════════════════════════════════════
// MERCADREAM — /api/checkout.js
// بروتوكول توليد روابط الدفع الآمنة عبر Stripe Checkout
// ═══════════════════════════════════════════════════════

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// جدول تعريفي بأسعار الخطط التي تحددها في لوحة تحكم Stripe الخاصة بك
const SUBSCRIPTION_PRICE_IDS = {
  creator_monthly: process.env.STRIPE_PRICE_CREATOR_MONTHLY || 'price_default_creator_mo',
  creator_yearly:  process.env.STRIPE_PRICE_CREATOR_YEARLY  || 'price_default_creator_yr',
  pro_monthly:     process.env.STRIPE_PRICE_PRO_MONTHLY     || 'price_default_pro_mo',
  pro_yearly:      process.env.STRIPE_PRICE_PRO_YEARLY      || 'price_default_pro_yr',
  studio_monthly:  process.env.STRIPE_PRICE_STUDIO_MONTHLY  || 'price_default_studio_mo',
  studio_yearly:   process.env.STRIPE_PRICE_STUDIO_YEARLY   || 'price_default_studio_yr',
};

module.exports = async function handler(req, res) {
  // تفعيل إعدادات CORS لتسهيل الاتصال بين الصفحات والسيرفر
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { type, amount, plan, billing, userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({ error: 'Protocol Error: Missing userId' });
  }

  try {
    let line_items = [];
    let mode = 'payment';

    // الحالة الأولى: شراء رصيد نقاط عشوائي من الحاسبة الرقمية (0.10 دولار لكل نقطة)
    if (type === 'credits') {
      const totalAmount = parseInt(amount) || 0;
      if (totalAmount < 1) return res.status(400).json({ error: 'Invalid credit amount' });

      line_items = [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `MERCADREAM Processing Power: ${totalAmount.toLocaleString()} Credits`,
            description: 'Direct GPU compute core allocation.',
          },
          unit_amount: 10, // القيمة بالسنتات (10 سنت = 0.10 دولار)
        },
        quantity: totalAmount,
      }];
      mode = 'payment';
    }
    // الحالة الثانية: ترقية الاشتراك الشهري أو السنوي للخطط الأربعة
    else if (type === 'subscription') {
      const lookupKey = `${plan.toLowerCase()}_${billing.toLowerCase()}`;
      const priceId = SUBSCRIPTION_PRICE_IDS[lookupKey];

      if (!priceId) return res.status(400).json({ error: 'Invalid Plan/Billing configurations' });

      line_items = [{ price: priceId, quantity: 1 }];
      mode = 'subscription';
    } else {
      return res.status(400).json({ error: 'Unknown acquisition type' });
    }

    // إنشاء الجلسة وتمرير البيانات المرجعية
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: mode,
      line_items: line_items,
      success_url: `${req.headers.origin}/pricing.html?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${req.headers.origin}/pricing.html?status=cancelled`,
      client_reference_id: userId,
      metadata: {
        transaction_type: type,
        credits_amount: amount || '0',
        plan_name: plan || 'none'
      }
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe Engine Session Failure:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

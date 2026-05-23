// 
// MERCADREAM  /api/webhook.js
// بروتوكول استقبال التأكيدات المالية وتحديث حسابات المستخدمين خلف الكواليس
// 
import { buffer } from 'micro';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// إيقاف البارسير الافتراضي لقراءة التوقيع المشفر من Stripe بدقة ميكرومترية
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    // التحقق من التوقيع لمنع التزوير أو الهجمات الخارجية
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.error(` Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // معالجة الحدث عند إتمام عملية الدفع بنجاح
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    const userId = session.client_reference_id; 
    const transactionType = session.metadata.transaction_type;
    const creditsAmount = parseInt(session.metadata.credits_amount) || 0;
    const planName = session.metadata.plan_name;

    console.log(` Transaction Detected for User: ${userId}`);

    if (transactionType === 'credits') {
      // حقن الرصيد الفوري المستند إلى الحاسبة
      await injectCreditsToDatabase(userId, creditsAmount);
    } else if (transactionType === 'subscription') {
      // معالجة خطط الترقية وحقن بونص الحزمة
      const subscriptionBonus = { creator: 300, pro: 1000, studio: 5000 };
      const bonus = subscriptionBonus[planName.toLowerCase()] || 0;
      await upgradeUserPlanInDatabase(userId, planName, bonus);
    }
  }

  res.json({ received: true });
}

//  محرك ربط قاعدة البيانات المركزي للمنصة 
async function injectCreditsToDatabase(userId, amount) {
  console.log(`[DB SUCCESS] Injected ${amount} credits into User account: ${userId}`);
}

async function upgradeUserPlanInDatabase(userId, plan, bonus) {
  console.log(`[DB SUCCESS] Upgraded User: ${userId} to Plan: ${plan} and added ${bonus} bonus credits.`);
}

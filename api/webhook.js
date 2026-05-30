// ═══════════════════════════════════════════════════════
// MERCADREAM — api/webhook.js
// Stripe → Firebase Firestore
// ═══════════════════════════════════════════════════════

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

module.exports.config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ── FIRESTORE REST API ────────────────────────────────
const FIREBASE_PROJECT = 'mercadream-4b4b3';
const FIREBASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

async function getFirestoreToken() {
  // Use service account or API key
  return process.env.FIREBASE_API_KEY || '';
}

async function getUser(uid) {
  const apiKey = process.env.FIREBASE_API_KEY;
  const url = `${FIREBASE_URL}/users/${uid}?key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.fields || null;
}

async function updateUserCredits(uid, newCredits) {
  const apiKey = process.env.FIREBASE_API_KEY;
  const url = `${FIREBASE_URL}/users/${uid}?key=${apiKey}&updateMask.fieldPaths=credits&updateMask.fieldPaths=recharges`;
  
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        credits:  { integerValue: newCredits },
        recharges: { integerValue: Date.now() }
      }
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error('Firestore update failed: ' + JSON.stringify(err));
  }
  return await res.json();
}

// ── MAIN HANDLER ─────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const buf = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId  = session.client_reference_id;
    const credits = parseInt(session.metadata?.credits || '0');

    console.log(`[Webhook] User: ${userId} | Credits: ${credits}`);

    if (!userId || credits < 1) {
      console.warn('[Webhook] Missing userId or credits in metadata');
      return res.status(200).json({ received: true });
    }

    try {
      // Get current balance
      const user = await getUser(userId);
      const currentCredits = user?.credits?.integerValue
        ? parseInt(user.credits.integerValue)
        : 0;

      const newCredits = currentCredits + credits;
      await updateUserCredits(userId, newCredits);

      console.log(`[Webhook] ✅ Credits updated: ${currentCredits} + ${credits} = ${newCredits}`);
    } catch (err) {
      console.error('[Webhook] Firestore error:', err.message);
      // Return 200 to prevent Stripe retries, log the error
    }
  }

  return res.status(200).json({ received: true });
};

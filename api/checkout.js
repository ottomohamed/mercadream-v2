// ═══════════════════════════════════════════════════════
// MERCADREAM — api/checkout.js
// Stripe Checkout — Credits Purchase
// $0.10 per credit — flat rate, no discounts
// ═══════════════════════════════════════════════════════

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const BASE_URL = 'https://www.mercadream.com';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  if (!STRIPE_KEY) return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured.' });

  const { amount, userId } = req.body || {};

  if (!userId) return res.status(400).json({ error: 'userId required.' });

  const creditAmount = parseInt(amount) || 100;
  if (creditAmount < 10) return res.status(400).json({ error: 'Minimum 10 credits.' });

  // $0.10 per credit — flat, no discounts
  const priceInCents = creditAmount * 10; // 10 cents per credit

  console.log('=== CHECKOUT ===');
  console.log('Credits:', creditAmount, '| Price: $' + (priceInCents/100).toFixed(2));
  console.log('User:', userId);

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(STRIPE_KEY);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `MercaDream — ${creditAmount.toLocaleString()} Credits`,
            description: 'AI Cinema Credits · $0.10 per credit',
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${BASE_URL}/pricing.html?status=success&credits=${creditAmount}&uid=${userId}`,
      cancel_url: `${BASE_URL}/pricing.html?status=cancelled`,
      metadata: {
        userId,
        credits: creditAmount.toString(),
      },
      client_reference_id: userId,
    });

    return res.status(200).json({ url: session.url });

  } catch (e) {
    console.error('Checkout error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};

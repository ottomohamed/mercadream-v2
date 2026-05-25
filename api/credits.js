// ═══════════════════════════════════════════════════════
// MERCADREAM — /api/credits.js
// Credits Management: check, spend, topup, history
// ═══════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

async function supabase(path, method, body) {
  method = method || 'GET';
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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  const { action, email, name, type, amount, description } = req.body || {};

  try {

    // ── GET OR CREATE USER + CHECK BALANCE ──
    if (action === 'check') {
      if (!email) return res.status(400).json({ error: 'email required.' });

      // Find user
      let users = await supabase(`users?email=eq.${encodeURIComponent(email)}&select=*`);

      if (!users || users.length === 0) {
        // Create user
        const newUser = await supabase('users', 'POST', {
          email,
          name: name || email.split('@')[0],
          type: type || 'creator'
        });
        const user = Array.isArray(newUser) ? newUser[0] : newUser;

        // Create credits record with 0 balance
        await supabase('credits', 'POST', {
          user_id: user.id,
          balance: 0
        });

        return res.status(200).json({
          user_id: user.id,
          email: user.email,
          type: user.type,
          balance: 0,
          is_new: true
        });
      }

      const user = users[0];
      const credits = await supabase(`credits?user_id=eq.${user.id}&select=balance`);
      const balance = credits && credits[0] ? credits[0].balance : 0;

      return res.status(200).json({
        user_id: user.id,
        email: user.email,
        type: user.type,
        balance,
        is_new: false
      });
    }

    // ── SPEND CREDITS ──
    if (action === 'spend') {
      const user_id = req.body.user_id;
      const cost    = req.body.cost;
      if (!user_id || !cost) return res.status(400).json({ error: 'user_id and cost required.' });

      const credits = await supabase(`credits?user_id=eq.${user_id}&select=balance`);
      const current = credits && credits[0] ? credits[0].balance : 0;

      if (current < cost) {
        return res.status(402).json({
          error: 'Insufficient credits.',
          balance: current,
          required: cost
        });
      }

      const newBalance = current - cost;

      await supabase(`credits?user_id=eq.${user_id}`, 'PATCH', {
        balance: newBalance,
        updated_at: new Date().toISOString()
      });

      await supabase('transactions', 'POST', {
        user_id,
        type: 'spend',
        amount: -cost,
        description: description || 'Film generation'
      });

      return res.status(200).json({ success: true, balance: newBalance });
    }

    // ── TOP UP CREDITS ──
    if (action === 'topup') {
      const user_id       = req.body.user_id;
      const credits_amount = req.body.credits_amount;
      if (!user_id || !credits_amount) return res.status(400).json({ error: 'user_id and credits_amount required.' });

      const credits = await supabase(`credits?user_id=eq.${user_id}&select=balance`);
      const current = credits && credits[0] ? credits[0].balance : 0;
      const newBalance = current + credits_amount;

      await supabase(`credits?user_id=eq.${user_id}`, 'PATCH', {
        balance: newBalance,
        updated_at: new Date().toISOString()
      });

      await supabase('transactions', 'POST', {
        user_id,
        type: 'topup',
        amount: credits_amount,
        description: description || 'Credit top-up'
      });

      return res.status(200).json({ success: true, balance: newBalance });
    }

    // ── GET TRANSACTION HISTORY ──
    if (action === 'history') {
      const user_id = req.body.user_id;
      if (!user_id) return res.status(400).json({ error: 'user_id required.' });

      const transactions = await supabase(
        `transactions?user_id=eq.${user_id}&order=created_at.desc&limit=20`
      );

      return res.status(200).json({ transactions: transactions || [] });
    }

    return res.status(400).json({ error: 'Unknown action.' });

  } catch (err) {
    console.error('Credits error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

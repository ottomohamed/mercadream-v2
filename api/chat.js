// ═══════════════════════════════════════════════════
// MERCADREAM — /api/chat.js
// Vercel Serverless Function → Anthropic Claude
// ═══════════════════════════════════════════════════
// SETUP:
// 1. Place this file at: /api/chat.js in your project root
// 2. Vercel Dashboard → Settings → Environment Variables:
//    ANTHROPIC_API_KEY = sk-ant-...
// 3. Redeploy
// ═══════════════════════════════════════════════════

export default async function handler(req, res) {

  // CORS
  const origin = req.headers.origin || '';
  const allowed = [
    'https://www.mercadream.com',
    'https://mercadream.com',
    'https://mercadream.vercel.app',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ];
  const corsOrigin = allowed.includes(origin) ? origin : allowed[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  // API KEY
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !apiKey.startsWith('sk-')) {
    console.error('ANTHROPIC_API_KEY missing');
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured in Vercel environment variables.' });
  }

  // VALIDATE
  const { messages, system = '', max_tokens = 800 } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required.' });
  }
  const safeTokens = Math.min(Math.max(parseInt(max_tokens) || 800, 50), 2500);

  // CALL ANTHROPIC
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: safeTokens,
        system,
        messages
      })
    });

    if (!response.ok) {
      const e = await response.json().catch(() => ({}));
      const msg = e?.error?.message || `Anthropic HTTP ${response.status}`;
      console.error('Anthropic error:', response.status, msg);
      if (response.status === 401) return res.status(500).json({ error: 'Invalid API key — check Vercel env vars.' });
      if (response.status === 429) return res.status(429).json({ error: 'Rate limit — retry in a moment.' });
      return res.status(response.status).json({ error: msg });
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text || '';
    if (!text) return res.status(500).json({ error: 'Empty response from Anthropic.' });

    return res.status(200).json({ text, usage: data.usage || null });

  } catch (err) {
    console.error('Server error:', err.message);
    return res.status(500).json({ error: 'Internal server error.', details: err.message });
  }
}

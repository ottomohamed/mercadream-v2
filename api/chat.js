// ═══════════════════════════════════════════════════════
// MERCADREAM — /api/chat.js
// Dual AI Strategy:
//   Discovery (conversation) → Gemini Flash 2.0 (FREE)
//   Scene Generation         → Claude Sonnet (PAID, once)
// ═══════════════════════════════════════════════════════
// SETUP — Vercel Environment Variables:
//   ANTHROPIC_API_KEY = sk-ant-...
//   GEMINI_API_KEY    = AIza...  (free from aistudio.google.com)
// ═══════════════════════════════════════════════════════

export default async function handler(req, res) {

  // ── CORS ──
  const origin = req.headers.origin || '';
  const allowed = [
    'https://www.mercadream.com',
    'https://mercadream.com',
    'https://mercadream-v2.vercel.app',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ];
  const corsOrigin = allowed.includes(origin) ? origin : '*';
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  // ── PARSE REQUEST ──
  const {
    messages,
    system = '',
    max_tokens = 800,
    mode = 'auto'   // 'discovery' | 'generate' | 'auto'
  } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required.' });
  }

  const safeTokens = Math.min(Math.max(parseInt(max_tokens) || 800, 50), 2500);

  // ── ROUTING LOGIC ──
  // 'generate' mode = scene generation → always use Claude (PhD quality)
  // 'discovery' mode = conversation → use Gemini (free)
  // 'auto' = detect from system prompt content
  const isGeneration = mode === 'generate'
    || system.includes('Scene Architect')
    || system.includes('OUTPUT FORMAT')
    || system.includes('JSON array')
    || system.includes('SYS_6SCENES')
    || system.includes('Analysis Engine');

  if (isGeneration) {
    return await callClaude(req, res, messages, system, safeTokens);
  } else {
    return await callGemini(req, res, messages, system, safeTokens);
  }
}


// ═══════════════════════════════════════════════════════
// GEMINI FLASH 2.0 — Discovery & Conversation (FREE)
// ═══════════════════════════════════════════════════════
async function callGemini(req, res, messages, system, maxTokens) {

  const apiKey = process.env.GEMINI_API_KEY;

  // Fallback to Claude if no Gemini key
  if (!apiKey) {
    console.log('No GEMINI_API_KEY — falling back to Claude');
    return await callClaude(req, res, messages, system, maxTokens);
  }

  try {
    // Convert messages to Gemini format
    const geminiMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // Add system prompt as first user message if present
    const contents = system
      ? [
          { role: 'user', parts: [{ text: system }] },
          { role: 'model', parts: [{ text: 'Understood. I am ready.' }] },
          ...geminiMessages
        ]
      : geminiMessages;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.85,
            topP: 0.95
          }
        })
      }
    );

    if (!response.ok) {
      const e = await response.json().catch(() => ({}));
      console.error('Gemini error:', response.status, e);
      // Fallback to Claude on Gemini failure
      console.log('Gemini failed — falling back to Claude');
      return await callClaude(req, res, messages, system, maxTokens);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      console.log('Gemini empty response — falling back to Claude');
      return await callClaude(req, res, messages, system, maxTokens);
    }

    return res.status(200).json({
      text,
      model: 'gemini-2.0-flash',
      usage: null
    });

  } catch (err) {
    console.error('Gemini error:', err.message);
    // Always fallback to Claude
    return await callClaude(req, res, messages, system, maxTokens);
  }
}


// ═══════════════════════════════════════════════════════
// CLAUDE SONNET — Scene Generation (PhD Quality)
// ═══════════════════════════════════════════════════════
async function callClaude(req, res, messages, system, maxTokens) {

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || !apiKey.startsWith('sk-')) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY not configured in Vercel environment variables.'
    });
  }

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
        max_tokens: maxTokens,
        system,
        messages
      })
    });

    if (!response.ok) {
      const e = await response.json().catch(() => ({}));
      const msg = e?.error?.message || `Anthropic HTTP ${response.status}`;
      console.error('Claude error:', response.status, msg);
      if (response.status === 401) return res.status(500).json({ error: 'Invalid API key.' });
      if (response.status === 429) return res.status(429).json({ error: 'Rate limit — retry in a moment.' });
      return res.status(response.status).json({ error: msg });
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text || '';

    if (!text) return res.status(500).json({ error: 'Empty response from Claude.' });

    return res.status(200).json({
      text,
      model: 'claude-sonnet-4',
      usage: data.usage || null
    });

  } catch (err) {
    console.error('Claude error:', err.message);
    return res.status(500).json({ error: 'Internal server error.', details: err.message });
  }
}

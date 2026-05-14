// ═══════════════════════════════════════════════════════
// MERCADREAM — /api/chat.js
// 3-Stage AI Pipeline:
//   Stage 1: Discovery    → Gemini Flash 2.0 (FREE)
//   Stage 2: Screenplay   → Claude Haiku (classify + write)
//   Stage 3: Direction    → Claude Sonnet (specialist director)
// ═══════════════════════════════════════════════════════

export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  const {
    messages,
    system = '',
    max_tokens = 800,
    mode = 'auto'
  } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required.' });
  }

  const safeTokens = Math.min(Math.max(parseInt(max_tokens) || 800, 50), 3000);

  // ── ROUTING ──
  // Stage 3: Scene generation by specialist director → Claude Sonnet
  const isGeneration = mode === 'generate'
    || system.includes('Scene Architect')
    || system.includes('JSON array')
    || system.includes('OUTPUT FORMAT');

  // Stage 2: Screenplay writing + classification → Claude Haiku
  const isScreenplay = mode === 'screenplay'
    || system.includes('SCREENPLAY_WRITER')
    || system.includes('classify');

  if (isGeneration) {
    return await callClaude(req, res, messages, system, safeTokens, 'claude-sonnet-4-20250514');
  } else if (isScreenplay) {
    return await callClaude(req, res, messages, system, safeTokens, 'claude-haiku-4-5-20251001');
  } else {
    return await callGemini(req, res, messages, system, safeTokens);
  }
}

// ═══════════════════════════════════════════════════════
// STAGE 1 — GEMINI FLASH 2.0 (Discovery / FREE)
// ═══════════════════════════════════════════════════════
async function callGemini(req, res, messages, system, maxTokens) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return await callClaude(req, res, messages, system, maxTokens, 'claude-haiku-4-5-20251001');
  }

  try {
    const geminiMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const contents = system
      ? [
          { role: 'user', parts: [{ text: system }] },
          { role: 'model', parts: [{ text: 'Understood. Ready.' }] },
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
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.85, topP: 0.95 }
        })
      }
    );

    if (!response.ok) {
      return await callClaude(req, res, messages, system, maxTokens, 'claude-haiku-4-5-20251001');
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      return await callClaude(req, res, messages, system, maxTokens, 'claude-haiku-4-5-20251001');
    }

    return res.status(200).json({ text, model: 'gemini-2.0-flash', usage: null });

  } catch (err) {
    return await callClaude(req, res, messages, system, maxTokens, 'claude-haiku-4-5-20251001');
  }
}

// ═══════════════════════════════════════════════════════
// STAGE 2 & 3 — CLAUDE (Haiku or Sonnet)
// ═══════════════════════════════════════════════════════
async function callClaude(req, res, messages, system, maxTokens, model = 'claude-sonnet-4-20250514') {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || !apiKey.startsWith('sk-')) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages })
    });

    if (!response.ok) {
      const e = await response.json().catch(() => ({}));
      const msg = e?.error?.message || `HTTP ${response.status}`;
      if (response.status === 401) return res.status(500).json({ error: 'Invalid API key.' });
      if (response.status === 429) return res.status(429).json({ error: 'Rate limit — retry.' });
      return res.status(response.status).json({ error: msg });
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text || '';
    if (!text) return res.status(500).json({ error: 'Empty response.' });

    return res.status(200).json({ text, model, usage: data.usage || null });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

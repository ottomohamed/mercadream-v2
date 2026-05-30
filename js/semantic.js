// ═══════════════════════════════════════════════════════
// MERCADREAM — api/semantic.js
// Screenplay Semantic Analysis using Claude
// ═══════════════════════════════════════════════════════

const KEY = process.env.ANTHROPIC_API_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  const { text = '', params = [] } = req.body || {};

  if (!text || text.trim().length < 50) {
    return res.status(400).json({ error: 'Text too short. Minimum 50 characters.' });
  }
  if (!KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured.' });

  const system = `You are a professional screenplay analyst at MercaDream.
Analyze the provided screenplay or creative text and return scores for these metrics.
Return ONLY a valid JSON object with scores from 1-10. No explanation, no markdown.

{
  "pacing": <1-10>,
  "arc": <1-10>,
  "dialogue": <1-10>,
  "emotion": <1-10>,
  "plot": <1-10>,
  "summary": "<one sentence analysis>",
  "strongest": "<the strongest element>",
  "weakest": "<the element that needs most work>"
}`;

  const userMsg = `Analyze this text:\n\n${text.substring(0, 8000)}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(500).json({ error: err.error?.message || 'Claude API error' });
    }

    const data = await response.json();
    const text_response = data.content?.[0]?.text || '';

    // Parse JSON
    const clean = text_response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const scores = JSON.parse(clean);

    return res.status(200).json({ scores, usage: data.usage });

  } catch (err) {
    console.error('Semantic error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// ═══════════════════════════════════════════════════════
// MERCADREAM — /api/animate.js
// Video Animation: Static Image → Animated Video
// Using WaveSpeed AI (Wan 2.1 i2v)
// Cost: 10 CR per animation
// ═══════════════════════════════════════════════════════

const KEY = process.env.WAVESPEED_KEY || process.env.WAVESPEED_API_KEY;
const WAVESPEED_BASE = 'https://api.wavespeed.ai/api/v3';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  if (!KEY) return res.status(500).json({ error: 'WAVESPEED_API_KEY not configured.' });

  const { action, prompt, image_url, duration = 5, id, pollUrl } = req.body || {};

  // ── POLL STATUS ──────────────────────────────────────
  if (action === 'poll' || (id && !prompt)) {
    if (!id) return res.status(400).json({ error: 'id required for polling.' });

    try {
      const url = pollUrl || `${WAVESPEED_BASE}/predictions/${id}/result`;
      const r = await fetch(url, {
        headers: { 'Authorization': `Bearer ${KEY}` }
      });
      const pd = await r.json();
      const data = pd.data || pd;
      const status = data.status || 'processing';
      const videoUrl = (data.outputs && data.outputs[0]) || data.url || null;

      return res.status(200).json({
        status: status === 'succeeded' ? 'completed' : status,
        url: videoUrl,
        id
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── GENERATE: Image → Video ──────────────────────────
  if (!image_url) return res.status(400).json({ error: 'image_url required.' });
  if (!prompt || prompt.trim().length < 5) return res.status(400).json({ error: 'prompt required (min 5 chars).' });

  const safeDuration = Math.min(parseInt(duration) || 5, 10);

  console.log('=== ANIMATE: Image → Video ===');
  console.log('Prompt:', prompt.substring(0, 100));
  console.log('Duration:', safeDuration);

  try {
    const r = await fetch(`${WAVESPEED_BASE}/predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'wavespeed-ai/wan-2.1/i2v-480p',
        input: {
          prompt: prompt.trim(),
          image: image_url,
          duration: safeDuration,
          aspect_ratio: '16:9',
          negative_prompt: 'blurry, distorted, low quality, static, no movement'
        }
      })
    });

    const d = await r.json();
    console.log('WaveSpeed response status:', r.status);

    const jobId = (d.data && d.data.id) || d.id || null;
    const poll = (d.data && d.data.urls && d.data.urls.get)
      || (jobId ? `${WAVESPEED_BASE}/predictions/${jobId}/result` : null);

    if (!jobId) {
      return res.status(400).json({ error: 'No job ID returned.', raw: d });
    }

    return res.status(200).json({
      id: jobId,
      pollUrl: poll,
      status: 'processing',
      estimatedSeconds: 45
    });

  } catch (e) {
    console.error('Animate error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};

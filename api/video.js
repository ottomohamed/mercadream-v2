// ═══════════════════════════════════════════════════════
// MERCADREAM — /api/video.js
// Video Generation → WaveSpeed API
// ═══════════════════════════════════════════════════════
// SETUP in Vercel Environment Variables:
//   WAVESPEED_API_KEY = your_key (from wavespeed.ai)
// ═══════════════════════════════════════════════════════
// ENDPOINTS:
//   POST /api/video        → submit task → returns { taskId }
//   GET  /api/video?id=xxx → poll status → returns { status, videoUrl }
// ═══════════════════════════════════════════════════════

const WAVESPEED_BASE = 'https://api.wavespeed.ai/api/v3';

// Cheapest models for development
const MODELS = {
  fast:    'wavespeed-ai/wan-2.1/t2v-480p',   // cheapest — 480p
  regular: 'wavespeed-ai/wan-2.2/t2v-720p',   // standard — 720p
};

module.exports = async function handler(req, res) {

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.WAVESPEED_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'WAVESPEED_API_KEY not configured.' });
  }

  // ── GET: Poll status ──
  if (req.method === 'GET') {
    const taskId = req.query.id;
    if (!taskId) return res.status(400).json({ error: 'Missing task id.' });

    try {
      const response = await fetch(`${WAVESPEED_BASE}/predictions/${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      const data = await response.json();
      const status = data?.data?.status || 'processing';

      const statusMap = {
        'queued':     'queued',
        'processing': 'generating',
        'completed':  'completed',
        'failed':     'failed'
      };

      return res.status(200).json({
        status: statusMap[status] || 'generating',
        taskId,
        videoUrl: data?.data?.outputs?.[0] || null,
        raw_status: status
      });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST: Submit generation ──
  if (req.method === 'POST') {
    const {
      prompt,
      duration = 10,
      model = 'regular'
    } = req.body || {};

    if (!prompt || prompt.trim().length < 10) {
      return res.status(400).json({ error: 'Prompt required (min 10 chars).' });
    }

    // For development: cap at 10 seconds
    const safeDuration = Math.min(parseInt(duration) || 10, 10);
    const selectedModel = MODELS[model] || MODELS.regular;

    try {
      const response = await fetch(`${WAVESPEED_BASE}/predictions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: selectedModel,
          input: {
            prompt: prompt.trim(),
            duration: safeDuration,
            aspect_ratio: '16:9',
            negative_prompt: 'blurry, low quality, distorted'
          }
        })
      });

      if (!response.ok) {
        const e = await response.json().catch(() => ({}));
        if (response.status === 401) return res.status(500).json({ error: 'Invalid WAVESPEED_API_KEY.' });
        if (response.status === 429) return res.status(429).json({ error: 'Rate limit. Try again.' });
        return res.status(response.status).json({ error: e?.detail || `WaveSpeed HTTP ${response.status}` });
      }

      const data = await response.json();
      const taskId = data?.data?.id;

      if (!taskId) {
        return res.status(500).json({ error: 'No task ID returned.', raw: data });
      }

      return res.status(200).json({
        taskId,
        status: 'queued',
        model: selectedModel,
        duration: safeDuration,
        estimatedSeconds: 60
      });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}


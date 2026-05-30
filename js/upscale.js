// ═══════════════════════════════════════════════════════
// MERCADREAM — api/upscale.js
// Video/Image Upscaler using WaveSpeed
// ═══════════════════════════════════════════════════════

const KEY = process.env.WAVESPEED_API_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  const body = req.body || {};

  // ── POLL ──────────────────────────────────────────────
  if (body.action === 'poll') {
    const { id } = body;
    if (!id) return res.status(400).json({ error: 'id required.' });

    try {
      const pr = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${id}/result`, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + KEY }
      });
      const pd = await pr.json();
      const data = pd.data || pd;
      const status = data.status || 'processing';
      const url = (data.outputs && data.outputs[0]) || data.url || null;
      const normalizedStatus = status === 'succeeded' ? 'completed' : status;
      return res.status(200).json({ status: normalizedStatus, url, id });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── UPSCALE ───────────────────────────────────────────
  const { input_url, type = 'video', scale = 4 } = body;

  if (!input_url) return res.status(400).json({ error: 'input_url required.' });

  // Choose endpoint based on type
  const endpoint = type === 'image'
    ? 'https://api.wavespeed.ai/api/v3/wavespeed-ai/image-upscaler'
    : 'https://api.wavespeed.ai/api/v3/wavespeed-ai/video-upscaler-pro';

  console.log('=== UPSCALE ===');
  console.log('Type:', type, '| Scale:', scale);
  console.log('Input:', input_url.substring(0, 80));

  try {
    const requestBody = type === 'image'
      ? { image: input_url, scale: Math.min(parseInt(scale) || 4, 4) }
      : { video: input_url, scale: Math.min(parseInt(scale) || 4, 4) };

    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const d = await r.json();
    console.log('Response:', JSON.stringify(d).substring(0, 200));

    const jobId = (d.data && d.data.id) || d.id || null;
    if (!jobId) return res.status(400).json({ error: 'No job ID returned', raw: d });

    return res.status(200).json({ id: jobId, status: 'processing' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

// ═══════════════════════════════════════════════════════
// MERCADREAM — api/faceswap.js
// AI Face Swap using WaveSpeed
// Cost: 20 CR per swap
// ═══════════════════════════════════════════════════════

const KEY = process.env.WAVESPEED_API_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  if (!KEY) return res.status(500).json({ error: 'WAVESPEED_API_KEY not configured.' });

  const body = req.body || {};

  // ── POLL ─────────────────────────────────────────────
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
      const status = data.status === 'succeeded' ? 'completed' : (data.status || 'processing');
      const url = (data.outputs && data.outputs[0]) || data.url || null;
      return res.status(200).json({ status, url, id });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── FACESWAP ─────────────────────────────────────────
  const { source_face_url, target_url, target_type = 'image' } = body;

  if (!source_face_url) return res.status(400).json({ error: 'source_face_url required.' });
  if (!target_url) return res.status(400).json({ error: 'target_url required.' });

  console.log('=== FACESWAP ===');
  console.log('Target type:', target_type);

  // Choose endpoint based on target type
  const endpoint = target_type === 'video'
    ? 'https://api.wavespeed.ai/api/v3/wavespeed-ai/faceswap-video'
    : 'https://api.wavespeed.ai/api/v3/wavespeed-ai/faceswap';

  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source_image: source_face_url,
        target_image: target_type === 'image' ? target_url : undefined,
        target_video: target_type === 'video' ? target_url : undefined,
        face_restore: true,
        face_upsample: true
      })
    });

    const d = await r.json();
    console.log('Response:', JSON.stringify(d).substring(0, 200));

    const jobId = (d.data && d.data.id) || d.id || null;
    if (!jobId) return res.status(400).json({ error: 'No job ID returned', raw: d });

    return res.status(200).json({ id: jobId, status: 'processing' });

  } catch (e) {
    console.error('Faceswap error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};

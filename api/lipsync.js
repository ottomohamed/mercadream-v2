// ═══════════════════════════════════════════════════════
// MERCADREAM — api/lipsync.js
// AI Lip Sync using WaveSpeed Sync Lipsync-2-Pro
// Cost: 30 CR per sync (covers ~30s audio)
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

  // ── LIPSYNC ──────────────────────────────────────────
  const { video_url, audio_url, image_url, mode = 'video', sync_mode = 'cut_off' } = body;

  if (!audio_url) return res.status(400).json({ error: 'audio_url required.' });

  console.log('=== LIPSYNC ===');
  console.log('Mode:', mode, '| Sync mode:', sync_mode);

  try {
    let endpoint, requestBody;

    if (mode === 'image') {
      // Image + audio → talking video (InfiniteTalk)
      if (!image_url) return res.status(400).json({ error: 'image_url required for image mode.' });
      endpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk';
      requestBody = { image: image_url, audio: audio_url };
    } else {
      // Video + audio → lipsync (Lipsync-2-Pro)
      if (!video_url) return res.status(400).json({ error: 'video_url required for video mode.' });
      endpoint = 'https://api.wavespeed.ai/api/v3/sync/lipsync-2-pro';
      requestBody = { video: video_url, audio: audio_url, sync_mode };
    }

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

    return res.status(200).json({ id: jobId, status: 'processing', mode });

  } catch (e) {
    console.error('Lipsync error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};

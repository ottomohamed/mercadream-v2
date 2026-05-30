// ═══════════════════════════════════════════════════════
// MERCADREAM — api/wavespeed.js
// Seedance v1.5 Pro — Text-to-Video with native audio
// ═══════════════════════════════════════════════════════

const KEY = process.env.WAVESPEED_API_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};

  // ── POLL ──────────────────────────────────────────────
  if (body.action === 'poll' || (body.id && !body.prompt)) {
    const pollId = body.id;
    if (!pollId) return res.status(400).json({ error: 'No prediction ID' });

    try {
      const pollUrl = 'https://api.wavespeed.ai/api/v3/predictions/' + pollId + '/result';
      const pr = await fetch(pollUrl, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + KEY }
      });
      const pd = await pr.json();
      const data = pd.data || pd;
      const status = data.status || 'processing';
      const url = (data.outputs && data.outputs.length > 0 && data.outputs[0])
        || data.url || data.output || null;

      console.log('POLL:', JSON.stringify({ status, url: url ? url.substring(0, 60) : 'NULL' }));

      const normalizedStatus = (status === 'succeeded') ? 'completed' : status;
      return res.status(200).json({ status: normalizedStatus, url, id: pollId });

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── GENERATE ──────────────────────────────────────────
  const prompt = body.prompt || '';
  const duration = Math.min(parseInt(body.duration) || 10, 12);

  if (!prompt || prompt.trim().length < 5) {
    return res.status(400).json({ error: 'Prompt too short' });
  }

  console.log('=== SEEDANCE 1.5 PRO GENERATE ===');
  console.log('Prompt:', prompt.substring(0, 100));
  console.log('Duration:', duration);

  try {
    const r = await fetch('https://api.wavespeed.ai/api/v3/bytedance/seedance-v1.5-pro/text-to-video', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt.trim(),
        duration: duration,
        aspect_ratio: '16:9',
        resolution: '720p',
        generate_audio: true,
        camera_fixed: false,
        seed: -1
      })
    });

    const d = await r.json();
    console.log('HTTP status:', r.status);
    console.log('Response:', JSON.stringify(d).substring(0, 300));

    const jobId = (d.data && d.data.id) || d.id || null;
    const pollUrl = jobId
      ? 'https://api.wavespeed.ai/api/v3/predictions/' + jobId + '/result'
      : null;

    if (!jobId) {
      return res.status(400).json({ error: 'No job ID returned', raw: d });
    }

    return res.status(200).json({ id: jobId, pollUrl, status: 'processing' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

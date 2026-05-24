// ═══════════════════════════════════════════════════════
// MERCADREAM — api/wavespeed.js
// ═══════════════════════════════════════════════════════

const KEY = process.env.WAVESPEED_KEY || process.env.WAVESPEED_API_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};

  // ── POLL ──────────────────────────────────────────────
  if (body.action === 'poll' || body.id) {
    const pollId = body.id;
    if (!pollId) return res.status(400).json({ error: 'No prediction ID' });

    try {
      // استخدام pollUrl إذا متوفر وإلا بناء الـ URL يدوياً
      const pollUrl = body.pollUrl || ('https://api.wavespeed.ai/api/v3/predictions/' + pollId + '/result');
      const pr = await fetch(pollUrl, {
        headers: { 'Authorization': 'Bearer ' + KEY }
      });
      const pd = await pr.json();

      const data = pd.data || pd;
      const status = data.status || 'processing';

      // الـ URL في outputs[0]
      const url = (data.outputs && data.outputs.length > 0 && data.outputs[0])
        || data.url
        || data.output
        || null;

      console.log('Poll response:', JSON.stringify({ status, url, outputs: data.outputs }));

      // WaveSpeed statuses: created → processing → succeeded/failed
      const normalizedStatus = status === 'succeeded' ? 'completed' : status;

      return res.status(200).json({ status: normalizedStatus, url, id: pollId });

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── GENERATE ──────────────────────────────────────────
  const prompt = body.prompt || 'Cinematic masterpiece sequence';
  const duration = parseInt(body.duration) || 5;

  if (!prompt || prompt.trim().length < 5) {
    return res.status(400).json({ error: 'Prompt too short' });
  }

  // LOG للـ debugging
  console.log('=== WAVESPEED GENERATE ===');
  console.log('Prompt:', prompt);
  console.log('Duration:', duration);
  console.log('KEY exists:', !!KEY);

  try {
    const r = await fetch('https://api.wavespeed.ai/api/v3/vidu/q3/text-to-video', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt.trim(),
        duration: Math.min(duration, 10), // max 10s
        resolution: '540p',  // أرخص
        aspect_ratio: '16:9',
        style: 'general',
        generate_audio: false,
        movement_amplitude: 'auto'
      })
    });

    const d = await r.json();
    console.log('Generate HTTP status:', r.status);
    console.log('Generate response FULL:', JSON.stringify(d));

    const jobId = (d.data && d.data.id) || d.id || d.task_id || null;
    const pollUrl = (d.data && d.data.urls && d.data.urls.get) || null;

    if (!jobId) {
      return res.status(400).json({ error: 'No job ID returned', raw: d });
    }

    return res.status(200).json({ id: jobId, pollUrl: pollUrl, status: 'processing' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

// ═══════════════════════════════════════════════════════
// MERCADREAM — api/wavespeed.js
// Kling v3.0 Pro — Image-to-Video + Text-to-Video
// Audio native, character consistency, 15 seconds max
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
  const duration = Math.min(parseInt(body.duration) || 10, 15);
  const imageUrl = body.image_url || null; // صورة مرجعية اختيارية

  if (!prompt || prompt.trim().length < 5) {
    return res.status(400).json({ error: 'Prompt too short' });
  }

  // اختر النموذج حسب وجود صورة مرجعية
  const model = imageUrl
    ? 'kwaivgi/kling-v3.0-pro/image-to-video'
    : 'kwaivgi/kling-v3.0-pro/text-to-video';

  const endpoint = 'https://api.wavespeed.ai/api/v3/' + model;

  console.log('=== KLING 3.0 PRO GENERATE ===');
  console.log('Model:', model);
  console.log('Prompt:', prompt.substring(0, 100));
  console.log('Duration:', duration);
  console.log('Reference image:', imageUrl ? 'YES' : 'NO');

  // بناء الـ body حسب النموذج
  const requestBody = {
    prompt: prompt.trim(),
    duration: duration,
    aspect_ratio: '16:9',
    cfg_scale: 0.5,
    generate_audio: true
  };

  // أضف الصورة المرجعية إذا موجودة
  if (imageUrl) {
    requestBody.image = imageUrl;
  }

  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
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

    return res.status(200).json({ id: jobId, pollUrl, status: 'processing', model });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

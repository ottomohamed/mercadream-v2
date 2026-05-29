// ═══════════════════════════════════════════════════════
// MERCADREAM — /api/deaging.js
// AI De-aging & Aging: Face Age Transformation
// Using Replicate (Real-ESRGAN + face restoration)
// Cost: 10 CR per transformation
// ═══════════════════════════════════════════════════════

const REPLICATE_KEY = process.env.REPLICATE_API_KEY;
const REPLICATE_BASE = 'https://api.replicate.com/v1';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  if (!REPLICATE_KEY) return res.status(500).json({ error: 'REPLICATE_API_KEY not configured.' });

  const { action, image_url, target_age = 25, direction = 'younger', prediction_id } = req.body || {};

  // ── POLL STATUS ──────────────────────────────────────
  if (action === 'status' || prediction_id) {
    const pid = prediction_id || req.body.id;
    if (!pid) return res.status(400).json({ error: 'prediction_id required.' });

    try {
      const r = await fetch(`${REPLICATE_BASE}/predictions/${pid}`, {
        headers: { 'Authorization': `Token ${REPLICATE_KEY}` }
      });
      const data = await r.json();

      return res.status(200).json({
        status:   data.status === 'succeeded' ? 'completed' : data.status,
        output:   data.output || null,
        error:    data.error  || null,
        progress: getProgress(data.status)
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── DE-AGING / AGING ─────────────────────────────────
  if (!image_url) return res.status(400).json({ error: 'image_url required.' });

  const safeAge = Math.min(Math.max(parseInt(target_age) || 25, 10), 90);

  console.log('=== DEAGING ===');
  console.log('Direction:', direction, '| Target age:', safeAge);

  // Build prompt for age transformation
  const agePrompt = direction === 'younger'
    ? `Transform the person in this photo to look ${safeAge} years old. Make face younger, smoother skin, reduce wrinkles, maintain identity and likeness. Photorealistic, high quality.`
    : `Transform the person in this photo to look ${safeAge} years old. Add age-appropriate wrinkles, grey hair, realistic aging effects while maintaining identity. Photorealistic, high quality.`;

  try {
    const r = await fetch(`${REPLICATE_BASE}/predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: 'db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf',
        input: {
          image:  image_url,
          prompt: agePrompt,
          negative_prompt: 'distorted, unrealistic, cartoon, unnatural, artifacts',
          strength: 0.65,
          guidance_scale: 7.5,
          num_inference_steps: 30
        }
      })
    });

    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: e.detail || `Replicate error ${r.status}` });
    }

    const prediction = await r.json();

    return res.status(200).json({
      prediction_id: prediction.id,
      status: 'processing',
      direction,
      target_age: safeAge,
      message: 'Age transformation started. Poll with action=status.'
    });

  } catch (e) {
    console.error('Deaging error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};

function getProgress(status) {
  const map = { starting: 10, processing: 55, succeeded: 100, failed: 0, canceled: 0 };
  return map[status] || 0;
}

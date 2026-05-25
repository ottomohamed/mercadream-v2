// ═══════════════════════════════════════════════════════
// MERCADREAM — /api/upscale.js
// Video Upscaling Factory: 720p → 4K
// Using Replicate + Real-ESRGAN
// ═══════════════════════════════════════════════════════

module.exports = async function handler(req, res) {

  // ── CORS ──
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  const apiKey = process.env.REPLICATE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'REPLICATE_API_KEY not configured.' });

  const { video_url, scale = 4, action = 'upscale' } = req.body || {};

  // ── ACTION: CHECK STATUS ──
  if (action === 'status') {
    const { prediction_id } = req.body;
    if (!prediction_id) return res.status(400).json({ error: 'prediction_id required.' });

    try {
      const r = await fetch(`https://api.replicate.com/v1/predictions/${prediction_id}`, {
        headers: { 'Authorization': `Token ${apiKey}` }
      });
      const data = await r.json();
      return res.status(200).json({
        status: data.status,
        output: data.output || null,
        error: data.error || null,
        progress: getProgress(data.status)
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── ACTION: UPSCALE VIDEO ──
  if (!video_url) return res.status(400).json({ error: 'video_url required.' });

  try {
    // Use Real-ESRGAN for video upscaling
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: 'c2b1a78d08b6ad5f55f26ef2e0e9a83b285dbc7d7c10e2f90b18f02b7e9f25b',
        input: {
          video: video_url,
          scale: Math.min(Math.max(parseInt(scale) || 4, 2), 4),
          face_enhance: false
        }
      })
    });

    if (!response.ok) {
      const e = await response.json().catch(() => ({}));

      // Fallback to image-based upscaling if video model fails
      console.log('Video model failed, trying image upscaler...');
      return await fallbackImageUpscale(req, res, apiKey, video_url, scale);
    }

    const prediction = await response.json();

    return res.status(200).json({
      prediction_id: prediction.id,
      status: prediction.status,
      message: 'Upscaling started. Poll /api/upscale with action=status to check progress.'
    });

  } catch (err) {
    console.error('Upscale error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ── FALLBACK: Image upscaling for frames ──
async function fallbackImageUpscale(req, res, apiKey, imageUrl, scale) {
  try {
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: '42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b',
        input: {
          image: imageUrl,
          scale: Math.min(parseInt(scale) || 4, 4),
          face_enhance: false
        }
      })
    });

    const prediction = await response.json();
    return res.status(200).json({
      prediction_id: prediction.id,
      status: prediction.status,
      mode: 'image_upscale',
      message: 'Image upscaling started.'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Both video and image upscalers failed: ' + err.message });
  }
}

function getProgress(status) {
  const map = { starting: 5, processing: 50, succeeded: 100, failed: 0, canceled: 0 };
  return map[status] || 0;
}

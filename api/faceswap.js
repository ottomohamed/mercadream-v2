// ═══════════════════════════════════════════════════════
// MERCADREAM — /api/faceswap.js
// AI Face Swap: Source Face → Target Video/Image
// Using Replicate (rope/inswapper)
// Cost: 8 CR per swap
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

  const { action, source_face_url, target_url, target_type = 'image', prediction_id } = req.body || {};

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

  // ── FACESWAP ─────────────────────────────────────────
  if (!source_face_url) return res.status(400).json({ error: 'source_face_url required.' });
  if (!target_url)      return res.status(400).json({ error: 'target_url (image or video) required.' });

  console.log('=== FACESWAP ===');
  console.log('Target type:', target_type);

  try {
    // Use lucataco/faceswap for images, or video variant
    const modelVersion = target_type === 'video'
      ? '9a4298548422074c3f57258c5d544084a7a7680db1f8fb5d1bb18b6b6b7af72c'  // video faceswap
      : '9a4298548422074c3f57258c5d544084a7a7680db1f8fb5d1bb18b6b6b7af72c'; // image faceswap

    const r = await fetch(`${REPLICATE_BASE}/predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: modelVersion,
        input: {
          source_image: source_face_url,
          target_image: target_type === 'image' ? target_url : undefined,
          target_video: target_type === 'video' ? target_url : undefined,
          face_restore:    true,
          background_enhance: false,
          face_upsample:   true,
          upscale: 1
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
      message: 'Face swap started. Poll with action=status.'
    });

  } catch (e) {
    console.error('Faceswap error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};

function getProgress(status) {
  const map = { starting: 10, processing: 60, succeeded: 100, failed: 0, canceled: 0 };
  return map[status] || 0;
}

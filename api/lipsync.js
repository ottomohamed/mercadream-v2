// ═══════════════════════════════════════════════════════
// MERCADREAM — /api/lipsync.js
// AI Lip Sync: Sync video lips to audio track
// Using Replicate (SadTalker / Wav2Lip)
// Cost: 12 CR per sync
// ═══════════════════════════════════════════════════════

const REPLICATE_KEY  = process.env.REPLICATE_API_KEY;
const REPLICATE_BASE = 'https://api.replicate.com/v1';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  if (!REPLICATE_KEY) return res.status(500).json({ error: 'REPLICATE_API_KEY not configured.' });

  const { action, video_url, audio_url, image_url, mode = 'video', prediction_id } = req.body || {};

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

  // ── LIP SYNC ─────────────────────────────────────────
  if (!audio_url) return res.status(400).json({ error: 'audio_url required.' });

  // Mode: 'video' = sync video to audio | 'image' = animate still image with audio
  if (mode === 'video' && !video_url) return res.status(400).json({ error: 'video_url required for video mode.' });
  if (mode === 'image' && !image_url) return res.status(400).json({ error: 'image_url required for image mode.' });

  console.log('=== LIPSYNC ===');
  console.log('Mode:', mode);

  try {
    let body;

    if (mode === 'image') {
      // SadTalker: animate portrait image with audio
      body = {
        version: '3aa3dac9353cc4d6bd62a8f95957bd844003b401ca4e4a9b33baa574c549d376',
        input: {
          source_image: image_url,
          driven_audio: audio_url,
          preprocess:   'full',
          still_mode:   false,
          enhancer:     'gfpgan',
          batch_size:   1,
          size:         256,
          pose_style:   0,
          face_model_resolution: 256,
          expression_scale: 1.0
        }
      };
    } else {
      // Wav2Lip: sync existing video to new audio
      body = {
        version: 'b74fae677b38e56e4e8cfd6c3bbb74d499b54f2efb21b38e61e0df99adfa17dd',
        input: {
          face:        video_url,
          audio:       audio_url,
          pads:        '0 10 0 0',
          smooth:      true,
          resize_factor: 1
        }
      };
    }

    const r = await fetch(`${REPLICATE_BASE}/predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: e.detail || `Replicate error ${r.status}` });
    }

    const prediction = await r.json();

    return res.status(200).json({
      prediction_id: prediction.id,
      status: 'processing',
      mode,
      message: 'Lip sync started. Poll with action=status.',
      estimatedSeconds: mode === 'image' ? 60 : 45
    });

  } catch (e) {
    console.error('Lipsync error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};

function getProgress(status) {
  const map = { starting: 10, processing: 55, succeeded: 100, failed: 0, canceled: 0 };
  return map[status] || 0;
}

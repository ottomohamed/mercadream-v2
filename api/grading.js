// ═══════════════════════════════════════════════════════
// MERCADREAM — /api/grading.js
// AI Color Grading: Apply Cinematic LUTs via Claude Vision
// Analyzes image → applies grade via img2img
// Cost: 5 CR per grade
// ═══════════════════════════════════════════════════════

const REPLICATE_KEY  = process.env.REPLICATE_API_KEY;
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
const REPLICATE_BASE = 'https://api.replicate.com/v1';

// Cinematic grading presets
const GRADES = {
  'NOIR':        'high contrast black and white film noir, deep blacks, bright highlights, dramatic shadows, 1940s cinema aesthetic',
  'TEAL_ORANGE': 'Hollywood teal and orange color grade, warm skin tones against cool shadows, blockbuster look, complementary color contrast',
  'BLADE_RUNNER':'cyberpunk neon color grade, electric blues and purples, orange neon lights, rain-soaked dark atmosphere, Ridley Scott aesthetic',
  'WABI_SABI':   'desaturated Japanese wabi-sabi aesthetic, muted earth tones, soft warm light, minimal color, Hirokazu Kore-eda visual style',
  'GOLDEN_HOUR': 'golden hour magic hour grade, warm amber and gold tones, long shadows, romantic cinematic glow',
  'COLD_NORDIC': 'cold Nordic desaturated grade, blue-grey shadows, minimal warmth, stark contrast, Scandinavian cinema aesthetic',
  'VINTAGE_FILM':'vintage film grain grade, faded colors, light leaks, 70s film stock, Kodachrome warmth, nostalgic texture',
  'NEON_TOKYO':  'neon Tokyo night grade, vivid magenta and cyan neons, deep black streets, vibrant saturated lights, Wong Kar-Wai mood'
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  const { action, image_url, grade = 'TEAL_ORANGE', intensity = 0.7, prediction_id } = req.body || {};

  // ── LIST AVAILABLE GRADES ─────────────────────────────
  if (action === 'list') {
    return res.status(200).json({ grades: Object.keys(GRADES) });
  }

  // ── POLL STATUS ──────────────────────────────────────
  if (action === 'status' || prediction_id) {
    const pid = prediction_id || req.body.id;
    if (!pid || !REPLICATE_KEY) return res.status(400).json({ error: 'prediction_id and REPLICATE_API_KEY required.' });

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

  // ── GRADE IMAGE ──────────────────────────────────────
  if (!image_url) return res.status(400).json({ error: 'image_url required.' });
  if (!REPLICATE_KEY) return res.status(500).json({ error: 'REPLICATE_API_KEY not configured.' });

  const gradeStyle = GRADES[grade.toUpperCase()] || GRADES['TEAL_ORANGE'];
  const safeIntensity = Math.min(Math.max(parseFloat(intensity) || 0.7, 0.3), 0.95);

  console.log('=== COLOR GRADING ===');
  console.log('Grade:', grade, '| Intensity:', safeIntensity);

  const prompt = `Apply cinematic color grade to this image: ${gradeStyle}. Maintain original composition and subjects. Photorealistic color grading only. Professional cinema quality.`;

  try {
    const r = await fetch(`${REPLICATE_BASE}/predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: 'a9758cbfbd5f3c2094457d996681af52552901775aa2d6cc0007152f1cb7b3e4',
        input: {
          image:              image_url,
          prompt:             prompt,
          negative_prompt:    'oversaturated, unrealistic, cartoon, noise, artifacts',
          strength:           safeIntensity,
          guidance_scale:     8,
          num_inference_steps: 25
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
      status:    'processing',
      grade,
      intensity: safeIntensity,
      message:   'Color grading started. Poll with action=status.'
    });

  } catch (e) {
    console.error('Grading error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};

function getProgress(status) {
  const map = { starting: 10, processing: 60, succeeded: 100, failed: 0, canceled: 0 };
  return map[status] || 0;
}

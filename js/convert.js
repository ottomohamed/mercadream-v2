// ═══════════════════════════════════════════════════════
// MERCADREAM — api/convert.js
// Video Format Conversion using WaveSpeed FFmpeg
// Cost: 8 CR per conversion
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

  // ── CONVERT ──────────────────────────────────────────
  const { video_url, format = 'mp4', quality = 'high' } = body;

  if (!video_url) return res.status(400).json({ error: 'video_url required.' });

  // Map quality to CRF value
  const crfMap = { low: 32, medium: 24, high: 18, ultra: 12 };
  const crf = crfMap[quality.toLowerCase()] || 18;

  // Supported formats
  const supportedFormats = ['mp4', 'webm', 'mov', 'avi', 'gif', 'mkv'];
  const targetFormat = supportedFormats.includes(format.toLowerCase()) ? format.toLowerCase() : 'mp4';

  console.log('=== CONVERT ===');
  console.log('Format:', targetFormat, '| Quality:', quality, '| CRF:', crf);
  console.log('Input:', video_url.substring(0, 80));

  try {
    const r = await fetch('https://api.wavespeed.ai/api/v3/wavespeed-ai/video-converter', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        video: video_url,
        output_format: targetFormat,
        crf: crf
      })
    });

    const d = await r.json();
    console.log('Response:', JSON.stringify(d).substring(0, 200));

    const jobId = (d.data && d.data.id) || d.id || null;

    if (!jobId) {
      // Fallback: if conversion API not available, return original
      console.warn('No job ID - returning original URL as fallback');
      return res.status(200).json({
        status: 'completed',
        url: video_url,
        fallback: true,
        message: 'Conversion service unavailable. Original file returned.'
      });
    }

    return res.status(200).json({ id: jobId, status: 'processing', format: targetFormat });

  } catch (e) {
    console.error('Convert error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};

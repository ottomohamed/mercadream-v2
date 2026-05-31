// ═══════════════════════════════════════════════════════
// MERCADREAM — api/audioforge.js
// Neural Audio Generation using WaveSpeed Mureka
// Cost: 25 GNS per track
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
    const { jobId } = body;
    if (!jobId) return res.status(400).json({ error: 'jobId required.' });
    try {
      const pr = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${jobId}/result`, {
        method: 'GET', headers: { 'Authorization': 'Bearer ' + KEY }
      });
      const pd = await pr.json();
      const data = pd.data || pd;
      const status = data.status === 'succeeded' ? 'completed' : (data.status || 'processing');
      const audioUrl = (data.outputs && data.outputs[0]) || data.url || null;
      return res.status(200).json({ 
        status, audioUrl, jobId,
        duration: '03:00',
        terminalLog: status === 'completed' ? ['NEURAL_SYNTHESIS_COMPLETE', 'AUDIO_READY_FOR_PLAYBACK'] : ['PROCESSING_AUDIO_LAYERS...']
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── GENERATE ─────────────────────────────────────────
  const { prompt = '', action } = body;
  if (action !== 'generate' && !prompt) return res.status(400).json({ error: 'prompt required.' });

  console.log('=== AUDIOFORGE ===', prompt.substring(0, 80));

  try {
    const r = await fetch('https://api.wavespeed.ai/api/v3/wavespeed-ai/mureka-v6', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt.trim(), duration: 30 })
    });

    const d = await r.json();
    console.log('Response:', JSON.stringify(d).substring(0, 200));

    const jobId = (d.data && d.data.id) || d.id || null;
    if (!jobId) return res.status(400).json({ error: 'No job ID returned', raw: d });

    return res.status(200).json({ jobId, status: 'processing' });

  } catch (e) {
    console.error('AudioForge error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};

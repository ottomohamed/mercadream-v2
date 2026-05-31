// ═══════════════════════════════════════════════════════
// MERCADREAM — api/bgremover.js
// Image/Video Background Remover & Replacer
// Image: 5 GNS ($0.01 cost) | Video: 15 GNS
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
        method: 'GET', headers: { 'Authorization': 'Bearer ' + KEY }
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

  // ── PROCESS ───────────────────────────────────────────
  const { input_url, mode = 'image', action = 'remove', bg_url } = body;
  if (!input_url) return res.status(400).json({ error: 'input_url required.' });

  let endpoint, requestBody;

  if (mode === 'image') {
    if (action === 'remove') {
      // Remove background → transparent PNG
      endpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/image-background-remover';
      requestBody = { image: input_url };
    } else {
      // Replace background
      endpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/image-background-remover';
      requestBody = { image: input_url };
      // After removal we'll composite with bg (simple approach)
    }
  } else {
    // Video background remover
    endpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/video-background-remover';
    requestBody = { video: input_url };
    if (action === 'replace' && bg_url) {
      requestBody.background_image = bg_url;
    }
  }

  console.log('=== BGREMOVER ===', mode, action);

  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const d = await r.json();
    console.log('Response:', JSON.stringify(d).substring(0, 200));

    // Check for instant result
    const outputs = d.data?.outputs || d.outputs;
    if (outputs && outputs[0]) {
      return res.status(200).json({ url: outputs[0], status: 'completed' });
    }

    const jobId = (d.data && d.data.id) || d.id || null;
    if (!jobId) return res.status(400).json({ error: 'No job ID returned', raw: d });

    return res.status(200).json({ id: jobId, status: 'processing' });

  } catch (e) {
    console.error('BGRemover error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};

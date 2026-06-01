// ═══════════════════════════════════════════════════════
// MERCADREAM — api/pexels.js
// Pexels Stock Video Search
// ═══════════════════════════════════════════════════════

const PEXELS_KEY = process.env.PEXELS_API_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!PEXELS_KEY) return res.status(500).json({ error: 'PEXELS_API_KEY not configured.' });

  const { query = 'sunset', per_page = 12, orientation = 'portrait' } = req.body || req.query || {};

  try {
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${per_page}&orientation=${orientation}&size=medium`;
    
    const r = await fetch(url, {
      headers: { 'Authorization': PEXELS_KEY }
    });

    const data = await r.json();
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

// ═══════════════════════════════════════════════════════
// MERCADREAM — /api/semantic.js
// Semantic Scene Search: Find similar scenes via embeddings
// Using Claude + Pexels for visual reference matching
// ═══════════════════════════════════════════════════════

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const PEXELS_KEY    = process.env.PEXELS_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured.' });

  const { action, query, scenes = [], director = 'drama' } = req.body || {};

  // ── ACTION: ANALYZE BRIEF → SEARCH TERMS ─────────────
  if (action === 'extract' || !action) {
    if (!query) return res.status(400).json({ error: 'query required.' });

    console.log('=== SEMANTIC: Extracting search terms ===');
    console.log('Query:', query.substring(0, 100));

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: `You are a visual search expert for a cinematic AI platform.
Extract 3-5 concise visual search terms from the user's film brief.
Each term should be a concrete visual concept suitable for stock video search.
Return ONLY a JSON array of strings. No explanations.
Example: ["rainy city street at night", "close up face dramatic lighting", "empty warehouse industrial"]`,
          messages: [{ role: 'user', content: `Extract visual search terms for: "${query}"` }]
        })
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || '[]';

      let terms = [];
      try {
        const match = text.match(/\[[\s\S]*\]/);
        terms = match ? JSON.parse(match[0]) : [];
      } catch (e) {
        terms = [query];
      }

      // Search Pexels for each term if key available
      let references = [];
      if (PEXELS_KEY && terms.length > 0) {
        try {
          const searchTerm = terms[0];
          const pexelsRes = await fetch(
            `https://api.pexels.com/videos/search?query=${encodeURIComponent(searchTerm)}&per_page=4&orientation=landscape`,
            { headers: { Authorization: PEXELS_KEY } }
          );
          const pexelsData = await pexelsRes.json();
          references = (pexelsData.videos || []).map(v => {
            const file = v.video_files.find(f => f.quality === 'hd') || v.video_files[0];
            return { id: v.id, url: file?.link || '', thumb: v.image, duration: v.duration };
          });
        } catch (pe) {
          console.log('Pexels search failed:', pe.message);
        }
      }

      return res.status(200).json({ terms, references, query });

    } catch (e) {
      console.error('Semantic extract error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // ── ACTION: RANK SCENES BY RELEVANCE ─────────────────
  if (action === 'rank') {
    if (!query || !scenes.length) return res.status(400).json({ error: 'query and scenes required.' });

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system: `You are a cinematic script supervisor. Rank scenes by relevance to a brief.
Return ONLY a JSON array of scene indices (0-based), sorted best to worst.
Example for 3 scenes: [2, 0, 1]`,
          messages: [{
            role: 'user',
            content: `Brief: "${query}"\n\nScenes:\n${scenes.map((s, i) => `${i}: ${s.title} — ${s.description?.substring(0, 100)}`).join('\n')}\n\nRank by relevance to the brief. Return JSON array of indices only.`
          }]
        })
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || '[]';
      let ranked = [];
      try {
        const match = text.match(/\[[\s\S]*\]/);
        ranked = match ? JSON.parse(match[0]) : scenes.map((_, i) => i);
      } catch (e) {
        ranked = scenes.map((_, i) => i);
      }

      return res.status(200).json({ ranked, total: scenes.length });

    } catch (e) {
      console.error('Semantic rank error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'Unknown action. Use: extract, rank' });
};

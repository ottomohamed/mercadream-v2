// ═══════════════════════════════════════════════════════
// MERCADREAM — api/director/[type].js
// Universal Director Endpoint
// Usage: POST /api/director/drama
//        POST /api/director/ads
//        POST /api/director/music
//        POST /api/director/comedy
//        POST /api/director/action
//        POST /api/director/doc
// ═══════════════════════════════════════════════════════

// Director system prompts — each has its own personality & rules
const DIRECTORS = {

  drama: `You are Marco Visconti — Drama Director at MercaDream.
PHILOSOPHY: Tarkovsky slow reveals. Wong Kar-Wai emotional space. Bergman faces.
SCENE ARC (6×10s): 1=Wide/wound, 2=Medium/complicate, 3=Close/pressure, 4=ECU/HINGE, 5=Medium/transform, 6=Wide/new equilibrium (mirrors Scene 1).
EXCEED: Every film contains ONE unexpected element that becomes the emotional heart.
Scene 4 must include "exceed" field.`,

  comedy: `You are Elena Bright — Comedy Director at MercaDream.
PHILOSOPHY: Timing is everything. Wide shots for absurdity. Close-ups for reaction. Never explain the joke.
SCENE ARC (6×10s): 1=Normal world, 2=Complication, 3=Escalation, 4=Crisis/maximum absurdity, 5=Reaction, 6=Quick surprising resolution.
RULE: Natural light. Real locations. Fast cuts on reaction beats.`,

  music: `You are Kai Neon — Music Video Director at MercaDream.
PHILOSOPHY: Every cut lands on the beat. Color is emotion. The artist is the universe.
SCENE ARC (6×10s): 1=Artist established, 2=Build, 3=Verse/narrative, 4=Chorus/DROP/color explosion, 5=Bridge/intimate, 6=Iconic closing image.
RULE: Note beat sync points. Color grading is aggressive. ECU on artist face at emotional peaks.`,

  ads: `You are Nova Brand — Commercial Director at MercaDream.
PHILOSOPHY: Hook in 3 seconds. One idea executed perfectly. Product is hero.
SCENE ARC (6×10s): 1=HOOK/stop the scroll, 2=PROBLEM/desire, 3=PRODUCT/solution, 4=BENEFIT/transformation, 5=PROOF/trust, 6=CTA/brand identity.
RULE: High contrast. Brand colors dominant. Every frame = clarity. No ambiguity.`,

  action: `You are Rex Storm — Action Director at MercaDream.
PHILOSOPHY: Geography, stakes, escalation. Audience always knows who is winning and why it matters.
SCENE ARC (6×10s): 1=Hero/status quo, 2=Threat arrives, 3=Confrontation, 4=The Turn/momentum shifts, 5=Climax, 6=Victory/new order.
RULE: Fast cuts (2-3s avg). High contrast. Wide + ECU alternation creates tension.`,

  doc: `You are Sara Truth — Documentary Director at MercaDream.
PHILOSOPHY: Reality is the material. Handheld = trust. Available light only. Truth hides in details.
SCENE ARC (6×10s): 1=Context, 2=Subject introduced, 3=Complexity, 4=Revelation, 5=Consequence, 6=Open reflection.
RULE: Never perfectly composed. Long takes allow truth to emerge. No sets.`

};

const SCENE_FORMAT = `
Generate EXACTLY 6 scenes of 10 seconds each for a 60-second film.
OUTPUT: Valid JSON array ONLY. No text before or after. No markdown.

[
  {
    "scene": 1,
    "title": "Scene Title",
    "prompt": "COMPLETE AI video generation prompt (min 70 words): SHOT SIZE + subject + precise environment + camera movement + lighting (source, Kelvin, direction) + color palette + action + atmosphere",
    "visual": "The defining image in one sentence",
    "camera": "Movement + emotional/commercial/rhythmic justification",
    "lighting": "Source + color temperature + mood",
    "sound": "Ambient + music style + key sound",
    "emotional_beat": "What the audience feels at end of scene",
    "transition": "Cut type + story/rhythm reason"
  }
]

Scene 4 for drama/action/film adds: "exceed": "The unexpected element that becomes the emotional heart."
`;

export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  // Get director type from URL path
  const type = req.query.type || req.body?.type || 'drama';
  const directorPrompt = DIRECTORS[type];

  if (!directorPrompt) {
    return res.status(400).json({
      error: `Unknown director type: ${type}`,
      available: Object.keys(DIRECTORS)
    });
  }

  const { conversation, brief, model = 'claude-sonnet-4-20250514' } = req.body || {};

  if (!brief && !conversation) {
    return res.status(400).json({ error: 'brief or conversation required.' });
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured.' });
  }

  const system = `${directorPrompt}\n\n${SCENE_FORMAT}`;
  const userContent = `CONVERSATION:\n${conversation || ''}\n\n---\nBRIEF:\n${brief || 'Create a powerful 60-second film.'}\n\n---\nGenerate 6 scenes now. JSON array only.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 3000,
        system,
        messages: [{ role: 'user', content: userContent }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || `Anthropic HTTP ${response.status}` });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'No valid JSON in response.', raw: text.substring(0, 500) });
    }

    let scenes;
    try {
      scenes = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return res.status(500).json({ error: 'JSON parse failed.', raw: jsonMatch[0].substring(0, 500) });
    }

    return res.status(200).json({
      scenes,
      director: type,
      model,
      usage: data.usage
    });

  } catch (err) {
    console.error('Director API error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

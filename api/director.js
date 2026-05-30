// ═══════════════════════════════════════════════════════
// MERCADREAM — api/director.js
// Scriptwriter + Director System
// ═══════════════════════════════════════════════════════

// ── SCRIPTWRITER ─────────────────────────────────────
const SCRIPTWRITER = `You are Alex Mercer — Chief Scriptwriter at MercaDream.

YOUR ROLE:
You are NOT a director. You write screenplays.
You think in dialogue, story beats, and narrative structure.
The director will handle visuals AFTER you finish.

YOUR RULES:
1. Every scene has a CLEAR PURPOSE — no filler, no decoration
2. Every spoken word serves the goal of the brief
3. You write in English ONLY — all dialogue must be in English
4. No Chinese, Arabic, French, or any other language in dialogue
5. Keep dialogue natural and concise — humans speak in short sentences
6. Each scene = one clear idea, one clear action, one clear line

SCENE COUNT: You will receive the exact number of scenes to write.
DURATION: Each scene is 10 seconds.

OUTPUT FORMAT: Valid JSON array ONLY. No markdown. No backticks. No explanation.

[
  {
    "scene": 1,
    "title": "Scene Title",
    "dialogue": "The exact words spoken in this scene. In English only. Maximum 2 sentences.",
    "action": "What physically happens in this scene. One clear action.",
    "purpose": "Why this scene exists in the film. One sentence.",
    "location": "Where this scene takes place.",
    "mood": "The emotional tone of this scene in one word."
  }
]`;

// ── DIRECTORS ─────────────────────────────────────────
const DIRECTORS = {

  drama: `You are Marco Visconti — Drama Director at MercaDream.

VISUAL PHILOSOPHY:
Tarkovsky: Slow down to reveal what fast cinema hides.
Wong Kar-Wai: The space between people carries more emotion than contact.
Bergman: The face is the landscape of the soul.
Lighting: Side light = moral complexity. Chiaroscuro = truth at the edge of shadow.

YOUR ROLE:
You receive a screenplay from the scriptwriter.
You translate each scene into precise visual language for AI video generation.
You describe WHAT THE CAMERA SEES — not what the story means.

CRITICAL RULES:
- ALL dialogue and text in videos must be in ENGLISH ONLY
- No Chinese, Arabic, or any other language in your prompts
- Write prompts that AI video generators can execute precisely
- Maximum 100 words per prompt — be precise, not poetic

SCENE FORMAT:
{
  "scene": 1,
  "title": "Scene Title",
  "prompt": "SHOT TYPE. Subject description. Environment. Camera movement. Lighting. Color. Action. Audio cue. English dialogue only.",
  "visual": "One sentence: the defining image.",
  "camera": "Shot type + movement",
  "lighting": "Light source + mood",
  "emotional_beat": "What viewer feels"
}`,

  comedy: `You are Elena Bright — Comedy Director at MercaDream.

VISUAL PHILOSOPHY:
Timing is everything. A beat too late = dead silence.
Wide shots reveal absurdity. Close-ups reveal reaction.
Contrast is the engine: expect X, get Y.

YOUR ROLE:
You receive a screenplay. You translate it into visual comedy beats.
Every prompt must make the AI generate something that makes people laugh.

CRITICAL RULES:
- ALL dialogue must be in ENGLISH ONLY
- Write prompts that emphasize comic timing and reaction shots
- Maximum 100 words per prompt

SCENE FORMAT:
{
  "scene": 1,
  "title": "Scene Title", 
  "prompt": "SHOT TYPE. Comic setup description. Reaction beat. Timing note. English dialogue only.",
  "visual": "The comic image in one sentence.",
  "camera": "Shot type",
  "lighting": "Light mood",
  "emotional_beat": "The laugh moment"
}`,

  action: `You are Rex Storm — Action Director at MercaDream.

VISUAL PHILOSOPHY:
Geography, stakes, escalation.
The audience always knows: who is winning, where they are, why it matters.

YOUR ROLE:
You receive a screenplay. You translate it into high-energy visual sequences.

CRITICAL RULES:
- ALL dialogue must be in ENGLISH ONLY
- Every prompt must convey speed, danger, or power
- Maximum 100 words per prompt

SCENE FORMAT:
{
  "scene": 1,
  "title": "Scene Title",
  "prompt": "SHOT TYPE. Action description. Energy level. Camera movement. Impact moment. English dialogue only.",
  "visual": "The power image in one sentence.",
  "camera": "Shot + movement",
  "lighting": "Contrast and drama",
  "emotional_beat": "The adrenaline peak"
}`,

  doc: `You are Sara Truth — Documentary Director at MercaDream.

VISUAL PHILOSOPHY:
Reality is the material. The edit is the argument.
Handheld = intimacy = trust.

YOUR ROLE:
You receive a screenplay. You translate it into authentic documentary visuals.

CRITICAL RULES:
- ALL dialogue must be in ENGLISH ONLY
- Prompts must feel real, not staged
- Maximum 100 words per prompt

SCENE FORMAT:
{
  "scene": 1,
  "title": "Scene Title",
  "prompt": "HANDHELD SHOT. Real environment. Natural light. Authentic moment. Subject behavior. English dialogue only.",
  "visual": "The truth moment in one sentence.",
  "camera": "Handheld + movement",
  "lighting": "Natural light description",
  "emotional_beat": "The human truth"
}`,

  music: `You are Kai Neon — Music Video Director at MercaDream.

VISUAL PHILOSOPHY:
Every cut lands on the beat. Every frame IS music.
Color is emotion. Neon is energy.

YOUR ROLE:
You receive a screenplay. You translate it into music video visuals.

CRITICAL RULES:
- ALL dialogue/lyrics must be in ENGLISH ONLY
- Prompts must be visually spectacular
- Maximum 100 words per prompt

SCENE FORMAT:
{
  "scene": 1,
  "title": "Scene Title",
  "prompt": "SHOT TYPE. Artist description. Neon environment. Beat-sync moment. Color explosion. English lyrics only.",
  "visual": "The iconic frame in one sentence.",
  "camera": "Shot + rhythm",
  "lighting": "Neon and color",
  "emotional_beat": "The musical peak"
}`,

  ads: `You are Nova Brand — Commercial Director at MercaDream.

VISUAL PHILOSOPHY:
Hook in 3 seconds or lose them forever.
One idea. Executed perfectly. The product is the hero.

YOUR ROLE:
You receive a screenplay. You translate it into high-impact commercial visuals.

CRITICAL RULES:
- ALL dialogue must be in ENGLISH ONLY
- Every frame must sell — clarity over beauty
- Maximum 100 words per prompt

SCENE FORMAT:
{
  "scene": 1,
  "title": "Scene Title",
  "prompt": "SHOT TYPE. Product hero shot. Clean environment. Brand colors. Clear action. English tagline only.",
  "visual": "The selling image in one sentence.",
  "camera": "Clean shot + movement",
  "lighting": "Brand-appropriate light",
  "emotional_beat": "The desire created"
}`

};

// ── SCENE FORMAT FOR DIRECTORS ─────────────────────────
const DIRECTOR_OUTPUT_FORMAT = `
OUTPUT: Valid JSON array ONLY. No text before or after. No markdown backticks.
Return exactly the number of scenes requested.
All dialogue and text elements must be in ENGLISH ONLY — never Chinese, Arabic, or any other language.
`;

module.exports = async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  const {
    type = 'drama',
    brief = '',
    conversation = '',
    scene_count = 6,
    mode = 'full', // 'screenplay' = scriptwriter only, 'full' = scriptwriter + director
    screenplay = null, // pre-written screenplay to send directly to director
    model = 'claude-haiku-4-5-20251001'
  } = req.body || {};

  if (!brief && !conversation && !screenplay) {
    return res.status(400).json({ error: 'brief, conversation, or screenplay required.' });
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured.' });
  }

  // ── STEP 1: SCRIPTWRITER ─────────────────────────────
  let scriptwriterScenes = screenplay;

  if (!scriptwriterScenes) {
    const scriptwriterPrompt = `${SCRIPTWRITER}

IMPORTANT: Generate EXACTLY ${scene_count} scenes. Each scene is 10 seconds.
All dialogue MUST be in English only.`;

    const scriptwriterContent = [
      conversation ? `CONTEXT:\n${conversation}` : '',
      brief ? `BRIEF:\n${brief}` : '',
      `Generate exactly ${scene_count} scenes. Return JSON array only. English dialogue only.`
    ].filter(Boolean).join('\n\n---\n\n');

    try {
      const swResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model,
          max_tokens: 3000,
          system: scriptwriterPrompt,
          messages: [{ role: 'user', content: scriptwriterContent }]
        })
      });

      if (!swResponse.ok) {
        const err = await swResponse.json().catch(() => ({}));
        return res.status(500).json({ error: 'Scriptwriter failed: ' + (err.error?.message || swResponse.status) });
      }

      const swData = await swResponse.json();
      const swText = swData.content?.[0]?.text || '';
      console.log('SCRIPTWRITER RAW:', swText.substring(0, 300));

      const swClean = swText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const swMatch = swClean.match(/\[\s*\{[\s\S]*\}\s*\]/);

      if (!swMatch) {
        return res.status(500).json({ error: 'Scriptwriter returned no valid screenplay.', raw: swText.substring(0, 300) });
      }

      scriptwriterScenes = JSON.parse(swMatch[0]);
      console.log('SCRIPTWRITER: Generated', scriptwriterScenes.length, 'scenes');

      // If mode is screenplay only — return here
      if (mode === 'screenplay') {
        return res.status(200).json({
          screenplay: scriptwriterScenes,
          scene_count: scriptwriterScenes.length,
          mode: 'screenplay'
        });
      }

    } catch (err) {
      return res.status(500).json({ error: 'Scriptwriter error: ' + err.message });
    }
  }

  // ── STEP 2: DIRECTOR ─────────────────────────────────
  const directorPrompt = DIRECTORS[type];
  if (!directorPrompt) {
    return res.status(400).json({
      error: `Unknown director type: "${type}"`,
      available: Object.keys(DIRECTORS)
    });
  }

  const system = `${directorPrompt}\n\n${DIRECTOR_OUTPUT_FORMAT}`;

  const directorContent = `SCREENPLAY FROM SCRIPTWRITER:
${JSON.stringify(scriptwriterScenes, null, 2)}

---
Translate this screenplay into ${scriptwriterScenes.length} visual prompts for AI video generation.
All dialogue and text must be in ENGLISH ONLY.
Return JSON array only.`;

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
        messages: [{ role: 'user', content: directorContent }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err.error?.message || `Anthropic HTTP ${response.status}`;
      if (response.status === 401) return res.status(500).json({ error: 'Invalid API key.' });
      if (response.status === 429) return res.status(429).json({ error: 'Rate limit — retry.' });
      return res.status(response.status).json({ error: msg });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    console.log('DIRECTOR RAW:', text.substring(0, 500));
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleanText.match(/\[\s*\{[\s\S]*\}\s*\]/);

    if (!jsonMatch) {
      console.error('No JSON in director response:', text.substring(0, 300));
      return res.status(500).json({ error: 'Director returned no valid scenes.', raw: text.substring(0, 300) });
    }

    let scenes;
    try {
      scenes = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return res.status(500).json({ error: 'JSON parse failed.', raw: jsonMatch[0].substring(0, 300) });
    }

    return res.status(200).json({
      scenes,
      screenplay: scriptwriterScenes,
      director: type,
      director_name: getDirectorName(type),
      model,
      scene_count: scenes.length,
      usage: data.usage
    });

  } catch (err) {
    console.error('Director API error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

function getDirectorName(type) {
  const names = {
    drama:   'Marco Visconti',
    comedy:  'Elena Bright',
    music:   'Kai Neon',
    ads:     'Nova Brand',
    action:  'Rex Storm',
    doc:     'Sara Truth'
  };
  return names[type] || type;
}

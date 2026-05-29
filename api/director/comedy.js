/**
 * comedy.js — COMEDY DIRECTOR PROTOCOL
 * Cost: 15 CR per scene
 * Style: Sharp timing, visual gags, warm humanity
 */

export const COMEDY_CONFIG = {
  cost: 15,
  color: '#ffba3f',
  directorName: 'Sofia Delgado',
  protocol: 'COMEDY PROTOCOL',

  systemPrompt: `You are Sofia Delgado, a comedic director known for visual wit.
Your visual language is inspired by Edgar Wright and Wes Anderson.
Rules:
- Timing is everything — frame every beat for maximum comedic impact
- Use symmetry, whip pans, and smash cuts as punctuation
- Lighting is bright and inviting — no darkness unless for ironic contrast
- Characters are always slightly bigger than life, but grounded in truth
- Color palette: saturated, warm, playful — think pastel meets pop art
- Sound design notes: comic timing sfx, awkward silences, cartoon-adjacent
Return ONLY a JSON array of 6 scene objects. No extra text.`,

  scenePrompt: (brief) => `
Create 6 comedic screenplay scenes for: "${brief}"

Each scene object must have:
{
  "title": "Scene title (witty, ironic, 3-5 words)",
  "shotType": "WIDE SHOT | MEDIUM SHOT | CLOSE-UP | EXTREME CLOSE-UP | WHIP PAN | OVERHEAD SHOT",
  "description": "Detailed visual description (60-80 words). Include: comedic staging, bright lighting setup, character physical comedy, the exact moment of the gag, and one absurd but grounded visual detail.",
  "directorNote": "One-line comedic timing note from the director",
  "lens": "lens choice e.g. 32mm, 50mm",
  "mood": "one word mood"
}

Return ONLY the JSON array. No markdown, no explanation.`,

  videoPrompt: (scene) => `
Cinematic comedy film scene. ${scene.shotType}.
${scene.description}
Style: Edgar Wright / Wes Anderson visual grammar. Bright even lighting.
${scene.lens || '32mm'} lens. Precise symmetrical framing.
Color grade: warm saturated pastels, high key lighting.
Whip pan transitions. Perfect comedic timing. 4K. No text overlays.
`.trim()
};

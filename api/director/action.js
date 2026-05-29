/**
 * action.js — ACTION DIRECTOR PROTOCOL
 * Cost: 25 CR per scene
 * Style: High-octane, kinetic energy, tactical precision
 */

export const ACTION_CONFIG = {
  cost: 25,
  color: '#ffb4ab',
  directorName: 'Viktor Rask',
  protocol: 'ACTION PROTOCOL',

  systemPrompt: `You are Viktor Rask, a tactical action director.
Your visual language is inspired by Chad Stahelski and Denis Villeneuve.
Rules:
- Every scene is choreographed with military precision
- Camera is always in motion — handheld, drone, tracking shots
- Lighting is hard and directional: tungsten practicals, muzzle flash, neon
- Physics matter: weight, impact, consequence
- Color palette: deep shadows, high contrast, desaturated blues and oranges
- Sound design notes: bass impacts, tactical silence before explosion, heartbeat sync
Return ONLY a JSON array of 6 scene objects. No extra text.`,

  scenePrompt: (brief) => `
Create 6 high-intensity action screenplay scenes for: "${brief}"

Each scene object must have:
{
  "title": "Scene title (punchy, 2-4 words)",
  "shotType": "WIDE SHOT | MEDIUM SHOT | CLOSE-UP | EXTREME CLOSE-UP | POV SHOT | DRONE SHOT",
  "description": "Detailed visual description (60-80 words). Include: camera movement, hard lighting direction, physical action beats, environmental hazards, and precise timing notation (e.g. '2.3 seconds of free fall').",
  "directorNote": "One-line tactical note from the director",
  "lens": "lens choice e.g. 24mm, 35mm, 14mm wide",
  "mood": "one word mood"
}

Return ONLY the JSON array. No markdown, no explanation.`,

  videoPrompt: (scene) => `
High-octane action cinema scene. ${scene.shotType}.
${scene.description}
Style: John Wick / Sicario visual grammar. Hard directional lighting.
${scene.lens || '24mm'} wide lens. Kinetic handheld camera.
Color grade: high contrast, desaturated blues and deep oranges.
Slow motion impact frames. Tactical choreography. 4K cinematic. No text overlays.
`.trim()
};

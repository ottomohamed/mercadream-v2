/**
 * music.js — MUSIC VIDEO DIRECTOR PROTOCOL
 * Cost: 14 CR per scene
 * Style: Visual rhythm, abstract narrative, sensory overload
 */

export const MUSIC_CONFIG = {
  cost: 14,
  color: '#d4aaff',
  directorName: 'Zara Nyx',
  protocol: 'MUSIC VIDEO PROTOCOL',

  systemPrompt: `You are Zara Nyx, a visionary music video director.
Your visual language is inspired by Hiro Murai and Dave Meyers.
Rules:
- Every frame must work as a standalone visual artwork
- Rhythm drives the edit — cuts sync to implied beat
- Lighting is sculptural and dramatic: hard rims, colored gels, strobes
- Reality bends: gravity, time, and space are tools not constraints
- Color palette: bold complementary contrasts — deep purple/gold, cyan/red
- Sound design notes: visual sync points, bass drops align with camera moves
Return ONLY a JSON array of 6 scene objects. No extra text.`,

  scenePrompt: (brief) => `
Create 6 music video screenplay scenes for: "${brief}"

Each scene object must have:
{
  "title": "Scene title (abstract, evocative, 2-4 words)",
  "shotType": "WIDE SHOT | MEDIUM SHOT | CLOSE-UP | OVERHEAD | LOW ANGLE | 360 ORBIT",
  "description": "Detailed visual description (60-80 words). Include: colored lighting gels and temperatures, surreal visual element, implied beat-sync moment, artist/subject staging, and one impossible-but-cinematic visual effect.",
  "directorNote": "One-line rhythmic/visual note from the director",
  "lens": "lens choice e.g. 14mm fisheye, 85mm portrait, 24mm",
  "mood": "one word mood"
}

Return ONLY the JSON array. No markdown, no explanation.`,

  videoPrompt: (scene) => `
Cinematic music video scene. ${scene.shotType}.
${scene.description}
Style: Hiro Murai / Donald Glover visual grammar. Dramatic colored lighting.
${scene.lens || '24mm'} lens. Dynamic camera movement synced to rhythm.
Color grade: bold complementary colors, deep shadows, vivid highlights.
Surreal elements grounded in physical space. 4K. No text overlays.
`.trim()
};

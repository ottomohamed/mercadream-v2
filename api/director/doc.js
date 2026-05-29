/**
 * doc.js — DOCUMENTARY DIRECTOR PROTOCOL
 * Cost: 10 CR per scene
 * Style: Raw authenticity, observational truth, fly-on-the-wall
 */

export const DOC_CONFIG = {
  cost: 10,
  color: '#aecae2',
  directorName: 'Yael Oron',
  protocol: 'DOCUMENTARY PROTOCOL',

  systemPrompt: `You are Yael Oron, a documentary director known for capturing raw truth.
Your visual language is inspired by Werner Herzog and Errol Morris.
Rules:
- Reality is the aesthetic — imperfect framing is intentional
- Available light only: windows, practicals, natural sources
- Camera observes, never directs — subjects lead the frame
- Every scene must feel like you stumbled upon a private moment
- Color palette: honest, ungraded naturalism with slight warmth
- Sound design notes: ambient natural audio, breathing, environmental texture
Return ONLY a JSON array of 6 scene objects. No extra text.`,

  scenePrompt: (brief) => `
Create 6 documentary-style screenplay scenes for: "${brief}"

Each scene object must have:
{
  "title": "Scene title (journalistic, direct, 2-4 words)",
  "shotType": "OBSERVATIONAL WIDE | HANDHELD MEDIUM | INTIMATE CLOSE-UP | VÉRITÉ POV | ARCHIVAL INSERT",
  "description": "Detailed visual description (60-80 words). Include: available light source, handheld camera behavior, subject's unaware or semi-aware state, environmental authenticity detail, and one unrepeatable moment of truth.",
  "directorNote": "One-line observational note from the director",
  "lens": "lens choice e.g. 50mm, 85mm, zoom 24-70mm",
  "mood": "one word mood"
}

Return ONLY the JSON array. No markdown, no explanation.`,

  videoPrompt: (scene) => `
Documentary cinema scene. ${scene.shotType}.
${scene.description}
Style: Werner Herzog / cinéma vérité. Available natural lighting only.
${scene.lens || '50mm'} lens. Handheld observational camera.
Color grade: honest naturalism, slight warm tone. Slight film grain.
Real-time pacing. No artificial staging. 4K. No text overlays.
`.trim()
};

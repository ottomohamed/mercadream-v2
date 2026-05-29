/**
 * drama.js — DRAMA DIRECTOR PROTOCOL
 * Cost: 12 CR per scene
 * Style: Emotional depth, character-driven, cinematic realism
 */

export const DRAMA_CONFIG = {
  cost: 12,
  color: '#a8d700',
  directorName: 'Marco Visconti',
  protocol: 'DRAMA PROTOCOL',

  systemPrompt: `You are Marco Visconti, an award-winning drama director.
Your visual language is inspired by Paolo Sorrentino and Darren Aronofsky.
Rules:
- Every scene must have emotional subtext beneath the action
- Use natural lighting: golden hour, practical lights, window light
- Camera moves slowly and deliberately — let silence speak
- Characters are always caught between what they want and what they need
- Color palette: desaturated realism with one dominant warm tone per scene
- Sound design notes: ambient room tone, breathing, distant city hum
Return ONLY a JSON array of 6 scene objects. No extra text.`,

  scenePrompt: (brief) => `
Create 6 dramatic screenplay scenes for: "${brief}"

Each scene object must have:
{
  "title": "Scene title (evocative, 3-5 words)",
  "shotType": "WIDE SHOT | MEDIUM SHOT | CLOSE-UP | EXTREME CLOSE-UP | TWO-SHOT",
  "description": "Detailed visual description (60-80 words). Include: camera angle, lighting temperature in Kelvin, character blocking, emotional undercurrent, and one specific sensory detail (smell, texture, sound).",
  "directorNote": "One-line technical note from the director",
  "lens": "lens choice e.g. 35mm, 50mm, 85mm",
  "mood": "one word mood"
}

Return ONLY the JSON array. No markdown, no explanation.`,

  videoPrompt: (scene) => `
Cinematic drama film scene. ${scene.shotType}.
${scene.description}
Style: Paolo Sorrentino visual grammar. Natural lighting ${scene.lens || '50mm'} lens.
Shallow depth of field. Slow deliberate camera movement.
Color grade: desaturated warm tones. Film grain. Anamorphic lens flare.
Professional cinema quality. 4K. No text overlays.
`.trim()
};

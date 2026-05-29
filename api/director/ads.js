/**
 * ads.js — COMMERCIAL/ADS DIRECTOR PROTOCOL
 * Cost: 18 CR per scene
 * Style: Brand storytelling, product hero, emotional conversion
 */

export const ADS_CONFIG = {
  cost: 18,
  color: '#80cbc4',
  directorName: 'Alexei Brand',
  protocol: 'COMMERCIAL PROTOCOL',

  systemPrompt: `You are Alexei Brand, a world-class commercial director.
Your visual language is inspired by Ridley Scott's early commercials and Melina Matsoukas.
Rules:
- Every frame sells something: emotion, aspiration, identity
- Product is always the hero — light it like a jewel
- Lighting is perfect and intentional: high-key for lifestyle, low-key for luxury
- Every second has a purpose — no wasted frames in 30 seconds
- Color palette: brand-consistent, aspirational — clean whites, deep navy, or warm gold
- Sound design notes: sonic logo potential, VO timing, emotional music sync
Return ONLY a JSON array of 6 scene objects. No extra text.`,

  scenePrompt: (brief) => `
Create 6 commercial/advertisement screenplay scenes for: "${brief}"

Each scene object must have:
{
  "title": "Scene title (brand-voice, aspirational, 2-4 words)",
  "shotType": "PRODUCT HERO SHOT | LIFESTYLE WIDE | EMOTIONAL CLOSE-UP | BEAUTY SHOT | TESTIMONIAL MEDIUM",
  "description": "Detailed visual description (60-80 words). Include: precise product placement and lighting (color temp in Kelvin), aspirational lifestyle context, target audience emotional trigger, brand color presence in frame, and the single key visual message.",
  "directorNote": "One-line brand strategy note from the director",
  "lens": "lens choice e.g. 85mm macro, 50mm, 100mm",
  "mood": "one word mood"
}

Return ONLY the JSON array. No markdown, no explanation.`,

  videoPrompt: (scene) => `
Premium commercial advertisement scene. ${scene.shotType}.
${scene.description}
Style: Ridley Scott commercial grammar. Perfect studio lighting.
${scene.lens || '85mm'} lens. Smooth controlled camera movement.
Color grade: clean aspirational palette, high production value.
Brand-safe composition. Luxury feel. 4K ultra-sharp. No text overlays.
`.trim()
};

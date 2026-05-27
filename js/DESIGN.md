---
name: Surgical Precision Cinematic Tech
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c4caac'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8e9479'
  outline-variant: '#434933'
  surface-tint: '#a8d700'
  primary: '#ffffff'
  on-primary: '#273500'
  primary-container: '#c0f500'
  on-primary-container: '#546d00'
  inverse-primary: '#4f6600'
  secondary: '#c8c6c5'
  on-secondary: '#313030'
  secondary-container: '#474746'
  on-secondary-container: '#b7b5b4'
  tertiary: '#ffffff'
  on-tertiary: '#303030'
  tertiary-container: '#e4e2e1'
  on-tertiary-container: '#656464'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c0f500'
  primary-fixed-dim: '#a8d700'
  on-primary-fixed: '#161f00'
  on-primary-fixed-variant: '#3b4d00'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#e4e2e1'
  tertiary-fixed-dim: '#c8c6c6'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#474747'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-lg:
    fontFamily: Sora
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Sora
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  technical-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.05em
  technical-xs:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: '1.2'
spacing:
  unit: 8px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 40px
  grid-cols: '12'
---

## Brand & Style
The design system is defined by "Surgical Precision"—a high-performance, clinical aesthetic that blends futuristic technicality with high-stakes cinematic tension. The target audience consists of power users and tech-forward professionals who require absolute clarity and zero-latency visual feedback. 

The visual style is **High-Contrast / Bold** with elements of **Minimalism**. It utilizes a "Dark Room" philosophy where the interface remains invisible until an action is required, at which point it emerges with vibrant, needle-thin precision. The atmosphere is professional, authoritative, and sophisticated, evoking the feeling of an advanced command center or medical diagnostic HUD.

## Colors
The palette is built on a foundation of absolute darkness to maximize visual focus and battery efficiency on OLED displays. 

- **Void Black (#060606):** The primary canvas color, used for the background to create infinite depth.
- **Neon Acid (#c8ff00):** The high-visibility action color. Reserved strictly for primary calls-to-action, active states, and critical system feedback.
- **System Greys:** Used for structural division and secondary surface layers to provide hierarchy without breaking the cinematic immersion.
- **Semantic Accents:** Use highly desaturated versions of red and blue only for error or info states, ensuring they do not compete with the primary Neon Acid.

## Typography
Typography is treated as a functional data-point. 

- **Sora** is utilized for headlines to provide a geometric, futuristic presence that feels structural and intentional.
- **Geist** serves as the primary body face, offering a clean, technical, and developer-friendly reading experience that remains legible at small sizes.
- **JetBrains Mono** is the "surgical" instrument of the system. It is used for all technical labels, timestamps, metadata, and Firebase-driven data points. 

All technical labels should use uppercase styling with slight letter-spacing to enhance the "monitored data" aesthetic.

## Layout & Spacing
The layout follows a **Fixed Grid** model. The interface is underpinned by a 12-column grid that is visually represented by subtle "scanning lines" or low-opacity grid intersections during specific transitions.

- **Rhythm:** Every element must align to an 8px base unit. 
- **Gutters:** Gutters are thin and rigid (16px), acting as "cutting paths" through the UI.
- **Margins:** Generous outer margins (40px on desktop) keep the content centered and focused, mimicking a widescreen cinematic frame.
- **Reflow:** On mobile, the 12-column grid collapses to a 4-column system, but the 8px rhythm remains absolute.

## Elevation & Depth
In a Void Black environment, traditional shadows are ineffective. Instead, hierarchy is established through **Tonal Layers** and **Light Strokes**.

- **Surface Tiers:** Containers are slightly lighter than the background (#1a1a1a) to suggest elevation.
- **Geometric Outlines:** Use 1px solid borders in a slightly brighter grey (#333333) to define object boundaries. 
- **Neon Glow:** For high-priority active elements, use a minimal, 2px outer glow using the Neon Acid color, but keep the spread tight to maintain the "surgical" sharpness.
- **Scanning Lines:** Use horizontal 1px lines with 5% opacity across the screen to create a sense of tech-layered depth.

## Shapes
The shape language is strictly **Sharp (0px roundedness)**. 

To maintain the "Surgical Precision" theme, any deviation from 90-degree angles is prohibited, except for 45-degree "chamfered" corners on specific feature cards or primary buttons. These chamfered corners should be treated as functional accents that signify a specialized interaction point. Borders are always 1px or 2px—never thick or heavy.

## Components
- **Buttons:** Rectangular with sharp corners. Primary buttons use a solid Neon Acid fill with black text. Secondary buttons use a 1px Neon Acid stroke with monospaced text.
- **Input Fields:** Bottom-border only or a full 1px thin outline. Use JetBrains Mono for input text. The focus state should trigger a horizontal "scanning" pulse across the border.
- **Chips/Labels:** Small, monospaced text blocks with a subtle background tint. Use them to display data types or status from Firebase.
- **Cards:** No shadows. Use a 1px border. The top-right corner may feature a small "technical coordinate" (e.g., [40.7128° N]) in 10px JetBrains Mono to enhance the cinematic tech feel.
- **Progress Indicators:** Linear only. Use the Neon Acid color. Avoid circular loaders to maintain the geometric, grid-aligned aesthetic.
- **Checkboxes/Radios:** Square and sharp. When checked, they should fill with a solid Neon Acid block.
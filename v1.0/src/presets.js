/** Named starting looks for demos / curriculum NPCs. */
export const PRESETS = {
  jordan: {
    skinTone: 0xedc9a8,
    bodyShape: "regular",
    eyes: { style: "oval", color: 0x3a5a2a },
    brows: { style: "straight" },
    nose: { style: "button" },
    ears: { style: "round" },
    hair: { style: "bob", color: 0x3a2a1a },
    hat: { style: "none" },
    clothes: {
      top: { style: "tee", color: 0x3d8f6e, pattern: { type: "solid" } },
      bottom: { style: "pants", color: 0x3a4550, pattern: { type: "solid" } },
      shoes: { color: 0x2a2a32, pattern: { type: "solid" } },
    },
  },
  sam: {
    skinTone: 0xd4a574,
    bodyShape: "stocky",
    eyes: { style: "wide", color: 0x2a3a4a },
    brows: { style: "thick" },
    nose: { style: "bridge" },
    ears: { style: "wide" },
    hair: { style: "crew", color: 0x1a1a1a },
    hat: { style: "cap", color: 0x2a4a6a },
    clothes: {
      top: {
        style: "hoodie",
        color: 0x4a6fa5,
        pattern: { type: "stripes", color2: 0x2a4060, scale: 1.2, rotation: 12, opacity: 0.7 },
      },
      bottom: { style: "pants", color: 0x2a2a32, pattern: { type: "solid" } },
      shoes: { color: 0xffffff, pattern: { type: "solid" } },
    },
  },
  maya: {
    skinTone: 0xa67c52,
    bodyShape: "slim",
    eyes: { style: "almond", color: 0x4a2a1a },
    brows: { style: "arched" },
    nose: { style: "flat" },
    ears: { style: "round" },
    hair: { style: "twin-tails", color: 0x1a1a1a },
    hat: { style: "none" },
    clothes: {
      top: {
        style: "polo",
        color: 0xc4a035,
        pattern: { type: "dots", color2: 0xffffff, scale: 0.9, rotation: 25, opacity: 0.55 },
      },
      bottom: { style: "mini-skirt", color: 0x5a3a50, pattern: { type: "solid" } },
      shoes: {
        color: 0x5a2030,
        pattern: { type: "polka", color2: 0xc08090, scale: 1.6, rotation: 40, opacity: 0.55 },
      },
    },
  },
  chris: {
    skinTone: 0xf0d5b8,
    bodyShape: "regular",
    eyes: { style: "wide", color: 0x4a6a9a },
    brows: { style: "angled" },
    nose: { style: "button" },
    ears: { style: "point" },
    hair: { style: "messy", color: 0x6a4a2a },
    hat: { style: "beanie", color: 0xb85c38 },
    clothes: {
      top: {
        style: "jacket",
        color: 0x5a6a5a,
        pattern: { type: "checkers", color2: 0x3a4a3a, scale: 1.4, rotation: 8, opacity: 0.65 },
      },
      bottom: {
        style: "shorts",
        color: 0x3a4550,
        pattern: { type: "grid", color2: 0x8899aa, scale: 1, rotation: 45, opacity: 0.5 },
      },
      shoes: { color: 0x1a1a1a, pattern: { type: "solid" } },
    },
  },
  aisha: {
    skinTone: 0x8d5524,
    bodyShape: "regular",
    eyes: { style: "oval", color: 0x2a2a2a },
    brows: { style: "thin" },
    nose: { style: "bridge" },
    ears: { style: "round" },
    hair: { style: "wavy", color: 0x1a1a1a },
    hat: { style: "none" },
    clothes: {
      top: {
        style: "tee",
        color: 0x8a3030,
        pattern: { type: "diagonal", color2: 0xf0d0d0, scale: 1.1, rotation: 15, opacity: 0.6 },
      },
      bottom: { style: "pants", color: 0x2a2a2a, pattern: { type: "solid" } },
      shoes: {
        color: 0x3d8f6e,
        pattern: { type: "stripes-v", color2: 0x2a5a40, scale: 1.8, rotation: 0, opacity: 0.6 },
      },
    },
  },
};

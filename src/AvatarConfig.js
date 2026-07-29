/**
 * AvatarConfig — declarative NPC appearance.
 * All fields optional; missing ones fall back to DEFAULT_CONFIG.
 */

/** @deprecated unused — kept so old imports don't break */
export const GENDERS = [];
export const BODY_SHAPES = ["slim", "regular", "stocky"];
export const EYE_STYLES = ["oval", "almond", "wide"];
export const EYE_SCALE_MIN = 0.6;
export const EYE_SCALE_MAX = 1.55;
export const EYE_DISTANCE_MIN = 0.45;
export const EYE_DISTANCE_MAX = 3.6;
/** Min clear space between inner eye edges (world units at ref skull). */
export const EYE_GAP_MIN = 0.02;
/** Pupil/iris size as a fraction of the eye sclera (how big pupils can get). */
export const PUPIL_SCALE_MIN = 0.28;
export const PUPIL_SCALE_MAX = 0.78;
/** Pupil look within eye white (−1…1, left/right and down/up). */
export const PUPIL_LOOK_MIN = -1;
export const PUPIL_LOOK_MAX = 1;
/** Face width slider — multiplies skull half-width (hw). */
export const FACE_WIDTH_MIN = 0.65;
export const FACE_WIDTH_MAX = 1.12;
/** 0 = high on face, 1 = low toward chin. */
export const FACE_DROP_MIN = 0;
export const FACE_DROP_MAX = 1;
/** Half-spread at eyeDistance=1 when hw=0.34 (matches Head placement). */
const EYE_SPREAD_AT_1 = 0.055;
/** Approx half-width of an eye at scale=1 (used for overlap limits). */
const EYE_HALF_AT_1 = 0.038;
/** Max eye X as a fraction of skull width — keeps eyes on the front face. */
const EYE_MAX_X_FRAC = 0.34;

function clamp01(n, fallback = 0.5) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(1, Math.max(0, v));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

/** Relative face size vs a reference skull — scales eyes / nose / brows. */
export function faceFeatureScale(hw = 0.16, hh = 0.16) {
  const ref = 0.155;
  const size = Math.sqrt(Math.max(1e-6, hw) * Math.max(1e-6, hh));
  return size / ref;
}

/** Vertical placement of eyes on the skull (world Y). eyeDrop 0=high, 1=low. */
export function faceEyeY(headY, hh, eyeDrop = 0.35) {
  const t = clamp01(eyeDrop, 0.35);
  return headY + (hh || 0.16) * mix(0.2, -0.26, t);
}

/** Vertical placement of nose on the skull (world Y). noseDrop 0=high, 1=low. */
export function faceNoseY(headY, hh, noseDrop = 0.5) {
  const t = clamp01(noseDrop, 0.5);
  return headY + (hh || 0.16) * mix(0.06, -0.42, t);
}

/** Min vertical gap between eye and nose centers (fraction of skull height). */
const FACE_EYE_NOSE_GAP = 0.08;

/** Max eyeDrop so eyes stay above the nose. */
export function maxEyeDropForNose(noseDrop = 0.5, hh = 0.16) {
  const h = hh || 0.16;
  const noseY = faceNoseY(0, h, noseDrop);
  const targetRel = (noseY + h * FACE_EYE_NOSE_GAP) / h;
  // faceEyeY: mix(0.2, -0.26, t) = 0.2 - 0.46*t >= targetRel
  const maxT = (0.2 - targetRel) / 0.46;
  return Math.min(FACE_DROP_MAX, Math.max(FACE_DROP_MIN, maxT));
}

/** Min noseDrop so the nose stays below the eyes. */
export function minNoseDropForEye(eyeDrop = 0.35, hh = 0.16) {
  const h = hh || 0.16;
  const eyeY = faceEyeY(0, h, eyeDrop);
  const targetRel = (eyeY - h * FACE_EYE_NOSE_GAP) / h;
  // faceNoseY: mix(0.06, -0.42, t) = 0.06 - 0.48*t <= targetRel
  const minT = (0.06 - targetRel) / 0.48;
  return Math.min(FACE_DROP_MAX, Math.max(FACE_DROP_MIN, minT));
}

/** Mutates face.eyeDrop / face.noseDrop so eyes stay above the nose. */
export function clampFaceFeatureDrops(face, hh = 0.16) {
  if (!face) return face;
  let eyeDrop = clamp01(face.eyeDrop, 0.35);
  let noseDrop = clamp01(face.noseDrop, 0.5);
  eyeDrop = Math.min(eyeDrop, maxEyeDropForNose(noseDrop, hh));
  noseDrop = Math.max(noseDrop, minNoseDropForEye(eyeDrop, hh));
  // Re-clamp eye in case nose was pushed
  eyeDrop = Math.min(eyeDrop, maxEyeDropForNose(noseDrop, hh));
  face.eyeDrop = eyeDrop;
  face.noseDrop = noseDrop;
  return face;
}

/** Center offset of one eye from midline. */
export function eyeHalfSpread(eyeDistance = 1, hw = 0.34) {
  const dist = Math.min(EYE_DISTANCE_MAX, Math.max(EYE_DISTANCE_MIN, Number(eyeDistance) || 1));
  return EYE_SPREAD_AT_1 * ((hw || 0.34) / 0.34) * dist;
}

/**
 * Max eyeDistance so eyes stay on the front of the face (not wrapping to the side/back).
 * Pass faceOpts ({ hw, hh, hd, headY, roundness, eyeDrop }) to tighten via SDF front surface.
 */
export function maxEyeDistanceForWidth(hw = 0.34, faceOpts = null) {
  const w = hw || 0.34;
  const base = EYE_SPREAD_AT_1 * (w / 0.34);
  if (base < 1e-8) return EYE_DISTANCE_MIN;

  let maxX = w * EYE_MAX_X_FRAC;

  if (faceOpts && faceOpts.hh != null) {
    // Lazy import avoided — inline front-Z probe via optional callback on faceOpts
    const probe = faceOpts.frontZ;
    if (typeof probe === "function") {
      const hd = faceOpts.hd ?? 0.18;
      const headY = faceOpts.headY ?? 0;
      const hh = faceOpts.hh ?? 0.16;
      const y = faceEyeY(headY, hh, faceOpts.eyeDrop ?? 0.35);
      const midZ = probe(0, y);
      const minFrontZ = Math.max(hd * 0.12, midZ * 0.55);
      let lo = 0;
      let hi = Math.min(w * 0.48, maxX * 1.2);
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) * 0.5;
        if (probe(mid, y) >= minFrontZ) lo = mid;
        else hi = mid;
      }
      maxX = Math.min(maxX, lo);
    }
  }

  return Math.min(EYE_DISTANCE_MAX, Math.max(EYE_DISTANCE_MIN, maxX / base));
}

/** Clamp eyeDistance to front-face max and eye-size min gap. */
export function clampEyeDistance(eyeDistance, hw = 0.34, faceOpts = null) {
  const lo = minEyeDistanceForScale(faceOpts?.eyeScale ?? 1, hw);
  const hi = Math.max(lo, maxEyeDistanceForWidth(hw, faceOpts));
  const v = Number(eyeDistance);
  if (!Number.isFinite(v)) return Math.min(Math.max(1, lo), hi);
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Min eyeDistance so left/right eyes keep EYE_GAP_MIN between inner edges
 * for the given eye scale (bigger eyes → cannot sit as close).
 */
export function minEyeDistanceForScale(eyeScale = 1, hw = 0.34) {
  const sc = Math.min(EYE_SCALE_MAX, Math.max(EYE_SCALE_MIN, Number(eyeScale) || 1));
  const base = EYE_SPREAD_AT_1 * ((hw || 0.34) / 0.34);
  if (base < 1e-8) return EYE_DISTANCE_MIN;
  const minDist = (2 * EYE_HALF_AT_1 * sc + EYE_GAP_MIN) / (2 * base);
  return Math.min(EYE_DISTANCE_MAX, Math.max(EYE_DISTANCE_MIN, minDist));
}

/**
 * Max eye scale so left/right eyes don't overlap for a given eyeDistance.
 * Closer eyes → lower max scale.
 */
export function maxEyeScaleForDistance(eyeDistance = 1, hw = 0.34) {
  const dist = Math.min(EYE_DISTANCE_MAX, Math.max(EYE_DISTANCE_MIN, Number(eyeDistance) || 1));
  const baseSpread = eyeHalfSpread(dist, hw);
  const maxFromDist = (2 * baseSpread - EYE_GAP_MIN) / (2 * EYE_HALF_AT_1);
  return Math.min(EYE_SCALE_MAX, Math.max(EYE_SCALE_MIN, maxFromDist));
}

export function clampEyeScale(scale, eyeDistance = 1, hw = 0.34) {
  const lo = EYE_SCALE_MIN;
  const hi = maxEyeScaleForDistance(eyeDistance, hw);
  const v = Number(scale);
  if (!Number.isFinite(v)) return Math.min(1, hi);
  return Math.min(hi, Math.max(lo, v));
}

/** Clamp pupil/iris fraction of the eye (PUPIL_SCALE_MIN…PUPIL_SCALE_MAX). */
export function clampPupilScale(scale) {
  const v = Number(scale);
  if (!Number.isFinite(v)) return 0.55;
  return Math.min(PUPIL_SCALE_MAX, Math.max(PUPIL_SCALE_MIN, v));
}

/** Clamp pupil X/Y look within eye white (−1…1). */
export function clampPupilLook(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(PUPIL_LOOK_MAX, Math.max(PUPIL_LOOK_MIN, n));
}

/** Head size (height.head) — min doubled from 0.5, max +30% from 1.7. */
export const HEAD_SCALE_MIN = 1.0;
export const HEAD_SCALE_MAX = 2.21;

export const BROW_STYLES = ["straight", "arched", "thick", "thin", "short", "angled", "none"];
export const NOSE_STYLES = [
  "button",
  "bridge",
  "flat",
  "pointy",
  "bulbous",
  "hooked",
  "snub",
  "hawk",
  "broad",
  "petite",
  "slope",
];
export const EAR_STYLES = [
  "round",
  "point",
  "wide",
  "lobe",
  "elf",
  "floppy",
  "small",
  "cupped",
  "square",
  "wing",
];
/** Short / cropped looks (~half of random picks). */
export const HAIR_SHORT = ["bald", "short", "buzz", "crew", "messy"];
/** Longer looks (~half of random picks). */
export const HAIR_LONG = [
  "bob",
  "ponytail",
  "bun",
  "long",
  "afro",
  "twin-tails",
  "braid",
  "wavy",
  "shoulder",
  "pigtails",
];
export const HAIR_STYLES = [...HAIR_SHORT, ...HAIR_LONG];
export const HAT_STYLES = ["none", "cone", "cap", "beanie", "visor", "hardhat", "bowler", "sunhat", "roundcap"];
export const BUTTON_SIZE_MIN = 0.8;
export const BUTTON_SIZE_MAX = 2.4;
export const TOP_STYLES = ["tee", "polo", "hoodie", "jacket", "overalls"];
export const BOTTOM_STYLES = ["pants", "shorts", "mini-shorts", "mini-skirt"];
export const SHOE_STYLES = ["sneaker", "boot", "slippers", "loafer", "hi-top"];
export const PATTERN_TYPES = [
  "solid",
  "stripes",
  "stripes-v",
  "stripes-thin",
  "stripes-h",
  "dots",
  "polka",
  "checkers",
  "grid",
  "crosshatch",
  "diagonal",
  "chevron",
  "zigzag",
  "diamonds",
  "triangles",
  "waves",
  "speckles",
  "argyle",
  "herringbone",
  "plaid",
  "bricks",
  "stars",
  "rings",
];

const SOLID_PATTERN = Object.freeze({
  type: "solid",
  color2: 0xffffff,
  scale: 1,
  rotation: 0,
  opacity: 0.85,
});

export const DEFAULT_CONFIG = Object.freeze({
  skinTone: 0xedc9a8,
  bodyShape: "regular",
  scale: 1,
  height: { leg: 1, torso: 1, neck: 1, head: 1 },
  body: { hipThick: 1, armThick: 1, legThick: 1 },
  face: { eyeDistance: 1, roundness: 1, length: 1, width: 0.92, eyeDrop: 0.35, noseDrop: 0.5 },
  eyes: { style: "oval", color: 0x2a3a4a, scale: 1, pupilScale: 0.55, pupilX: 0, pupilY: 0 },
  brows: { style: "straight", scale: 1 },
  nose: { style: "button", scale: 1 },
  ears: { style: "round", scale: 1 },
  hair: { style: "bob", color: 0x3a2a1a },
  hat: { style: "none", color: 0x3d8f6e },
  clothes: {
    top: {
      style: "tee",
      color: 0x3d8f6e,
      pattern: { ...SOLID_PATTERN },
      buttons: 3,
      buttonSize: 1.4,
      buttonColor: 0x222222,
    },
    bottom: {
      style: "pants",
      color: 0x3a4550,
      pattern: { ...SOLID_PATTERN, color2: 0x222222 },
    },
    shoes: {
      style: "sneaker",
      color: 0x2a2a32,
      pattern: { ...SOLID_PATTERN, color2: 0x555555 },
    },
  },
});

export function deepMerge(base, patch) {
  if (!patch) return structuredClone(base);
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = deepMerge(out[k] ?? {}, v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

export function resolveConfig(partial = {}) {
  const cfg = deepMerge(DEFAULT_CONFIG, partial);
  if (cfg.eyes?.style === "dot") cfg.eyes.style = "oval";
  if (cfg.clothes?.shoes?.style === "sandal") cfg.clothes.shoes.style = "slippers";
  if (cfg.clothes?.top?.style === "tank") cfg.clothes.top.style = "overalls";
  delete cfg.gender;
  if (cfg.face) {
    cfg.face.eyeDistance = clampEyeDistance(cfg.face.eyeDistance, 0.34, {
      eyeScale: cfg.eyes?.scale ?? 1,
    });
    clampFaceFeatureDrops(cfg.face);
  }
  if (cfg.eyes) {
    cfg.eyes.scale = clampEyeScale(cfg.eyes.scale, cfg.face?.eyeDistance);
    cfg.eyes.pupilScale = clampPupilScale(cfg.eyes.pupilScale);
    cfg.eyes.pupilX = clampPupilLook(cfg.eyes.pupilX);
    cfg.eyes.pupilY = clampPupilLook(cfg.eyes.pupilY);
  }
  return cfg;
}

/** ~50% patterned, else solid. Includes scale + rotation + opacity variation. */
export function randomPattern(rnd, hex) {
  if (rnd() > 0.5) {
    return {
      type: "solid",
      color2: hex(),
      scale: 1,
      rotation: 0,
      opacity: 0.85,
    };
  }
  const types = PATTERN_TYPES.filter((t) => t !== "solid");
  return {
    type: types[Math.floor(rnd() * types.length)],
    color2: hex(),
    scale: 0.4 + rnd() * 2.0,
    rotation: rnd() * 180,
    opacity: 0.2 + rnd() * 0.8,
  };
}

export function randomConfig(seed = Math.random()) {
  let s = typeof seed === "string"
    ? [...seed].reduce((a, c) => a + c.charCodeAt(0), 0)
    : Number(seed) || 1;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const hex = () => Math.floor(rnd() * 0xffffff);

  // ~50/50 short vs long hair (presentation cue, not a gender flag)
  const hairPool = rnd() < 0.5 ? HAIR_SHORT : HAIR_LONG;

  return resolveConfig({
    skinTone: pick([0xf0d5b8, 0xedc9a8, 0xd4a574, 0xa67c52, 0x8d5524, 0x5c3a21]),
    bodyShape: pick(BODY_SHAPES),
    height: {
      leg: 0.55 + rnd() * 0.9,
      torso: 0.55 + rnd() * 0.9,
      neck: 0.55 + rnd() * 0.9,
      head: HEAD_SCALE_MIN + rnd() * (HEAD_SCALE_MAX - HEAD_SCALE_MIN),
    },
    face: {
      // Full slider ranges (same mins/maxes as the Face panel)
      eyeDistance: 0.45 + rnd() * (2.1 - 0.45),
      roundness: 0.45 + rnd() * (1.25 - 0.45),
      length: 0.65 + rnd() * (2 - 0.65),
      width: FACE_WIDTH_MIN + rnd() * (FACE_WIDTH_MAX - FACE_WIDTH_MIN),
      eyeDrop: FACE_DROP_MIN + rnd() * (FACE_DROP_MAX - FACE_DROP_MIN),
      noseDrop: FACE_DROP_MIN + rnd() * (FACE_DROP_MAX - FACE_DROP_MIN),
    },
    body: {
      hipThick: 0.95 + rnd() * 1.1,
      armThick: 0.7 + rnd() * 0.9,
      legThick: 0.7 + rnd() * 0.9,
    },
    eyes: {
      style: pick(EYE_STYLES),
      color: pick([0x2a3a4a, 0x3a5a2a, 0x4a6a9a, 0x5a3a2a]),
      scale: 0.7 + rnd() * 1.5,
      pupilScale: PUPIL_SCALE_MIN + rnd() * (PUPIL_SCALE_MAX - PUPIL_SCALE_MIN),
      // Mild look bias — full −1…1 still available on sliders
      pupilX: (rnd() - 0.5) * 1.4,
      pupilY: (rnd() - 0.5) * 1.0,
    },
    brows: { style: pick(BROW_STYLES), scale: 0.85 + rnd() * 0.3 },
    nose: { style: pick(NOSE_STYLES), scale: 0.85 + rnd() * 0.35 },
    ears: { style: pick(EAR_STYLES), scale: 0.95 + rnd() * 0.25 },
    hair: { style: pick(hairPool), color: pick([0x1a1a1a, 0x3a2a1a, 0x6a4a2a, 0xc4a35a, 0x8a2a2a, 0x4a4a5a]) },
    hat: { style: rnd() > 0.7 ? pick(HAT_STYLES.filter((h) => h !== "none")) : "none", color: hex() },
    clothes: {
      top: {
        style: pick(TOP_STYLES),
        color: hex(),
        pattern: randomPattern(rnd, hex),
        buttons: 2 + Math.floor(rnd() * 4), // 2–5 (used by polo / jacket)
        buttonSize: BUTTON_SIZE_MIN + rnd() * (BUTTON_SIZE_MAX - BUTTON_SIZE_MIN),
        buttonColor: pick([0x1a1a1a, 0x222222, 0xf5f0e6, 0xc4a35a, 0x8a3030, 0x3d5a8f, 0xffffff, hex()]),
      },
      bottom: {
        style: pick(BOTTOM_STYLES),
        color: hex(),
        pattern: randomPattern(rnd, hex),
      },
      shoes: {
        style: pick(SHOE_STYLES),
        color: pick([0x1a1a1a, 0x2a2a32, 0x4a3020, 0xffffff, 0x8a3030, 0x3d8f6e]),
        pattern: randomPattern(rnd, hex),
      },
    },
  });
}

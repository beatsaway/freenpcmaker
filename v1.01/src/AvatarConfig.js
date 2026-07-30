/**
 * AvatarConfig — declarative NPC appearance.
 * All fields optional; missing ones fall back to DEFAULT_CONFIG.
 */

/** @deprecated unused — kept so old imports don't break */
export const GENDERS = [];
export const BODY_SHAPES = ["slim", "regular", "stocky"];
export const EYE_STYLES = ["oval", "almond", "wide", "parallelogram"];
/** @deprecated alias — eye white shape (use EYE_WHITE_STYLES) */
export const EYE_WHITE_STYLES = EYE_STYLES;
export const EYE_PUPIL_STYLES = ["circle", "oval", "almond", "square", "parallelogram"];
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
/** Half-spread at eyeDistance=1 as a fraction of skull half-width (≈ human IPD). */
const EYE_SPREAD_FRAC = 0.4;
/** Approx half-width of an eye at scale=1 (used for overlap limits). */
const EYE_HALF_AT_1 = 0.028;
/** Max eye X as a fraction of skull half-width — keeps eyes on the front face. */
const EYE_MAX_X_FRAC = 0.48;

function clamp01(n, fallback = 0.5) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(1, Math.max(0, v));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

/** Relative face size vs Loomis ball — scales eyes / nose / brows. */
export function faceFeatureScale(hw = 0.08, hh = 0.1) {
  // Prefer ball radius; hh is 1.5R so R = hh/1.5
  const R = (hh || 0.1) / 1.5;
  const refR = 0.075;
  return Math.max(0.55, Math.min(1.4, R / refR));
}

/**
 * Merged skull vertical span (crown → chin tip).
 * Prefer faceOpts.crownY / chinY from stack; fallback from headY + R.
 */
export function faceSkullSpan(faceOpts = null, headY = 0, hh = 0.1) {
  const R = faceOpts?.R ?? (hh || 0.1) / 1.5;
  const crownY = faceOpts?.crownY ?? faceOpts?.headTop ?? headY + R;
  const chinY = faceOpts?.chinY ?? faceOpts?.headBot ?? headY - (faceOpts?.jawLen ?? R * 1.85);
  const span = Math.max(1e-4, crownY - chinY);
  return { crownY, chinY, midY: (crownY + chinY) * 0.5, span, R };
}

/**
 * Eyes — Y is the lower end of the eye (bottom of sclera), not the center.
 * eyeDrop 0 = a bit higher, 1 = a bit lower (small nudge around the ideal).
 * Ideal: sclera centers sit on the crown→chin midpoint (Loomis eye line).
 * (Bottom is a half-eye below mid so the visual center reads as mid-head.)
 */
export function faceEyeY(headY, hh, eyeDrop = 0.5, faceOpts = null) {
  const { midY, span } = faceSkullSpan(faceOpts, headY, hh);
  const u = clamp01(eyeDrop, 0.5);
  // Eye bottoms just under mid → centers ≈ midY (was mid+8%, which sat too high)
  const ideal = midY - span * 0.04;
  return ideal + span * mix(0.05, -0.05, u);
}

/**
 * Approximate sclera-center Y from eye-bottom (for nose/brow spacing).
 */
export function faceEyeCenterY(headY, hh, eyeDrop = 0.5, faceOpts = null) {
  const { span } = faceSkullSpan(faceOpts, headY, hh);
  const bottom = faceEyeY(headY, hh, eyeDrop, faceOpts);
  // Typical half-height of default oval white ≈ 0.035–0.045 of face span
  return bottom + span * 0.04;
}

/**
 * Nose tip Y — between eye centers and chin tip, nearer the eyes than the chin.
 * With eyes on the mid-line this lands in the old (too-high) eye band — mid-face.
 *
 * Why mouth can look OK while eyes/nose look high: nested midpoints damp error
 * toward the chin (~62% retained at nose, ~32% at mouth), so a high eye baseline
 * hurts eyes most, nose next, and mouth least.
 */
export function faceNoseY(headY, hh, noseDrop = 0.5, faceOpts = null) {
  const eyeC = faceEyeCenterY(headY, hh, faceOpts?.eyeDrop ?? 0.5, faceOpts);
  const { chinY } = faceSkullSpan(faceOpts, headY, hh);
  // ~0.30 of eye→chin — sits where the old high eye line used to read
  const ideal = mix(eyeC, chinY, 0.3);
  const u = clamp01(noseDrop, 0.5);
  const room = Math.max(0.003, (eyeC - chinY) * 0.1);
  return ideal + mix(room, -room, u);
}

/**
 * Mouth center Y — between nose tip and chin.
 * Soft-anchored to a chin-relative band so lowering eyes/nose doesn't drag lips
 * (users already read the current mouth band as correct).
 */
export function faceMouthY(headY, hh, mouthDrop = 0.5, faceOpts = null) {
  const noseTipY = faceNoseY(headY, hh, faceOpts?.noseDrop ?? 0.5, faceOpts);
  const { chinY, span } = faceSkullSpan(faceOpts, headY, hh);
  const chained = mix(noseTipY, chinY, 0.48);
  // ~22% of skull span above chin — classic lower-third mouth band
  const anchored = chinY + span * 0.22;
  const ideal = mix(chained, anchored, 0.55);
  const u = clamp01(mouthDrop, 0.5);
  const room = Math.max(0.0025, (noseTipY - chinY) * 0.1);
  return ideal + mix(room, -room, u);
}

/** Min vertical gap between stacked features (fraction of skull span). */
const FACE_FEATURE_GAP = 0.06;

/** Max eyeDrop so eyes stay above the nose. */
export function maxEyeDropForNose(noseDrop = 0.5, hh = 0.1, faceOpts = null) {
  const h = hh || 0.1;
  const { span } = faceSkullSpan(faceOpts, 0, h);
  const opts = { ...(faceOpts || {}), noseDrop };
  const minEyeY = faceNoseY(0, h, noseDrop, opts) + span * FACE_FEATURE_GAP;
  let lo = FACE_DROP_MIN;
  let hi = FACE_DROP_MAX;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) * 0.5;
    if (faceEyeY(0, h, mid, { ...opts, eyeDrop: mid }) >= minEyeY) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Min noseDrop so the nose stays below the eyes. */
export function minNoseDropForEye(eyeDrop = 0.5, hh = 0.1, faceOpts = null) {
  const h = hh || 0.1;
  const { span } = faceSkullSpan(faceOpts, 0, h);
  const opts = { ...(faceOpts || {}), eyeDrop };
  const maxNoseY = faceEyeY(0, h, eyeDrop, opts) - span * FACE_FEATURE_GAP;
  let lo = FACE_DROP_MIN;
  let hi = FACE_DROP_MAX;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) * 0.5;
    if (faceNoseY(0, h, mid, { ...opts, noseDrop: mid }) <= maxNoseY) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Min mouthDrop so the mouth stays below the nose. */
export function minMouthDropForNose(noseDrop = 0.5, hh = 0.1, faceOpts = null) {
  const h = hh || 0.1;
  const { span } = faceSkullSpan(faceOpts, 0, h);
  const opts = { ...(faceOpts || {}), noseDrop };
  const maxMouthY = faceNoseY(0, h, noseDrop, opts) - span * FACE_FEATURE_GAP * 0.85;
  let lo = FACE_DROP_MIN;
  let hi = FACE_DROP_MAX;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) * 0.5;
    if (faceMouthY(0, h, mid, { ...opts, mouthDrop: mid }) <= maxMouthY) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Mutates face drops so eyes > nose > mouth vertically. */
export function clampFaceFeatureDrops(face, hh = 0.1, faceOpts = null) {
  if (!face) return face;
  let eyeDrop = clamp01(face.eyeDrop, 0.5);
  let noseDrop = clamp01(face.noseDrop, 0.5);
  let mouthDrop = clamp01(face.mouthDrop, 0.5);
  const opts = { ...(faceOpts || {}), eyeDrop, noseDrop, mouthDrop };
  eyeDrop = Math.min(eyeDrop, maxEyeDropForNose(noseDrop, hh, opts));
  noseDrop = Math.max(noseDrop, minNoseDropForEye(eyeDrop, hh, { ...opts, eyeDrop }));
  mouthDrop = Math.max(mouthDrop, minMouthDropForNose(noseDrop, hh, { ...opts, noseDrop }));
  eyeDrop = Math.min(eyeDrop, maxEyeDropForNose(noseDrop, hh, { ...opts, noseDrop }));
  face.eyeDrop = eyeDrop;
  face.noseDrop = noseDrop;
  face.mouthDrop = mouthDrop;
  return face;
}

/** Center offset of one eye from midline. */
export function eyeHalfSpread(eyeDistance = 1, hw = 0.08) {
  const dist = Math.min(EYE_DISTANCE_MAX, Math.max(EYE_DISTANCE_MIN, Number(eyeDistance) || 1));
  return EYE_SPREAD_FRAC * Math.max(1e-6, hw || 0.08) * dist;
}

/**
 * Max eyeDistance so eyes stay on the front of the face (not wrapping to the side/back).
 * Pass faceOpts ({ hw, hh, hd, headY, roundness, eyeDrop }) to tighten via front-surface probe.
 */
export function maxEyeDistanceForWidth(hw = 0.08, faceOpts = null) {
  const w = hw || 0.08;
  const base = EYE_SPREAD_FRAC * w;
  if (base < 1e-8) return EYE_DISTANCE_MIN;

  let maxX = w * EYE_MAX_X_FRAC;

  if (faceOpts && faceOpts.hh != null) {
    const probe = faceOpts.frontZ;
    if (typeof probe === "function") {
      const hd = faceOpts.hd ?? 0.1;
      const headY = faceOpts.headY ?? 0;
      const hh = faceOpts.hh ?? 0.1;
      const y = faceEyeY(headY, hh, faceOpts.eyeDrop ?? 0.5, faceOpts);
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
export function clampEyeDistance(eyeDistance, hw = 0.08, faceOpts = null) {
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
export function minEyeDistanceForScale(eyeScale = 1, hw = 0.08) {
  const sc = Math.min(EYE_SCALE_MAX, Math.max(EYE_SCALE_MIN, Number(eyeScale) || 1));
  const base = EYE_SPREAD_FRAC * Math.max(1e-6, hw || 0.08);
  if (base < 1e-8) return EYE_DISTANCE_MIN;
  const minDist = (2 * EYE_HALF_AT_1 * sc + EYE_GAP_MIN) / (2 * base);
  return Math.min(EYE_DISTANCE_MAX, Math.max(EYE_DISTANCE_MIN, minDist));
}

/**
 * Max eye scale so left/right eyes don't overlap for a given eyeDistance.
 * Closer eyes → lower max scale.
 */
export function maxEyeScaleForDistance(eyeDistance = 1, hw = 0.08) {
  const dist = Math.min(EYE_DISTANCE_MAX, Math.max(EYE_DISTANCE_MIN, Number(eyeDistance) || 1));
  const baseSpread = eyeHalfSpread(dist, hw);
  const maxFromDist = (2 * baseSpread - EYE_GAP_MIN) / (2 * EYE_HALF_AT_1);
  return Math.min(EYE_SCALE_MAX, Math.max(EYE_SCALE_MIN, maxFromDist));
}

export function clampEyeScale(scale, eyeDistance = 1, hw = 0.08) {
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
  "soft",
  "round",
  "short",
  "snub",
  "upturned",
  "flat",
  "broad",
  "flared",
  "petite",
  "bridge",
  "straight",
  "bulbous",
  "soft-slope",
  "arched",
  "pointy",
  "roman",
  "hooked",
  "hawk",
  "slope",
];
export const MOUTH_STYLES = ["smile", "flat", "wide", "small", "none"];
export const LIP_THICKNESS_MIN = 0.35;
export const LIP_THICKNESS_MAX = 1.75;
export const LIP_CURVE_MIN = -1;
export const LIP_CURVE_MAX = 1;
export const LIP_LENGTH_MIN = 0.45;
export const LIP_LENGTH_MAX = 1.55;
/** Natural lip tones (random picks stay in this band). */
export const LIP_COLORS = [
  0xc47880, // soft rose
  0xb56a72, // dusty rose
  0xa85c68, // muted mauve
  0xd08a8a, // light coral
  0x9a5a5a, // brown-rose
  0xc48a78, // peach nude
  0x8a4a52, // deeper rose
  0xb87870, // warm nude
];
export const NOSE_SCALE_MIN = 0.45;
export const NOSE_SCALE_MAX = 1.35;
export const BROW_LENGTH_MIN = 0.5;
export const BROW_LENGTH_MAX = 1.75;
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
export const HAIR_SHORT = ["bald", "short", "buzz", "crew", "messy", "spiky", "quiff", "pompadour"];
/** Longer / girly looks (~half of random picks). */
export const HAIR_LONG = [
  "bob",
  "shoulder",
  "long",
  "wavy",
  "princess",
  "hime",
  "ponytail",
  "side-tail",
  "half-up",
  "bun",
  "odango",
  "twin-tails",
  "pigtails",
  "braid",
  "drills",
  "afro",
];
export const HAIR_STYLES = [...HAIR_SHORT, ...HAIR_LONG];

export const NOSE_WIDTH_MIN = 0.55;
export const NOSE_WIDTH_MAX = 1.6;
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
  face: { eyeDistance: 1, roundness: 0.95, length: 1.12, width: 0.94, eyeDrop: 0.5, noseDrop: 0.5, mouthDrop: 0.5 },
  eyes: {
    style: "oval",
    whiteStyle: "oval",
    pupilStyle: "circle",
    color: 0x2a3a4a,
    scale: 1,
    pupilScale: 0.55,
    pupilX: 0,
    pupilY: 0,
  },
  brows: { style: "straight", scale: 0.62, length: 0.72 },
  nose: { style: "button", scale: 0.78, width: 0.9 },
  mouth: {
    style: "smile",
    scale: 0.62,
    lipThickness: 0.7,
    curvature: 0.45,
    lipLength: 0.72,
    color: 0xc47880,
  },
  ears: { style: "round", scale: 1 },
  hair: { style: "short", color: 0x3a2a1a },
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
  const eyesPatch = partial?.eyes || {};
  if (cfg.eyes?.style === "dot") cfg.eyes.style = "oval";
  if (eyesPatch.whiteStyle === "dot") eyesPatch.whiteStyle = "oval";
  // Prefer explicit whiteStyle from patch; else legacy style; keep both synced
  if (cfg.eyes) {
    let white = "oval";
    if (eyesPatch.whiteStyle != null) white = eyesPatch.whiteStyle;
    else if (eyesPatch.style != null) white = eyesPatch.style;
    else white = cfg.eyes.whiteStyle || cfg.eyes.style || "oval";
    if (white === "dot") white = "oval";
    if (!EYE_STYLES.includes(white)) white = "oval";
    cfg.eyes.whiteStyle = white;
    cfg.eyes.style = white;
    let pupil = eyesPatch.pupilStyle ?? cfg.eyes.pupilStyle ?? "circle";
    if (!EYE_PUPIL_STYLES.includes(pupil)) pupil = "circle";
    cfg.eyes.pupilStyle = pupil;
  }
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
  if (cfg.mouth) {
    const t = Number(cfg.mouth.lipThickness);
    cfg.mouth.lipThickness = Number.isFinite(t)
      ? Math.min(LIP_THICKNESS_MAX, Math.max(LIP_THICKNESS_MIN, t))
      : 1;
    const cv = Number(cfg.mouth.curvature);
    cfg.mouth.curvature = Number.isFinite(cv)
      ? Math.min(LIP_CURVE_MAX, Math.max(LIP_CURVE_MIN, cv))
      : 0.55;
    const len = Number(cfg.mouth.lipLength ?? cfg.mouth.length);
    cfg.mouth.lipLength = Number.isFinite(len)
      ? Math.min(LIP_LENGTH_MAX, Math.max(LIP_LENGTH_MIN, len))
      : 1;
    const ms = Number(cfg.mouth.scale);
    cfg.mouth.scale = Number.isFinite(ms) ? Math.min(1.55, Math.max(0.45, ms)) : 0.62;
    const mc = Number(cfg.mouth.color);
    cfg.mouth.color = Number.isFinite(mc) ? mc & 0xffffff : 0xc47880;
  }
  if (cfg.brows) {
    const bl = Number(cfg.brows.length);
    cfg.brows.length = Number.isFinite(bl)
      ? Math.min(BROW_LENGTH_MAX, Math.max(BROW_LENGTH_MIN, bl))
      : 1;
  }
  if (cfg.nose) {
    const ns = Number(cfg.nose.scale);
    cfg.nose.scale = Number.isFinite(ns)
      ? Math.min(NOSE_SCALE_MAX, Math.max(NOSE_SCALE_MIN, ns))
      : 0.78;
    const nw = Number(cfg.nose.width);
    cfg.nose.width = Number.isFinite(nw)
      ? Math.min(NOSE_WIDTH_MAX, Math.max(NOSE_WIDTH_MIN, nw))
      : 0.9;
    if (cfg.nose.style && !NOSE_STYLES.includes(cfg.nose.style)) cfg.nose.style = "button";
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
      mouthDrop: FACE_DROP_MIN + rnd() * (FACE_DROP_MAX - FACE_DROP_MIN),
    },
    body: {
      hipThick: 0.95 + rnd() * 1.1,
      armThick: 0.7 + rnd() * 0.9,
      legThick: 0.7 + rnd() * 0.9,
    },
    eyes: (() => {
      const whiteStyle = pick(EYE_STYLES);
      return {
        style: whiteStyle,
        whiteStyle,
        pupilStyle: pick(EYE_PUPIL_STYLES),
        color: pick([0x2a3a4a, 0x3a5a2a, 0x4a6a9a, 0x5a3a2a]),
        scale: 0.7 + rnd() * 1.5,
        pupilScale: PUPIL_SCALE_MIN + rnd() * (PUPIL_SCALE_MAX - PUPIL_SCALE_MIN),
        // Mild look bias — full −1…1 still available on sliders
        pupilX: (rnd() - 0.5) * 1.4,
        pupilY: (rnd() - 0.5) * 1.0,
      };
    })(),
    brows: {
      style: pick(BROW_STYLES),
      scale: 0.85 + rnd() * 0.3,
      length: BROW_LENGTH_MIN + rnd() * (BROW_LENGTH_MAX - BROW_LENGTH_MIN),
    },
    nose: {
      // Bias toward soft everyday shapes; long/pointy IDs still exist but are toned down
      style: pick([
        "button", "soft", "round", "short", "snub", "upturned", "flat", "broad", "flared",
        "petite", "bridge", "straight", "bulbous", "soft-slope", "arched",
        "pointy", "roman", "button", "soft", "round",
      ]),
      scale: NOSE_SCALE_MIN + rnd() * (NOSE_SCALE_MAX - NOSE_SCALE_MIN),
      width: NOSE_WIDTH_MIN + rnd() * (NOSE_WIDTH_MAX - NOSE_WIDTH_MIN),
    },
    mouth: {
      style: pick(MOUTH_STYLES.filter((s) => s !== "none")),
      scale: 0.55 + rnd() * 0.75,
      lipThickness: LIP_THICKNESS_MIN + rnd() * (LIP_THICKNESS_MAX - LIP_THICKNESS_MIN),
      curvature: LIP_CURVE_MIN + rnd() * (LIP_CURVE_MAX - LIP_CURVE_MIN),
      lipLength: LIP_LENGTH_MIN + rnd() * (LIP_LENGTH_MAX - LIP_LENGTH_MIN),
      color: pick(LIP_COLORS),
    },
    ears: { style: "round", scale: 1 },
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

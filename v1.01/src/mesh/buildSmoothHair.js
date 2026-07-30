/**
 * Bowl hair foundation: 48 sealed watermelon slices.
 * Each slice can stop shorter than a full bowl (`cover` 0→1 truncates θ —
 * we simply build fewer rim rows, no curvature hacks).
 * Hang continues from that slice’s own rim as extra vertices on the same mesh.
 * Style macros set cover / hang / wave; extras add bun, tail, pompadour, spikes, etc.
 */
import * as THREE from "three";
import { keepOutside, keepCurveOutside } from "./skullSafe.js";

const SLICES = 48;
const SLICE = (Math.PI * 2) / SLICES;
const THETA_FULL = Math.PI * 0.58; // full bowl rim
const THETA_SEGS_FULL = 8;
const SEAL = 0.008;

/** Active skull layout while building hair (used by ribbon / hang). */
let _skullL = null;

function hairLayout(opts = {}) {
  const R = opts.R ?? (opts.hh ?? 0.1) / 1.5;
  const W = opts.hw ?? R;
  const D = opts.hd ?? R;
  const headY = opts.headY ?? 1.6;
  const skullTop = opts.skullTop ?? headY + R;
  const eyeY = opts.eyeY ?? headY;
  const chinY = opts.chinY ?? headY - R * 1.5;
  const shoulderY = opts.shoulderY ?? chinY - R * 3.2;
  const waistY = opts.waistY ?? shoulderY - Math.max(0.28, R * 5.5);
  // Chest ≈ midway shoulder → waist
  const chestY = opts.chestY ?? mix(shoulderY, waistY, 0.42);
  // Bowl rim for a given cover (hang starts from that rim, so lengths must account for it)
  const bowlR = Math.max(R, W, D) * 1.1;
  const rimAt = (cover = 1) => {
    const c = Math.min(1, Math.max(0.06, cover));
    const theta = mix(THETA_FULL * 0.1, THETA_FULL, c);
    return headY + bowlR * Math.cos(theta);
  };
  const rimY = rimAt(1);
  /** Hang length so tips reach targetY when the slice uses this cover. */
  const hangTo = (targetY, cover = 1) => Math.max(0.02, rimAt(cover) - targetY);
  const toChin = hangTo(chinY, 1);
  const toShoulder = hangTo(shoulderY, 1);
  const toChest = hangTo(chestY, 1);
  const toWaist = hangTo(waistY, 1);
  return {
    R,
    W,
    D,
    headY,
    skullTop,
    eyeY,
    chinY,
    shoulderY,
    chestY,
    waistY,
    rimY,
    rimAt,
    hangTo,
    toChin,
    toShoulder,
    toChest,
    toWaist,
  };
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(v, fb = 1) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fb;
  return Math.min(1, Math.max(0.06, n));
}

function hash01(i, salt = 0) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Style macros — hang lengths use hangTo(targetY, cover) so tips actually reach
 * chin / shoulder / chest / waist after cover truncates the bowl rim.
 * Front bangs are capped above the eyes. Volume = extra meshes on the bowl, not longer hang.
 */
function styleMacro(style, L) {
  const R = L.R;
  const { hangTo, chinY, shoulderY, chestY, waistY, eyeY } = L;
  // Front tips stop at the brow band — never hang over the sclera
  const browClear = eyeY + R * 0.38;

  const all = (len, wave = 0, vary = 0.15, cover = 1, coverVary = 0.06) => ({
    front: { len, wave, vary, cover, coverVary },
    right: { len, wave, vary, cover, coverVary },
    back: { len, wave, vary, cover, coverVary },
    left: { len, wave, vary, cover, coverVary },
  });
  const sides = (len, wave = 0.1, cards = 3, width = R * 0.14) => ({
    cards,
    len,
    wave,
    width,
  });
  /** Short forehead fringe — cover stops high, hang ends above eyes. */
  const fringe = (wave = 0.05, vary = 0.06, cover = 0.42) => ({
    len: hangTo(browClear, cover),
    wave,
    vary: Math.min(vary, 0.18),
    cover,
    coverVary: 0.04,
  });

  switch (style) {
    case "buzz":
      return {
        ...all(0, 0, 0, 0.22, 0.03),
        extras: { kind: "crownVolume", size: R * 0.1, lift: 0.35 },
      };
    case "crew":
      return {
        front: fringe(0, 0.04, 0.2),
        right: { len: hangTo(mix(eyeY, chinY, 0.35), 0.42), wave: 0, vary: 0.1, cover: 0.42, coverVary: 0.05 },
        back: { len: hangTo(mix(eyeY, chinY, 0.55), 0.5), wave: 0, vary: 0.1, cover: 0.5, coverVary: 0.05 },
        left: { len: hangTo(mix(eyeY, chinY, 0.35), 0.42), wave: 0, vary: 0.1, cover: 0.42, coverVary: 0.05 },
        extras: [
          { kind: "crownVolume", size: R * 0.14, lift: 0.45 },
          { kind: "tufts", count: 3, len: R * 0.1 },
        ],
      };
    case "short":
      return {
        front: fringe(0.05, 0.12, 0.4),
        right: { len: hangTo(mix(eyeY, chinY, 0.45), 0.58), wave: 0.08, vary: 0.18, cover: 0.58, coverVary: 0.08 },
        back: { len: hangTo(mix(eyeY, chinY, 0.55), 0.64), wave: 0.1, vary: 0.2, cover: 0.64, coverVary: 0.08 },
        left: { len: hangTo(mix(eyeY, chinY, 0.45), 0.58), wave: 0.08, vary: 0.18, cover: 0.58, coverVary: 0.08 },
        justSides: sides(hangTo(mix(eyeY, chinY, 0.4), 0.5), 0.08, 2),
        extras: [
          { kind: "crownVolume", size: R * 0.2, lift: 0.55 },
          { kind: "tufts", count: 5, len: R * 0.14 },
        ],
      };
    case "messy":
      return {
        front: fringe(0.25, 0.12, 0.36),
        right: { len: hangTo(mix(eyeY, chinY, 0.55), 0.55), wave: 0.5, vary: 0.45, cover: 0.55, coverVary: 0.28 },
        back: { len: hangTo(mix(eyeY, chinY, 0.7), 0.62), wave: 0.55, vary: 0.5, cover: 0.62, coverVary: 0.28 },
        left: { len: hangTo(mix(eyeY, chinY, 0.55), 0.55), wave: 0.5, vary: 0.45, cover: 0.55, coverVary: 0.28 },
        justSides: sides(hangTo(mix(eyeY, chinY, 0.5), 0.5), 0.4, 2),
        extras: [
          { kind: "crownVolume", size: R * 0.22, lift: 0.65 },
          { kind: "tufts", count: 10, len: R * 0.3 },
        ],
      };
    case "spiky":
      // Tight bowl + a handful of big pointed locks (not many tiny needles)
      return {
        front: fringe(0.05, 0.08, 0.28),
        right: { len: hangTo(mix(eyeY, chinY, 0.2), 0.34), wave: 0.05, vary: 0.1, cover: 0.34, coverVary: 0.06 },
        back: { len: hangTo(mix(eyeY, chinY, 0.25), 0.36), wave: 0.05, vary: 0.1, cover: 0.36, coverVary: 0.06 },
        left: { len: hangTo(mix(eyeY, chinY, 0.2), 0.34), wave: 0.05, vary: 0.1, cover: 0.34, coverVary: 0.06 },
        extras: { kind: "spikes", len: R * 0.95 },
      };
    case "quiff":
      return {
        front: fringe(0.08, 0.1, 0.26),
        right: { len: hangTo(mix(eyeY, chinY, 0.45), 0.55), wave: 0.08, vary: 0.12, cover: 0.55, coverVary: 0.07 },
        back: { len: hangTo(mix(eyeY, chinY, 0.55), 0.6), wave: 0.08, vary: 0.12, cover: 0.6, coverVary: 0.07 },
        left: { len: hangTo(mix(eyeY, chinY, 0.45), 0.55), wave: 0.08, vary: 0.12, cover: 0.55, coverVary: 0.07 },
        extras: { kind: "quiff", len: R * 0.48 },
      };
    case "pompadour":
      return {
        front: fringe(0, 0.04, 0.22),
        right: { len: hangTo(mix(eyeY, chinY, 0.45), 0.6), wave: 0.05, vary: 0.1, cover: 0.6, coverVary: 0.07 },
        back: { len: hangTo(mix(eyeY, chinY, 0.55), 0.66), wave: 0.05, vary: 0.1, cover: 0.66, coverVary: 0.07 },
        left: { len: hangTo(mix(eyeY, chinY, 0.45), 0.6), wave: 0.05, vary: 0.1, cover: 0.6, coverVary: 0.07 },
        extras: { kind: "pompadour", len: R * 0.55 },
      };
    case "bob":
      // Short bowl + crown/side volume meshes (not long face hang)
      return {
        front: fringe(0.04, 0.06, 0.48),
        right: { len: hangTo(chinY, 0.9), wave: 0.05, vary: 0.06, cover: 0.9, coverVary: 0.03 },
        back: { len: hangTo(chinY, 0.92), wave: 0.05, vary: 0.06, cover: 0.92, coverVary: 0.03 },
        left: { len: hangTo(chinY, 0.9), wave: 0.05, vary: 0.06, cover: 0.9, coverVary: 0.03 },
        justSides: sides(hangTo(chinY, 0.88), 0.05, 3, R * 0.16),
        extras: { kind: "bobVolume", size: R * 0.34 },
      };
    case "shoulder":
      return {
        front: fringe(0.08, 0.1, 0.5),
        right: { len: hangTo(shoulderY, 0.96), wave: 0.12, vary: 0.12, cover: 0.96, coverVary: 0.04 },
        back: { len: hangTo(shoulderY, 0.98), wave: 0.12, vary: 0.12, cover: 0.98, coverVary: 0.04 },
        left: { len: hangTo(shoulderY, 0.96), wave: 0.12, vary: 0.12, cover: 0.96, coverVary: 0.04 },
        justSides: sides(hangTo(shoulderY, 0.9), 0.12, 4, R * 0.16),
        extras: [
          { kind: "crownVolume", size: R * 0.16, lift: 0.4 },
          { kind: "capeVolume", len: hangTo(shoulderY, 0.85), width: R * 0.42, thick: 1.15 },
        ],
      };
    case "long":
      return {
        front: fringe(0.08, 0.1, 0.5),
        right: { len: hangTo(chestY, 1), wave: 0.12, vary: 0.15, cover: 1, coverVary: 0.03 },
        back: { len: hangTo(chestY, 1), wave: 0.12, vary: 0.15, cover: 1, coverVary: 0.03 },
        left: { len: hangTo(chestY, 1), wave: 0.12, vary: 0.15, cover: 1, coverVary: 0.03 },
        justSides: sides(hangTo(chestY, 0.92), 0.12, 4, R * 0.17),
        extras: [
          { kind: "crownVolume", size: R * 0.14, lift: 0.35 },
          { kind: "capeVolume", len: hangTo(chestY, 0.82), width: R * 0.48, thick: 1.25 },
        ],
      };
    case "wavy":
      return {
        front: fringe(0.4, 0.15, 0.48),
        right: { len: hangTo(chestY, 1), wave: 0.75, vary: 0.22, cover: 1, coverVary: 0.04 },
        back: { len: hangTo(chestY, 1), wave: 0.75, vary: 0.22, cover: 1, coverVary: 0.04 },
        left: { len: hangTo(chestY, 1), wave: 0.75, vary: 0.22, cover: 1, coverVary: 0.04 },
        justSides: sides(hangTo(chestY, 0.9), 0.65, 4, R * 0.17),
        extras: [
          { kind: "crownVolume", size: R * 0.15, lift: 0.4 },
          { kind: "capeVolume", len: hangTo(chestY, 0.8), width: R * 0.45, wave: 0.55, thick: 1.2 },
        ],
      };
    case "princess":
      return {
        front: fringe(0.12, 0.1, 0.48),
        right: { len: hangTo(waistY, 1), wave: 0.18, vary: 0.18, cover: 1, coverVary: 0.03 },
        back: { len: hangTo(waistY, 1), wave: 0.16, vary: 0.18, cover: 1, coverVary: 0.03 },
        left: { len: hangTo(waistY, 1), wave: 0.18, vary: 0.18, cover: 1, coverVary: 0.03 },
        justSides: sides(hangTo(waistY, 0.9), 0.16, 5, R * 0.18),
        extras: [
          { kind: "crownVolume", size: R * 0.16, lift: 0.4 },
          { kind: "capeVolume", len: hangTo(waistY, 0.8), width: R * 0.55, thick: 1.35 },
        ],
      };
    case "hime":
      return {
        front: fringe(0, 0.03, 0.52),
        right: { len: hangTo(chestY, 1), wave: 0.03, vary: 0.08, cover: 1, coverVary: 0.02 },
        back: { len: hangTo(chestY, 1), wave: 0.03, vary: 0.08, cover: 1, coverVary: 0.02 },
        left: { len: hangTo(chestY, 1), wave: 0.03, vary: 0.08, cover: 1, coverVary: 0.02 },
        justSides: sides(hangTo(chestY, 0.9), 0.02, 4, R * 0.2),
        extras: { kind: "himeSides", len: hangTo(chestY, 0.85) },
      };
    case "ponytail":
      return {
        front: fringe(0.05, 0.08, 0.45),
        right: { len: hangTo(mix(eyeY, chinY, 0.4), 0.6), wave: 0.05, vary: 0.1, cover: 0.6, coverVary: 0.06 },
        back: { len: hangTo(mix(eyeY, chinY, 0.3), 0.58), wave: 0.05, vary: 0.1, cover: 0.58, coverVary: 0.06 },
        left: { len: hangTo(mix(eyeY, chinY, 0.4), 0.6), wave: 0.05, vary: 0.1, cover: 0.6, coverVary: 0.06 },
        justSides: sides(hangTo(mix(eyeY, chinY, 0.4), 0.5), 0.08, 2),
        extras: [
          { kind: "crownVolume", size: R * 0.12, lift: 0.35 },
          { kind: "pony", len: hangTo(chestY, 0.9) },
        ],
      };
    case "side-tail":
      return {
        front: fringe(0.06, 0.08, 0.44),
        right: { len: hangTo(mix(eyeY, chinY, 0.3), 0.58), wave: 0.08, vary: 0.1, cover: 0.58, coverVary: 0.06 },
        back: { len: hangTo(mix(eyeY, chinY, 0.35), 0.6), wave: 0.05, vary: 0.1, cover: 0.6, coverVary: 0.06 },
        left: { len: hangTo(mix(eyeY, chinY, 0.45), 0.6), wave: 0.08, vary: 0.1, cover: 0.6, coverVary: 0.06 },
        justSides: sides(hangTo(mix(eyeY, chinY, 0.4), 0.5), 0.1, 2),
        extras: { kind: "sidePony", side: 1, len: hangTo(chestY, 0.88) },
      };
    case "half-up":
      return {
        front: fringe(0.08, 0.1, 0.48),
        right: { len: hangTo(shoulderY, 0.9), wave: 0.12, vary: 0.15, cover: 0.9, coverVary: 0.05 },
        back: { len: hangTo(shoulderY, 0.9), wave: 0.12, vary: 0.15, cover: 0.9, coverVary: 0.05 },
        left: { len: hangTo(shoulderY, 0.9), wave: 0.12, vary: 0.15, cover: 0.9, coverVary: 0.05 },
        justSides: sides(hangTo(shoulderY, 0.85), 0.12, 3),
        extras: [
          { kind: "crownVolume", size: R * 0.14, lift: 0.4 },
          { kind: "pony", len: hangTo(mix(shoulderY, chestY, 0.5), 0.85) },
        ],
      };
    case "bun":
      return {
        front: fringe(0.04, 0.08, 0.42),
        right: { len: hangTo(mix(eyeY, chinY, 0.3), 0.55), wave: 0, vary: 0.08, cover: 0.55, coverVary: 0.05 },
        back: { len: hangTo(mix(eyeY, chinY, 0.3), 0.55), wave: 0, vary: 0.08, cover: 0.55, coverVary: 0.05 },
        left: { len: hangTo(mix(eyeY, chinY, 0.3), 0.55), wave: 0, vary: 0.08, cover: 0.55, coverVary: 0.05 },
        justSides: sides(hangTo(mix(eyeY, chinY, 0.35), 0.5), 0.05, 2),
        extras: { kind: "bun", size: R * 0.38 },
      };
    case "odango":
      return {
        front: fringe(0.04, 0.06, 0.48),
        right: { len: hangTo(mix(eyeY, chinY, 0.2), 0.48), wave: 0, vary: 0.06, cover: 0.48, coverVary: 0.04 },
        back: { len: hangTo(mix(eyeY, chinY, 0.35), 0.58), wave: 0.05, vary: 0.08, cover: 0.58, coverVary: 0.04 },
        left: { len: hangTo(mix(eyeY, chinY, 0.2), 0.48), wave: 0, vary: 0.06, cover: 0.48, coverVary: 0.04 },
        justSides: sides(hangTo(mix(eyeY, chinY, 0.4), 0.5), 0.06, 2),
        extras: { kind: "odango", size: R * 0.28 },
      };
    case "twin-tails":
      return {
        front: fringe(0.06, 0.08, 0.48),
        right: { len: hangTo(mix(eyeY, chinY, 0.4), 0.6), wave: 0.08, vary: 0.1, cover: 0.6, coverVary: 0.06 },
        back: { len: hangTo(mix(eyeY, chinY, 0.4), 0.6), wave: 0.08, vary: 0.1, cover: 0.6, coverVary: 0.06 },
        left: { len: hangTo(mix(eyeY, chinY, 0.4), 0.6), wave: 0.08, vary: 0.1, cover: 0.6, coverVary: 0.06 },
        justSides: sides(hangTo(mix(eyeY, chinY, 0.45), 0.5), 0.1, 3),
        extras: { kind: "twins", len: hangTo(chestY, 0.88) },
      };
    case "pigtails":
      return {
        front: fringe(0.06, 0.08, 0.48),
        right: { len: hangTo(mix(eyeY, chinY, 0.4), 0.6), wave: 0.08, vary: 0.1, cover: 0.6, coverVary: 0.06 },
        back: { len: hangTo(mix(eyeY, chinY, 0.4), 0.6), wave: 0.08, vary: 0.1, cover: 0.6, coverVary: 0.06 },
        left: { len: hangTo(mix(eyeY, chinY, 0.4), 0.6), wave: 0.08, vary: 0.1, cover: 0.6, coverVary: 0.06 },
        justSides: sides(hangTo(mix(eyeY, chinY, 0.4), 0.5), 0.1, 3),
        extras: { kind: "pigs", len: hangTo(shoulderY, 0.85) },
      };
    case "braid":
      return {
        front: fringe(0.05, 0.08, 0.45),
        right: { len: hangTo(mix(eyeY, chinY, 0.35), 0.58), wave: 0.05, vary: 0.08, cover: 0.58, coverVary: 0.06 },
        back: { len: hangTo(mix(eyeY, chinY, 0.35), 0.58), wave: 0.05, vary: 0.08, cover: 0.58, coverVary: 0.06 },
        left: { len: hangTo(mix(eyeY, chinY, 0.35), 0.58), wave: 0.05, vary: 0.08, cover: 0.58, coverVary: 0.06 },
        justSides: sides(hangTo(mix(eyeY, chinY, 0.35), 0.5), 0.08, 2),
        extras: { kind: "braid", len: hangTo(chestY, 0.9) },
      };
    case "drills":
      return {
        front: fringe(0.2, 0.12, 0.48),
        right: { len: hangTo(shoulderY, 0.9), wave: 0.85, vary: 0.22, cover: 0.9, coverVary: 0.06 },
        back: { len: hangTo(mix(chinY, shoulderY, 0.35), 0.84), wave: 0.35, vary: 0.18, cover: 0.84, coverVary: 0.08 },
        left: { len: hangTo(shoulderY, 0.9), wave: 0.85, vary: 0.22, cover: 0.9, coverVary: 0.06 },
        justSides: sides(hangTo(shoulderY, 0.85), 0.7, 3, R * 0.16),
        extras: { kind: "capeVolume", len: hangTo(shoulderY, 0.8), width: R * 0.28, wave: 0.7, thick: 0.9 },
      };
    case "afro":
      return {
        front: fringe(0.1, 0.1, 0.3),
        right: { len: hangTo(mix(eyeY, chinY, 0.12), 0.34), wave: 0.15, vary: 0.1, cover: 0.34, coverVary: 0.06 },
        back: { len: hangTo(mix(eyeY, chinY, 0.12), 0.34), wave: 0.15, vary: 0.1, cover: 0.34, coverVary: 0.06 },
        left: { len: hangTo(mix(eyeY, chinY, 0.12), 0.34), wave: 0.15, vary: 0.1, cover: 0.34, coverVary: 0.06 },
        bowlScale: 1.05,
        extras: { kind: "afro", size: R * 0.72 },
      };
    default:
      return {
        front: fringe(0.08, 0.1, 0.48),
        right: { len: hangTo(mix(eyeY, chinY, 0.5), 0.65), wave: 0.1, vary: 0.12, cover: 0.65, coverVary: 0.08 },
        back: { len: hangTo(mix(eyeY, chinY, 0.55), 0.68), wave: 0.1, vary: 0.12, cover: 0.68, coverVary: 0.08 },
        left: { len: hangTo(mix(eyeY, chinY, 0.5), 0.65), wave: 0.1, vary: 0.12, cover: 0.65, coverVary: 0.08 },
        justSides: sides(hangTo(mix(eyeY, chinY, 0.4), 0.5), 0.1, 2),
        extras: { kind: "crownVolume", size: R * 0.16, lift: 0.45 },
      };
  }
}

function sliceCover(cfg, localIndex, globalIndex) {
  const base = clamp01(cfg?.cover ?? 1);
  const vary = cfg?.coverVary ?? 0.06;
  const jitter = (hash01(globalIndex, 7) - 0.5) * 2 * vary;
  const lobe = Math.sin((localIndex / 11) * Math.PI) * vary * 0.25;
  return clamp01(base + jitter + lobe);
}

function sliceHangLength(cfg, localIndex, globalIndex) {
  if (!cfg) return 0;
  const base = Number(cfg.len) || 0;
  if (base <= 0) return 0;
  const vary = cfg.vary ?? 0.15;
  const jitter = (hash01(globalIndex, 3) - 0.5) * 2 * vary;
  const lobe = Math.sin((localIndex / 11) * Math.PI) * vary * 0.35;
  return Math.max(0, base * (1 + jitter + lobe));
}

/**
 * One slice: crown → truncated rim (by cover) → optional hang.
 * Shorter than bowl = stop θ early (drop lower sphere rows).
 */
function makeExtendedSlice(mat, phi0, phiLen, radius, headY, cover, hangLen, wave, sliceIndex, name, skullL = null) {
  const phiSegs = 2;
  const cols = phiSegs + 1;
  const thetaMax = mix(THETA_FULL * 0.1, THETA_FULL, cover);
  const bowlSegs = Math.max(2, Math.ceil(THETA_SEGS_FULL * cover));
  const bowlRows = bowlSegs + 1;
  const hangRows = hangLen > 1e-4 ? Math.max(2, 2 + Math.ceil(4 + wave * 5)) : 0;
  const totalRows = bowlRows + hangRows;

  const rimY = radius * Math.cos(thetaMax);
  const rimR = radius * Math.sin(thetaMax);
  const phiMid = phi0 + phiLen * 0.5;
  const safeL = skullL || { headY, R: radius / 1.1 };

  const pos = [];
  const uvs = [];
  const idx = [];

  for (let iy = 0; iy < totalRows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const u = ix / phiSegs;
      const phi = phi0 + u * phiLen;
      let x;
      let y;
      let z;
      let v;

      if (iy < bowlRows) {
        const tv = iy / bowlSegs;
        const theta = tv * thetaMax;
        const st = Math.sin(theta);
        const ct = Math.cos(theta);
        x = -Math.cos(phi) * st * radius;
        y = ct * radius;
        z = Math.sin(phi) * st * radius;
        v = tv * 0.55;
      } else {
        const h = (iy - bowlRows + 1) / hangRows;
        const ox = -Math.cos(phi);
        const oz = Math.sin(phi);
        const tx = -Math.sin(phiMid);
        const tz = -Math.cos(phiMid);
        const flare = h * radius * 0.045;
        const sway =
          Math.sin(h * Math.PI * (1.4 + wave * 3) + sliceIndex * 0.7) * wave * radius * 0.2;
        const sway2 = Math.sin(h * Math.PI * 2 + u * Math.PI) * wave * radius * 0.04;
        x = ox * rimR + ox * flare + tx * (sway + sway2);
        z = oz * rimR + oz * flare + tz * (sway + sway2);
        y = rimY - h * hangLen;
        if (h > 0.7) {
          const taper = mix(1, 0.88, (h - 0.7) / 0.3);
          const midX = -Math.cos(phiMid) * (rimR + flare);
          const midZ = Math.sin(phiMid) * (rimR + flare);
          x = mix(x, midX + tx * (sway + sway2), 1 - taper);
          z = mix(z, midZ + tz * (sway + sway2), 1 - taper);
        }
        v = 0.55 + h * 0.45;
      }
      let px = x;
      let py = headY + y;
      let pz = z;
      // Hang can chord through the face/skull — push outside
      if (iy >= bowlRows) {
        const safe = keepOutside(safeL, new THREE.Vector3(px, py, pz), mix(0.08, 0.05, (iy - bowlRows + 1) / hangRows));
        px = safe.x;
        py = safe.y;
        pz = safe.z;
      }
      pos.push(px, py, pz);
      uvs.push(u, v);
    }
  }

  for (let iy = 0; iy < totalRows - 1; iy++) {
    for (let ix = 0; ix < cols - 1; ix++) {
      const a = iy * cols + ix;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.skinBone = "head";
  return mesh;
}

function ribbon(mat, pts, w0, w1, name, g, skullL = null) {
  if (pts.length < 2) return;
  const safePts = keepCurveOutside(skullL || _skullL || { headY: 0, R: 0.06 }, pts, 0.06);
  const pos = [];
  const uvs = [];
  const idx = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < safePts.length; i++) {
    const t = i / (safePts.length - 1);
    const w = mix(w0, w1, t) * 0.5;
    const p = safePts[i];
    const prev = safePts[Math.max(0, i - 1)];
    const next = safePts[Math.min(safePts.length - 1, i + 1)];
    const tan = next.clone().sub(prev).normalize();
    let side = new THREE.Vector3().crossVectors(tan, up);
    if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
    side.normalize();
    pos.push(p.x - side.x * w, p.y - side.y * w, p.z - side.z * w);
    pos.push(p.x + side.x * w, p.y + side.y * w, p.z + side.z * w);
    uvs.push(0, t, 1, t);
    if (i < safePts.length - 1) {
      const i0 = i * 2;
      idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.castShadow = true;
  m.userData.skinBone = "head";
  g.add(m);
}

function addExtras(g, mat, extras, L, radius) {
  if (!extras) return;
  const list = Array.isArray(extras) ? extras : [extras];
  for (const ex of list) addExtraKind(g, mat, ex, L, radius);
}

function addExtraKind(g, mat, extras, L, radius) {
  if (!extras?.kind) return;
  const R = L.R;
  const kind = extras.kind;
  const len = extras.len ?? R;

  const onPhi = (phi, elevFrac, lift = 0) => {
    // elevFrac 0 = eye band-ish, 1 = crown tip on bowl
    const theta = mix(THETA_FULL * 0.85, 0.05, elevFrac);
    const rr = radius * Math.sin(theta) + lift;
    return new THREE.Vector3(
      -Math.cos(phi) * rr,
      L.headY + radius * Math.cos(theta) + lift * 0.3,
      Math.sin(phi) * rr
    );
  };

  if (kind === "pony" || kind === "braid") {
    const top = onPhi(Math.PI, 0.85, R * 0.02);
    const pts = [top];
    const n = kind === "braid" ? 7 : 5;
    for (let i = 1; i < n; i++) {
      const t = i / (n - 1);
      const wave = kind === "braid" ? Math.sin(t * 10) * R * 0.04 : Math.sin(t * 3) * R * 0.03;
      pts.push(new THREE.Vector3(wave, top.y - len * t, top.z - R * 0.08 * t));
    }
    if (kind === "braid") {
      ribbon(mat, pts, R * 0.1, R * 0.06, "braid", g);
      ribbon(
        mat,
        pts.map((p, i) => p.clone().add(new THREE.Vector3(Math.sin(i) * R * 0.03, 0, 0))),
        R * 0.08,
        R * 0.05,
        "braid",
        g
      );
    } else {
      ribbon(mat, pts, R * 0.14, R * 0.08, "pony", g);
    }
  } else if (kind === "sidePony") {
    const side = extras.side >= 0 ? 1 : -1;
    const phi = Math.PI / 2 + side * (Math.PI / 2 + 0.35);
    const top = onPhi(phi, 0.75, R * 0.02);
    const pts = [top];
    for (let i = 1; i < 5; i++) {
      const t = i / 4;
      pts.push(new THREE.Vector3(top.x + side * R * 0.05 * t, top.y - len * t, top.z - R * 0.06 * t));
    }
    ribbon(mat, pts, R * 0.12, R * 0.07, "sidePony", g);
  } else if (kind === "twins" || kind === "pigs") {
    for (const side of [-1, 1]) {
      const phi = Math.PI / 2 + side * (Math.PI / 2 + 0.2);
      const top = onPhi(phi, 0.72, R * 0.02);
      const pts = [top];
      for (let i = 1; i < 5; i++) {
        const t = i / 4;
        pts.push(new THREE.Vector3(top.x * (1 + 0.05 * t), top.y - len * t, top.z - R * 0.05 * t));
      }
      ribbon(mat, pts, R * 0.1, R * 0.06, kind, g);
    }
  } else if (kind === "bun" || kind === "odango") {
    const size = extras.size ?? R * 0.25;
    const sides = kind === "odango" ? [-1, 1] : [0];
    for (const side of sides) {
      const phi = side === 0 ? Math.PI : Math.PI / 2 + side * (Math.PI / 2 + 0.25);
      const c =
        side === 0
          ? onPhi(phi, 0.95, size * 0.35)
          : new THREE.Vector3(side * R * 0.55, L.headY + R * 0.55, -R * 0.05);
      for (let k = 0; k < 2; k++) {
        const pts = [];
        for (let i = 0; i < 5; i++) {
          const a = (i / 4) * Math.PI * 2 + k * 1.1;
          pts.push(
            new THREE.Vector3(
              c.x + Math.cos(a) * size * 0.55,
              c.y + Math.sin(a) * size * 0.4,
              c.z + Math.sin(a * 2) * size * 0.2
            )
          );
        }
        ribbon(mat, pts, size * 0.7, size * 0.45, kind, g);
      }
    }
  } else if (kind === "pompadour") {
    // Volume swept up from forehead toward crown-front
    const root = onPhi(Math.PI / 2, 0.35, R * 0.02);
    const tip = onPhi(Math.PI / 2, 0.95, len * 0.55);
    const mid = new THREE.Vector3(
      (root.x + tip.x) * 0.5,
      mix(root.y, tip.y, 0.55) + len * 0.25,
      mix(root.z, tip.z, 0.4) + R * 0.12
    );
    ribbon(mat, [root, mid, tip], R * 0.28, R * 0.12, "pompadour", g);
    ribbon(
      mat,
      [
        root.clone().add(new THREE.Vector3(-R * 0.08, 0, 0)),
        mid.clone().add(new THREE.Vector3(-R * 0.06, len * 0.05, R * 0.02)),
        tip.clone().add(new THREE.Vector3(-R * 0.04, 0, 0)),
      ],
      R * 0.18,
      R * 0.08,
      "pompadour",
      g
    );
    ribbon(
      mat,
      [
        root.clone().add(new THREE.Vector3(R * 0.08, 0, 0)),
        mid.clone().add(new THREE.Vector3(R * 0.06, len * 0.05, R * 0.02)),
        tip.clone().add(new THREE.Vector3(R * 0.04, 0, 0)),
      ],
      R * 0.18,
      R * 0.08,
      "pompadour",
      g
    );
  } else if (kind === "quiff") {
    const root = onPhi(Math.PI / 2, 0.4, R * 0.02);
    const tip = new THREE.Vector3(0, L.skullTop + len * 0.35, radius * 0.35);
    const mid = new THREE.Vector3(R * 0.02, mix(root.y, tip.y, 0.5) + len * 0.1, mix(root.z, tip.z, 0.55));
    ribbon(mat, [root, mid, tip], R * 0.2, R * 0.08, "quiff", g);
    ribbon(
      mat,
      [
        root.clone().add(new THREE.Vector3(-R * 0.06, 0, 0)),
        mid.clone().add(new THREE.Vector3(-R * 0.04, 0, 0)),
        tip.clone().add(new THREE.Vector3(-R * 0.03, -len * 0.05, 0)),
      ],
      R * 0.12,
      R * 0.05,
      "quiff",
      g
    );
  } else if (kind === "spikes") {
    // 5–6 large anime spikes: wide base → sharp tip, mostly front/top
    const H = len || R * 0.95;
    const spikes = [
      { phi: Math.PI * 0.5, elev: 0.38, h: 1.15, leanZ: 0.65, leanX: 0, w: 1.05 },
      { phi: Math.PI * 0.5 - 0.4, elev: 0.46, h: 1.0, leanZ: 0.48, leanX: -0.22, w: 0.92 },
      { phi: Math.PI * 0.5 + 0.4, elev: 0.46, h: 1.0, leanZ: 0.48, leanX: 0.22, w: 0.92 },
      { phi: Math.PI * 0.5 - 0.82, elev: 0.55, h: 0.82, leanZ: 0.22, leanX: -0.4, w: 0.75 },
      { phi: Math.PI * 0.5 + 0.82, elev: 0.55, h: 0.82, leanZ: 0.22, leanX: 0.4, w: 0.75 },
      { phi: Math.PI, elev: 0.7, h: 0.75, leanZ: -0.28, leanX: 0, w: 0.8 },
    ];
    for (const s of spikes) {
      const root = onPhi(s.phi, s.elev, R * 0.02);
      const mid = root.clone().add(
        new THREE.Vector3(s.leanX * R * 0.25, H * s.h * 0.45, s.leanZ * R * 0.45)
      );
      const tip = root.clone().add(
        new THREE.Vector3(s.leanX * R * 0.55, H * s.h, s.leanZ * R * 0.85)
      );
      const w0 = R * 0.28 * s.w;
      ribbon(mat, [root, mid, tip], w0, w0 * 0.06, "spike", g);
      // slight second card for thickness
      ribbon(
        mat,
        [
          root.clone().add(new THREE.Vector3(0, 0, R * 0.01)),
          mid.clone().add(new THREE.Vector3(s.leanX * R * 0.04, H * 0.02, 0)),
          tip.clone().add(new THREE.Vector3(0, -H * 0.02, 0)),
        ],
        w0 * 0.7,
        w0 * 0.05,
        "spike",
        g
      );
    }
  } else if (kind === "afro") {
    const size = extras.size ?? R * 0.5;
    const c = new THREE.Vector3(0, L.headY + R * 0.35, -R * 0.05);
    for (let k = 0; k < 6; k++) {
      const pts = [];
      const yaw = (k / 6) * Math.PI * 2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 5) * Math.PI;
        pts.push(
          new THREE.Vector3(
            c.x + Math.cos(yaw) * Math.sin(a) * size,
            c.y + Math.cos(a) * size * 0.85 + size * 0.15,
            c.z + Math.sin(yaw) * Math.sin(a) * size * 0.9
          )
        );
      }
      ribbon(mat, pts, size * 0.55, size * 0.4, "afro", g);
    }
  } else if (kind === "bobVolume") {
    // Rounded bob silhouette: crown lift + side cheek puffs + back nape shell
    const size = extras.size ?? R * 0.34;
    for (let k = 0; k < 5; k++) {
      const t = k / 4;
      const phi = mix(-0.9, 0.9, t) + Math.PI * 0.5;
      const root = onPhi(phi, 0.78, R * 0.02);
      const mid = onPhi(phi, 0.95, size * 0.55);
      mid.y += size * 0.22;
      const tip = onPhi(phi, 0.88, size * 0.2);
      tip.y += size * 0.08;
      ribbon(mat, [root, mid, tip], size * 0.55, size * 0.28, "bobCrown", g);
    }
    for (const side of [-1, 1]) {
      const c = new THREE.Vector3(side * R * 0.58, mix(L.eyeY, L.chinY, 0.45), R * 0.02);
      for (let k = 0; k < 4; k++) {
        const pts = [];
        for (let i = 0; i < 6; i++) {
          const a = mix(-0.7, 1.25, i / 5) + k * 0.1;
          pts.push(
            new THREE.Vector3(
              c.x + side * Math.sin(a) * size * (1.05 + k * 0.07),
              c.y + Math.cos(a) * size * 0.85,
              c.z + Math.cos(a * 0.65) * size * 0.45 - k * R * 0.015
            )
          );
        }
        ribbon(mat, pts, size * (0.9 - k * 0.08), size * 0.5, "bobSide", g);
      }
    }
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const phi = Math.PI + mix(-0.55, 0.55, t);
      const root = onPhi(phi, 0.7, R * 0.02);
      const tip = new THREE.Vector3(root.x * 1.12, mix(root.y, L.chinY, 0.85), root.z - size * 0.35);
      const mid = new THREE.Vector3(
        mix(root.x, tip.x, 0.5),
        mix(root.y, tip.y, 0.45) - size * 0.05,
        mix(root.z, tip.z, 0.5)
      );
      ribbon(mat, [root, mid, tip], size * 0.5, size * 0.28, "bobNape", g);
    }
  } else if (kind === "crownVolume") {
    const size = extras.size ?? R * 0.18;
    const lift = extras.lift ?? 0.5;
    const sheets = extras.sheets ?? 6;
    for (let k = 0; k < sheets; k++) {
      const t = k / sheets;
      const phi = Math.PI * 2 * t + 0.15;
      const root = onPhi(phi, 0.55 + lift * 0.2, R * 0.01);
      const crest = onPhi(phi, 0.92, size * (0.7 + lift * 0.4));
      crest.y += size * (0.15 + lift * 0.25);
      const tip = onPhi(phi + 0.08, 0.75, size * 0.15);
      tip.y += size * 0.05;
      ribbon(mat, [root, crest, tip], size * 0.7, size * 0.25, "crownVolume", g);
    }
  } else if (kind === "capeVolume") {
    // Back/side volume sheets — not more bowl slices
    const fall = extras.len ?? L.toShoulder;
    const width = extras.width ?? R * 0.4;
    const wave = extras.wave ?? 0.12;
    const thick = extras.thick ?? 1;
    const sheets = Math.max(5, Math.round(6 * thick));
    for (let i = 0; i < sheets; i++) {
      const t = i / (sheets - 1);
      const phi = Math.PI + mix(-0.95, 0.95, t);
      const root = onPhi(phi, 0.72, R * 0.03);
      const pts = [root];
      for (let r = 1; r <= 6; r++) {
        const u = r / 6;
        const sway = Math.sin(u * Math.PI * (1.5 + wave * 2) + i) * wave * R * 0.3;
        pts.push(
          new THREE.Vector3(
            root.x * (1 + u * 0.12 * thick) + sway,
            root.y - fall * u,
            root.z - R * 0.12 * u * thick
          )
        );
      }
      ribbon(mat, pts, width * (0.75 + t * 0.25) * thick, width * 0.5 * thick, "capeVolume", g);
    }
  } else if (kind === "himeSides") {
    // Extra-thick straight cheek locks for hime
    const fall = extras.len ?? L.toChest;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const phi = side * (Math.PI * 0.5 + 0.12 + i * 0.11);
        const root = onPhi(phi, 0.52, R * 0.04);
        root.x += side * R * 0.06;
        root.z += R * 0.05;
        const pts = [root];
        for (let r = 1; r <= 6; r++) {
          const u = r / 6;
          pts.push(new THREE.Vector3(root.x + side * R * 0.04 * u, root.y - fall * u, root.z));
        }
        ribbon(mat, pts, R * 0.2, R * 0.12, "himeSide", g);
      }
    }
  } else if (kind === "tufts") {
    const n = extras.count ?? 6;
    const h = extras.len ?? R * 0.25;
    for (let i = 0; i < n; i++) {
      const phi = Math.PI * 2 * (i / n) + 0.3;
      const root = onPhi(phi, 0.7 + hash01(i, 4) * 0.25, R * 0.02);
      const tip = root.clone().add(
        new THREE.Vector3(-Math.cos(phi) * R * 0.06, h * (0.6 + hash01(i, 5) * 0.6), Math.sin(phi) * R * 0.06)
      );
      ribbon(mat, [root, tip], R * 0.09, R * 0.03, "tuft", g);
    }
  }
}

/**
 * JUSTSIDES — temple/cheek locks only (L+R). Not bowl slices.
 * Frames the face for bob / hime / long / princess / etc.
 */
function addJustSides(g, mat, cfg, L, radius) {
  if (!cfg || !(cfg.len > 1e-4)) return;
  const R = L.R;
  const cards = Math.max(1, Math.round(cfg.cards ?? 3));
  const len = cfg.len;
  const wave = cfg.wave ?? 0.1;
  const width = cfg.width ?? R * 0.12;
  const sg = new THREE.Group();
  sg.name = "hair-justSides";

  for (const side of [-1, 1]) {
    for (let i = 0; i < cards; i++) {
      const u = cards === 1 ? 0.5 : i / (cards - 1);
      // Pure side band: around ±X, slightly forward so it reads beside the face
      const phi = side * (Math.PI * 0.5 + mix(0.08, 0.42, u));
      const elev = mix(0.62, 0.42, u); // temple → slightly lower root
      const theta = mix(THETA_FULL * 0.15, THETA_FULL * 0.75, 1 - elev);
      const rootR = radius * Math.sin(theta) + R * 0.02;
      const root = new THREE.Vector3(
        -Math.cos(phi) * rootR,
        L.headY + radius * Math.cos(theta),
        Math.sin(phi) * rootR
      );
      // Pull slightly outward + a bit forward so locks clear the cheek
      root.x += side * R * 0.04;
      root.z += R * 0.03;

      const pts = [root];
      const rows = Math.max(4, 3 + Math.ceil(wave * 4));
      for (let r = 1; r <= rows; r++) {
        const t = r / rows;
        const sway = Math.sin(t * Math.PI * (1.2 + wave * 2.5) + i + side) * wave * R * 0.18;
        const flare = t * R * 0.06;
        pts.push(
          new THREE.Vector3(
            root.x + side * flare + sway * 0.35,
            root.y - len * t,
            root.z - R * 0.02 * t + Math.cos(t * Math.PI) * wave * R * 0.04
          )
        );
      }
      const safe = keepCurveOutside(L, pts, 0.07);
      const w0 = width * (0.85 + hash01(i + side * 17, 2) * 0.3);
      ribbon(mat, safe, w0, w0 * 0.7, "justSide", sg);
    }
  }
  if (sg.children.length) g.add(sg);
}

export function buildSmoothHair(mat, opts = {}) {
  const style = opts.style || "short";
  if (style === "bald") return null;

  const L = hairLayout(opts);
  const prevSkull = _skullL;
  _skullL = L;
  try {
    const macro = styleMacro(style, L);
    const bowlScale = macro.bowlScale ?? 1.1;
    const radius = Math.max(L.R, L.W, L.D) * bowlScale;

    const cardMat = mat.clone();
    cardMat.side = THREE.DoubleSide;

    const g = new THREE.Group();
    g.name = "hair";
    g.userData.meshMethod = "bowl-48-cover+ext";
    g.userData.hairStyle = style;

    const perRegion = SLICES / 4;
    const frontStart = Math.PI / 2 - SLICE * (perRegion * 0.5);
    const groups = [
      { name: "front", start: frontStart, cfg: macro.front },
      { name: "right", start: frontStart + SLICE * perRegion, cfg: macro.right },
      { name: "back", start: frontStart + SLICE * perRegion * 2, cfg: macro.back },
      { name: "left", start: frontStart + SLICE * perRegion * 3, cfg: macro.left },
    ];

    let globalI = 0;
    for (const grp of groups) {
      const sg = new THREE.Group();
      sg.name = `hair-${grp.name}`;
      const wave = grp.cfg?.wave ?? 0;
      for (let i = 0; i < perRegion; i++) {
        const phi0 = grp.start + i * SLICE - SEAL * 0.5;
        const phiLen = SLICE + SEAL;
        const cover = sliceCover(grp.cfg, i, globalI);
        const hang = sliceHangLength(grp.cfg, i, globalI);
        sg.add(
          makeExtendedSlice(
            cardMat,
            phi0,
            phiLen,
            radius,
            L.headY,
            cover,
            hang,
            wave,
            globalI,
            `slice-${grp.name}-${i}`,
            L
          )
        );
        globalI++;
      }
      g.add(sg);
    }

    addExtras(g, cardMat, macro.extras, L, radius);
    addJustSides(g, cardMat, macro.justSides, L, radius);
    return g;
  } finally {
    _skullL = prevSkull;
  }
}

export function probeHairCrown(opts = {}) {
  const style = opts.style || "short";
  const L = hairLayout(opts);
  if (style === "bald") {
    return { topY: L.skullTop, radius: Math.max(L.W, L.D) * 0.55, skullTop: L.skullTop };
  }
  const macro = styleMacro(style, L);
  const bowlScale = macro.bowlScale ?? 1.1;
  const radius = Math.max(L.R, L.W, L.D) * bowlScale;
  let topY = L.headY + radius * 0.98;
  const extrasList = !macro.extras ? [] : Array.isArray(macro.extras) ? macro.extras : [macro.extras];
  for (const ex of extrasList) {
    if (ex.kind === "bun") topY += (ex.size ?? L.R * 0.28) * 0.9;
    if (ex.kind === "afro") topY += (ex.size ?? L.R * 0.5) * 0.7;
    if (ex.kind === "pompadour" || ex.kind === "quiff") topY += (ex.len ?? L.R * 0.4) * 0.5;
    if (ex.kind === "spikes") topY += (ex.len ?? L.R * 0.3) * 0.6;
    if (ex.kind === "crownVolume" || ex.kind === "bobVolume") topY += (ex.size ?? L.R * 0.18) * 0.55;
  }
  return { topY, radius: radius * 0.95, skullTop: L.skullTop };
}

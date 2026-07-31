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
 * Front bangs are capped above the eyes.
 * Shape knobs (flare / peel / curl / tipTaper / waveFreq) give each style a readable silhouette.
 */
function styleMacro(style, L) {
  const R = L.R;
  const { hangTo, chinY, shoulderY, chestY, waistY, eyeY } = L;
  const browClear = eyeY + R * 0.38;

  const sh = (o = {}) => ({
    flare: o.flare ?? 0.045,
    peel: o.peel ?? 0,
    curl: o.curl ?? 0,
    curlFreq: o.curlFreq ?? 3.2,
    tipTaper: o.tipTaper ?? 0.12,
    waveFreq: o.waveFreq ?? 1.4,
    // Non-bowl crown: peak lifts apex, flat squashes top, sideBulge fattens temples
    crownPeak: o.crownPeak ?? 0,
    crownFlat: o.crownFlat ?? 0,
    sideBulge: o.sideBulge ?? 0,
  });
  const reg = (len, wave, vary, cover, coverVary, shape = {}) => ({
    len,
    wave,
    vary,
    cover,
    coverVary,
    ...sh(shape),
  });
  const all = (len, wave = 0, vary = 0.15, cover = 1, coverVary = 0.06, shape = {}) => ({
    front: reg(len, wave, vary, cover, coverVary, shape),
    right: reg(len, wave, vary, cover, coverVary, shape),
    back: reg(len, wave, vary, cover, coverVary, shape),
    left: reg(len, wave, vary, cover, coverVary, shape),
  });
  const sides = (len, wave = 0.1, cards = 3, width = R * 0.14) => ({
    cards,
    len,
    wave,
    width,
  });
  /**
   * Front fringe. shape.part: "mid" | "sideL" | "sideR" | "none"
   * shape.feel: "tidy" | "fluffy" | "curtain" (affects coverVary / hang falloff)
   */
  const fringe = (wave = 0.05, vary = 0.06, cover = 0.42, shape = {}) => {
    const feel = shape.feel || "tidy";
    const coverVary = feel === "fluffy" ? 0.12 : feel === "curtain" ? 0.06 : 0.025;
    const hangVary = feel === "fluffy" ? Math.min(vary * 1.4, 0.28) : Math.min(vary, 0.16);
    return {
      ...reg(hangTo(browClear, cover), wave, hangVary, cover, coverVary, shape),
      part: shape.part || "none",
      feel,
    };
  };

  switch (style) {
    case "buzz":
      return {
        ...all(0, 0, 0, 0.18, 0.02, { flare: 0.02, tipTaper: 0, crownFlat: 0.08 }),
        bowlScale: 1.01,
        extras: { kind: "crownVolume", size: R * 0.06, lift: 0.12, sheets: 3, bias: "flat" },
      };
    case "crew":
      return {
        front: fringe(0.02, 0.04, 0.26, { flare: 0.02, feel: "tidy", part: "none", crownFlat: 0.06 }),
        right: reg(hangTo(mix(eyeY, chinY, 0.25), 0.38), 0, 0.08, 0.38, 0.04, { flare: 0.02, tipTaper: 0.2, crownFlat: 0.05 }),
        back: reg(hangTo(mix(eyeY, chinY, 0.4), 0.46), 0, 0.08, 0.46, 0.04, { flare: 0.02, tipTaper: 0.2, crownFlat: 0.04 }),
        left: reg(hangTo(mix(eyeY, chinY, 0.25), 0.38), 0, 0.08, 0.38, 0.04, { flare: 0.02, tipTaper: 0.2, crownFlat: 0.05 }),
        bowlScale: 1.03,
        extras: [
          { kind: "crownVolume", size: R * 0.1, lift: 0.2, sheets: 5, bias: "flat" },
          { kind: "tufts", count: 4, len: R * 0.12 },
        ],
      };
    case "short":
      return {
        front: fringe(0.14, 0.12, 0.4, { flare: 0.05, peel: 0.04, feel: "fluffy", part: "sideL", crownPeak: 0.12, sideBulge: 0.08 }),
        right: reg(hangTo(mix(eyeY, chinY, 0.5), 0.55), 0.14, 0.2, 0.55, 0.08, { flare: 0.07, peel: 0.05, crownPeak: 0.1, sideBulge: 0.1 }),
        back: reg(hangTo(mix(eyeY, chinY, 0.6), 0.62), 0.16, 0.22, 0.62, 0.08, { flare: 0.08, peel: 0.05, crownPeak: 0.08, sideBulge: 0.06 }),
        left: reg(hangTo(mix(eyeY, chinY, 0.5), 0.55), 0.14, 0.2, 0.55, 0.08, { flare: 0.07, peel: 0.05, crownPeak: 0.1, sideBulge: 0.1 }),
        justSides: sides(hangTo(mix(eyeY, chinY, 0.45), 0.5), 0.12, 3, R * 0.12),
        bowlScale: 1.06,
        extras: [
          { kind: "crownVolume", size: R * 0.16, lift: 0.48, sheets: 7, bias: "peak" },
          { kind: "tufts", count: 5, len: R * 0.2 },
        ],
      };
    case "messy":
      return {
        front: fringe(0.5, 0.38, 0.5, {
          flare: 0.12, peel: 0.1, curl: 0.4, curlFreq: 4.5, waveFreq: 2.2,
          feel: "fluffy", part: "sideR", crownPeak: 0.22, sideBulge: 0.14,
        }),
        right: reg(hangTo(mix(eyeY, chinY, 0.6), 0.55), 0.65, 0.5, 0.55, 0.3, {
          flare: 0.14, peel: 0.12, curl: 0.45, curlFreq: 5, tipTaper: 0.05, waveFreq: 2.4,
          crownPeak: 0.18, sideBulge: 0.12,
        }),
        back: reg(hangTo(mix(eyeY, chinY, 0.75), 0.62), 0.7, 0.55, 0.62, 0.3, {
          flare: 0.16, peel: 0.12, curl: 0.5, curlFreq: 5.2, tipTaper: 0.05, waveFreq: 2.6,
          crownPeak: 0.16, sideBulge: 0.1,
        }),
        left: reg(hangTo(mix(eyeY, chinY, 0.6), 0.55), 0.65, 0.5, 0.55, 0.3, {
          flare: 0.14, peel: 0.12, curl: 0.45, curlFreq: 5, tipTaper: 0.05, waveFreq: 2.4,
          crownPeak: 0.18, sideBulge: 0.12,
        }),
        justSides: sides(hangTo(mix(eyeY, chinY, 0.55), 0.5), 0.55, 3, R * 0.15),
        bowlScale: 1.08,
        extras: [
          { kind: "tufts", count: 10, len: R * 0.34 },
          { kind: "crownVolume", size: R * 0.24, lift: 0.65, sheets: 9, bias: "messy" },
        ],
      };
    case "spiky":
      return {
        front: fringe(0.05, 0.08, 0.28, { flare: 0.02, feel: "tidy", part: "none", crownPeak: 0.28 }),
        right: reg(hangTo(mix(eyeY, chinY, 0.15), 0.3), 0.02, 0.08, 0.3, 0.05, { flare: 0.02, tipTaper: 0.35, crownPeak: 0.2 }),
        back: reg(hangTo(mix(eyeY, chinY, 0.18), 0.32), 0.02, 0.08, 0.32, 0.05, { flare: 0.02, tipTaper: 0.35, crownPeak: 0.18 }),
        left: reg(hangTo(mix(eyeY, chinY, 0.15), 0.3), 0.02, 0.08, 0.3, 0.05, { flare: 0.02, tipTaper: 0.35, crownPeak: 0.2 }),
        bowlScale: 1.04,
        extras: { kind: "spikes", len: R * 1.05 },
      };
    case "quiff":
      return {
        front: fringe(0.08, 0.08, 0.34, { flare: 0.04, peel: 0.08, feel: "tidy", part: "sideL", crownPeak: 0.32 }),
        right: reg(hangTo(mix(eyeY, chinY, 0.4), 0.5), 0.06, 0.1, 0.5, 0.06, { flare: 0.04, tipTaper: 0.22, crownPeak: 0.15 }),
        back: reg(hangTo(mix(eyeY, chinY, 0.5), 0.55), 0.06, 0.1, 0.55, 0.06, { flare: 0.04, tipTaper: 0.22, crownPeak: 0.1 }),
        left: reg(hangTo(mix(eyeY, chinY, 0.4), 0.5), 0.06, 0.1, 0.5, 0.06, { flare: 0.04, tipTaper: 0.22, crownPeak: 0.2, sideBulge: 0.08 }),
        bowlScale: 1.05,
        extras: { kind: "quiff", len: R * 0.58 },
      };
    case "pompadour":
      return {
        front: fringe(0.04, 0.05, 0.3, { flare: 0.03, feel: "tidy", part: "none", crownPeak: 0.4 }),
        right: reg(hangTo(mix(eyeY, chinY, 0.4), 0.52), 0.04, 0.08, 0.52, 0.05, { flare: 0.03, tipTaper: 0.25, crownPeak: 0.22 }),
        back: reg(hangTo(mix(eyeY, chinY, 0.5), 0.58), 0.04, 0.08, 0.58, 0.05, { flare: 0.03, tipTaper: 0.25, crownPeak: 0.12 }),
        left: reg(hangTo(mix(eyeY, chinY, 0.4), 0.52), 0.04, 0.08, 0.52, 0.05, { flare: 0.03, tipTaper: 0.25, crownPeak: 0.22 }),
        bowlScale: 1.05,
        extras: { kind: "pompadour", len: R * 0.68 },
      };
    case "bob":
      return {
        front: fringe(0.02, 0.03, 0.52, { flare: 0.02, tipTaper: 0.02, feel: "tidy", part: "mid", crownFlat: 0.04, sideBulge: 0.16 }),
        right: reg(hangTo(chinY, 0.92), 0.02, 0.04, 0.92, 0.02, { flare: 0.03, peel: 0.06, tipTaper: 0.02, sideBulge: 0.18, crownFlat: 0.03 }),
        back: reg(hangTo(chinY, 0.95), 0.02, 0.04, 0.95, 0.02, { flare: 0.03, peel: 0.07, tipTaper: 0.02, sideBulge: 0.14, crownFlat: 0.02 }),
        left: reg(hangTo(chinY, 0.92), 0.02, 0.04, 0.92, 0.02, { flare: 0.03, peel: 0.06, tipTaper: 0.02, sideBulge: 0.18, crownFlat: 0.03 }),
        justSides: sides(hangTo(chinY, 0.9), 0.02, 4, R * 0.18),
        bowlScale: 1.1,
        extras: { kind: "bobVolume", size: R * 0.42 },
      };
    case "shoulder":
      return {
        front: fringe(0.14, 0.1, 0.5, {
          flare: 0.06, peel: 0.05, curl: 0.08, feel: "curtain", part: "sideL",
          crownPeak: 0.1, sideBulge: 0.1,
        }),
        right: reg(hangTo(shoulderY, 0.96), 0.22, 0.14, 0.96, 0.04, {
          flare: 0.08, peel: 0.08, curl: 0.12, curlFreq: 2.4, tipTaper: 0.1, crownPeak: 0.08, sideBulge: 0.1,
        }),
        back: reg(hangTo(shoulderY, 0.98), 0.2, 0.14, 0.98, 0.04, {
          flare: 0.09, peel: 0.08, curl: 0.1, curlFreq: 2.2, crownPeak: 0.06, sideBulge: 0.08,
        }),
        left: reg(hangTo(shoulderY, 0.96), 0.22, 0.14, 0.96, 0.04, {
          flare: 0.08, peel: 0.08, curl: 0.12, curlFreq: 2.4, crownPeak: 0.08, sideBulge: 0.1,
        }),
        justSides: sides(hangTo(shoulderY, 0.9), 0.18, 4, R * 0.17),
        bowlScale: 1.08,
        extras: [
          { kind: "bobVolume", size: R * 0.3 },
          { kind: "capeVolume", len: hangTo(shoulderY, 0.85), width: R * 0.38, thick: 1.05 },
          { kind: "crownVolume", size: R * 0.14, lift: 0.35, sheets: 5, bias: "peak" },
        ],
      };
    case "long":
      return {
        front: fringe(0.1, 0.1, 0.52, {
          flare: 0.05, peel: 0.04, feel: "curtain", part: "mid", crownPeak: 0.08, sideBulge: 0.08,
        }),
        right: reg(hangTo(chestY, 1), 0.16, 0.12, 1, 0.03, {
          flare: 0.06, peel: 0.1, tipTaper: 0.08, waveFreq: 1.2, crownPeak: 0.06, sideBulge: 0.08,
        }),
        back: reg(hangTo(chestY, 1), 0.14, 0.12, 1, 0.03, {
          flare: 0.07, peel: 0.12, tipTaper: 0.08, waveFreq: 1.15, crownPeak: 0.05, sideBulge: 0.06,
        }),
        left: reg(hangTo(chestY, 1), 0.16, 0.12, 1, 0.03, {
          flare: 0.06, peel: 0.1, tipTaper: 0.08, waveFreq: 1.2, crownPeak: 0.06, sideBulge: 0.08,
        }),
        justSides: sides(hangTo(chestY, 0.92), 0.14, 5, R * 0.16),
        bowlScale: 1.09,
        extras: [
          { kind: "bobVolume", size: R * 0.24 },
          { kind: "capeVolume", len: hangTo(chestY, 0.82), width: R * 0.5, thick: 1.3 },
          { kind: "crownVolume", size: R * 0.12, lift: 0.3, sheets: 5, bias: "peak" },
        ],
      };
    case "wavy":
      return {
        front: fringe(0.55, 0.22, 0.52, {
          flare: 0.1, peel: 0.08, curl: 0.55, curlFreq: 3.6, waveFreq: 2.0,
          feel: "fluffy", part: "sideR", crownPeak: 0.14, sideBulge: 0.12,
        }),
        right: reg(hangTo(chestY, 1), 0.85, 0.25, 1, 0.05, {
          flare: 0.12, peel: 0.14, curl: 0.7, curlFreq: 4.0, tipTaper: 0.06, waveFreq: 2.1,
          crownPeak: 0.12, sideBulge: 0.12,
        }),
        back: reg(hangTo(chestY, 1), 0.85, 0.25, 1, 0.05, {
          flare: 0.13, peel: 0.14, curl: 0.72, curlFreq: 3.8, tipTaper: 0.06, waveFreq: 2.0,
          crownPeak: 0.1, sideBulge: 0.1,
        }),
        left: reg(hangTo(chestY, 1), 0.85, 0.25, 1, 0.05, {
          flare: 0.12, peel: 0.14, curl: 0.7, curlFreq: 4.0, tipTaper: 0.06, waveFreq: 2.1,
          crownPeak: 0.12, sideBulge: 0.12,
        }),
        justSides: sides(hangTo(chestY, 0.9), 0.75, 5, R * 0.18),
        bowlScale: 1.1,
        extras: [
          { kind: "bobVolume", size: R * 0.28 },
          { kind: "capeVolume", len: hangTo(chestY, 0.8), width: R * 0.48, wave: 0.7, thick: 1.25 },
          { kind: "crownVolume", size: R * 0.16, lift: 0.4, sheets: 7, bias: "messy" },
        ],
      };
    case "princess":
      return {
        front: fringe(0.16, 0.12, 0.5, {
          flare: 0.06, peel: 0.05, curl: 0.15, feel: "curtain", part: "mid", crownPeak: 0.1, sideBulge: 0.1,
        }),
        right: reg(hangTo(waistY, 1), 0.28, 0.16, 1, 0.03, {
          flare: 0.07, peel: 0.16, curl: 0.2, curlFreq: 2.6, tipTaper: 0.05, crownPeak: 0.08, sideBulge: 0.1,
        }),
        back: reg(hangTo(waistY, 1), 0.24, 0.16, 1, 0.03, {
          flare: 0.08, peel: 0.18, curl: 0.18, curlFreq: 2.4, tipTaper: 0.05, crownPeak: 0.06, sideBulge: 0.08,
        }),
        left: reg(hangTo(waistY, 1), 0.28, 0.16, 1, 0.03, {
          flare: 0.07, peel: 0.16, curl: 0.2, curlFreq: 2.6, tipTaper: 0.05, crownPeak: 0.08, sideBulge: 0.1,
        }),
        justSides: sides(hangTo(waistY, 0.9), 0.22, 6, R * 0.19),
        bowlScale: 1.1,
        extras: [
          { kind: "bobVolume", size: R * 0.26 },
          { kind: "capeVolume", len: hangTo(waistY, 0.8), width: R * 0.58, thick: 1.4 },
          { kind: "crownVolume", size: R * 0.14, lift: 0.35, sheets: 6, bias: "peak" },
        ],
      };
    case "hime":
      return {
        front: fringe(0.01, 0.02, 0.56, { flare: 0.01, tipTaper: 0.01, feel: "tidy", part: "none", crownFlat: 0.05 }),
        right: reg(hangTo(chestY, 1), 0.01, 0.04, 1, 0.015, { flare: 0.02, peel: 0.04, tipTaper: 0.02, crownFlat: 0.03, sideBulge: 0.06 }),
        back: reg(hangTo(chestY, 1), 0.01, 0.04, 1, 0.015, { flare: 0.02, peel: 0.04, tipTaper: 0.02, crownFlat: 0.02 }),
        left: reg(hangTo(chestY, 1), 0.01, 0.04, 1, 0.015, { flare: 0.02, peel: 0.04, tipTaper: 0.02, crownFlat: 0.03, sideBulge: 0.06 }),
        justSides: sides(hangTo(chestY, 0.92), 0.01, 5, R * 0.22),
        bowlScale: 1.08,
        extras: { kind: "himeSides", len: hangTo(chestY, 0.88) },
      };
    case "ponytail":
      return {
        front: fringe(0.06, 0.08, 0.4, { flare: 0.03, feel: "tidy", part: "sideL", crownPeak: 0.08 }),
        right: reg(hangTo(mix(eyeY, chinY, 0.35), 0.52), 0.04, 0.08, 0.52, 0.05, { flare: 0.03, tipTaper: 0.25, crownPeak: 0.06 }),
        back: reg(hangTo(mix(eyeY, chinY, 0.25), 0.48), 0.03, 0.08, 0.48, 0.05, { flare: 0.02, tipTaper: 0.3, crownPeak: 0.05 }),
        left: reg(hangTo(mix(eyeY, chinY, 0.35), 0.52), 0.04, 0.08, 0.52, 0.05, { flare: 0.03, tipTaper: 0.25, crownPeak: 0.06 }),
        justSides: sides(hangTo(mix(eyeY, chinY, 0.35), 0.48), 0.05, 2, R * 0.1),
        bowlScale: 1.04,
        extras: [
          { kind: "crownVolume", size: R * 0.14, lift: 0.35, sheets: 6, bias: "peak" },
          { kind: "pony", len: hangTo(chestY, 0.92), thick: 1.35 },
        ],
      };
    case "side-tail":
      return {
        front: fringe(0.1, 0.1, 0.42, { flare: 0.04, feel: "curtain", part: "sideR", crownPeak: 0.1, sideBulge: 0.08 }),
        right: reg(hangTo(mix(eyeY, chinY, 0.25), 0.5), 0.05, 0.08, 0.5, 0.05, { flare: 0.03, tipTaper: 0.28, crownPeak: 0.06 }),
        back: reg(hangTo(mix(eyeY, chinY, 0.3), 0.55), 0.05, 0.08, 0.55, 0.05, { flare: 0.03, tipTaper: 0.25, crownPeak: 0.05 }),
        left: reg(hangTo(mix(eyeY, chinY, 0.45), 0.58), 0.12, 0.12, 0.58, 0.06, { flare: 0.06, peel: 0.05, curl: 0.1, sideBulge: 0.1 }),
        justSides: sides(hangTo(mix(eyeY, chinY, 0.4), 0.5), 0.12, 2, R * 0.12),
        bowlScale: 1.05,
        extras: { kind: "sidePony", side: 1, len: hangTo(chestY, 0.9), thick: 1.25 },
      };
    case "half-up":
      return {
        front: fringe(0.12, 0.1, 0.46, { flare: 0.05, peel: 0.04, feel: "fluffy", part: "mid", crownPeak: 0.16 }),
        right: reg(hangTo(shoulderY, 0.9), 0.18, 0.14, 0.9, 0.05, { flare: 0.07, peel: 0.08, curl: 0.1, crownPeak: 0.1, sideBulge: 0.08 }),
        back: reg(hangTo(shoulderY, 0.9), 0.16, 0.14, 0.9, 0.05, { flare: 0.07, peel: 0.08, curl: 0.08, crownPeak: 0.08 }),
        left: reg(hangTo(shoulderY, 0.9), 0.18, 0.14, 0.9, 0.05, { flare: 0.07, peel: 0.08, curl: 0.1, crownPeak: 0.1, sideBulge: 0.08 }),
        justSides: sides(hangTo(shoulderY, 0.85), 0.16, 3, R * 0.14),
        bowlScale: 1.06,
        extras: [
          { kind: "crownVolume", size: R * 0.18, lift: 0.5, sheets: 7, bias: "peak" },
          { kind: "pony", len: hangTo(mix(shoulderY, chestY, 0.55), 0.88), thick: 1.15 },
        ],
      };
    case "bun":
      return {
        front: fringe(0.03, 0.04, 0.34, { flare: 0.02, feel: "tidy", part: "none", crownPeak: 0.06 }),
        right: reg(hangTo(mix(eyeY, chinY, 0.22), 0.48), 0, 0.06, 0.48, 0.04, { flare: 0.02, tipTaper: 0.3 }),
        back: reg(hangTo(mix(eyeY, chinY, 0.22), 0.48), 0, 0.06, 0.48, 0.04, { flare: 0.02, tipTaper: 0.3 }),
        left: reg(hangTo(mix(eyeY, chinY, 0.22), 0.48), 0, 0.06, 0.48, 0.04, { flare: 0.02, tipTaper: 0.3 }),
        justSides: sides(hangTo(mix(eyeY, chinY, 0.28), 0.45), 0.03, 2, R * 0.09),
        bowlScale: 1.04,
        extras: { kind: "bun", size: R * 0.44 },
      };
    case "odango":
      return {
        front: fringe(0.04, 0.05, 0.36, { flare: 0.02, feel: "tidy", part: "mid", crownPeak: 0.08 }),
        right: reg(hangTo(mix(eyeY, chinY, 0.15), 0.42), 0, 0.05, 0.42, 0.03, { flare: 0.02, tipTaper: 0.32 }),
        back: reg(hangTo(mix(eyeY, chinY, 0.28), 0.52), 0.04, 0.06, 0.52, 0.04, { flare: 0.03, tipTaper: 0.25 }),
        left: reg(hangTo(mix(eyeY, chinY, 0.15), 0.42), 0, 0.05, 0.42, 0.03, { flare: 0.02, tipTaper: 0.32 }),
        justSides: sides(hangTo(mix(eyeY, chinY, 0.35), 0.48), 0.04, 2, R * 0.1),
        bowlScale: 1.04,
        extras: { kind: "odango", size: R * 0.32 },
      };
    case "twin-tails":
      return {
        front: fringe(0.12, 0.1, 0.44, { flare: 0.05, curl: 0.08, feel: "fluffy", part: "mid", crownPeak: 0.12 }),
        right: reg(hangTo(mix(eyeY, chinY, 0.35), 0.55), 0.1, 0.1, 0.55, 0.05, { flare: 0.04, tipTaper: 0.22, crownPeak: 0.08 }),
        back: reg(hangTo(mix(eyeY, chinY, 0.35), 0.55), 0.08, 0.1, 0.55, 0.05, { flare: 0.04, tipTaper: 0.22, crownPeak: 0.06 }),
        left: reg(hangTo(mix(eyeY, chinY, 0.35), 0.55), 0.1, 0.1, 0.55, 0.05, { flare: 0.04, tipTaper: 0.22, crownPeak: 0.08 }),
        justSides: sides(hangTo(mix(eyeY, chinY, 0.4), 0.5), 0.12, 2, R * 0.1),
        bowlScale: 1.05,
        extras: { kind: "twins", len: hangTo(chestY, 0.9), curl: 0.55, thick: 1.2 },
      };
    case "pigtails":
      return {
        front: fringe(0.08, 0.08, 0.4, { flare: 0.04, feel: "tidy", part: "sideL", crownPeak: 0.1 }),
        right: reg(hangTo(mix(eyeY, chinY, 0.35), 0.55), 0.08, 0.1, 0.55, 0.05, { flare: 0.04, tipTaper: 0.22, crownPeak: 0.06 }),
        back: reg(hangTo(mix(eyeY, chinY, 0.35), 0.55), 0.08, 0.1, 0.55, 0.05, { flare: 0.04, tipTaper: 0.22, crownPeak: 0.05 }),
        left: reg(hangTo(mix(eyeY, chinY, 0.35), 0.55), 0.08, 0.1, 0.55, 0.05, { flare: 0.04, tipTaper: 0.22, crownPeak: 0.06 }),
        justSides: sides(hangTo(mix(eyeY, chinY, 0.35), 0.5), 0.1, 2, R * 0.1),
        bowlScale: 1.05,
        extras: { kind: "pigs", len: hangTo(shoulderY, 0.88), thick: 1.15 },
      };
    case "braid":
      return {
        front: fringe(0.05, 0.05, 0.4, { flare: 0.03, feel: "tidy", part: "sideR", crownPeak: 0.06 }),
        right: reg(hangTo(mix(eyeY, chinY, 0.28), 0.5), 0.03, 0.06, 0.5, 0.04, { flare: 0.02, tipTaper: 0.28 }),
        back: reg(hangTo(mix(eyeY, chinY, 0.28), 0.5), 0.03, 0.06, 0.5, 0.04, { flare: 0.02, tipTaper: 0.28 }),
        left: reg(hangTo(mix(eyeY, chinY, 0.28), 0.5), 0.03, 0.06, 0.5, 0.04, { flare: 0.02, tipTaper: 0.28 }),
        justSides: sides(hangTo(mix(eyeY, chinY, 0.3), 0.48), 0.04, 2, R * 0.09),
        bowlScale: 1.04,
        extras: { kind: "braid", len: hangTo(chestY, 0.92) },
      };
    case "drills":
      return {
        front: fringe(0.5, 0.22, 0.5, {
          flare: 0.1, peel: 0.1, curl: 0.85, curlFreq: 5.5, waveFreq: 2.4,
          feel: "fluffy", part: "mid", crownPeak: 0.16, sideBulge: 0.12,
        }),
        right: reg(hangTo(shoulderY, 0.92), 0.95, 0.22, 0.92, 0.06, {
          flare: 0.14, peel: 0.16, curl: 1.05, curlFreq: 6.2, tipTaper: 0.04, waveFreq: 2.5,
          crownPeak: 0.12, sideBulge: 0.12,
        }),
        back: reg(hangTo(mix(chinY, shoulderY, 0.4), 0.84), 0.45, 0.18, 0.84, 0.08, {
          flare: 0.1, peel: 0.1, curl: 0.55, curlFreq: 4.0, crownPeak: 0.1,
        }),
        left: reg(hangTo(shoulderY, 0.92), 0.95, 0.22, 0.92, 0.06, {
          flare: 0.14, peel: 0.16, curl: 1.05, curlFreq: 6.2, tipTaper: 0.04, waveFreq: 2.5,
          crownPeak: 0.12, sideBulge: 0.12,
        }),
        justSides: sides(hangTo(shoulderY, 0.88), 0.85, 4, R * 0.17),
        bowlScale: 1.1,
        extras: [
          { kind: "drills", len: hangTo(shoulderY, 0.9), coils: 5 },
          { kind: "capeVolume", len: hangTo(shoulderY, 0.75), width: R * 0.26, wave: 0.8, thick: 0.85 },
          { kind: "crownVolume", size: R * 0.16, lift: 0.4, sheets: 6, bias: "messy" },
        ],
      };
    case "afro":
      return {
        front: fringe(0.2, 0.12, 0.28, { flare: 0.08, curl: 0.4, curlFreq: 6, feel: "fluffy", part: "none", crownPeak: 0.35, sideBulge: 0.25 }),
        right: reg(hangTo(mix(eyeY, chinY, 0.08), 0.28), 0.25, 0.12, 0.28, 0.05, {
          flare: 0.1, curl: 0.55, curlFreq: 6.5, tipTaper: 0.15, crownPeak: 0.3, sideBulge: 0.28,
        }),
        back: reg(hangTo(mix(eyeY, chinY, 0.08), 0.28), 0.25, 0.12, 0.28, 0.05, {
          flare: 0.1, curl: 0.55, curlFreq: 6.5, tipTaper: 0.15, crownPeak: 0.3, sideBulge: 0.28,
        }),
        left: reg(hangTo(mix(eyeY, chinY, 0.08), 0.28), 0.25, 0.12, 0.28, 0.05, {
          flare: 0.1, curl: 0.55, curlFreq: 6.5, tipTaper: 0.15, crownPeak: 0.3, sideBulge: 0.28,
        }),
        bowlScale: 1.14,
        extras: { kind: "afro", size: R * 0.85 },
      };
    default:
      return {
        front: fringe(0.12, 0.12, 0.48, { flare: 0.06, peel: 0.05, feel: "curtain", part: "sideL", crownPeak: 0.1, sideBulge: 0.08 }),
        right: reg(hangTo(mix(eyeY, chinY, 0.55), 0.65), 0.16, 0.14, 0.65, 0.08, { flare: 0.07, peel: 0.06, crownPeak: 0.08, sideBulge: 0.08 }),
        back: reg(hangTo(mix(eyeY, chinY, 0.6), 0.68), 0.16, 0.14, 0.68, 0.08, { flare: 0.08, peel: 0.06, crownPeak: 0.06 }),
        left: reg(hangTo(mix(eyeY, chinY, 0.55), 0.65), 0.16, 0.14, 0.65, 0.08, { flare: 0.07, peel: 0.06, crownPeak: 0.08, sideBulge: 0.08 }),
        justSides: sides(hangTo(mix(eyeY, chinY, 0.45), 0.55), 0.14, 3, R * 0.13),
        bowlScale: 1.07,
        extras: { kind: "crownVolume", size: R * 0.2, lift: 0.55, sheets: 7, bias: "peak" },
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
 * Fringe part falloff — shortens hang / trims cover near the part line.
 * part: "mid" | "sideL" | "sideR" | "none"
 * Returns { hangMul, coverMul } in 0…1.
 */
function fringePartFalloff(part, localIndex, count) {
  if (!part || part === "none" || count <= 1) return { hangMul: 1, coverMul: 1 };
  const mid = (count - 1) * 0.5;
  const partI =
    part === "mid" ? mid : part === "sideL" ? count * 0.22 : count * 0.78;
  const dist = Math.abs(localIndex - partI) / Math.max(0.5, mid);
  // Soft valley at the part; curtain styles keep more length at edges
  const valley = clamp01(1 - dist * 1.35);
  const hangMul = mix(1, 0.18, valley * valley);
  const coverMul = mix(1, 0.55, valley);
  return { hangMul, coverMul };
}

/**
 * One slice: crown → truncated rim (by cover) → optional hang.
 * Hang shape knobs (from region cfg): flare, peel, curl, curlFreq, tipTaper, waveFreq.
 */
function makeExtendedSlice(mat, phi0, phiLen, radius, headY, cover, hangLen, wave, sliceIndex, name, skullL = null, shape = {}) {
  const phiSegs = 2;
  const cols = phiSegs + 1;
  const thetaMax = mix(THETA_FULL * 0.1, THETA_FULL, cover);
  const bowlSegs = Math.max(2, Math.ceil(THETA_SEGS_FULL * cover));
  const bowlRows = bowlSegs + 1;
  const curl = Math.max(0, shape.curl ?? 0);
  const hangRows =
    hangLen > 1e-4
      ? Math.max(2, 2 + Math.ceil(4 + wave * 5 + curl * 4))
      : 0;
  const totalRows = bowlRows + hangRows;

  const rimY = radius * Math.cos(thetaMax);
  const rimR = radius * Math.sin(thetaMax);
  const phiMid = phi0 + phiLen * 0.5;
  const safeL = skullL || { headY, R: radius / 1.1 };
  const flareScale = shape.flare ?? 0.045;
  const peel = shape.peel ?? 0;
  const curlFreq = shape.curlFreq ?? 3.2;
  const tipTaper = shape.tipTaper ?? 0.12;
  const waveFreq = shape.waveFreq ?? 1.4;
  const crownPeak = shape.crownPeak ?? 0;
  const crownFlat = shape.crownFlat ?? 0;
  const sideBulge = shape.sideBulge ?? 0;

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
        // Non-spherical crown: peak lifts apex, flat squashes top, sideBulge fattens mid latitudes
        const peakLift = crownPeak * Math.pow(Math.max(0, ct), 2.4) * (1 - st * 0.35);
        const flatPush = crownFlat * Math.pow(Math.max(0, ct), 3.2);
        const bulge = sideBulge * Math.sin(theta) * Math.sin(theta) * (0.55 + 0.45 * Math.abs(Math.sin(phi)));
        const rXY = radius * (1 + bulge);
        x = -Math.cos(phi) * st * rXY;
        y = ct * radius * (1 + peakLift - flatPush);
        z = Math.sin(phi) * st * rXY;
        v = tv * 0.55;
      } else {
        const h = (iy - bowlRows + 1) / hangRows;
        const ox = -Math.cos(phi);
        const oz = Math.sin(phi);
        const tx = -Math.sin(phiMid);
        const tz = -Math.cos(phiMid);
        // Peel out from rim, then flare as length falls
        const peelOut = peel * Math.sin(Math.min(1, h * 1.6) * Math.PI * 0.5) * radius;
        const flare = h * radius * flareScale + peelOut;
        const sway =
          Math.sin(h * Math.PI * (waveFreq + wave * 3) + sliceIndex * 0.7) * wave * radius * 0.22;
        const sway2 = Math.sin(h * Math.PI * 2.2 + u * Math.PI) * wave * radius * 0.05;
        // Curl / coil around the hang axis (reads as wavy·drills·curly texture)
        const ang = h * Math.PI * curlFreq + sliceIndex * 0.35 + u;
        const cr = curl * radius * Math.sin(h * Math.PI) * (0.55 + 0.45 * h);
        const curlX = tx * Math.cos(ang) * cr + ox * Math.sin(ang) * cr * 0.35;
        const curlZ = tz * Math.cos(ang) * cr + oz * Math.sin(ang) * cr * 0.35;
        x = ox * rimR + ox * flare + tx * (sway + sway2) + curlX;
        z = oz * rimR + oz * flare + tz * (sway + sway2) + curlZ;
        y = rimY - h * hangLen;
        if (h > 0.65 && tipTaper > 0) {
          const taper = mix(1, 1 - tipTaper, (h - 0.65) / 0.35);
          const midX = -Math.cos(phiMid) * (rimR + flare);
          const midZ = Math.sin(phiMid) * (rimR + flare);
          x = mix(x, midX + tx * (sway + sway2) + curlX, 1 - taper);
          z = mix(z, midZ + tz * (sway + sway2) + curlZ, 1 - taper);
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
    const thick = extras.thick ?? 1;
    if (kind === "braid") {
      // Triple helix: 12 points, 3 phase-offset strands
      const n = 12;
      const helixR = R * 0.055;
      for (let s = 0; s < 3; s++) {
        const phase = (s / 3) * Math.PI * 2;
        const pts = [];
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          const a = t * Math.PI * 6 + phase;
          pts.push(
            new THREE.Vector3(
              Math.cos(a) * helixR,
              top.y - len * t,
              top.z - R * 0.08 * t + Math.sin(a) * helixR
            )
          );
        }
        ribbon(mat, pts, R * 0.085, R * 0.045, "braid", g);
      }
    } else {
      const pts = [top];
      for (let i = 1; i < 5; i++) {
        const t = i / 4;
        const wave = Math.sin(t * 3) * R * 0.03;
        pts.push(new THREE.Vector3(wave, top.y - len * t, top.z - R * 0.08 * t));
      }
      ribbon(mat, pts, R * 0.14 * thick, R * 0.08 * thick, "pony", g);
    }
  } else if (kind === "sidePony") {
    const side = extras.side >= 0 ? 1 : -1;
    const thick = extras.thick ?? 1;
    const phi = Math.PI / 2 + side * (Math.PI / 2 + 0.35);
    const top = onPhi(phi, 0.75, R * 0.02);
    const pts = [top];
    for (let i = 1; i < 5; i++) {
      const t = i / 4;
      pts.push(new THREE.Vector3(top.x + side * R * 0.05 * t, top.y - len * t, top.z - R * 0.06 * t));
    }
    ribbon(mat, pts, R * 0.12 * thick, R * 0.07 * thick, "sidePony", g);
  } else if (kind === "twins" || kind === "pigs") {
    const curl = extras.curl ?? 0;
    const thick = extras.thick ?? 1;
    for (const side of [-1, 1]) {
      const phi = Math.PI / 2 + side * (Math.PI / 2 + 0.2);
      const top = onPhi(phi, 0.72, R * 0.02);
      const pts = [top];
      const n = curl > 0 ? 10 : 5;
      for (let i = 1; i < n; i++) {
        const t = i / (n - 1);
        const spiral = curl * R * 0.12;
        const a = t * Math.PI * 4 * curl * side;
        pts.push(
          new THREE.Vector3(
            top.x * (1 + 0.05 * t) + Math.cos(a) * spiral * t,
            top.y - len * t,
            top.z - R * 0.05 * t + Math.sin(a) * spiral * t
          )
        );
      }
      ribbon(mat, pts, R * 0.1 * thick, R * 0.06 * thick, kind, g);
    }
  } else if (kind === "drills") {
    // Spiral coil ribbons on each side
    const coils = extras.coils ?? 5;
    for (const side of [-1, 1]) {
      const phi = Math.PI / 2 + side * (Math.PI / 2 + 0.15);
      const top = onPhi(phi, 0.7, R * 0.02);
      const n = Math.max(10, coils * 4);
      const helixR = R * 0.1;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const a = t * Math.PI * 2 * coils * side;
        const taper = 1 - t * 0.55;
        pts.push(
          new THREE.Vector3(
            top.x + side * R * 0.04 * t + Math.cos(a) * helixR * taper,
            top.y - len * t,
            top.z - R * 0.04 * t + Math.sin(a) * helixR * taper
          )
        );
      }
      ribbon(mat, pts, R * 0.12, R * 0.04, "drills", g);
      ribbon(
        mat,
        pts.map((p, i) => {
          const t = i / (n - 1);
          return p.clone().add(new THREE.Vector3(side * R * 0.02 * (1 - t), 0, R * 0.015));
        }),
        R * 0.09,
        R * 0.03,
        "drills",
        g
      );
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
    const bias = extras.bias || "peak"; // peak | flat | messy
    for (let k = 0; k < sheets; k++) {
      const t = k / sheets;
      const phi = Math.PI * 2 * t + 0.15;
      // Bias steers volume away from a uniform dome
      const elevRoot =
        bias === "flat" ? 0.7 : bias === "messy" ? 0.48 + hash01(k, 9) * 0.28 : 0.52 + lift * 0.18;
      const elevCrest =
        bias === "flat" ? 0.82 : bias === "messy" ? 0.78 + hash01(k, 11) * 0.2 : 0.9 + lift * 0.08;
      const yBoost =
        bias === "flat"
          ? size * 0.04
          : bias === "messy"
            ? size * (0.1 + hash01(k, 13) * 0.35)
            : size * (0.18 + lift * 0.3);
      const outward =
        bias === "flat" ? size * 0.35 : bias === "messy" ? size * (0.55 + hash01(k, 15) * 0.45) : size * (0.7 + lift * 0.4);
      const root = onPhi(phi, elevRoot, R * 0.01);
      const crest = onPhi(phi + (bias === "messy" ? (hash01(k, 17) - 0.5) * 0.35 : 0.05), elevCrest, outward);
      crest.y += yBoost;
      if (bias === "messy") {
        crest.x += (hash01(k, 19) - 0.5) * size * 0.35;
        crest.z += (hash01(k, 21) - 0.5) * size * 0.25;
      }
      const tip = onPhi(phi + 0.1, bias === "flat" ? 0.7 : 0.72, size * (bias === "flat" ? 0.08 : 0.18));
      tip.y += size * (bias === "flat" ? 0.02 : 0.06);
      ribbon(mat, [root, crest, tip], size * (bias === "messy" ? 0.55 : 0.7), size * 0.25, "crownVolume", g);
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
      const isFront = grp.name === "front";
      for (let i = 0; i < perRegion; i++) {
        const phi0 = grp.start + i * SLICE - SEAL * 0.5;
        const phiLen = SLICE + SEAL;
        let cover = sliceCover(grp.cfg, i, globalI);
        let hang = sliceHangLength(grp.cfg, i, globalI);
        if (isFront) {
          const fall = fringePartFalloff(grp.cfg?.part, i, perRegion);
          cover = clamp01(cover * fall.coverMul);
          hang *= fall.hangMul;
          // Fluffy fringe: push wave/curl per-slice jitter via hang already; bump wave
          if (grp.cfg?.feel === "fluffy") {
            hang *= 0.85 + hash01(globalI, 23) * 0.4;
          } else if (grp.cfg?.feel === "tidy") {
            hang *= 0.96 + hash01(globalI, 23) * 0.08;
          }
        }
        sg.add(
          makeExtendedSlice(
            cardMat,
            phi0,
            phiLen,
            radius,
            L.headY,
            cover,
            hang,
            isFront && grp.cfg?.feel === "fluffy" ? wave * (1.15 + hash01(globalI, 25) * 0.5) : wave,
            globalI,
            `slice-${grp.name}-${i}`,
            L,
            grp.cfg
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

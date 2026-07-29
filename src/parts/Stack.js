/**
 * Human stack — mirrors mesh/buildConnectedBody humanLayout(cfg).
 * Limb / torso / neck lengths follow AvatarConfig height multipliers.
 */
import { humanLayout } from "../mesh/buildConnectedBody.js";
import {
  HEAD_SCALE_MIN,
  HEAD_SCALE_MAX,
  FACE_WIDTH_MIN,
  FACE_WIDTH_MAX,
  FACE_DROP_MIN,
  FACE_DROP_MAX,
} from "../AvatarConfig.js";

export const SHAPE = {
  slim: { w: 0.92, d: 0.92, torso: 1, hip: 1 },
  regular: { w: 1, d: 1, torso: 1, hip: 1 },
  stocky: { w: 1.08, d: 1.06, torso: 1, hip: 1.04 },
};

function clampH(n, lo = 0.5, hi = 1.7) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 1;
  return Math.min(hi, Math.max(lo, v));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

export function faceParams(cfg = {}) {
  return {
    eyeDistance: clampH(cfg.face?.eyeDistance, 0.45, 3.6),
    // Softened extremes — very low roundness/length made pancake heads
    roundness: clampH(cfg.face?.roundness, 0.45, 1.25),
    length: clampH(cfg.face?.length, 0.65, 2),
    width: clampH(cfg.face?.width, FACE_WIDTH_MIN, FACE_WIDTH_MAX),
    eyeDrop: clampH(cfg.face?.eyeDrop, FACE_DROP_MIN, FACE_DROP_MAX),
    noseDrop: clampH(cfg.face?.noseDrop, FACE_DROP_MIN, FACE_DROP_MAX),
  };
}

export function skullSize(cfg, st) {
  const f = faceParams(cfg);
  const headScale = clampH(cfg.height?.head, HEAD_SCALE_MIN, HEAD_SCALE_MAX);
  const lenT = clampH((f.length - 0.65) / 1.35, 0, 1);
  const roundT = clampH((f.roundness - 0.45) / 0.8, 0, 1);
  const bodyW = st?.S?.w ?? 1;

  // Narrower base skull — face.width multiplies this further
  let hw = 0.158 * headScale * (0.94 + 0.06 * bodyW) * f.width;
  let hh = 0.162 * headScale;
  let hd = 0.178 * headScale;

  // Longer face → taller + narrower; shorter → slightly wider
  hh *= mix(0.88, 1.16, lenT);
  hw *= mix(1.06, 0.9, lenT);
  hd *= mix(1.06, 0.96, lenT);

  // Rounder → fuller / more spherical; squarer → flatter cheeks, boxier jaw width
  hw *= mix(0.94, 1.06, roundT);
  hd *= mix(0.94, 1.12, roundT);
  hh *= mix(1.05, 0.95, roundT);
  // Floor depth so profile never collapses (squarer can be a bit shallower)
  hd = Math.max(hd, hw * mix(0.78, 0.86, roundT));

  const radiusFactor = Math.min(0.49, 0.26 + f.roundness * 0.2);
  return { hw, hh, hd, headScale, ...f, radiusFactor };
}

/** Local-Y of skull underside at the neck column (matches buildSmoothFace jaw/cran). Negative. */
export function skullSeatLocalY(sk) {
  const ry = (sk.hh ?? 0.16) * 0.5;
  const rT = clampH(((sk.roundness ?? 1) - 0.45) / 0.8, 0, 1);
  const cranBot = ry * 0.06 - ry * mix(0.94, 1.02, rT);
  const jawBot = -ry * mix(0.34, 0.4, rT) - ry * mix(0.32, 0.38, rT);
  // Neck seats under jaw/cran — not the forward chin tip (which hangs lower)
  return Math.min(cranBot, jawBot);
}

/** Local-Y of cranial crown top (for hair/hat anchors). Positive. */
export function skullCrownLocalY(sk) {
  const ry = (sk.hh ?? 0.16) * 0.5;
  const rT = clampH(((sk.roundness ?? 1) - 0.45) / 0.8, 0, 1);
  return ry * 0.06 + ry * mix(0.94, 1.02, rT);
}

/** How far the skull underside sinks into the neck top. */
export const HEAD_NECK_SINK = 0.055;

/**
 * @returns anchors + sizes for every segment (centers + tops/bots)
 */
export function buildStack(cfg = {}) {
  const L = humanLayout(cfg);
  const S = L.S;
  const H = L.H;

  function seg(bot, top) {
    return { bot, top, h: top - bot, y: (bot + top) / 2 };
  }

  const {
    yFoot, yAnkle, yKnee, yHip, yWaist, yShoulder, yNeck, yNeckTop,
    armLenU, armLenL, handLen, shoulderX, legX, hipZ,
  } = L;

  // Seat real skull underside onto neck (fixes float when face.length ≫ skull hh)
  const sk = skullSize(cfg, { S });
  const seatLocal = skullSeatLocalY(sk);
  const crownLocal = skullCrownLocalY(sk);
  const headBot = yNeckTop - HEAD_NECK_SINK;
  const headY = headBot - seatLocal;
  const headTop = headY + crownLocal;

  const foot = seg(0, yFoot * 2);
  const shin = seg(yAnkle, yKnee);
  const thigh = seg(yKnee, yHip);
  const hip = seg(yHip - 0.08, yWaist);
  const torso = seg(yWaist, yNeck);
  const neck = seg(yNeck, yNeckTop);
  const head = { bot: headBot, top: headTop, h: headTop - headBot, y: headY };

  const tw = L.chestRX * 2;
  const td = L.chestRZ * 2;
  const hipW = L.hipRX * 2;
  const hipD = L.hipRZ * 2;
  const armW = L.rShoulder;
  const legW = L.rThigh;
  const legD = L.rThigh * 1.05;
  const armLen = armLenU + armLenL;
  const handH = handLen;
  const shoulderSocketX = shoulderX;
  const armAttachY = yShoulder;
  const elbowX = shoulderX + armLenU;
  const wristX = shoulderX + armLenU + armLenL;
  const handX = wristX + handH * 0.45;
  const offsets = {
    ARM_Z: 0,
    HIP_Z: hipZ,
    SHIN_Z: hipZ * 0.4,
    FOOT_Z: 0,
    HEAD_Z: 0.03,
  };

  return {
    S,
    H,
    L,
    overlap: HEAD_NECK_SINK,
    shR: L.rShoulder,
    foot,
    shin,
    kneeY: yKnee,
    ankleY: yAnkle,
    hipSocketY: yHip,
    waistY: yWaist,
    thigh,
    hip,
    torso,
    neck,
    head,
    shoulderY: yShoulder,
    shoulderSocketX,
    armAttachY,
    armTop: yShoulder,
    armBot: yShoulder,
    armH: armLen,
    armY: yShoulder,
    upperArm: { h: armLenU, y: yShoulder, top: yShoulder, bot: yShoulder },
    elbowY: yShoulder,
    elbowX,
    wristX,
    handX,
    forearm: { h: armLenL, y: yShoulder, top: yShoulder, bot: yShoulder },
    handY: yShoulder,
    handH,
    tw,
    td,
    hipW,
    hipD,
    hipThick: L.hipThick,
    armThick: L.armThick,
    legThick: L.legThick,
    armW,
    armX: shoulderX + armLenU * 0.5,
    armTilt: Math.PI / 2,
    pose: "T",
    legW,
    legD,
    legX,
    offsets,
    totalHeight: head.top,
  };
}

export function figureLayout(cfg) {
  return buildStack(cfg);
}

/**
 * Human stack — mirrors mesh/humanLayout(cfg).
 * Limb / torso / neck lengths follow AvatarConfig height multipliers.
 */
import { humanLayout } from "../mesh/humanLayout.js";
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
    mouthDrop: clampH(cfg.face?.mouthDrop, FACE_DROP_MIN, FACE_DROP_MAX),
  };
}

export function skullSize(cfg, st) {
  const f = faceParams(cfg);
  const headScale = clampH(cfg.height?.head, HEAD_SCALE_MIN, HEAD_SCALE_MAX);
  const roundT = clampH((f.roundness - 0.45) / 0.8, 0, 1);
  const bodyW = st?.S?.w ?? st?.L?.S?.w ?? 1;
  const L = st?.L;

  // 7.5-head canon → ball; cranial ball slightly smaller, jaw/chin larger
  const neckTopY = L?.yNeckTop ?? L?.yNeck ?? st?.neck?.top ?? null;
  const baseHeadH = L?.estHeadH ?? Math.max(0.2, (neckTopY ?? 1.45) / 6.55);
  const headH = Math.max(0.18, baseHeadH * headScale);
  const Rfull = headH / 3;
  const R = Rfull * 0.88;
  const jawMeshLen = Rfull * Math.min(2.25, Math.max(1.6, 1.95 + ((f.length ?? 1) - 1) * 0.35));
  const jawDrop = Rfull * 0.12;
  const jawH = jawMeshLen * 0.74;
  const chinH = Rfull * 0.46;
  const jawLen = jawDrop + jawH + chinH * 0.92;
  const headHAdj = R + jawLen;

  // Ball half-extents follow shrunk cranial R; width slider still applies
  let hw = R * (0.96 + 0.04 * bodyW) * f.width;
  let hd = R;
  hw = mix(R, hw, 0.45);
  hd = mix(R, hd * mix(0.98, 1.04, roundT), 0.3);

  const hh = headHAdj * 0.5;

  const radiusFactor = Math.min(0.49, 0.26 + f.roundness * 0.2);
  return {
    hw,
    hh,
    hd,
    R,
    Rfull,
    headScale,
    headH: headHAdj,
    jawLen,
    jawDrop,
    jawMeshLen,
    ...f,
    radiusFactor,
  };
}

/** Chin tip local-Y vs ball center. */
export function skullSeatLocalY(sk) {
  if (sk.jawLen != null) return -sk.jawLen;
  const Rfull = sk.Rfull ?? (sk.R ?? (sk.hh ?? 0.1) / 1.5) / 0.88;
  const R = sk.R ?? Rfull * 0.88;
  const length = sk.length ?? 1;
  const jawMeshLen = Rfull * Math.min(2.25, Math.max(1.6, 1.95 + (length - 1) * 0.35));
  const jawDrop = Rfull * 0.12;
  const jawH = jawMeshLen * 0.74;
  const chinH = Rfull * 0.46;
  return -(jawDrop + jawH + chinH * 0.92);
}

/** Crown local-Y vs ball center (sphere top = +R). */
export function skullCrownLocalY(sk) {
  const R = sk.R ?? (sk.hh ?? 0.1) / 1.5;
  return R;
}

/** How far the chin tip sinks past neck.top so under-chin rests on the column. */
export const HEAD_NECK_SINK = 0.05;

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

  // Lower the head so the ball underside meets the neck column (chin can wrap the join)
  const sk = skullSize(cfg, { S, L });
  const seatLocal = skullSeatLocalY(sk);
  const crownLocal = skullCrownLocalY(sk);
  const jawLen = Math.abs(seatLocal);
  const Rball = sk.R ?? 0.06;
  // Chin wraps past neck top a little; keep sink modest with the shorter column
  const sink = Math.max(HEAD_NECK_SINK, jawLen - Rball - 0.02);
  const headBot = yNeckTop - sink;
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
  // Enforce monotonic clavicle → shoulder → elbow → wrist → hand with clear gaps
  const MIN_UA = 0.16;
  const MIN_LA = 0.15;
  const MIN_HAND = 0.055;
  const MAX_UA = 0.42;
  const MAX_LA = 0.4;
  const ua = Math.min(MAX_UA, Math.max(MIN_UA, armLenU));
  const la = Math.min(MAX_LA, Math.max(MIN_LA, armLenL));
  const hh = Math.max(MIN_HAND, handH);
  const elbowX = shoulderSocketX + ua;
  const wristX = elbowX + la;
  const handX = wristX + hh * 0.45;
  // Clavicle sits between chest and shoulder (never past upperarm)
  const clavicleX = Math.min(shoulderSocketX * 0.62, Math.max(tw * 0.28, shoulderSocketX - ua * 0.35));
  // Small forward nest only — under-chin / jaw back sits on the neck, not a long gap to the occiput
  const joinZ = (hipZ != null ? hipZ : -0.035) * 0.5;
  const nest = Math.min(0.022, Math.max(0.01, (L.neckR ?? 0.034) * 0.45));
  const headZ = joinZ + nest;
  const offsets = {
    ARM_Z: 0.04,
    HIP_Z: hipZ != null ? hipZ : -0.035,
    SHIN_Z: -0.02,
    FOOT_Z: -0.005,
    JOIN_Z: joinZ,
    NECK_Z: joinZ,
    HEAD_Z: headZ,
  };

  return {
    S,
    H,
    L,
    overlap: sink,
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
    clavicleX,
    armAttachY: yShoulder,
    armTop: yShoulder,
    armBot: yShoulder,
    armH: ua + la,
    armY: yShoulder,
    upperArm: { h: ua, y: yShoulder, top: yShoulder, bot: yShoulder },
    elbowY: yShoulder,
    elbowX,
    wristX,
    handX,
    forearm: { h: la, y: yShoulder, top: yShoulder, bot: yShoulder },
    handY: yShoulder,
    handH: hh,
    tw,
    td,
    hipW,
    hipD,
    hipThick: L.hipThick,
    armThick: L.armThick,
    legThick: L.legThick,
    armW,
    armX: shoulderSocketX + ua * 0.5,
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

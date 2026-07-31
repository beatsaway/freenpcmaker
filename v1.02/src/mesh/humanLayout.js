/**
 * Standing human layout in meters-ish units.
 * Shared by stack, joints, and lathe body builders.
 */
import { HEAD_SCALE_MIN, HEAD_SCALE_MAX } from "../AvatarConfig.js";

const SHAPE = {
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

/**
 * @param {object} [cfg] AvatarConfig (partial ok)
 */
export function humanLayout(cfg = {}) {
  const S = SHAPE[cfg.bodyShape] || SHAPE.regular;
  const H = {
    leg: clampH(cfg.height?.leg),
    torso: clampH(cfg.height?.torso),
    neck: clampH(cfg.height?.neck),
    head: clampH(cfg.height?.head, HEAD_SCALE_MIN, HEAD_SCALE_MAX),
  };
  const armThick = clampH(cfg.body?.armThick, 0.55, 2.2);
  const legThick = clampH(cfg.body?.legThick, 0.55, 2.2);
  const hipThick = clampH(cfg.body?.hipThick, 0.9, 2.7);
  const chestWidth = clampH(cfg.body?.chestWidth, 0.55, 1.85);
  const waistWidth = clampH(cfg.body?.waistWidth, 0.5, 1.85);
  const torsoDepth = clampH(cfg.body?.depth, 0.55, 1.85);

  const yFoot = 0.04;
  const yAnkle = 0.1;
  // Floor/cap vs Mesh2Motion template (~0.41 thigh / ~0.43 calf) so auto-rig
  // keeps a clear upper/lower leg split at extreme height.leg values.
  const shinLen = Math.min(0.55, Math.max(0.18, 0.38 * H.leg));
  const thighLen = Math.min(0.6, Math.max(0.2, 0.44 * H.leg));
  const yKnee = yAnkle + shinLen;
  const yHip = yKnee + thighLen;
  const hipBand = 0.13;
  const yWaist = yHip + hipBand;
  const torsoLen = 0.37 * H.torso * S.torso;
  const yChest = yWaist + 0.27 * H.torso * S.torso;
  const yShoulder = yWaist + 0.33 * H.torso * S.torso;
  const yNeck = yWaist + torsoLen;

  // Arms track a blend of torso + legs; floor/cap vs Mesh2Motion (~0.30 / 0.28)
  // so long-limb NPCs don't stretch upperarm past a usable elbow split.
  const armScale = (0.45 * H.torso + 0.55 * H.leg) * S.torso;
  const armLenU = Math.min(0.42, Math.max(0.16, 0.28 * armScale));
  const armLenL = Math.min(0.4, Math.max(0.15, 0.26 * armScale));
  const handLen = Math.max(0.055, Math.min(0.12, 0.09 * Math.min(1.25, 0.85 + 0.15 * armScale)));

  const w = S.w;
  const d = S.d;
  const legX = Math.max(0.08, 0.1 * w) + (legThick - 1) * 0.012;
  const shoulderX = 0.18 * w * Math.sqrt(chestWidth);

  // Neck column — short; head sits back so under-chin rests on it (merged into torso mesh)
  const neckR = 0.034 * mix(0.92, 1.06, (w - 0.92) / 0.16);
  const rNeckJoin = neckR; // same radius as shaft — continuous with torso top
  const estHeadH = Math.max(0.2, yNeck / 6.5);
  const neckLen = Math.min(0.14, Math.max(0.08, estHeadH * 0.32 * H.neck));
  const yNeckTop = yNeck + neckLen;

  return {
    yFoot,
    yAnkle,
    yKnee,
    yHip,
    yWaist,
    yChest,
    yShoulder,
    yNeck,
    yNeckTop,
    neckLen,
    estHeadH,
    legX,
    shoulderX,
    chestRX: 0.15 * w * chestWidth,
    chestRZ: 0.1 * d * torsoDepth,
    waistRX: 0.12 * w * waistWidth,
    waistRZ: 0.085 * d * torsoDepth,
    hipRX: 0.155 * w * S.hip * (0.88 + 0.12 * hipThick),
    hipRZ: 0.11 * d * (0.85 + 0.15 * hipThick) * (0.9 + 0.1 * torsoDepth),
    neckR,
    rNeckJoin,
    rThigh: 0.055 * w * legThick,
    rKnee: 0.042 * w * Math.sqrt(legThick),
    rCalf: 0.038 * w * Math.sqrt(legThick),
    rAnkle: 0.03 * w * Math.sqrt(legThick),
    rShoulder: 0.048 * w * Math.sqrt(armThick),
    rElbow: 0.038 * w * Math.sqrt(armThick),
    rWrist: 0.03 * w * Math.sqrt(armThick),
    rPalm: 0.036 * w * Math.sqrt(armThick),
    armLenU,
    armLenL,
    handLen,
    footW: 0.1 * w * Math.sqrt(legThick),
    footH: 0.065,
    footD: 0.2,
    heelR: 0.042 * Math.sqrt(legThick),
    hipZ: -0.04 * (0.9 + 0.1 * torsoDepth),
    buttZ: -0.07 * (0.9 + 0.1 * hipThick),
    H,
    S,
    armThick,
    legThick,
    hipThick,
  };
}

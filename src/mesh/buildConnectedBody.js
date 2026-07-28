/**
 * One-piece human body via SDF smooth-union → marching cubes.
 * Limb / torso / neck lengths follow AvatarConfig height multipliers.
 */
import * as THREE from "three";
import {
  clamp, mix, smin, smax, sdSphere, sdCapsule, sdEllipsoid, marchField,
} from "./sdfCore.js";
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

/**
 * Standing human layout in meters-ish units.
 * @param {object} [cfg] AvatarConfig (partial ok) — uses height.* and body.* and bodyShape
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

  // Base segment lengths at scale=1 (matches previous fixed layout)
  const yFoot = 0.04;
  const yAnkle = 0.1;
  const shinLen = 0.38 * H.leg;
  const thighLen = 0.44 * H.leg;
  const yKnee = yAnkle + shinLen;
  const yHip = yKnee + thighLen;
  const hipBand = 0.13;
  const yWaist = yHip + hipBand;
  const torsoLen = 0.37 * H.torso * S.torso;
  const yChest = yWaist + 0.27 * H.torso * S.torso;
  const yShoulder = yWaist + 0.33 * H.torso * S.torso;
  const yNeck = yWaist + torsoLen;
  const neckLen = 0.14 * H.neck;
  const yNeckTop = yNeck + neckLen;

  // Arms track a blend of torso + legs (same idea as avatarbuilder2)
  const armScale = (0.45 * H.torso + 0.55 * H.leg) * S.torso;
  const armLenU = 0.28 * armScale;
  const armLenL = 0.26 * armScale;
  const handLen = 0.09 * Math.min(1.25, 0.85 + 0.15 * armScale);

  const w = S.w;
  const d = S.d;
  const legX = Math.max(0.08, 0.1 * w) + (legThick - 1) * 0.012;
  const shoulderX = 0.18 * w * Math.sqrt(chestWidth);

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
    legX,
    shoulderX,
    chestRX: 0.15 * w * chestWidth,
    chestRZ: 0.1 * d * torsoDepth,
    waistRX: 0.12 * w * waistWidth,
    waistRZ: 0.085 * d * torsoDepth,
    hipRX: 0.155 * w * S.hip * (0.88 + 0.12 * hipThick),
    hipRZ: 0.11 * d * (0.85 + 0.15 * hipThick) * (0.9 + 0.1 * torsoDepth),
    neckR: 0.042 * mix(0.92, 1.08, (w - 0.92) / 0.16),
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
    // extras for stack / clothes
    H,
    S,
    armThick,
    legThick,
    hipThick,
  };
}

function sdTrunk(px, py, pz, L) {
  const yBot = L.yHip - 0.08;
  const y = clamp(py, yBot, L.yNeckTop);
  // Normalize using chest top as the “shoulder plateau”, then steep neck
  const yChestTop = L.yShoulder + 0.02;
  let rx;
  let rz;
  let cz = 0;

  if (y < L.yWaist) {
    const t = clamp((y - yBot) / (L.yWaist - yBot), 0, 1);
    if (t < 0.55) {
      const u = t / 0.55;
      rx = mix(L.hipRX * 0.92, L.hipRX, u);
      rz = mix(L.hipRZ * 0.9, L.hipRZ, u);
      cz = mix(L.hipZ, L.hipZ * 0.45, u);
    } else {
      const u = (t - 0.55) / 0.45;
      rx = mix(L.hipRX, L.waistRX, u);
      rz = mix(L.hipRZ, L.waistRZ, u);
      cz = mix(L.hipZ * 0.45, 0, u);
    }
  } else if (y < yChestTop) {
    // Chest stays broad — almost flat shoulder line
    const t = clamp((y - L.yWaist) / (yChestTop - L.yWaist), 0, 1);
    const u = t * t * (3 - 2 * t);
    rx = mix(L.waistRX, L.chestRX, u);
    rz = mix(L.waistRZ, L.chestRZ, u);
  } else if (y < L.yNeck) {
    // Steep trap: chest → neck in a short span (not a gentle hill)
    const t = clamp((y - yChestTop) / Math.max(1e-6, L.yNeck - yChestTop), 0, 1);
    // Ease-in sharp: stay wide early, snap in late
    const u = Math.pow(t, 0.45);
    const snap = u * u;
    rx = mix(L.chestRX * 0.98, L.neckR, snap);
    rz = mix(L.chestRZ * 0.98, L.neckR * 0.95, snap);
  } else {
    // Cylindrical neck column
    rx = L.neckR;
    rz = L.neckR * 0.95;
  }

  const qx = px / rx;
  const qz = (pz - cz) / rz;
  const len = Math.hypot(qx, qz);
  let d = len < 1e-8 ? -Math.min(rx, rz) : (len - 1) * Math.min(rx, rz);
  d = smax(d, yBot - 0.02 - py, 0.03);
  d = smax(d, py - L.yNeckTop, 0.015);
  // Soft rear hip mass
  const butt = sdEllipsoid(px, py, pz, 0, mix(L.yHip, L.yWaist, 0.25), L.buttZ, L.hipRX * 0.88, 0.08, L.hipRZ * 0.7);
  d = smin(d, butt, 0.07);
  return d;
}

function sdArm(px, py, pz, side, L) {
  const y = L.yShoulder;
  const z = 0;
  const xSh = side * L.shoulderX;
  const xEl = side * (L.shoulderX + L.armLenU);
  const xWr = side * (L.shoulderX + L.armLenU + L.armLenL);
  const xTip = side * (L.shoulderX + L.armLenU + L.armLenL + L.handLen);
  // Start inside chest so soft-union has overlap
  const xIn = side * (L.chestRX * 0.55);
  const dU = sdCapsule(px, py, pz, xIn, y, z, xEl, y, z, (L.rShoulder + L.rElbow) * 0.5);
  const dL = sdCapsule(px, py, pz, xEl, y, z, xWr, y, z, (L.rElbow + L.rWrist) * 0.5);
  const dH = sdCapsule(px, py, pz, xWr, y, z, xTip, y, z, (L.rPalm + L.rWrist) * 0.5);
  const dTip = sdSphere(px, py, pz, xTip, y, z, L.rPalm * 0.7);
  const dSh = sdSphere(px, py, pz, xSh, y, z, L.rShoulder * 1.15);
  let d = smin(dU, dL, 0.03);
  d = smin(d, dH, 0.025);
  d = smin(d, dTip, 0.02);
  d = smin(d, dSh, 0.04);
  return d;
}

function sdLeg(px, py, pz, side, L) {
  const x = side * L.legX;
  const dTh = sdCapsule(px, py, pz, x, L.yHip, L.hipZ, x, L.yKnee, L.hipZ * 0.4, (L.rThigh + L.rKnee) * 0.5);
  const dCa = sdCapsule(px, py, pz, x, L.yKnee, L.hipZ * 0.4, x, L.yAnkle, 0, (L.rKnee + L.rAnkle) * 0.5);
  const dHip = sdSphere(px, py, pz, x, L.yHip, L.hipZ, L.rThigh * 1.05);
  // Cap at ankle — feet come from the separate shoe mesh
  const dAnkle = sdSphere(px, py, pz, x, L.yAnkle, 0, L.rAnkle);

  let d = smin(dTh, dCa, 0.035);
  d = smin(d, dHip, 0.045);
  d = smin(d, dAnkle, 0.02);
  return d;
}

function classifyAndGroup(geo, L) {
  const pos = geo.attributes.position;
  const n = pos.count;
  const limbT = new Float32Array(n);
  const partId = new Float32Array(n);
  const armSide = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const ax = Math.abs(x);
    const nearArm = Math.abs(y - L.yShoulder) < 0.12 && ax > L.chestRX * 0.65;
    const nearLeg = y < L.yHip + 0.06 && ax > L.legX * 0.35;

    if (nearArm) {
      partId[i] = x >= 0 ? 1 : 2;
      armSide[i] = x >= 0 ? 1 : 2;
      const along = (ax - L.shoulderX * 0.5) / (L.armLenU + L.armLenL + L.handLen);
      limbT[i] = clamp(along, 0, 1);
    } else if (nearLeg) {
      partId[i] = x >= 0 ? 3 : 4;
      armSide[i] = x >= 0 ? 3 : 4;
      limbT[i] = clamp((L.yHip - y) / (L.yHip - 0.02), 0, 1.1);
    } else {
      partId[i] = 0;
      armSide[i] = 0;
      limbT[i] = 0;
    }
  }

  geo.setAttribute("limbT", new THREE.Float32BufferAttribute(limbT, 1));
  geo.setAttribute("partId", new THREE.Float32BufferAttribute(partId, 1));
  geo.setAttribute("armSide", new THREE.Float32BufferAttribute(armSide, 1));

  const joinY = L.yWaist;
  const neckJoinY = L.yNeck;
  const tElbow = L.armLenU / (L.armLenU + L.armLenL + L.handLen);
  const tWrist = (L.armLenU + L.armLenL) / (L.armLenU + L.armLenL + L.handLen);
  const tKnee = (L.yHip - L.yKnee) / (L.yHip - 0.02);

  const idx = geo.index;
  const buckets = Array.from({ length: 9 }, () => []);
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i);
    const b = idx.getX(i + 1);
    const c = idx.getX(i + 2);
    const pid = Math.max(partId[a], partId[b], partId[c]);
    let g = 0;
    if (pid === 1 || pid === 2) {
      const t = (limbT[a] + limbT[b] + limbT[c]) / 3;
      g = t < tElbow ? 3 : t < tWrist ? 4 : 5;
    } else if (pid === 3 || pid === 4) {
      const t = (limbT[a] + limbT[b] + limbT[c]) / 3;
      g = t < tKnee ? 6 : 7; // thigh / shin — no body foot (shoes are separate)
    } else {
      const y = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3;
      g = y < joinY ? 0 : y < neckJoinY ? 1 : 2;
    }
    buckets[g].push(a, b, c);
  }
  const flat = buckets.flat();
  geo.setIndex(flat);
  geo.clearGroups();
  let start = 0;
  for (let gi = 0; gi < 9; gi++) {
    geo.addGroup(start, buckets[gi].length, gi);
    start += buckets[gi].length;
  }
  geo.computeVertexNormals();

  return {
    kind: "bodySDF",
    blend: 0.055,
    shoulderBlend: 0.14,
    hipBlend: 0.12,
    trunk: {
      blend: 0.06,
      joints: [
        { bone: "pelvis", t0: -1e6, t1: joinY },
        { bone: "spine_02", t0: joinY, t1: neckJoinY },
        { bone: "neck_01", t0: neckJoinY, t1: 1e6 },
      ],
    },
    armL: {
      attr: "limbT",
      blend: 0.05,
      joints: [
        { bone: "upperarm_l", t0: 0, t1: tElbow },
        { bone: "lowerarm_l", t0: tElbow, t1: tWrist },
        { bone: "hand_l", t0: tWrist, t1: 1.1 },
      ],
    },
    armR: {
      attr: "limbT",
      blend: 0.05,
      joints: [
        { bone: "upperarm_r", t0: 0, t1: tElbow },
        { bone: "lowerarm_r", t0: tElbow, t1: tWrist },
        { bone: "hand_r", t0: tWrist, t1: 1.1 },
      ],
    },
    legL: {
      attr: "limbT",
      blend: 0.05,
      joints: [
        { bone: "thigh_l", t0: 0, t1: tKnee },
        { bone: "calf_l", t0: tKnee, t1: 1.2 },
      ],
    },
    legR: {
      attr: "limbT",
      blend: 0.05,
      joints: [
        { bone: "thigh_r", t0: 0, t1: tKnee },
        { bone: "calf_r", t0: tKnee, t1: 1.2 },
      ],
    },
  };
}

/**
 * @param {THREE.Material[]} mats [hip,torso,neck, ua,fa,hand, thigh,shin,unused]
 */
export function buildConnectedBody(mats, opts = {}) {
  const L = { ...humanLayout(), ...opts.layout };
  const kJoin = opts.joinSmooth ?? 0.055; // limb ↔ torso blend (the “connected” feel)
  const res = opts.resolution ?? 40;
  const pad = 0.08;

  const x0 = -(L.shoulderX + L.armLenU + L.armLenL + L.handLen) - pad;
  const x1 = -x0;
  const y0 = L.yAnkle - L.rAnkle - pad * 0.5;
  const y1 = L.yNeckTop + pad * 0.4;
  const z0 = L.buttZ - L.hipRZ - pad;
  const z1 = Math.max(L.chestRZ, L.hipRZ) + pad;

  const nx = res + 8;
  const ny = res + 12;
  const nz = Math.max(28, Math.round(res * 0.85));
  const field = new Float32Array(nx * ny * nz);

  function sdf(px, py, pz) {
    let d = sdTrunk(px, py, pz, L);
    // Soft-union arms into torso (overlap + wide k → one surface)
    d = smin(d, sdArm(px, py, pz, 1, L), kJoin);
    d = smin(d, sdArm(px, py, pz, -1, L), kJoin);
    // Legs: soft into torso, hard between each other
    const dLegs = Math.min(sdLeg(px, py, pz, 1, L), sdLeg(px, py, pz, -1, L));
    d = smin(d, dLegs, kJoin * 1.05);
    return d - 0.004;
  }

  for (let iz = 0; iz < nz; iz++) {
    const pz = mix(z0, z1, iz / (nz - 1));
    for (let iy = 0; iy < ny; iy++) {
      const py = mix(y0, y1, iy / (ny - 1));
      for (let ix = 0; ix < nx; ix++) {
        const px = mix(x0, x1, ix / (nx - 1));
        field[ix + nx * (iy + ny * iz)] = sdf(px, py, pz);
      }
    }
  }

  const geo = marchField(field, nx, ny, nz, x0, x1, y0, y1, z0, z1);
  if (!geo) return null;

  const bands = classifyAndGroup(geo, L);
  const mesh = new THREE.Mesh(geo, mats);
  mesh.name = "body";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.meshMethod = "sdf-connected";
  mesh.userData.layout = L;
  mesh.userData.skinBands = bands;
  return mesh;
}

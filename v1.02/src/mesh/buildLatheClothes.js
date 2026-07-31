/**
 * Lathed clothing shells (tops / bottoms) sized from humanLayout.
 * Long sleeves and pant legs are split at elbow / knee so skinning
 * matches the arm/leg bones (avoids elbow-mid-sleeve / knee-mid-thigh).
 *
 * Waist bands match the body trunk join ring (slight cloth ease only);
 * hems / thighs may stay looser.
 */
import * as THREE from "three";
import { humanLayout } from "./humanLayout.js";
import {
  latheMesh,
  profileFromKeys,
  shaftProfile,
  mix,
  withEndCaps,
} from "./latheParts.js";

/** Same waist ring as buildLatheBody trunk — cloth sits just outside skin. */
function waistFit(L) {
  const rJoin = Math.max(L.waistRX, L.waistRZ);
  const joinScaleZ = (L.waistRZ / Math.max(1e-6, L.waistRX)) * 0.96;
  const joinZ = (L.hipZ != null ? L.hipZ : -0.035) * 0.5;
  // ~3% ease so cloth clears skin without floating
  const rBand = rJoin * 1.03;
  return { rJoin, rBand, joinScaleZ, joinZ };
}

function tposeSleeve(side, len, rNear, rFar, mat, bone, segs = 12) {
  const shaft = latheMesh(shaftProfile(Math.max(0.02, len), rNear, rFar, rNear * 1.02), {
    material: mat,
    name: "sleeve",
    skinBone: bone,
    segments: segs,
  });
  const capped = withEndCaps(shaft, {
    material: mat,
    skinBone: bone,
    segments: 10,
    r0: rNear,
    r1: rFar,
  });
  capped.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  return capped;
}

/**
 * @param {THREE.Material} mat
 * @param {object} opts
 */
export function buildLatheTop(mat, opts = {}) {
  const style = opts.style || "tee";
  const L = { ...humanLayout(), ...(opts.layout || {}) };
  const g = new THREE.Group();
  g.name = "top-lathe";
  const { rBand, joinScaleZ, joinZ } = waistFit(L);

  const yBot = L.yWaist - 0.01;
  let yTop = L.yNeck + 0.01;
  let sleeve = "short"; // none | short | long
  let chestMul = 1.08;
  if (style === "tank" || style === "overalls") {
    sleeve = "none";
    chestMul = 1.05;
  } else if (style === "hoodie" || style === "jacket" || style === "longsleeve") {
    sleeve = "long";
    chestMul = style === "hoodie" ? 1.14 : 1.1;
    yTop = L.yNeckTop - 0.02;
  } else if (style === "tee" || style === "polo") {
    sleeve = "short";
  }

  // Hem hugs waist; chest/shoulders keep style ease
  const rWaist = rBand;
  const rChest = Math.max(L.chestRX, L.chestRZ) * chestMul;
  const rNeck = L.neckR * (style === "hoodie" ? 1.6 : 1.35);
  const torso = latheMesh(
    profileFromKeys(
      [
        { y: yBot, r: rWaist },
        { y: mix(yBot, L.yChest, 0.35), r: mix(rWaist, rChest, 0.55) },
        { y: L.yChest, r: rChest },
        { y: L.yShoulder, r: rChest * 0.95 },
        { y: yTop, r: rNeck },
      ],
      3
    ),
    { material: mat, name: "top-torso", skinBone: "spine_02", segments: 16 }
  );
  const torsoG = withEndCaps(torso, { material: mat, skinBone: "spine_02", r0: rWaist, r1: rNeck });
  // Match body trunk depth at the waist so the hem doesn't float
  torsoG.scale.z = mix(joinScaleZ, (L.chestRZ / Math.max(1e-6, L.chestRX)) * 0.95, 0.45);
  torsoG.position.z = joinZ;
  g.add(torsoG);

  if (sleeve !== "none") {
    const shoulderX = opts.shoulderX ?? L.shoulderX;
    const ua = Math.max(0.16, Math.min(0.42, L.armLenU));
    const la = Math.max(0.15, Math.min(0.4, L.armLenL));
    const elbowX = opts.elbowX ?? shoulderX + ua;
    const wristX = opts.wristX ?? elbowX + la;
    const uaLen = Math.abs(elbowX - shoulderX);
    const faLen = Math.abs(wristX - elbowX);

    for (const side of [-1, 1]) {
      const boneUA = side > 0 ? "upperarm_l" : "upperarm_r";
      const boneFA = side > 0 ? "lowerarm_l" : "lowerarm_r";
      const x0 = side * shoulderX;
      const xElbow = side * elbowX;
      const y = L.yShoulder;
      const z = 0.04;

      if (sleeve === "short") {
        const len = uaLen * 0.72;
        const sleeveM = tposeSleeve(side, len, L.rShoulder * 1.15, L.rElbow * 1.15, mat, boneUA);
        sleeveM.position.set(x0, y, z);
        g.add(sleeveM);
      } else {
        const upper = tposeSleeve(
          side,
          uaLen,
          L.rShoulder * 1.15,
          L.rElbow * 1.2,
          mat,
          boneUA
        );
        upper.position.set(x0, y, z);
        g.add(upper);

        const lowerLen = faLen * 0.85;
        const lower = tposeSleeve(
          side,
          lowerLen,
          L.rElbow * 1.18,
          L.rWrist * 1.25,
          mat,
          boneFA
        );
        lower.position.set(xElbow, y, z);
        g.add(lower);
      }
    }
  }

  if (style === "hoodie") {
    const hood = latheMesh(
      profileFromKeys(
        [
          { y: 0, r: L.neckR * 1.2 },
          { y: 0.08, r: Math.max(opts.hw ?? 0.14, L.neckR * 2.2) },
          { y: 0.16, r: Math.max(opts.hw ?? 0.14, L.neckR * 2) * 0.7 },
          { y: 0.2, r: 0.02 },
        ],
        2
      ),
      { material: mat, name: "hood", skinBone: "neck_01", segments: 14 }
    );
    hood.position.set(0, L.yNeck, -0.02);
    g.add(hood);
  }

  return g;
}

export function buildLatheBottom(mat, opts = {}) {
  const style = opts.style || "pants";
  const L = { ...humanLayout(), ...(opts.layout || {}) };
  const g = new THREE.Group();
  g.name = "bottom-lathe";
  const { rBand, joinScaleZ, joinZ } = waistFit(L);

  const yTop = opts.yTop ?? L.yWaist;
  const yBot = opts.yBot ?? L.yAnkle + 0.02;
  const flare = style === "mini-skirt";
  const rHip = Math.max(L.hipRX, L.hipRZ);

  if (flare) {
    // Cinch at waist; flare freely toward hem (thighs may not touch)
    const rHem = Math.max(rHip * 1.35, rBand * 1.55);
    const skirt = latheMesh(
      profileFromKeys(
        [
          { y: yBot, r: rHem },
          { y: mix(yBot, yTop, 0.45), r: mix(rHem, rHip * 1.05, 0.5) },
          { y: mix(yBot, yTop, 0.82), r: mix(rHip * 1.02, rBand, 0.35) },
          { y: yTop, r: rBand },
        ],
        3
      ),
      { material: mat, name: "skirt", skinBone: "pelvis", segments: 18 }
    );
    const skirtG = withEndCaps(skirt, {
      material: mat,
      skinBone: "pelvis",
      r0: rHem,
      r1: rBand,
    });
    skirtG.scale.z = joinScaleZ;
    skirtG.position.z = joinZ;
    g.add(skirtG);
    return g;
  }

  // Pants / shorts — waistband hugs body; hip/leg can ease out
  const rHipShell = rHip * 1.06;
  const hip = latheMesh(
    profileFromKeys(
      [
        { y: Math.max(yBot, L.yHip - 0.02), r: mix(rHipShell * 0.92, rBand, 0.15) },
        { y: L.yHip + 0.02, r: rHipShell },
        { y: mix(L.yHip, yTop, 0.55), r: mix(rHipShell, rBand, 0.5) },
        { y: yTop, r: rBand },
      ],
      2
    ),
    { material: mat, name: "pants-hip", skinBone: "pelvis", segments: 14 }
  );
  const hipG = withEndCaps(hip, {
    material: mat,
    skinBone: "pelvis",
    r0: mix(rHipShell * 0.92, rBand, 0.15),
    r1: rBand,
    cap0: false,
  });
  hipG.scale.z = joinScaleZ;
  hipG.position.z = joinZ;
  g.add(hipG);

  const hemY = yBot;
  const kneeY = L.yKnee;
  const hipY = L.yHip;
  const fullLength = hemY < kneeY - 0.05;

  for (const side of [-1, 1]) {
    const sx = side * L.legX;
    const boneThigh = side > 0 ? "thigh_l" : "thigh_r";
    const boneCalf = side > 0 ? "calf_l" : "calf_r";
    const z = joinZ;

    if (fullLength) {
      const calfLen = Math.max(0.05, kneeY - hemY);
      const calf = latheMesh(
        shaftProfile(calfLen, L.rAnkle * 1.25, L.rKnee * 1.15, L.rCalf * 1.15),
        { material: mat, name: "pant-calf", skinBone: boneCalf, segments: 12 }
      );
      const calfG = withEndCaps(calf, {
        material: mat,
        skinBone: boneCalf,
        r0: L.rAnkle * 1.25,
        r1: L.rKnee * 1.15,
      });
      calfG.position.set(sx, hemY, z);
      g.add(calfG);

      const thighLen = Math.max(0.05, hipY - kneeY);
      const thigh = latheMesh(
        shaftProfile(thighLen, L.rKnee * 1.15, L.rThigh * 1.12, L.rThigh * 1.14),
        { material: mat, name: "pant-thigh", skinBone: boneThigh, segments: 12 }
      );
      const thighG = withEndCaps(thigh, {
        material: mat,
        skinBone: boneThigh,
        r0: L.rKnee * 1.15,
        r1: L.rThigh * 1.12,
      });
      thighG.position.set(sx, kneeY, z);
      g.add(thighG);
    } else {
      const y0 = Math.max(hemY, L.yAnkle);
      const len = Math.max(0.05, hipY - y0);
      const leg = latheMesh(
        shaftProfile(len, L.rKnee * 1.12, L.rThigh * 1.1, mix(L.rKnee, L.rThigh, 0.5) * 1.05),
        { material: mat, name: "pant-leg", skinBone: boneThigh, segments: 12 }
      );
      const legG = withEndCaps(leg, {
        material: mat,
        skinBone: boneThigh,
        r0: L.rKnee * 1.12,
        r1: L.rThigh * 1.1,
      });
      legG.position.set(sx, y0, z);
      g.add(legG);
    }
  }
  return g;
}

export const buildSmoothTop = buildLatheTop;
export const buildSmoothBottom = buildLatheBottom;
export function buildSmoothHood(mat, opts = {}) {
  return buildLatheTop(mat, { ...opts, style: "hoodie" });
}
export function buildSmoothFlare(mat, opts = {}) {
  return buildLatheBottom(mat, { ...opts, style: "mini-skirt" });
}
export function buildSmoothSkirt(mat, opts = {}) {
  return buildSmoothFlare(mat, opts);
}

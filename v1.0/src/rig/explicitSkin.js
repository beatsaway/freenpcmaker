/**
 * Explicit / band skinning (hofk / Bumblebee style).
 * - Single bone tag, or
 * - Multi-band by Y / limbT (soft blends at joints) for merged chains.
 * - Composite trunk+arms after shoulder weld.
 */
import { Uint16BufferAttribute, Float32BufferAttribute } from "three";
import { applyDistanceSkinWeights } from "./distanceSkin.js";

function boneIndex(skeleton, name) {
  return skeleton.bones.findIndex((b) => b.name === name);
}

function applySingleBoneSkin(geometry, boneIdx) {
  const n = geometry.attributes.position.count;
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    skinIndex[o] = boneIdx;
    skinWeight[o] = 1;
  }
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeight, 4));
  return geometry;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Normalize legacy dual-band into joints[]. */
function normalizeJoints(bands) {
  if (!bands) return null;
  if (bands.joints?.length) return bands;
  if (bands.lowerBone && bands.upperBone) {
    return {
      ...bands,
      joints: [
        { bone: bands.lowerBone, t0: -1e6, t1: bands.joinY },
        { bone: bands.upperBone, t0: bands.joinY, t1: 1e6 },
      ],
    };
  }
  return null;
}

function resolveBandPair(t, joints, idxs, blend) {
  let b0 = idxs[0];
  let b1 = idxs[0];
  let w1 = 0;
  for (let s = 0; s < joints.length; s++) {
    const j = joints[s];
    if (t <= j.t1 || s === joints.length - 1) {
      b0 = idxs[s];
      if (s + 1 < joints.length) {
        const join = j.t1;
        w1 = smoothstep(join - blend, join + blend, t);
        b1 = idxs[s + 1];
      }
      break;
    }
  }
  return { b0, b1, w1 };
}

/**
 * Soft multi-band skinning along a scalar param (world Y or baked limbT).
 * joints: [{ bone, t0, t1 }, ...] covering the chain in order (t0 < t1).
 */
export function applyParamBandSkin(geometry, skeleton, bands) {
  const norm = normalizeJoints(bands);
  const joints = norm?.joints;
  if (!joints?.length) return null;

  const idxs = joints.map((j) => boneIndex(skeleton, j.bone));
  if (idxs.some((i) => i < 0)) return null;

  const pos = geometry.attributes.position;
  const paramAttr = norm.attr ? geometry.attributes[norm.attr] : null;
  const n = pos.count;
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const blend = Math.max(0.008, norm.blend ?? bands.blend ?? 0.045);

  for (let i = 0; i < n; i++) {
    const t = paramAttr ? paramAttr.getX(i) : pos.getY(i);
    const { b0, b1, w1 } = resolveBandPair(t, joints, idxs, blend);
    const o = i * 4;
    skinIndex[o] = b0;
    skinIndex[o + 1] = b1;
    skinWeight[o] = 1 - w1;
    skinWeight[o + 1] = w1;
  }

  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeight, 4));
  return geometry;
}

/**
 * Upper body after shoulder weld: trunk (Y bands) + arms (limbT bands).
 * Near shoulder, arm verts also blend toward spine_02.
 */
export function applyTrunkArmsSkin(geometry, skeleton, bands) {
  const trunk = normalizeJoints(bands.trunk);
  const armL = normalizeJoints(bands.armL);
  const armR = normalizeJoints(bands.armR);
  if (!trunk?.joints?.length) return null;

  const trunkIdxs = trunk.joints.map((j) => boneIndex(skeleton, j.bone));
  if (trunkIdxs.some((i) => i < 0)) return null;

  const armLIdxs = armL?.joints?.map((j) => boneIndex(skeleton, j.bone)) ?? null;
  const armRIdxs = armR?.joints?.map((j) => boneIndex(skeleton, j.bone)) ?? null;
  if (armLIdxs?.some((i) => i < 0) || armRIdxs?.some((i) => i < 0)) return null;

  const spineIdx = boneIndex(skeleton, "spine_02");
  const pos = geometry.attributes.position;
  const limbT = geometry.attributes.limbT;
  const armSide = geometry.attributes.armSide;
  const n = pos.count;
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const trunkBlend = Math.max(0.008, trunk.blend ?? bands.blend ?? 0.055);
  const armBlend = Math.max(0.008, armL?.blend ?? armR?.blend ?? bands.blend ?? 0.05);
  const shoulderBlend = Math.max(0.02, bands.shoulderBlend ?? 0.1);

  for (let i = 0; i < n; i++) {
    const side = armSide ? armSide.getX(i) : 0;
    let b0;
    let b1;
    let w1 = 0;

    if (side < 0.5) {
      const t = pos.getY(i);
      ({ b0, b1, w1 } = resolveBandPair(t, trunk.joints, trunkIdxs, trunkBlend));
    } else {
      const t = limbT ? limbT.getX(i) : 0;
      const isL = side < 1.5;
      const joints = isL ? armL.joints : armR.joints;
      const idxs = isL ? armLIdxs : armRIdxs;
      ({ b0, b1, w1 } = resolveBandPair(t, joints, idxs, armBlend));

      // Soft shoulder: mix in spine_02 near the weld
      if (spineIdx >= 0 && t < shoulderBlend) {
        const wSpine = 1 - smoothstep(0, shoulderBlend, t);
        // Keep primary arm bone, secondary = spine (drop forearm blend when near shoulder)
        const armPrimary = w1 < 0.5 ? b0 : b1;
        b0 = armPrimary;
        b1 = spineIdx;
        w1 = wSpine * 0.65;
      }
    }

    const o = i * 4;
    skinIndex[o] = b0;
    skinIndex[o + 1] = b1;
    skinWeight[o] = 1 - w1;
    skinWeight[o + 1] = w1;
  }

  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeight, 4));
  return geometry;
}

/**
 * Full-body SDF skin: trunk (Y) + arms/legs (limbT via armSide).
 * armSide: 0 trunk, 1 armL, 2 armR, 3 legL, 4 legR
 */
export function applyBodySDFSkin(geometry, skeleton, bands) {
  const trunk = normalizeJoints(bands.trunk);
  const armL = normalizeJoints(bands.armL);
  const armR = normalizeJoints(bands.armR);
  const legL = normalizeJoints(bands.legL);
  const legR = normalizeJoints(bands.legR);
  if (!trunk?.joints?.length) return null;

  const trunkIdxs = trunk.joints.map((j) => boneIndex(skeleton, j.bone));
  if (trunkIdxs.some((i) => i < 0)) return null;

  function mapIdxs(chain) {
    if (!chain?.joints) return null;
    const idxs = chain.joints.map((j) => boneIndex(skeleton, j.bone));
    if (idxs.some((i) => i < 0)) return null;
    return idxs;
  }

  const armLIdxs = mapIdxs(armL);
  const armRIdxs = mapIdxs(armR);
  const legLIdxs = mapIdxs(legL);
  const legRIdxs = mapIdxs(legR);
  if (!armLIdxs || !armRIdxs || !legLIdxs || !legRIdxs) return null;

  const spineIdx = boneIndex(skeleton, "spine_02");
  const pelvisIdx = boneIndex(skeleton, "pelvis");
  const pos = geometry.attributes.position;
  const limbT = geometry.attributes.limbT;
  const armSide = geometry.attributes.armSide;
  const n = pos.count;
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const trunkBlend = Math.max(0.008, trunk.blend ?? bands.blend ?? 0.055);
  const limbBlend = Math.max(0.008, bands.blend ?? 0.05);
  const shoulderBlend = Math.max(0.02, bands.shoulderBlend ?? 0.1);
  const hipBlend = Math.max(0.02, bands.hipBlend ?? 0.1);

  for (let i = 0; i < n; i++) {
    const side = armSide ? armSide.getX(i) : 0;
    let b0;
    let b1;
    let w1 = 0;

    if (side < 0.5) {
      const t = pos.getY(i);
      ({ b0, b1, w1 } = resolveBandPair(t, trunk.joints, trunkIdxs, trunkBlend));
    } else if (side < 2.5) {
      const t = limbT ? limbT.getX(i) : 0;
      const isL = side < 1.5;
      ({ b0, b1, w1 } = resolveBandPair(
        t,
        isL ? armL.joints : armR.joints,
        isL ? armLIdxs : armRIdxs,
        armL?.blend ?? limbBlend
      ));
      if (spineIdx >= 0 && t < shoulderBlend) {
        const wSpine = 1 - smoothstep(0, shoulderBlend, t);
        const armPrimary = w1 < 0.5 ? b0 : b1;
        b0 = armPrimary;
        b1 = spineIdx;
        w1 = wSpine * 0.65;
      }
    } else {
      const t = limbT ? limbT.getX(i) : 0;
      const isL = side < 3.5;
      ({ b0, b1, w1 } = resolveBandPair(
        t,
        isL ? legL.joints : legR.joints,
        isL ? legLIdxs : legRIdxs,
        legL?.blend ?? limbBlend
      ));
      if (pelvisIdx >= 0 && t < hipBlend) {
        const wPelvis = 1 - smoothstep(0, hipBlend, t);
        const legPrimary = w1 < 0.5 ? b0 : b1;
        b0 = legPrimary;
        b1 = pelvisIdx;
        w1 = wPelvis * 0.6;
      }
    }

    const o = i * 4;
    skinIndex[o] = b0;
    skinIndex[o + 1] = b1;
    skinWeight[o] = 1 - w1;
    skinWeight[o + 1] = w1;
  }

  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeight, 4));
  return geometry;
}

/**
 * @param {import('three').BufferGeometry} geometry
 * @param {import('three').Skeleton} skeleton
 * @param {string|null} boneName
 * @param {object|null} [skinBands]
 */
export function applyExplicitOrDistanceSkin(geometry, skeleton, boneName, skinBands = null) {
  if (skinBands?.kind === "bodySDF") {
    const ok = applyBodySDFSkin(geometry, skeleton, skinBands);
    if (ok) return ok;
  }
  if (skinBands?.kind === "trunkArms") {
    const ok = applyTrunkArmsSkin(geometry, skeleton, skinBands);
    if (ok) return ok;
  }
  if (skinBands?.joints?.length) {
    const ok = applyParamBandSkin(geometry, skeleton, skinBands);
    if (ok) return ok;
  }
  // Legacy dual-band { lowerBone, upperBone, joinY }
  if (skinBands?.lowerBone && skinBands?.upperBone) {
    const ok = applyParamBandSkin(geometry, skeleton, {
      joints: [
        { bone: skinBands.lowerBone, t0: -1e6, t1: skinBands.joinY },
        { bone: skinBands.upperBone, t0: skinBands.joinY, t1: 1e6 },
      ],
      blend: skinBands.blend ?? 0.05,
    });
    if (ok) return ok;
  }
  if (boneName) {
    const idx = boneIndex(skeleton, boneName);
    if (idx >= 0) return applySingleBoneSkin(geometry, idx);
  }
  return applyDistanceSkinWeights(geometry, skeleton);
}

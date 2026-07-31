/**
 * Shared limb centerlines / radii for body + cloth.
 * Matches buildLatheBody arm/leg placement so sleeves and pant legs sit on the same path.
 */
import { mix } from "./latheParts.js";

/**
 * T-pose arm path used by lathe body arms.
 * @param {object} st buildStack result
 */
export function clothArmPath(st = {}) {
  const L = st.L || {};
  const ARM_Z = st.offsets?.ARM_Z ?? 0.04;
  const shoulderX = st.shoulderSocketX ?? L.shoulderX ?? 0.18;
  const ua = Math.min(0.42, Math.max(0.16, L.armLenU ?? 0.28));
  const la = Math.min(0.4, Math.max(0.15, L.armLenL ?? 0.26));
  const elbowX = st.elbowX ?? shoulderX + ua;
  const wristX = st.wristX ?? elbowX + la;
  const y = st.armAttachY ?? L.yShoulder ?? 1.2;
  const joinScaleZ = (L.waistRZ / Math.max(1e-6, L.waistRX ?? 0.12)) * 0.96;
  const torsoHalfW = (L.chestRX ?? 0.15) * joinScaleZ;
  const rShoulder = L.rShoulder ?? 0.048;
  const inset = Math.max(
    rShoulder * 1.7,
    Math.abs(shoulderX) - torsoHalfW + rShoulder * 0.4
  );
  return {
    y,
    z: ARM_Z,
    shoulderX,
    elbowX,
    wristX,
    uaLen: Math.abs(elbowX - shoulderX),
    faLen: Math.abs(wristX - elbowX),
    rShoulder,
    rElbow: L.rElbow ?? 0.038,
    rWrist: L.rWrist ?? 0.03,
    inset,
    /** Cloth ease over skin */
    ease: 1.14,
  };
}

/**
 * Upright leg path used by lathe body legs.
 * @param {object} st buildStack result
 */
export function clothLegPath(st = {}) {
  const L = st.L || {};
  const HIP_Z = st.offsets?.HIP_Z ?? -0.035;
  const SHIN_Z = st.offsets?.SHIN_Z ?? -0.02;
  const FOOT_Z = st.offsets?.FOOT_Z ?? -0.005;
  const thighZ = HIP_Z * 0.4;
  const shinZ = SHIN_Z * 0.5;
  const legZ = mix(thighZ, shinZ, 0.55);
  const ankleY = st.shin?.bot ?? L.yAnkle ?? 0.1;
  const hipY = st.hipSocketY ?? L.yHip ?? 0.9;
  const kneeY = st.kneeY ?? L.yKnee ?? 0.5;
  return {
    legX: st.legX ?? L.legX ?? 0.1,
    /** Same Z as body leg.position.z */
    z: mix(legZ, FOOT_Z, 0.35),
    joinZ: (HIP_Z ?? -0.035) * 0.5,
    hipY,
    kneeY,
    ankleY,
    shinH: st.shin?.h ?? Math.max(0.05, kneeY - ankleY),
    thighH: st.thigh?.h ?? Math.max(0.05, hipY - kneeY),
    rThigh: L.rThigh ?? 0.055,
    rKnee: L.rKnee ?? 0.042,
    rCalf: L.rCalf ?? 0.038,
    rAnkle: L.rAnkle ?? 0.03,
    ease: 1.14,
  };
}

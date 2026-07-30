/**
 * Map AvatarBuilder stack anchors → Mesh2Motion human bone world positions.
 * Avatar faces +Z, Y-up, feet on y=0. Matches static/rigs/rig-human.glb names.
 */
import { buildStack } from "../parts/Stack.js";
import { resolveConfig } from "../AvatarConfig.js";

/**
 * @param {object} partialConfig AvatarBuilder config (partial ok)
 * @returns {{ joints: Record<string, {x:number,y:number,z:number}>, meta: object }}
 */
export function buildJointMap(partialConfig = {}) {
  const cfg = resolveConfig(partialConfig);
  const st = buildStack(cfg);
  const {
    foot, shin, thigh, hip, torso, neck, head,
    kneeY, ankleY, hipSocketY, waistY, shoulderY, shoulderSocketX, armAttachY,
    handH, elbowX, wristX, handX, legX, tw, offsets,
  } = st;

  const ARM_Z = offsets.ARM_Z;
  const HIP_Z = offsets.HIP_Z;
  const SHIN_Z = offsets.SHIN_Z;
  const FOOT_Z = offsets.FOOT_Z;
  const HEAD_Z = offsets.HEAD_Z;
  const armY = armAttachY;

  const v = (x, y, z) => ({ x, y, z });

  /** @type {Record<string, {x:number,y:number,z:number}>} */
  const joints = {
    root: v(0, 0, 0),
    pelvis: v(0, hip.y, HIP_Z),
    spine_01: v(0, torso.bot + torso.h * 0.18, 0),
    spine_02: v(0, torso.y + torso.h * 0.08, 0),
    spine_03: v(0, torso.top - torso.h * 0.1, 0),
    neck_01: v(0, neck.y, HEAD_Z * 0.3),
    head: v(0, head.y, HEAD_Z),
    head_leaf: v(0, head.top + 0.02, HEAD_Z),

    // Mesh2Motion / Mixamo: face +Z → character right = −X (_r), left = +X (_l)
    thigh_r: v(-legX, hipSocketY, HIP_Z * 0.4),
    thigh_l: v(legX, hipSocketY, HIP_Z * 0.4),
    calf_r: v(-legX, kneeY, SHIN_Z * 0.5),
    calf_l: v(legX, kneeY, SHIN_Z * 0.5),
    foot_r: v(-legX, ankleY, FOOT_Z),
    foot_l: v(legX, ankleY, FOOT_Z),
    ball_r: v(-legX, foot.bot + foot.h * 0.35, FOOT_Z + 0.06),
    ball_l: v(legX, foot.bot + foot.h * 0.35, FOOT_Z + 0.06),
    ball_leaf_r: v(-legX, foot.bot + foot.h * 0.2, FOOT_Z + 0.1),
    ball_leaf_l: v(legX, foot.bot + foot.h * 0.2, FOOT_Z + 0.1),

    clavicle_r: v(-tw * 0.38, shoulderY, ARM_Z * 0.35),
    clavicle_l: v(tw * 0.38, shoulderY, ARM_Z * 0.35),
    upperarm_r: v(-shoulderSocketX, armY, ARM_Z),
    upperarm_l: v(shoulderSocketX, armY, ARM_Z),
    lowerarm_r: v(-elbowX, armY, ARM_Z),
    lowerarm_l: v(elbowX, armY, ARM_Z),
    hand_r: v(-wristX, armY, ARM_Z + 0.02),
    hand_l: v(wristX, armY, ARM_Z + 0.02),
  };

  joints.middle_01_r = v(-(handX + handH * 0.2), armY, ARM_Z + 0.02);
  joints.middle_01_l = v(handX + handH * 0.2, armY, ARM_Z + 0.02);

  return {
    joints,
    meta: {
      kneeY,
      ankleY,
      hipSocketY,
      waistY,
      shoulderY,
      totalHeight: st.totalHeight,
      armX: st.armX,
      legX,
      pose: "T",
      elbowX,
      wristX,
      handX,
    },
  };
}

/** @deprecated use buildJointMap(...).joints */
export function buildJointMapLegacy(partialConfig = {}) {
  return buildJointMap(partialConfig).joints;
}

export const JOINT_PLACE_ORDER = [
  "root",
  "pelvis",
  "spine_01",
  "spine_02",
  "spine_03",
  "neck_01",
  "head",
  "head_leaf",
  "thigh_l",
  "calf_l",
  "foot_l",
  "ball_l",
  "ball_leaf_l",
  "thigh_r",
  "calf_r",
  "foot_r",
  "ball_r",
  "ball_leaf_r",
  "clavicle_l",
  "upperarm_l",
  "lowerarm_l",
  "hand_l",
  "middle_01_l",
  "clavicle_r",
  "upperarm_r",
  "lowerarm_r",
  "hand_r",
  "middle_01_r",
];

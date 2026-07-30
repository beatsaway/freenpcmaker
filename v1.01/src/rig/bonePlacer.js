/**
 * Fit Mesh2Motion human armature to an avatar joint map.
 * Rewrites bone *positions* to match this body, then re-aims limb bones
 * along local +Y toward their child (rig-human.glb rest pose is +Y-aligned).
 * That keeps elbow/knee bend axes usable while preventing upper/lower arm
 * axes from drifting when limb lengths differ a lot from the template.
 */
import { Skeleton, Vector3, Quaternion, Matrix4 } from "three";
import { JOINT_PLACE_ORDER } from "./jointMap.js";

const _world = new Vector3();
const _dir = new Vector3();
const _x = new Vector3();
const _z = new Vector3();
const _hint = new Vector3();
const _quat = new Quaternion();
const _parentQ = new Quaternion();
const _pos = new Vector3();
const _m = new Matrix4();
/** Character forward — keeps knee/elbow bend from flipping when limbs are very short/long. */
const TWIST_FORWARD = new Vector3(0, 0, 1);
const TWIST_UP = new Vector3(0, 1, 0);
const TWIST_RIGHT = new Vector3(1, 0, 0);

/** Parent→…→tip chains that must stay +Y-aligned after retarget. */
const AIM_CHAINS = [
  ["clavicle_l", "upperarm_l", "lowerarm_l", "hand_l", "middle_01_l"],
  ["clavicle_r", "upperarm_r", "lowerarm_r", "hand_r", "middle_01_r"],
  ["thigh_l", "calf_l", "foot_l", "ball_l"],
  ["thigh_r", "calf_r", "foot_r", "ball_r"],
];

export function indexBonesByName(root) {
  const map = new Map();
  root.traverse((obj) => {
    if (obj.isBone || obj.type === "Bone") map.set(obj.name, obj);
  });
  return map;
}

export function setBoneWorldPosition(bone, world) {
  if (bone.parent) {
    bone.parent.updateWorldMatrix(true, false);
    bone.position.copy(bone.parent.worldToLocal(world.clone()));
  } else {
    bone.position.copy(world);
  }
  bone.updateMatrix();
  bone.updateWorldMatrix(false, false);
}

/**
 * Rotate bone so local +Y points at target; twist locked to character forward
 * so knee/elbow hinges stay consistent across extreme limb lengths.
 */
export function aimBoneYAtWorld(bone, targetWorld, twistHint = TWIST_FORWARD) {
  if (!bone?.parent) return;
  bone.parent.updateWorldMatrix(true, false);
  bone.getWorldPosition(_pos);
  _dir.copy(targetWorld).sub(_pos);
  const len = _dir.length();
  if (len < 1e-5) return;
  _dir.multiplyScalar(1 / len);

  _hint.copy(twistHint);
  _x.crossVectors(_hint, _dir);
  if (_x.lengthSq() < 1e-8) {
    _x.crossVectors(TWIST_UP, _dir);
    if (_x.lengthSq() < 1e-8) _x.crossVectors(TWIST_RIGHT, _dir);
  }
  _x.normalize();
  _z.crossVectors(_x, _dir).normalize();
  _x.crossVectors(_dir, _z).normalize();
  _m.makeBasis(_x, _dir, _z);
  _quat.setFromRotationMatrix(_m);

  bone.parent.getWorldQuaternion(_parentQ);
  bone.quaternion.copy(_parentQ).invert().multiply(_quat);
  bone.updateMatrix();
  setBoneWorldPosition(bone, _pos);
}

/**
 * Place every mapped bone at the avatar's joint anchors (parents before children),
 * then aim limb bones at their child joints so upper/lower segments stay ordered.
 */
export function placeArmatureFromJointMap(armature, joints, order = JOINT_PLACE_ORDER) {
  const bones = indexBonesByName(armature);
  const placed = [];
  const missing = [];

  armature.position.set(0, 0, 0);
  armature.rotation.set(0, 0, 0);
  armature.scale.set(1, 1, 1);
  armature.updateMatrixWorld(true);

  for (const name of order) {
    const target = joints[name];
    if (!target) continue;
    const bone = bones.get(name);
    if (!bone) {
      missing.push(name);
      continue;
    }
    setBoneWorldPosition(bone, _world.set(target.x, target.y, target.z));
    placed.push(name);
  }

  armature.updateMatrixWorld(true);

  // Aim each limb bone at the next joint. Re-place before aiming so parent
  // rotation changes don't leave children at the wrong world spot.
  for (const chain of AIM_CHAINS) {
    for (let i = 0; i < chain.length - 1; i++) {
      const name = chain[i];
      const childName = chain[i + 1];
      const bone = bones.get(name);
      const joint = joints[name];
      const target = joints[childName];
      if (!bone || !joint || !target) continue;
      setBoneWorldPosition(bone, _world.set(joint.x, joint.y, joint.z));
      aimBoneYAtWorld(bone, new Vector3(target.x, target.y, target.z));
    }
    const tip = chain[chain.length - 1];
    const tipBone = bones.get(tip);
    const tipJoint = joints[tip];
    if (tipBone && tipJoint) {
      setBoneWorldPosition(tipBone, _world.set(tipJoint.x, tipJoint.y, tipJoint.z));
    }
  }

  armature.updateMatrixWorld(true);
  return { placed, missing };
}

/** Snapshot local bone lengths after fit (debug / future scale-retarget). */
export function measureBoneLengths(armature, joints, order = JOINT_PLACE_ORDER) {
  const bones = indexBonesByName(armature);
  const lengths = {};
  for (const name of order) {
    const bone = bones.get(name);
    if (!bone?.parent || !joints[name]) continue;
    const parentName = bone.parent.name;
    if (!joints[parentName]) continue;
    const a = joints[parentName];
    const b = joints[name];
    lengths[name] = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  return lengths;
}

export function boneListFromHierarchy(root) {
  const list = [];
  root.traverse((obj) => {
    if (obj.isBone || obj.type === "Bone") list.push(obj);
  });
  return list;
}

export function createSkeletonFromArmature(armature) {
  const bones = boneListFromHierarchy(armature);
  return new Skeleton(bones);
}

/** Single-bone hands — drop extra finger bones (Mesh2Motion HandHelper subset). */
export function simplifyHandsToSingleBone(armature) {
  const remove = [];
  armature.traverse((child) => {
    if (child.type !== "Bone") return;
    const n = (child.name || "").toLowerCase();
    const isHand = ["hand", "finger", "thumb", "index", "middle", "ring", "pinky"].some((p) =>
      n.includes(p)
    );
    const isPalm =
      n.includes("hand") &&
      !n.includes("thumb") &&
      !n.includes("index") &&
      !n.includes("middle") &&
      !n.includes("ring") &&
      !n.includes("pinky") &&
      !n.includes("finger");
    if (!isHand || isPalm) return;
    if (!n.includes("middle")) {
      remove.push(child);
      return;
    }
    if (n.includes("leaf") || n.includes("03") || n.includes("04") || n.includes("02")) {
      remove.push(child);
    }
  });
  remove.forEach((b) => b.parent?.remove(b));
}

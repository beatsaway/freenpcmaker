/**
 * Fit Mesh2Motion human armature to an avatar joint map.
 * Keeps template bone *rotations* (elbow bend axes / twist match shared clips)
 * and only rewrites *positions* so limb/torso lengths match this body build.
 */
import { Skeleton, Vector3 } from "three";
import { JOINT_PLACE_ORDER } from "./jointMap.js";

const _world = new Vector3();

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
 * Place every mapped bone at the avatar's joint anchors (parents before children).
 * Rotations stay from rig-human.glb so Mixamo/Mesh2Motion quats still make sense.
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
    const isHand = ["hand", "finger", "thumb", "index", "middle", "ring", "pinky"].some((p) => n.includes(p));
    const isPalm = n.includes("hand") && !n.includes("thumb") && !n.includes("index") &&
      !n.includes("middle") && !n.includes("ring") && !n.includes("pinky") && !n.includes("finger");
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

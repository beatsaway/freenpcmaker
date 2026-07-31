/**
 * Auto-rig AvatarBuilder mesh with a *fitted* Mesh2Motion human skeleton.
 * Bone positions come from this avatar's stack; shared clips must be adapted
 * (rotation + root motion only) via adaptClip / getAdaptedClips.
 */
import { Group, SkinnedMesh } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { buildJointMap } from "./jointMap.js";
import { buildAvatarSceneForRig } from "./buildAvatarScene.js";
import {
  placeArmatureFromJointMap,
  createSkeletonFromArmature,
  simplifyHandsToSingleBone,
  measureBoneLengths,
} from "./bonePlacer.js";
import { applyExplicitOrDistanceSkin } from "./explicitSkin.js";
import { HUMAN_TEMPLATE_HEIGHT } from "./adaptClip.js";
import { assetUrl } from "./assetUrl.js";

const RIG_URL = () => assetUrl("rigs/rig-human.glb");

let _rigTemplate = null;

async function loadHumanArmature() {
  if (_rigTemplate) return _rigTemplate.clone(true);
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(RIG_URL());
  let armature = null;
  gltf.scene.traverse((child) => {
    if (armature || child.type !== "Bone") return;
    armature = child.parent;
  });
  if (!armature) throw new Error("No armature found in rig-human.glb");
  _rigTemplate = armature;
  return armature.clone(true);
}

/**
 * @param {object} partialConfig
 */
export async function autoRigAvatar(partialConfig = {}) {
  const { joints, meta } = buildJointMap(partialConfig);
  const { scene: baked } = buildAvatarSceneForRig(partialConfig, { facing: 0 });

  const armature = await loadHumanArmature();
  armature.name = "AvatarArmature";
  simplifyHandsToSingleBone(armature);
  const { placed, missing } = placeArmatureFromJointMap(armature, joints);
  const boneLengths = measureBoneLengths(armature, joints);

  const skeleton = createSkeletonFromArmature(armature);
  skeleton.bones[0]?.updateWorldMatrix(true, true);

  const group = new Group();
  group.name = "AutoRiggedAvatar";
  group.add(armature);

  const skinnedMeshes = [];
  baked.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry) return;
    const geo = obj.geometry.clone();
    applyExplicitOrDistanceSkin(
      geo,
      skeleton,
      obj.userData.skinBone || null,
      obj.userData.skinBands || null
    );
    const mat = Array.isArray(obj.material)
      ? obj.material.map((m) => m.clone())
      : obj.material.clone();
    const sm = new SkinnedMesh(geo, mat);
    sm.name = obj.name || "part";
    sm.castShadow = true;
    sm.receiveShadow = true;
    sm.userData.skinBone = obj.userData.skinBone;
    sm.userData.skinBands = obj.userData.skinBands;
    sm.bind(skeleton);
    group.add(sm);
    skinnedMeshes.push(sm);
  });

  const heightScale = (meta.totalHeight || HUMAN_TEMPLATE_HEIGHT) / HUMAN_TEMPLATE_HEIGHT;
  meta.heightScale = heightScale;
  meta.templateHeight = HUMAN_TEMPLATE_HEIGHT;
  meta.boneLengths = boneLengths;
  meta.placedBones = placed;
  meta.missingBones = missing;

  group.userData.joints = joints;
  group.userData.meta = meta;
  group.userData.skeleton = skeleton;
  group.userData.heightScale = heightScale;

  return { group, skeleton, skinnedMeshes, joints, meta, heightScale };
}

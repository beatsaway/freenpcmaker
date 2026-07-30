/**
 * Flatten LowPolyAvatar for auto-rig.
 * Keeps one mesh per part and preserves userData.skinBone (hofk explicit skinning).
 * Head features stay separate so materials/colors survive.
 */
import * as THREE from "three";
import { AvatarBuilder } from "../AvatarBuilder.js";

/**
 * @param {object} partialConfig
 * @param {{ facing?: number }} [place]
 * @returns {{ scene: THREE.Scene, avatar: THREE.Group }}
 */
export function buildAvatarSceneForRig(partialConfig = {}, place = {}) {
  const avatar = AvatarBuilder.create(partialConfig, { facing: place.facing ?? 0 });
  avatar.updateMatrixWorld(true);

  const scene = new THREE.Scene();
  scene.name = "AvatarBuilderScene";

  avatar.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry) return;

    const geo = obj.geometry.clone();
    geo.applyMatrix4(obj.matrixWorld);
    if (geo.attributes.position) {
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
      geo.computeVertexNormals();
    }

    const mat = Array.isArray(obj.material)
      ? obj.material.map((m) => m.clone())
      : obj.material.clone();

    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = obj.name || "part";
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Propagate hofk-style bone tag (mesh → ancestors → head inference)
    let skinBone = obj.userData.skinBone || null;
    if (!skinBone) {
      let p = obj.parent;
      while (p && !skinBone) {
        if (p.userData?.skinBone) skinBone = p.userData.skinBone;
        p = p.parent;
      }
    }
    if (!skinBone) {
      let p = obj;
      while (p) {
        const n = (p.name || "").toLowerCase();
        if (n === "head" || n.includes("hair") || n.includes("hat")) {
          skinBone = "head";
          break;
        }
        p = p.parent;
      }
    }
    mesh.userData.skinBone = skinBone;
    if (obj.userData.skinBands) {
      const sb = obj.userData.skinBands;
      mesh.userData.skinBands = {
        ...sb,
        attr: sb.attr,
        blend: sb.blend,
        joints: sb.joints ? sb.joints.map((j) => ({ ...j })) : undefined,
        trunk: sb.trunk
          ? { ...sb.trunk, joints: sb.trunk.joints?.map((j) => ({ ...j })) }
          : undefined,
        armL: sb.armL
          ? { ...sb.armL, joints: sb.armL.joints?.map((j) => ({ ...j })) }
          : undefined,
        armR: sb.armR
          ? { ...sb.armR, joints: sb.armR.joints?.map((j) => ({ ...j })) }
          : undefined,
        legL: sb.legL
          ? { ...sb.legL, joints: sb.legL.joints?.map((j) => ({ ...j })) }
          : undefined,
        legR: sb.legR
          ? { ...sb.legR, joints: sb.legR.joints?.map((j) => ({ ...j })) }
          : undefined,
      };
    }

    // Keep limbT (and similar) through bake — used by arm/leg skin bands
    for (const name of ["limbT", "armSide"]) {
      if (obj.geometry.attributes[name] && !geo.attributes[name]) {
        geo.setAttribute(name, obj.geometry.attributes[name].clone());
      }
    }

    scene.add(mesh);
  });

  return { scene, avatar };
}

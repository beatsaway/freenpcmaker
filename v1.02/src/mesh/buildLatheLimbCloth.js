/**
 * Lathe sleeves / pant legs driven by clothArmPath / clothLegPath
 * (same centerlines as buildLatheBody). Used with SDF torso/hip shells.
 */
import * as THREE from "three";
import {
  latheMesh,
  shaftProfile,
  withEndCaps,
  mix,
} from "./latheParts.js";
import { clothArmPath, clothLegPath } from "./limbPath.js";

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
 * Short or long sleeves on the lathe arm path.
 * @returns {THREE.Group|null}
 */
export function buildLatheSleeves(mat, st, style = "tee") {
  const long = style === "hoodie" || style === "jacket";
  const short = style === "tee" || style === "polo";
  if (!long && !short) return null;

  const path = clothArmPath(st);
  const e = path.ease;
  const g = new THREE.Group();
  g.name = "sleeves-lathe";
  g.userData.meshMethod = "lathe-sleeves";

  for (const side of [-1, 1]) {
    const boneUA = side > 0 ? "upperarm_l" : "upperarm_r";
    const boneFA = side > 0 ? "lowerarm_l" : "lowerarm_r";
    const x0 = side * path.shoulderX;
    const y = path.y;
    const z = path.z;

    // Small stub into torso nest — same idea as arm inset, cloth-eased
    const stubLen = Math.min(path.inset * 0.55, path.rShoulder * 1.1);
    if (stubLen > 0.01) {
      const stub = tposeSleeve(
        side,
        stubLen,
        path.rShoulder * e * 0.98,
        path.rShoulder * e,
        mat,
        boneUA,
        10
      );
      // Place so sleeve grows outward from slightly inside the shoulder socket
      stub.position.set(x0 - side * stubLen, y, z);
      g.add(stub);
    }

    if (short) {
      const len = path.uaLen * 0.72;
      const sleeveM = tposeSleeve(
        side,
        len,
        path.rShoulder * e,
        path.rElbow * e,
        mat,
        boneUA
      );
      sleeveM.position.set(x0, y, z);
      g.add(sleeveM);
    } else {
      const upper = tposeSleeve(
        side,
        path.uaLen,
        path.rShoulder * e,
        path.rElbow * e * 1.04,
        mat,
        boneUA
      );
      upper.position.set(x0, y, z);
      g.add(upper);

      const lowerLen = path.faLen * 0.85;
      const lower = tposeSleeve(
        side,
        lowerLen,
        path.rElbow * e * 1.02,
        path.rWrist * e * 1.12,
        mat,
        boneFA
      );
      lower.position.set(side * path.elbowX, y, z);
      g.add(lower);
    }
  }

  return g;
}

/**
 * Pant / shorts legs on the lathe leg path.
 * @returns {THREE.Group|null}
 */
export function buildLathePantLegs(mat, st, opts = {}) {
  const style = opts.style || "pants";
  if (style === "mini-skirt" || style === "skirt") return null;

  const path = clothLegPath(st);
  const e = path.ease;
  const yBot = opts.yBot ?? path.ankleY + 0.02;
  const fullLength = style === "pants" && yBot < path.kneeY - 0.05;
  const g = new THREE.Group();
  g.name = "pant-legs-lathe";
  g.userData.meshMethod = "lathe-pant-legs";

  for (const side of [-1, 1]) {
    const sx = side * path.legX;
    const boneThigh = side > 0 ? "thigh_l" : "thigh_r";
    const boneCalf = side > 0 ? "calf_l" : "calf_r";
    const z = path.z;

    if (fullLength) {
      const calfLen = Math.max(0.05, path.kneeY - yBot);
      const calf = latheMesh(
        shaftProfile(calfLen, path.rAnkle * e * 1.08, path.rKnee * e, path.rCalf * e),
        { material: mat, name: "pant-calf", skinBone: boneCalf, segments: 12 }
      );
      const calfG = withEndCaps(calf, {
        material: mat,
        skinBone: boneCalf,
        r0: path.rAnkle * e * 1.08,
        r1: path.rKnee * e,
      });
      calfG.position.set(sx, yBot, z);
      g.add(calfG);

      const thighLen = Math.max(0.05, path.hipY - path.kneeY);
      const thigh = latheMesh(
        shaftProfile(thighLen, path.rKnee * e, path.rThigh * e, path.rThigh * e * 1.02),
        { material: mat, name: "pant-thigh", skinBone: boneThigh, segments: 12 }
      );
      const thighG = withEndCaps(thigh, {
        material: mat,
        skinBone: boneThigh,
        r0: path.rKnee * e,
        r1: path.rThigh * e,
      });
      thighG.position.set(sx, path.kneeY, z);
      g.add(thighG);
    } else {
      // Shorts / mini-shorts: one thigh tube from hem up to hip
      const y0 = Math.max(yBot, path.ankleY);
      const len = Math.max(0.05, path.hipY - y0);
      const rHem = style === "mini-shorts" ? path.rThigh * e * 0.95 : path.rKnee * e * 1.05;
      const leg = latheMesh(
        shaftProfile(len, rHem, path.rThigh * e, mix(rHem, path.rThigh * e, 0.55)),
        { material: mat, name: "pant-leg", skinBone: boneThigh, segments: 12 }
      );
      const legG = withEndCaps(leg, {
        material: mat,
        skinBone: boneThigh,
        r0: rHem,
        r1: path.rThigh * e,
      });
      legG.position.set(sx, y0, z);
      g.add(legG);
    }
  }

  return g;
}

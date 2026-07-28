/**
 * Distance skinning (Mesh2Motion-style): nearest bone→child midpoint.
 * Includes pelvis crotch filter so hip verts stay on pelvis.
 */
import {
  Vector3, Raycaster, Mesh, MeshBasicMaterial, DoubleSide,
  Float32BufferAttribute, Uint16BufferAttribute,
} from "three";

function midpointToChild(bone) {
  const pos = new Vector3();
  bone.getWorldPosition(pos);
  if (!bone.children.length) return pos;
  const child = bone.children[0];
  if (!child?.isBone && child?.type !== "Bone") return pos;
  const cpos = new Vector3();
  child.getWorldPosition(cpos);
  return pos.clone().lerp(cpos, 0.5);
}

function isLeafBone(bone) {
  const kids = bone.children.filter((c) => c.isBone || c.type === "Bone");
  return kids.length === 0;
}

function crotchYFromPelvis(bones, geometry) {
  const pelvis = bones.find((b) => /pelvis|hips/i.test(b.name));
  if (!pelvis) return -Infinity;
  const mid = midpointToChild(pelvis);
  const ray = new Raycaster(mid, new Vector3(0, -1, 0));
  const tmp = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
  const hits = ray.intersectObject(tmp, false);
  return hits.length ? hits[0].point.y + 0.002 : -Infinity;
}

/**
 * @param {import('three').BufferGeometry} geometry
 * @param {import('three').Skeleton} skeleton
 */
export function applyDistanceSkinWeights(geometry, skeleton) {
  const bones = skeleton.bones;
  const mids = bones.map((b) => midpointToChild(b));
  const skip = new Set();
  bones.forEach((b, i) => {
    if (b.name === "root" || isLeafBone(b)) skip.add(i);
  });

  const crotchY = crotchYFromPelvis(bones, geometry);
  const pos = geometry.attributes.position;
  const n = pos.count;
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);

  const v = new Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i);
    let best = 0;
    let bestD = Infinity;
    for (let bi = 0; bi < bones.length; bi++) {
      if (skip.has(bi)) continue;
      const name = bones[bi].name.toLowerCase();
      if ((name.includes("pelvis") || name.includes("hips")) && v.y < crotchY) continue;
      const d = mids[bi].distanceTo(v);
      if (d < bestD) {
        bestD = d;
        best = bi;
      }
    }
    const o = i * 4;
    skinIndex[o] = best;
    skinWeight[o] = 1;
  }

  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeight, 4));
  return geometry;
}

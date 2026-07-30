/**
 * Lathe of-revolution helpers for Free NPC Maker (Lathe).
 * Profile points use Vector2(x=radius ≥ 0, y=height).
 */
import * as THREE from "three";

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

export function mix(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Sample a radius function along Y into Lathe profile points.
 * @param {(t:number, y:number) => number} radiusAtT  t in [0,1] bottom→top
 * @param {number} y0
 * @param {number} y1
 * @param {number} [steps=10]
 */
export function profileFromFn(radiusAtT, y0, y1, steps = 10) {
  const pts = [];
  const n = Math.max(2, steps | 0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = mix(y0, y1, t);
    const r = Math.max(0.001, radiusAtT(t, y));
    pts.push(new THREE.Vector2(r, y));
  }
  return pts;
}

/**
 * Keyframe radii [ { y, r }, ... ] sorted by y → dense profile.
 */
export function profileFromKeys(keys, stepsPerSeg = 3) {
  const sorted = keys.slice().sort((a, b) => a.y - b.y);
  const pts = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const n = Math.max(1, stepsPerSeg);
    for (let k = 0; k < n; k++) {
      const t = k / n;
      pts.push(new THREE.Vector2(mix(a.r, b.r, t), mix(a.y, b.y, t)));
    }
  }
  const last = sorted[sorted.length - 1];
  pts.push(new THREE.Vector2(last.r, last.y));
  return pts;
}

/**
 * Capsule-like profile along local Y from 0..length (for limbs).
 * @param {number} len
 * @param {number} r0 bottom radius
 * @param {number} r1 top radius
 * @param {number} [midR] optional belly
 */
export function shaftProfile(len, r0, r1, midR = null) {
  const mid = midR != null ? midR : mix(r0, r1, 0.5) * 1.05;
  return profileFromKeys(
    [
      { y: 0, r: Math.max(0.004, r0 * 0.55) },
      { y: len * 0.08, r: r0 },
      { y: len * 0.5, r: mid },
      { y: len * 0.92, r: r1 },
      { y: len, r: Math.max(0.004, r1 * 0.55) },
    ],
    2
  );
}

/**
 * @param {THREE.Vector2[]} points
 * @param {object} opts
 * @param {THREE.Material} opts.material
 * @param {string} [opts.name]
 * @param {string} [opts.skinBone]
 * @param {number} [opts.segments=16]
 * @param {number} [opts.phiStart]
 * @param {number} [opts.phiLength]
 */
export function latheMesh(points, opts = {}) {
  const segments = opts.segments ?? 16;
  const geo = new THREE.LatheGeometry(
    points,
    segments,
    opts.phiStart ?? 0,
    opts.phiLength ?? Math.PI * 2
  );
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, opts.material);
  if (opts.name) mesh.name = opts.name;
  if (opts.skinBone) mesh.userData.skinBone = opts.skinBone;
  mesh.userData.meshMethod = "lathe";
  // Remember end radii so callers can plug holes with capDisc
  if (points?.length) {
    mesh.userData.latheR0 = points[0].x;
    mesh.userData.latheR1 = points[points.length - 1].x;
    mesh.userData.latheY0 = points[0].y;
    mesh.userData.latheY1 = points[points.length - 1].y;
  }
  return mesh;
}

/**
 * Flat circle to plug an open lathe end. Circle lies in local XY (normal +Z);
 * rotate to face along the shaft axis as needed.
 * @param {number} radius
 * @param {object} opts
 */
export function capDisc(radius, opts = {}) {
  const r = Math.max(0.001, radius);
  const segments = opts.segments ?? 16;
  const geo = new THREE.CircleGeometry(r, segments);
  const mesh = new THREE.Mesh(geo, opts.material);
  if (opts.name) mesh.name = opts.name;
  if (opts.skinBone) mesh.userData.skinBone = opts.skinBone;
  mesh.userData.meshMethod = "lathe-cap";
  mesh.userData.capRadius = r;
  // Default: face −Y (plug the bottom / proximal open end of a Y-up lathe)
  if (opts.face === "+y") mesh.rotation.x = -Math.PI / 2;
  else if (opts.face === "-y" || opts.face == null) mesh.rotation.x = Math.PI / 2;
  else if (opts.face === "+z") mesh.rotation.set(0, 0, 0);
  else if (opts.face === "-z") mesh.rotation.y = Math.PI;
  return mesh;
}

/**
 * Attach disc caps at ends of a Y-up lathe mesh (local Y = y0..y1).
 * @param {THREE.Mesh} shaftMesh
 * @param {{ material?: THREE.Material, skinBone?: string, segments?: number, r0?: number, r1?: number, cap0?: boolean, cap1?: boolean }} [opts]
 * @returns {THREE.Group}
 */
export function withEndCaps(shaftMesh, opts = {}) {
  const g = new THREE.Group();
  g.name = (shaftMesh.name || "shaft") + "-capped";
  if (opts.skinBone || shaftMesh.userData.skinBone) {
    g.userData.skinBone = opts.skinBone || shaftMesh.userData.skinBone;
  }
  g.add(shaftMesh);

  const mat = opts.material || shaftMesh.material;
  const mat1 = opts.material1 || mat;
  const bone = opts.skinBone || shaftMesh.userData.skinBone;
  const bone1 = opts.skinBone1 || bone;
  const segs = opts.segments ?? 12;
  const y0 = shaftMesh.userData.latheY0 ?? 0;
  const y1 = shaftMesh.userData.latheY1 ?? 0;
  const r0 = opts.r0 ?? shaftMesh.userData.latheR0 ?? 0.01;
  const r1 = opts.r1 ?? shaftMesh.userData.latheR1 ?? 0.01;
  const do0 = opts.cap0 !== false;
  const do1 = opts.cap1 !== false;

  if (do0 && r0 > 0.002) {
    const c0 = capDisc(r0, { material: mat, skinBone: bone, segments: segs, face: "-y", name: "cap0" });
    c0.position.y = y0;
    g.add(c0);
  }
  if (do1 && r1 > 0.002) {
    const c1 = capDisc(r1, { material: mat1, skinBone: bone1, segments: segs, face: "+y", name: "cap1" });
    c1.position.y = y1;
    g.add(c1);
  }
  return g;
}

const _yAxis = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _quat = new THREE.Quaternion();

/**
 * Place a Y-up lathe shaft so its local Y=0..len maps from→to.
 * @param {THREE.Mesh} mesh
 * @param {THREE.Vector3|number[]} from
 * @param {THREE.Vector3|number[]} to
 */
export function placeLimb(mesh, from, to) {
  const a = from.isVector3 ? from : new THREE.Vector3().fromArray(from);
  const b = to.isVector3 ? to : new THREE.Vector3().fromArray(to);
  _dir.subVectors(b, a);
  const len = _dir.length();
  if (len < 1e-6) {
    mesh.position.copy(a);
    return mesh;
  }
  _dir.multiplyScalar(1 / len);
  _quat.setFromUnitVectors(_yAxis, _dir);
  mesh.quaternion.copy(_quat);
  _mid.copy(a);
  mesh.position.copy(_mid);
  return mesh;
}

/** Ellipsoid front +Z at (x,y) for a skull centered at (0, cy, 0). */
export function ellipsoidFrontZ(x, y, { hw, hh, hd, headY, clearance = 0 }) {
  const cy = headY ?? 0;
  const nx = x / Math.max(1e-6, hw);
  const ny = (y - cy) / Math.max(1e-6, hh);
  const s = 1 - nx * nx - ny * ny;
  if (s <= 0) return clearance;
  return hd * Math.sqrt(s) + clearance;
}

/** Ellipsoid side |X| at (y,z). */
export function ellipsoidSideX(y, z, side, { hw, hh, hd, headY, clearance = 0 }) {
  const cy = headY ?? 0;
  const s = side >= 0 ? 1 : -1;
  const ny = (y - cy) / Math.max(1e-6, hh);
  const nz = z / Math.max(1e-6, hd);
  const rem = 1 - ny * ny - nz * nz;
  if (rem <= 0) return s * clearance;
  return s * (hw * Math.sqrt(rem) + clearance);
}

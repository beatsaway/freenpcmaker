/**
 * Elliptic tube loft along a centerline — the core “grow mesh” primitive.
 * Stable quads, sealed tips optional. No marching cubes.
 */
import * as THREE from "three";

function asRadii(r) {
  if (r == null) return { rx: 0.04, rz: 0.04 };
  if (typeof r === "number") return { rx: r, rz: r };
  return { rx: r.rx ?? r.r ?? 0.04, rz: r.rz ?? r.r ?? r.rx ?? 0.04 };
}

/**
 * Parallel-transport frames along a polyline (avoids Frenet twists).
 * @param {THREE.Vector3[]} centers
 * @returns {{ T: THREE.Vector3, N: THREE.Vector3, B: THREE.Vector3 }[]}
 */
export function tubeFrames(centers) {
  const n = centers.length;
  const frames = [];
  const T = centers.map((_, i) => {
    if (i === 0) return centers[1].clone().sub(centers[0]).normalize();
    if (i === n - 1) return centers[n - 1].clone().sub(centers[n - 2]).normalize();
    return centers[i + 1].clone().sub(centers[i - 1]).normalize();
  });

  // Initial normal: prefer world-up projected off tangent
  let N = new THREE.Vector3(0, 1, 0);
  if (Math.abs(T[0].dot(N)) > 0.9) N.set(1, 0, 0);
  N = N.clone().sub(T[0].clone().multiplyScalar(N.dot(T[0]))).normalize();
  let B = new THREE.Vector3().crossVectors(T[0], N).normalize();

  frames.push({ T: T[0].clone(), N: N.clone(), B: B.clone() });

  for (let i = 1; i < n; i++) {
    const axis = new THREE.Vector3().crossVectors(T[i - 1], T[i]);
    const axisLen = axis.length();
    if (axisLen > 1e-6) {
      const angle = Math.acos(clamp(T[i - 1].dot(T[i]), -1, 1));
      axis.multiplyScalar(1 / axisLen);
      N.applyAxisAngle(axis, angle);
      B.applyAxisAngle(axis, angle);
    }
    // Re-orthonormalize
    N.sub(T[i].clone().multiplyScalar(N.dot(T[i]))).normalize();
    B.crossVectors(T[i], N).normalize();
    N.crossVectors(B, T[i]).normalize();
    frames.push({ T: T[i].clone(), N: N.clone(), B: B.clone() });
  }
  return frames;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * @param {object} opts
 * @param {THREE.Vector3[]} opts.centers  centerline samples (2+)
 * @param {Array<number|{rx:number,rz:number}>} opts.radii  per sample
 * @param {number} [opts.radialSegments=12]
 * @param {boolean} [opts.sealStart=false]  collapse first ring to a point
 * @param {boolean} [opts.sealEnd=false]    collapse last ring to a point
 * @param {number} [opts.limbT0=0]  baked limbT at start
 * @param {number} [opts.limbT1=1]  baked limbT at end
 * @param {number} [opts.partId=0]  0 trunk, 1/2 arms, 3/4 legs
 * @returns {THREE.BufferGeometry}
 */
export function loftTube(opts) {
  const {
    centers,
    radii,
    radialSegments = 12,
    sealStart = false,
    sealEnd = false,
    limbT0 = 0,
    limbT1 = 1,
    partId = 0,
  } = opts;

  if (!centers || centers.length < 2) {
    throw new Error("loftTube: need ≥2 centers");
  }

  const segs = Math.max(6, radialSegments | 0);
  const frames = tubeFrames(centers);
  const ringCount = centers.length;
  const positions = [];
  const normals = [];
  const limbT = [];
  const part = [];
  const indices = [];

  for (let i = 0; i < ringCount; i++) {
    const c = centers[i];
    const { T, N, B } = frames[i];
    let { rx, rz } = asRadii(radii[i] ?? radii[radii.length - 1]);
    if ((sealStart && i === 0) || (sealEnd && i === ringCount - 1)) {
      rx = 0;
      rz = 0;
    }
    const t = limbT0 + (limbT1 - limbT0) * (i / (ringCount - 1));

    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // Ellipse in N–B plane (N≈“up/side”, B≈“side/depth” depending on chain)
      const ox = N.x * ca * rx + B.x * sa * rz;
      const oy = N.y * ca * rx + B.y * sa * rz;
      const oz = N.z * ca * rx + B.z * sa * rz;
      positions.push(c.x + ox, c.y + oy, c.z + oz);

      const nx = N.x * ca * (rx > 1e-8 ? 1 : 0) + B.x * sa * (rz > 1e-8 ? 1 : 0);
      const ny = N.y * ca * (rx > 1e-8 ? 1 : 0) + B.y * sa * (rz > 1e-8 ? 1 : 0);
      const nz = N.z * ca * (rx > 1e-8 ? 1 : 0) + B.z * sa * (rz > 1e-8 ? 1 : 0);
      const nlen = Math.hypot(nx, ny, nz) || 1;
      normals.push(nx / nlen, ny / nlen, nz / nlen);
      // Tip normals along ±T
      if (rx < 1e-8 && rz < 1e-8) {
        const s = sealStart && i === 0 ? -1 : 1;
        normals[normals.length - 3] = T.x * s;
        normals[normals.length - 2] = T.y * s;
        normals[normals.length - 1] = T.z * s;
      }

      limbT.push(t);
      part.push(partId);
    }
  }

  for (let i = 0; i < ringCount - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const j2 = (j + 1) % segs;
      const a = i * segs + j;
      const b = i * segs + j2;
      const c = (i + 1) * segs + j;
      const d = (i + 1) * segs + j2;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("limbT", new THREE.Float32BufferAttribute(limbT, 1));
  geo.setAttribute("partId", new THREE.Float32BufferAttribute(part, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Concatenate tube geos; remaps material groups via face classifier.
 * @param {{ geo: THREE.BufferGeometry, matIndex: (a:number,b:number,c:number)=>number }[]} parts
 * @param {number} matCount
 */
export function mergeTubeParts(parts, matCount) {
  let vBase = 0;
  const pos = [];
  const nrm = [];
  const limbT = [];
  const partId = [];
  const buckets = Array.from({ length: matCount }, () => []);

  for (const { geo, matIndex } of parts) {
    const p = geo.attributes.position;
    const n = geo.attributes.normal;
    const lt = geo.attributes.limbT;
    const pid = geo.attributes.partId;
    const idx = geo.index;
    const nV = p.count;

    for (let i = 0; i < nV; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      if (n) nrm.push(n.getX(i), n.getY(i), n.getZ(i));
      else nrm.push(0, 1, 0);
      limbT.push(lt ? lt.getX(i) : 0);
      partId.push(pid ? pid.getX(i) : 0);
    }

    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i);
      const b = idx.getX(i + 1);
      const c = idx.getX(i + 2);
      const mi = matIndex(a, b, c);
      buckets[mi].push(vBase + a, vBase + b, vBase + c);
    }
    vBase += nV;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  out.setAttribute("limbT", new THREE.Float32BufferAttribute(limbT, 1));
  out.setAttribute("partId", new THREE.Float32BufferAttribute(partId, 1));
  const flat = buckets.flat();
  out.setIndex(flat);
  out.clearGroups();
  let start = 0;
  for (let g = 0; g < matCount; g++) {
    out.addGroup(start, buckets[g].length, g);
    start += buckets[g].length;
  }
  out.computeVertexNormals();
  return out;
}

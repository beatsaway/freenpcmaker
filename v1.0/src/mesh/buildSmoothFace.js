/**
 * Smooth face / cranium shell via SDF → marching cubes.
 * A closed head blob with a clear chin — no soft taper into the neck.
 * Eyes, nose, ears, brows stay as separate feature meshes.
 */
import * as THREE from "three";
import {
  clamp, mix, smin, smax, sdSphere, sdEllipsoid, marchField,
} from "./sdfCore.js";

/**
 * Analytic head SDF (negative = inside). Shared with feature placement.
 * @param {number} px
 * @param {number} py
 * @param {number} pz
 * @param {{ hw:number, hh:number, hd:number, headY:number, roundness?:number }} opts
 */
export function evalFaceSdf(px, py, pz, opts = {}) {
  const hw = opts.hw ?? 0.16;
  const hh = opts.hh ?? 0.2;
  const hd = opts.hd ?? 0.18;
  const cy = opts.headY ?? 1.66;
  const round = clamp(opts.roundness ?? 1, 0.45, 1.25);

  const rx = hw * 0.5;
  const ry = hh * 0.5;
  const rz = Math.max(hd * 0.5, rx * mix(0.78, 0.88, clamp((round - 0.45) / 0.8, 0, 1)));
  const rT = clamp((round - 0.45) / 0.8, 0, 1);
  // Low roundness = tighter joins (squarer); high = soft blob
  const k = mix(0.012, 0.048, rT);

  const lx = px;
  const ly = py - cy;
  const lz = pz;

  const cranRx = rx * mix(1.02, 1.12, rT);
  const cranRy = ry * mix(0.94, 1.02, rT);
  const cranRz = rz * mix(1.0, 1.1, rT);
  let d = sdEllipsoid(lx, ly, lz, 0, ry * 0.06, -rz * 0.04, cranRx, cranRy, cranRz);

  d = smin(
    d,
    sdEllipsoid(lx, ly, lz, 0, ry * 0.4, -rz * 0.02, cranRx * 0.9, ry * 0.45, cranRz * 0.9),
    k
  );
  // Mid face / cheeks — rounder fills out, squarer stays flatter
  d = smin(
    d,
    sdEllipsoid(
      lx,
      ly,
      lz,
      0,
      -ry * 0.02,
      rz * mix(0.08, 0.14, rT),
      rx * mix(0.88, 1.04, rT),
      ry * mix(0.36, 0.44, rT),
      rz * mix(0.5, 0.62, rT)
    ),
    k
  );
  // Jaw — squarer = wider / flatter block; rounder = softer oval
  d = smin(
    d,
    sdEllipsoid(
      lx,
      ly,
      lz,
      0,
      -ry * mix(0.34, 0.4, rT),
      rz * mix(0.06, 0.1, rT),
      rx * mix(0.84, 0.74, rT),
      ry * mix(0.32, 0.38, rT),
      rz * mix(0.5, 0.6, rT)
    ),
    k * 0.9
  );

  const chinY = -ry * mix(0.68, 0.74, rT);
  const chinZ = rz * mix(0.28, 0.34, rT);
  const chinR = rx * mix(0.3, 0.44, rT);
  d = smin(d, sdSphere(lx, ly, lz, 0, chinY, chinZ, chinR), k * mix(0.55, 0.85, rT));
  d = smin(
    d,
    sdEllipsoid(
      lx,
      ly,
      lz,
      0,
      chinY + ry * 0.08,
      chinZ * 0.7,
      rx * mix(0.48, 0.38, rT),
      ry * mix(0.14, 0.2, rT),
      rz * mix(0.24, 0.3, rT)
    ),
    k * 0.8
  );

  const chinFloor = chinY - chinR * 0.85;
  d = smax(d, chinFloor - ly, 0.012);
  return d - 0.002;
}

/**
 * Front surface +Z at (x,y) from analytic SDF, plus clearance so features sit outside.
 */
export function faceSurfaceZFromSdf(x, y, opts = {}, clearance = 0.014) {
  const hd = opts.hd ?? 0.18;
  let lo = -hd;
  let hi = hd * 1.4;
  // Ensure hi is outside
  for (let i = 0; i < 8 && evalFaceSdf(x, y, hi, opts) < 0; i++) hi += hd * 0.25;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) * 0.5;
    if (evalFaceSdf(x, y, mid, opts) < 0) lo = mid;
    else hi = mid;
  }
  return hi + clearance;
}

/**
 * Raycast the actual cranium mesh along −Z so features clear smoothed geometry.
 * Falls back to analytic SDF if no hit.
 */
export function faceSurfaceZ(mesh, x, y, opts = {}, clearance = 0.016) {
  const fallback = faceSurfaceZFromSdf(x, y, opts, clearance);
  if (!mesh?.geometry) return fallback;

  if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
  const raycaster = new THREE.Raycaster();
  const origin = new THREE.Vector3(x, y, (opts.hd ?? 0.18) * 2 + 0.5);
  const dir = new THREE.Vector3(0, 0, -1);
  raycaster.set(origin, dir);
  raycaster.near = 0;
  raycaster.far = origin.z + 1;
  const hits = raycaster.intersectObject(mesh, false);
  if (!hits.length) return fallback;

  // First hit from outside is the front skin
  return hits[0].point.z + clearance;
}

/**
 * Side surface |X| at (y,z) from analytic SDF (side = +1 right / −1 left).
 */
export function headSurfaceXFromSdf(y, z, side, opts = {}, clearance = 0.012) {
  const hw = opts.hw ?? 0.16;
  const s = side >= 0 ? 1 : -1;
  let lo = 0;
  let hi = hw * 1.2;
  for (let i = 0; i < 8 && evalFaceSdf(s * hi, y, z, opts) < 0; i++) hi += hw * 0.25;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) * 0.5;
    if (evalFaceSdf(s * mid, y, z, opts) < 0) lo = mid;
    else hi = mid;
  }
  return s * (hi + clearance);
}

/**
 * Side skin X from mesh raycast (±X), with SDF fallback.
 */
export function headSurfaceX(mesh, y, z, side, opts = {}, clearance = 0.014) {
  const fallback = headSurfaceXFromSdf(y, z, side, opts, clearance);
  if (!mesh?.geometry) return fallback;

  if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
  const s = side >= 0 ? 1 : -1;
  const hw = opts.hw ?? 0.16;
  const raycaster = new THREE.Raycaster();
  const origin = new THREE.Vector3(s * (hw * 2 + 0.4), y, z);
  const dir = new THREE.Vector3(-s, 0, 0);
  raycaster.set(origin, dir);
  raycaster.near = 0;
  raycaster.far = Math.abs(origin.x) + 1;
  const hits = raycaster.intersectObject(mesh, false);
  if (!hits.length) return fallback;
  return hits[0].point.x + s * clearance;
}

/**
 * @param {THREE.Material} mat skin material
 * @param {{ hw:number, hh:number, hd:number, headY:number, roundness?:number, resolution?:number }} opts
 */
export function buildSmoothFace(mat, opts = {}) {
  const hw = opts.hw ?? 0.16;
  const hh = opts.hh ?? 0.2;
  const hd = opts.hd ?? 0.18;
  const cy = opts.headY ?? 1.66;
  const round = clamp(opts.roundness ?? 1, 0.25, 1.35);
  const res = opts.resolution ?? 36;

  const rx = hw * 0.5;
  const ry = hh * 0.5;
  const rz = hd * 0.5;

  const pad = 0.055;
  const chinExtent = ry * 0.72 + rx * 0.45;
  const x0 = -rx - pad;
  const x1 = rx + pad;
  const y0 = cy - chinExtent - pad;
  const y1 = cy + ry + pad;
  const z0 = -rz - pad;
  const z1 = rz + pad;

  const nx = res;
  const ny = res + 2;
  const nz = res;
  const field = new Float32Array(nx * ny * nz);

  for (let iz = 0; iz < nz; iz++) {
    const pz = mix(z0, z1, iz / (nz - 1));
    for (let iy = 0; iy < ny; iy++) {
      const py = mix(y0, y1, iy / (ny - 1));
      for (let ix = 0; ix < nx; ix++) {
        const px = mix(x0, x1, ix / (nx - 1));
        field[ix + nx * (iy + ny * iz)] = evalFaceSdf(px, py, pz, opts);
      }
    }
  }

  const geo = marchField(field, nx, ny, nz, x0, x1, y0, y1, z0, z1, {
    smoothIters: 4,
    smoothStrength: 0.65,
  });
  if (!geo) return null;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "face";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.meshMethod = "sdf-face";
  mesh.userData.faceSize = { hw, hh, hd, headY: cy, roundness: round };
  mesh.userData.faceOpts = { hw, hh, hd, headY: cy, roundness: round };
  return mesh;
}

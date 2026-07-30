/**
 * Head mesh — Loomis primitives soft-unioned via SDF → one low-poly mesh:
 *   1) Sphere cranium
 *   2) Inverted-trapezoid jaw (wide top → narrow bottom), pitched into ball
 *   3) Soft triangle chin
 * Analytic probes kept for eye/nose seating.
 */
import * as THREE from "three";
import { clamp, mix, ellipsoidFrontZ, ellipsoidSideX } from "./latheParts.js";
import { smin, sdSphere, sdEllipsoid, marchField } from "./sdfCore.js";

/** Resolve Loomis ball radius from opts (R, or hh = 1.5 R). */
export function loomisR(opts = {}) {
  if (opts.R != null && Number.isFinite(opts.R)) return Math.max(1e-4, opts.R);
  const hh = opts.hh ?? 0.1;
  return Math.max(1e-4, hh / 1.5);
}

/**
 * Layout for sphere + inverted-trapezoid jaw + triangle chin.
 * Practical: jaw shorter than theory 2R, dropped below ball mid, Z eased back.
 */
export function jawLayout(opts = {}) {
  const Rfull = loomisR(opts);
  // Cranial ball slightly smaller than the layout R; jaw/chin take more of the face
  const ballScale = opts.ballScale ?? 0.88;
  const R = Rfull * ballScale;
  const cy = opts.headY ?? 0;
  const round = clamp(opts.roundness ?? 1, 0.45, 1.35);
  const rT = clamp((round - 0.45) / 0.8, 0, 1);
  const length = opts.length ?? 1;
  const widthFac = (opts.width ?? 1) * 0.5 + 0.5;

  // Jaw sized from full reference R so lower face stays big while ball shrinks
  const jawMeshLen = Rfull * Math.min(2.25, Math.max(1.6, 1.95 + (length - 1) * 0.35));
  const jawDrop = Rfull * 0.12;

  const hw = opts.hw ?? R;
  const hd = opts.hd ?? R;

  const jawTopW = Rfull * 2 * mix(0.88, 1.0, rT) * widthFac;
  const jawBotW = jawTopW * mix(0.55, 0.64, rT);
  const jawH = jawMeshLen * 0.74;
  const jawD = Rfull * mix(0.72, 0.88, rT);
  const jawTopY = cy - jawDrop;
  const jawY = jawTopY - jawH * 0.5;
  const jawZ = R * 0.42;
  const jawTiltX = -0.18;

  const chinW = jawBotW * mix(1.05, 1.14, rT);
  const chinTipW = chinW * mix(0.3, 0.38, rT);
  const chinH = Rfull * mix(0.36, 0.46, rT);
  const chinD = jawD * 0.72;
  const chinY = jawTopY - jawH - chinH * 0.4;
  const chinZ = R * 0.44;
  const chinExtraTilt = -0.06;

  const chinTipY = chinY - chinH * 0.5;
  const jawLen = cy - chinTipY;

  const pivotY = jawTopY;
  const pivotZ = jawZ * 0.55;
  const jawLocalY = -jawH * 0.5;
  const jawLocalZ = jawZ * 0.45;
  const chinLocalY = -(jawH + chinH * 0.35);
  const chinLocalZ = jawZ * 0.5;

  return {
    R,
    Rfull,
    ballScale,
    hw,
    hh: opts.hh ?? Rfull * 1.55,
    hd,
    cy,
    round,
    rT,
    jawDrop,
    jawMeshLen,
    jawLen,
    jawTopW,
    jawBotW,
    jawW: jawTopW,
    jawH,
    jawD,
    jawY,
    jawZ,
    jawTopY,
    jawTiltX,
    chinW,
    chinTipW,
    chinH,
    chinD,
    chinY,
    chinZ,
    chinExtraTilt,
    pivotY,
    pivotZ,
    jawLocalY,
    jawLocalZ,
    chinLocalY,
    chinLocalZ,
    jawFront: jawZ + jawD * 0.5,
    chinFront: chinZ + chinD * 0.5,
    chinTipY,
    crownY: cy + R,
  };
}

/** Axis-aligned box SDF (half-extents). */
function sdBox(px, py, pz, hx, hy, hz) {
  const qx = Math.abs(px) - hx;
  const qy = Math.abs(py) - hy;
  const qz = Math.abs(pz) - hz;
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  const oz = Math.max(qz, 0);
  return Math.hypot(ox, oy, oz) + Math.min(Math.max(qx, qy, qz), 0);
}

/** Tapered prism: width from botW (y=-h/2) to topW (y=+h/2). */
function sdTaperPrism(px, py, pz, topW, botW, h, d) {
  const t = clamp(py / Math.max(1e-6, h * 0.5) * 0.5 + 0.5, 0, 1);
  const hw = mix(botW, topW, t) * 0.5;
  return sdBox(px, py, pz, hw, h * 0.5, d * 0.5);
}

function rotX(px, py, pz, ang) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return { x: px, y: py * c - pz * s, z: py * s + pz * c };
}

/** SDF of the three Loomis parts soft-unioned (negative = inside). */
export function sdLoomisHead(px, py, pz, J) {
  const sx = mix(J.R, J.hw, 0.3);
  const sz = mix(J.R, J.hd, 0.2);
  let d = sdSphere(px / sx, (py - J.cy) / J.R, pz / sz, 0, 0, 0, 1) * Math.min(sx, J.R, sz);

  const lx = px;
  const ly = py - J.pivotY;
  const lz = pz - J.pivotZ;
  const inv = rotX(lx, ly, lz, -J.jawTiltX);

  const jx = inv.x;
  const jy = inv.y - J.jawLocalY;
  const jz = inv.z - J.jawLocalZ;
  const dJaw = sdTaperPrism(jx, jy, jz, J.jawTopW, J.jawBotW, J.jawH, J.jawD);

  const chin = rotX(inv.x, inv.y - J.chinLocalY, inv.z - J.chinLocalZ, -J.chinExtraTilt);
  const dChin = sdTaperPrism(chin.x, chin.y, chin.z, J.chinW, J.chinTipW, J.chinH, J.chinD);

  // Front face fill — ball∪jaw soft-min leaves a crease at nose/mouth;
  // at low march res that groove opens into holes. Plug it (use fuller jaw scale).
  const Rf = J.Rfull ?? J.R / (J.ballScale || 0.88);
  const dFace = sdEllipsoid(
    px,
    py,
    pz,
    0,
    J.cy - Rf * 0.5,
    J.R * 0.55,
    Rf * 0.62,
    Rf * 0.95,
    J.R * 0.52
  );

  const k = Rf * 0.18;
  d = smin(d, dJaw, k);
  d = smin(d, dChin, k * 0.9);
  d = smin(d, dFace, k * 1.15);
  return d;
}

/** Front +Z of cranial ball ∪ forward jaw/chin (for feature seating). */
export function faceSurfaceZFromProfile(x, y, opts = {}, clearance = 0.014) {
  const J = jawLayout(opts);
  const ballZ = ellipsoidFrontZ(x, y, {
    hw: J.R,
    hh: J.R,
    hd: J.R,
    headY: J.cy,
    clearance: 0,
  });

  let jawZ = 0;
  const yTop = J.jawTopY;
  const yBot = J.chinTipY;
  if (y <= yTop + J.R * 0.02 && y >= yBot - J.R * 0.02) {
    const t = clamp((y - yBot) / Math.max(1e-6, yTop - yBot), 0, 1);
    const jawBand = J.jawH / Math.max(1e-6, yTop - yBot);
    let halfW;
    if (t > 1 - jawBand) {
      const u = (t - (1 - jawBand)) / jawBand;
      halfW = mix(J.jawBotW, J.jawTopW, u) * 0.5;
    } else {
      const u = t / Math.max(1e-6, 1 - jawBand);
      halfW = mix(J.chinTipW * 0.5, J.chinW * 0.5, u);
    }
    const nx = Math.abs(x) / Math.max(1e-6, halfW);
    if (nx < 1.05) {
      const side = Math.sqrt(Math.max(0, 1 - Math.min(1, nx) * Math.min(1, nx)));
      const front = mix(J.chinFront, J.jawFront, Math.min(1, t * 1.05));
      jawZ = front * side * mix(0.75, 1, t);
    }
  }

  return Math.max(ballZ, jawZ) + clearance;
}

/** @deprecated name alias for callers expecting *FromSdf */
export const faceSurfaceZFromSdf = faceSurfaceZFromProfile;

export function faceSurfaceZ(mesh, x, y, opts = {}, clearance = 0.016) {
  const fallback = faceSurfaceZFromProfile(x, y, opts, clearance);
  if (!mesh?.geometry) return fallback;
  if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
  const raycaster = new THREE.Raycaster();
  const origin = new THREE.Vector3(x, y, (opts.hd ?? opts.R ?? 0.1) * 2 + 0.5);
  raycaster.set(origin, new THREE.Vector3(0, 0, -1));
  raycaster.near = 0;
  raycaster.far = origin.z + 1;
  const hits = raycaster.intersectObject(mesh, true);
  if (!hits.length) return fallback;
  return hits[0].point.z + clearance;
}

export function headSurfaceXFromProfile(y, z, side, opts = {}, clearance = 0.012) {
  const R = loomisR(opts);
  return ellipsoidSideX(y, z, side, {
    hw: R,
    hh: R,
    hd: R,
    headY: opts.headY ?? 0,
    clearance,
  });
}

export const headSurfaceXFromSdf = headSurfaceXFromProfile;

export function headSurfaceX(mesh, y, z, side, opts = {}, clearance = 0.014) {
  const fallback = headSurfaceXFromProfile(y, z, side, opts, clearance);
  if (!mesh?.geometry) return fallback;
  if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
  const s = side >= 0 ? 1 : -1;
  const R = loomisR(opts);
  const raycaster = new THREE.Raycaster();
  const origin = new THREE.Vector3(s * (R * 2 + 0.4), y, z);
  raycaster.set(origin, new THREE.Vector3(-s, 0, 0));
  raycaster.near = 0;
  raycaster.far = Math.abs(origin.x) + 1;
  const hits = raycaster.intersectObject(mesh, true);
  if (!hits.length) return fallback;
  return hits[0].point.x + s * clearance;
}

/**
 * One mesh: sphere ∪ trap jaw ∪ soft chin (SDF soft-union, low-poly march).
 * Sample box must fully enclose the head — if the front face clips the volume,
 * marching cubes leaves open holes (often right where the nose/mouth stick out).
 */
export function buildLatheFace(mat, opts = {}) {
  const J = jawLayout(opts);
  const res = opts.resolution ?? 22;

  // Generous pad: tilted jaw/chin reach further +Z than unrotated jawFront suggests
  const pad = J.R * 0.55;
  const frontReach =
    Math.max(J.R, J.jawFront, J.chinFront, J.pivotZ + J.jawD * 0.75 + J.R * 0.35) + J.R * 0.25;
  let x0 = -Math.max(J.jawTopW * 0.55, J.R) - pad;
  let x1 = -x0;
  let y0 = J.chinTipY - pad;
  let y1 = J.crownY + pad;
  let z0 = -J.R - pad;
  let z1 = frontReach + pad;

  // Grow box until every boundary sample is outside (SDF > 0) — prevents MC open holes
  for (let grow = 0; grow < 4; grow++) {
    const probes = [
      [0, J.cy, z1],
      [0, J.cy, z0],
      [0, y1, 0],
      [0, y0, J.chinFront * 0.5],
      [x1, J.cy, J.R * 0.3],
      [x0, J.cy, J.R * 0.3],
      [0, J.jawY, z1],
      [0, J.chinY, z1],
    ];
    let ok = true;
    for (const [px, py, pz] of probes) {
      if (sdLoomisHead(px, py, pz, J) < J.R * 0.04) {
        ok = false;
        break;
      }
    }
    if (ok) break;
    const g = J.R * 0.2;
    x0 -= g;
    x1 += g;
    y0 -= g;
    y1 += g;
    z0 -= g;
    z1 += g;
  }

  const nx = res;
  const ny = res + 6;
  const nz = res + 4; // a bit more depth samples for the face front
  const field = new Float32Array(nx * ny * nz);
  for (let iz = 0; iz < nz; iz++) {
    const pz = mix(z0, z1, iz / (nz - 1));
    for (let iy = 0; iy < ny; iy++) {
      const py = mix(y0, y1, iy / (ny - 1));
      for (let ix = 0; ix < nx; ix++) {
        const px = mix(x0, x1, ix / (nx - 1));
        field[ix + nx * (iy + ny * iz)] = sdLoomisHead(px, py, pz, J);
      }
    }
  }

  const geo = marchField(field, nx, ny, nz, x0, x1, y0, y1, z0, z1, {
    smoothIters: 2,
    smoothStrength: 0.45,
    clothUVs: true,
  });
  if (!geo) return null;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "cranium";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.skinBone = "head";
  mesh.userData.meshMethod = "sdf-loomis";
  mesh.userData.faceOpts = {
    R: J.R,
    hw: J.hw,
    hh: J.hh,
    hd: J.hd,
    headY: J.cy,
    roundness: J.round,
    length: opts.length ?? 1,
    width: opts.width ?? 1,
    probeHd: J.R,
    construction: "sdf-sphere-trap-tri",
  };
  return mesh;
}

/** Alias matching old import name. */
export const buildSmoothFace = buildLatheFace;

/** Clearer name for the Loomis SDF builder. */
export const buildLoomisFace = buildLatheFace;

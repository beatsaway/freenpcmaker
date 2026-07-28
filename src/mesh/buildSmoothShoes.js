/**
 * Smooth shoe shells via SDF → marching cubes (both feet).
 */
import * as THREE from "three";
import {
  mix, smin, smax, sdSphere, sdCapsule, sdEllipsoid, marchField,
} from "./sdfCore.js";
import { humanLayout } from "./buildConnectedBody.js";

function finish(geo, mat, name, meta = {}) {
  if (!geo) return null;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.meshMethod = `sdf-${name}`;
  Object.assign(mesh.userData, meta);
  return mesh;
}

function sampleField(sdf, x0, x1, y0, y1, z0, z1, nx, ny, nz) {
  const field = new Float32Array(nx * ny * nz);
  for (let iz = 0; iz < nz; iz++) {
    const pz = mix(z0, z1, iz / (nz - 1));
    for (let iy = 0; iy < ny; iy++) {
      const py = mix(y0, y1, iy / (ny - 1));
      for (let ix = 0; ix < nx; ix++) {
        const px = mix(x0, x1, ix / (nx - 1));
        field[ix + nx * (iy + ny * iz)] = sdf(px, py, pz);
      }
    }
  }
  return field;
}

/** One shoe at leg X = side * legX (world). */
function sdShoeAt(px, py, pz, side, style, L, k) {
  const x = side * L.legX;
  const footR = Math.max(L.rPalm, L.heelR ?? L.rAnkle, L.footH * 0.48);
  const soleY = footR * 0.85;
  const soleZ1 = L.footD * 0.78;
  const pad = 0.01;

  // Shared sole / heel base (slightly larger than body foot)
  let d = sdCapsule(px, py, pz, x, L.yAnkle + 0.02, 0, x, soleY + pad, 0, footR + pad);
  d = smin(d, sdCapsule(px, py, pz, x, soleY, 0, x, soleY, soleZ1, footR + pad * 1.2), k);
  d = smin(
    d,
    sdEllipsoid(px, py, pz, x, soleY, soleZ1 * 0.9, L.footW * 0.48, footR * 0.95, L.footD * 0.24),
    k
  );

  if (style === "boot") {
    // Shaft up the shin
    d = smin(d, sdCapsule(px, py, pz, x, L.yAnkle, 0, x, L.yAnkle + 0.18, 0, L.rAnkle + 0.022), k);
    d = smin(d, sdEllipsoid(px, py, pz, x, L.yAnkle + 0.16, 0, 0.045, 0.04, 0.05), k);
    d = smin(d, sdEllipsoid(px, py, pz, x, soleY + 0.02, soleZ1 * 0.55, L.footW * 0.42, 0.04, L.footD * 0.35), k);
  } else if (style === "hi-top") {
    d = smin(d, sdCapsule(px, py, pz, x, L.yAnkle, 0, x, L.yAnkle + 0.1, 0, L.rAnkle + 0.02), k);
    d = smin(d, sdEllipsoid(px, py, pz, x, soleY + 0.03, soleZ1 * 0.45, L.footW * 0.4, 0.035, L.footD * 0.32), k);
    // tongue
    d = smin(d, sdEllipsoid(px, py, pz, x, L.yAnkle + 0.06, 0.04, 0.03, 0.05, 0.035), k);
  } else if (style === "slippers" || style === "sandal") {
    // Soft closed slipper — low quilted volume, open-ish throat, rounded toe
    d = smin(d, sdEllipsoid(px, py, pz, x, soleY + 0.02, soleZ1 * 0.45, L.footW * 0.46, 0.035, L.footD * 0.4), k);
    d = smin(d, sdEllipsoid(px, py, pz, x, soleY * 0.55, soleZ1 * 0.5, L.footW * 0.5, footR * 0.4, L.footD * 0.42), k);
    d = smin(d, sdSphere(px, py, pz, x, soleY + 0.015, soleZ1 * 0.88, footR * 0.85), k);
    // Soft heel cup, low
    d = smin(d, sdEllipsoid(px, py, pz, x, L.yAnkle * 0.45, -0.01, 0.04, 0.032, 0.038), k);
    d = smax(d, py - (L.yAnkle + 0.05), 0.012);
  } else if (style === "loafer") {
    d = smin(d, sdEllipsoid(px, py, pz, x, soleY + 0.025, soleZ1 * 0.4, L.footW * 0.4, 0.032, L.footD * 0.38), k);
    // low vamp, open-ish throat
    d = smin(d, sdEllipsoid(px, py, pz, x, L.yAnkle * 0.55, 0.02, 0.04, 0.035, 0.04), k);
    d = smax(d, py - (L.yAnkle + 0.06), 0.012);
  } else {
    // sneaker (default)
    d = smin(d, sdEllipsoid(px, py, pz, x, soleY + 0.03, soleZ1 * 0.45, L.footW * 0.42, 0.038, L.footD * 0.35), k);
    d = smin(d, sdEllipsoid(px, py, pz, x, L.yAnkle * 0.65, 0.01, 0.042, 0.04, 0.045), k);
    // thick rubber sole plate
    d = smin(d, sdEllipsoid(px, py, pz, x, soleY * 0.45, soleZ1 * 0.45, L.footW * 0.5, footR * 0.35, L.footD * 0.42), k);
    d = smax(d, py - (L.yAnkle + 0.08), 0.014);
  }

  // Keep shoe on the ground plane-ish
  d = smax(d, -py - 0.005, 0.01);
  return d;
}

/**
 * @param {THREE.Material} mat
 * @param {{ style?:string, scale?:number, resolution?:number, layout?:object }} opts
 */
export function buildSmoothShoes(mat, opts = {}) {
  const style = opts.style || "sneaker";
  if (style === "none" || style === "bare") return null;

  const L = { ...humanLayout(), ...(opts.layout || {}) };
  const sc = opts.scale ?? 1;
  // Mild uniform scale around feet center
  const res = opts.resolution ?? 30;
  const k = 0.022;

  function sdf(px, py, pz) {
    // Optional scale about mid-feet
    let qx = px;
    let qy = py;
    let qz = pz;
    if (sc !== 1) {
      const cy = L.yAnkle * 0.5;
      const cz = L.footD * 0.35;
      qx = px / sc;
      qy = cy + (py - cy) / sc;
      qz = cz + (pz - cz) / sc;
    }
    const dL = sdShoeAt(qx, qy, qz, -1, style, L, k);
    const dR = sdShoeAt(qx, qy, qz, 1, style, L, k);
    return Math.min(dL, dR) - 0.003;
  }

  const tall = style === "boot" || style === "hi-top";
  const pad = 0.06;
  const x0 = -L.legX - L.footW - pad;
  const x1 = L.legX + L.footW + pad;
  const y0 = -0.02;
  const y1 = (tall ? L.yAnkle + 0.22 : L.yAnkle + 0.1) + pad;
  const z0 = -L.footW * 0.5 - pad;
  const z1 = L.footD * 0.95 + pad;

  const nx = res + 4;
  const ny = tall ? res + 2 : res - 2;
  const nz = res;
  const field = sampleField(sdf, x0, x1, y0, y1, z0, z1, nx, ny, nz);
  const geo = marchField(field, nx, ny, nz, x0, x1, y0, y1, z0, z1, {
    smoothIters: 4,
    smoothStrength: 0.68,
  });
  return finish(geo, mat, "shoes", { shoeStyle: style });
}

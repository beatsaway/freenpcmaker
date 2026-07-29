/**
 * Smooth hairstyle shell via SDF soft-union → marching cubes.
 * One connected volume per style (no brick stacks).
 */
import * as THREE from "three";
import {
  mix, smin, smax, sdSphere, sdCapsule, sdEllipsoid, marchField,
} from "./sdfCore.js";

function sdEll(px, py, pz, c, r) {
  return sdEllipsoid(px, py, pz, c[0], c[1], c[2], r[0], r[1], r[2]);
}

/** Soft skull-hugging upper cap (shared by many styles). */
function sdCrown(px, py, pz, W, H, D, headY, skullTop, mul = {}) {
  const w = W * (mul.w ?? 1.1);
  const h = H * (mul.h ?? 0.42);
  const d = D * (mul.d ?? 1.05);
  const y = skullTop - h * 0.28 + H * 0.08;
  return sdEll(px, py, pz, [0, y, mul.z ?? 0], [w * 0.5, h * 0.5, d * 0.5]);
}

function sdHairStyle(style, px, py, pz, W, H, D, headY, skullTop) {
  const CLEAR = Math.max(0.018, H * 0.1);
  const k = 0.028;
  let d = 1e3;

  switch (style) {
    case "buzz": {
      // Thin shell hug — top + temples + nape
      d = sdEll(px, py, pz, [0, skullTop - H * 0.05, 0], [W * 0.52, H * 0.14, D * 0.52]);
      d = smin(d, sdEll(px, py, pz, [-W * 0.42, headY + H * 0.12, 0.02], [W * 0.08, H * 0.2, D * 0.4]), k);
      d = smin(d, sdEll(px, py, pz, [W * 0.42, headY + H * 0.12, 0.02], [W * 0.08, H * 0.2, D * 0.4]), k);
      d = smin(d, sdEll(px, py, pz, [0, headY + H * 0.08, -D * 0.48], [W * 0.45, H * 0.12, D * 0.12]), k);
      break;
    }
    case "crew": {
      // Flat-top lid + high sides + squared back
      const lidY = skullTop + CLEAR * 0.2;
      d = sdEll(px, py, pz, [0, lidY, 0], [W * 0.5, H * 0.09, D * 0.46]);
      // keep top flatter via soft plane cut from above
      d = smax(d, py - (lidY + H * 0.07), 0.012);
      d = smin(d, sdEll(px, py, pz, [-W * 0.42, headY + H * 0.02, 0], [W * 0.09, H * 0.32, D * 0.4]), k * 0.8);
      d = smin(d, sdEll(px, py, pz, [W * 0.42, headY + H * 0.02, 0], [W * 0.09, H * 0.32, D * 0.4]), k * 0.8);
      d = smin(d, sdEll(px, py, pz, [0, headY + H * 0.1, -D * 0.48], [W * 0.44, H * 0.28, D * 0.12]), k);
      d = smin(d, sdEll(px, py, pz, [0, skullTop - H * 0.02, D * 0.4], [W * 0.35, H * 0.07, D * 0.1]), k);
      break;
    }
    case "short": {
      d = sdCrown(px, py, pz, W, H, D, headY, skullTop, { w: 1.14, h: 0.5, d: 1.12 });
      d = smin(d, sdEll(px, py, pz, [-W * 0.42, headY - H * 0.02, D * 0.05], [W * 0.14, H * 0.34, D * 0.35]), k);
      d = smin(d, sdEll(px, py, pz, [W * 0.42, headY - H * 0.02, D * 0.05], [W * 0.14, H * 0.34, D * 0.35]), k);
      d = smin(d, sdEll(px, py, pz, [0, headY + H * 0.22, D * 0.38], [W * 0.38, H * 0.14, D * 0.14]), k);
      d = smin(d, sdEll(px, py, pz, [0, headY + H * 0.08, -D * 0.45], [W * 0.46, H * 0.26, D * 0.16]), k);
      break;
    }
    case "messy": {
      d = sdCrown(px, py, pz, W, H, D, headY, skullTop, { w: 1.1, h: 0.4, d: 1.08 });
      d = smin(d, sdEll(px, py, pz, [-W * 0.4, headY + H * 0.05, -D * 0.04], [W * 0.12, H * 0.26, D * 0.32]), k);
      d = smin(d, sdEll(px, py, pz, [W * 0.38, headY + H * 0.02, D * 0.03], [W * 0.11, H * 0.22, D * 0.34]), k);
      const cy = skullTop + CLEAR * 0.5;
      const tufts = [
        [-W * 0.28, cy + H * 0.12, D * 0.1, 0.11],
        [W * 0.22, cy + H * 0.18, -D * 0.05, 0.09],
        [0, cy + H * 0.2, D * 0.08, 0.08],
        [-W * 0.08, cy + H * 0.08, -D * 0.15, 0.1],
      ];
      for (const [x, y, z, s] of tufts) {
        const r = Math.min(W, H) * s;
        d = smin(d, sdSphere(px, py, pz, x, y, z, r), k * 0.85);
      }
      break;
    }
    case "bob": {
      d = sdCrown(px, py, pz, W, H, D, headY, skullTop, { w: 1.14, h: 0.45, d: 1.1 });
      const side = Math.min(W, H) * 0.2;
      d = smin(d, sdEll(px, py, pz, [-W * 0.5, headY + H * 0.04, 0], [side, H * 0.4, side]), k);
      d = smin(d, sdEll(px, py, pz, [W * 0.5, headY + H * 0.04, 0], [side, H * 0.4, side]), k);
      d = smin(d, sdEll(px, py, pz, [0, headY + H * 0.12, -D * 0.42], [W * 0.52, H * 0.28, D * 0.2]), k);
      d = smin(d, sdEll(px, py, pz, [0, headY + H * 0.06, -D * 0.48], [W * 0.48, H * 0.38, D * 0.18]), k);
      break;
    }
    case "ponytail": {
      d = sdCrown(px, py, pz, W, H, D, headY, skullTop, { w: 1.08, h: 0.42, d: 1.05 });
      const ay = skullTop - H * 0.2;
      const az = -D * 0.42;
      d = smin(d, sdEll(px, py, pz, [0, ay, az], [W * 0.4, H * 0.2, D * 0.22]), k);
      d = smin(d, sdSphere(px, py, pz, 0, ay - H * 0.07, az - D * 0.08, Math.min(W, H) * 0.2), k);
      d = smin(
        d,
        sdCapsule(px, py, pz, 0, ay - H * 0.12, az - D * 0.1, 0, ay - H * 1.05, az - D * 0.12, W * 0.11),
        k
      );
      break;
    }
    case "twin-tails": {
      d = sdCrown(px, py, pz, W, H, D, headY, skullTop, { w: 1.1, h: 0.42, d: 1.05 });
      d = smin(d, sdEll(px, py, pz, [0, skullTop - H * 0.15, D * 0.28], [W * 0.36, H * 0.18, D * 0.2]), k);
      const sideY = skullTop - H * 0.22;
      const sideZ = -D * 0.08;
      const rRoot = Math.min(W, H) * 0.18;
      for (const sx of [-1, 1]) {
        const x = sx * W * 0.48;
        d = smin(d, sdSphere(px, py, pz, x, sideY, sideZ, rRoot), k);
        d = smin(d, sdEll(px, py, pz, [x, sideY + H * 0.06, sideZ + D * 0.08], [W * 0.14, H * 0.16, D * 0.14]), k);
        d = smin(
          d,
          sdCapsule(px, py, pz, x, sideY - H * 0.05, sideZ - D * 0.05, x, sideY - H * 1.1, sideZ - D * 0.1, W * 0.09),
          k
        );
        d = smin(d, sdSphere(px, py, pz, x, sideY - H * 1.15, sideZ - D * 0.08, rRoot * 0.75), k);
      }
      break;
    }
    case "pigtails": {
      d = sdCrown(px, py, pz, W, H, D, headY, skullTop, { w: 1.08, h: 0.4, d: 1.02 });
      const sideY = skullTop - H * 0.22;
      const sideZ = -D * 0.05;
      const r = Math.min(W, H) * 0.2;
      for (const sx of [-1, 1]) {
        const x = sx * W * 0.5;
        d = smin(d, sdEll(px, py, pz, [x * 0.85, sideY + H * 0.06, sideZ + D * 0.08], [W * 0.16, H * 0.18, D * 0.15]), k);
        d = smin(d, sdSphere(px, py, pz, x, sideY - H * 0.03, sideZ, r), k);
        d = smin(
          d,
          sdCapsule(px, py, pz, x, sideY - H * 0.1, sideZ - D * 0.05, x, sideY - H * 0.65, sideZ - D * 0.1, W * 0.07),
          k
        );
      }
      break;
    }
    case "braid": {
      d = sdCrown(px, py, pz, W, H, D, headY, skullTop, { w: 1.08, h: 0.42, d: 1.05 });
      const ay = skullTop - H * 0.18;
      const az = -D * 0.4;
      d = smin(d, sdEll(px, py, pz, [0, ay, az], [W * 0.38, H * 0.2, D * 0.22]), k);
      d = smin(d, sdSphere(px, py, pz, 0, ay - H * 0.07, az - D * 0.08, Math.min(W, H) * 0.17), k);
      const bz = az - D * 0.15;
      d = smin(d, sdCapsule(px, py, pz, 0, ay - H * 0.1, bz, 0, ay - H * 0.48, bz, W * 0.115), k);
      d = smin(d, sdCapsule(px, py, pz, 0, ay - H * 0.48, bz, 0, ay - H * 0.85, bz - D * 0.04, W * 0.105), k);
      d = smin(d, sdCapsule(px, py, pz, 0, ay - H * 0.85, bz - D * 0.04, 0, ay - H * 1.18, bz, W * 0.095), k);
      d = smin(d, sdSphere(px, py, pz, 0, ay - H * 1.22, bz + D * 0.04, Math.min(W, H) * 0.13), k);
      break;
    }
    case "bun": {
      d = sdCrown(px, py, pz, W, H, D, headY, skullTop, { w: 1.05, h: 0.36, d: 1.0 });
      d = smin(d, sdSphere(px, py, pz, 0, skullTop + H * 0.22, -D * 0.08, Math.min(W, H) * 0.28), k);
      break;
    }
    case "long": {
      d = sdCrown(px, py, pz, W, H, D, headY, skullTop, { w: 1.14, h: 0.48, d: 1.1 });
      const side = Math.min(W, H) * 0.2;
      const fall = H * 0.75;
      d = smin(d, sdEll(px, py, pz, [-W * 0.5, headY - H * 0.15, 0], [side, fall, side]), k);
      d = smin(d, sdEll(px, py, pz, [W * 0.5, headY - H * 0.15, 0], [side, fall, side]), k);
      d = smin(d, sdEll(px, py, pz, [0, skullTop - H * 0.25, -D * 0.42], [W * 0.48, H * 0.24, D * 0.22]), k);
      d = smin(d, sdEll(px, py, pz, [0, headY - H * 0.15, -D * 0.5], [W * 0.46, fall, D * 0.18]), k);
      break;
    }
    case "shoulder": {
      d = sdCrown(px, py, pz, W, H, D, headY, skullTop, { w: 1.12, h: 0.42, d: 1.08 });
      const side = Math.min(W, H) * 0.18;
      const fall = H * 0.52;
      d = smin(d, sdEll(px, py, pz, [-W * 0.48, headY - H * 0.08, 0], [side, fall, side]), k);
      d = smin(d, sdEll(px, py, pz, [W * 0.48, headY - H * 0.08, 0], [side, fall, side]), k);
      d = smin(d, sdEll(px, py, pz, [0, headY - H * 0.04, -D * 0.46], [W * 0.45, fall * 0.9, D * 0.17]), k);
      d = smin(d, sdEll(px, py, pz, [0, skullTop - H * 0.18, D * 0.32], [W * 0.42, H * 0.16, D * 0.2]), k);
      break;
    }
    case "wavy": {
      d = sdCrown(px, py, pz, W, H, D, headY, skullTop, { w: 1.14, h: 0.45, d: 1.1 });
      const side = Math.min(W, H) * 0.2;
      const fall = H * 0.68;
      d = smin(d, sdEll(px, py, pz, [-W * 0.48, headY - H * 0.1, D * 0.06], [side, fall, side]), k);
      d = smin(d, sdEll(px, py, pz, [W * 0.48, headY - H * 0.08, -D * 0.06], [side, fall * 0.95, side]), k);
      d = smin(d, sdEll(px, py, pz, [0, headY - H * 0.14, -D * 0.48], [W * 0.47, fall * 1.05, D * 0.19]), k);
      d = smin(d, sdSphere(px, py, pz, -W * 0.28, skullTop + H * 0.12, D * 0.12, Math.min(W, H) * 0.14), k);
      d = smin(d, sdSphere(px, py, pz, W * 0.26, skullTop + H * 0.16, -D * 0.08, Math.min(W, H) * 0.12), k);
      break;
    }
    case "afro": {
      // Rounded crown puff on top + sides + nape — not a face-swallowing ball
      const cy = skullTop + H * 0.08;
      const cz = -D * 0.12;
      d = sdEll(px, py, pz, [0, cy, cz], [W * 0.62, H * 0.48, D * 0.58]);
      d = smin(d, sdEll(px, py, pz, [0, skullTop + H * 0.22, -D * 0.06], [W * 0.55, H * 0.32, D * 0.5]), k);
      // Temple / side lobes (kept behind the face plane)
      d = smin(d, sdEll(px, py, pz, [-W * 0.48, headY + H * 0.08, -D * 0.08], [W * 0.28, H * 0.36, D * 0.38]), k);
      d = smin(d, sdEll(px, py, pz, [W * 0.48, headY + H * 0.08, -D * 0.08], [W * 0.28, H * 0.36, D * 0.38]), k);
      // Nape bulk
      d = smin(d, sdEll(px, py, pz, [0, headY + H * 0.05, -D * 0.48], [W * 0.5, H * 0.32, D * 0.22]), k);
      // Soft clump texture on top (small, still above brow)
      const tuftR = Math.min(W, H) * 0.16;
      d = smin(d, sdSphere(px, py, pz, -W * 0.22, skullTop + H * 0.28, -D * 0.1, tuftR), k * 0.9);
      d = smin(d, sdSphere(px, py, pz, W * 0.2, skullTop + H * 0.3, D * 0.02, tuftR * 0.9), k * 0.9);
      d = smin(d, sdSphere(px, py, pz, 0, skullTop + H * 0.34, -D * 0.18, tuftR * 1.05), k * 0.9);
      // Keep volume above mid-forehead on the front half
      const browY = headY + H * 0.22;
      d = smax(d, browY - py - Math.max(0, pz) * 0.35, 0.028);
      break;
    }
    default: {
      // fallback ≈ short
      d = sdCrown(px, py, pz, W, H, D, headY, skullTop, { w: 1.1, h: 0.42, d: 1.06 });
      break;
    }
  }

  // Soft cutaway so hair doesn't swallow the face plane
  if (style === "afro") {
    d = smax(d, pz - D * 0.12, 0.028);
  } else {
    const facePlane = D * 0.42;
    d = smax(d, pz - facePlane - (style === "crew" || style === "short" || style === "shoulder" ? 0.02 : 0.06), 0.02);
  }

  return d - 0.003;
}

function hairBounds(style, W, H, D, headY, skullTop) {
  const pad = 0.05;
  let x0 = -W * 0.75 - pad;
  let x1 = W * 0.75 + pad;
  let y0 = headY - H * 0.35 - pad;
  let y1 = skullTop + H * 0.55 + pad;
  let z0 = -D * 0.85 - pad;
  let z1 = D * 0.55 + pad;

  if (style === "afro") {
    x0 = -W * 0.95 - pad; x1 = W * 0.95 + pad;
    y0 = headY - H * 0.15 - pad; y1 = skullTop + H * 0.75 + pad;
    z0 = -D * 0.95 - pad; z1 = D * 0.35 + pad;
  } else if (["long", "wavy", "ponytail", "braid", "twin-tails"].includes(style)) {
    y0 = headY - H * 1.45 - pad;
    y1 = skullTop + H * 0.55 + pad;
    x0 = -W * 0.85 - pad; x1 = W * 0.85 + pad;
  } else if (["bob", "shoulder", "pigtails"].includes(style)) {
    y0 = headY - H * 0.85 - pad;
  } else if (style === "messy") {
    y1 = skullTop + H * 0.7 + pad;
  }
  return { x0, x1, y0, y1, z0, z1 };
}

/**
 * @param {THREE.Material} mat
 * @param {{ style:string, hw:number, hh:number, hd:number, headY:number, skullTop:number, resolution?:number }} opts
 * @returns {THREE.Mesh|null}
 */
export function buildSmoothHair(mat, opts = {}) {
  const style = opts.style || "short";
  if (style === "bald") return null;

  const W = opts.hw ?? 0.16;
  const H = opts.hh ?? 0.2;
  const D = opts.hd ?? 0.18;
  const headY = opts.headY ?? 1.66;
  const skullTop = opts.skullTop ?? headY + H * 0.5;
  const res = opts.resolution ?? 34;

  const { x0, x1, y0, y1, z0, z1 } = hairBounds(style, W, H, D, headY, skullTop);
  const tall = y1 - y0 > 0.55;
  const nx = res;
  const ny = tall ? res + 10 : res + 2;
  const nz = res;
  const field = new Float32Array(nx * ny * nz);

  for (let iz = 0; iz < nz; iz++) {
    const pz = mix(z0, z1, iz / (nz - 1));
    for (let iy = 0; iy < ny; iy++) {
      const py = mix(y0, y1, iy / (ny - 1));
      for (let ix = 0; ix < nx; ix++) {
        const px = mix(x0, x1, ix / (nx - 1));
        field[ix + nx * (iy + ny * iz)] = sdHairStyle(style, px, py, pz, W, H, D, headY, skullTop);
      }
    }
  }

  const geo = marchField(field, nx, ny, nz, x0, x1, y0, y1, z0, z1, {
    smoothIters: 5,
    smoothStrength: 0.72,
  });
  if (!geo) return null;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "hair";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.meshMethod = "sdf-hair";
  mesh.userData.hairStyle = style;
  return mesh;
}

/**
 * Sample hair SDF for crown radius so hats can scale to the hairstyle.
 * @returns {{ topY:number, radius:number, skullTop:number }}
 */
export function probeHairCrown(opts = {}) {
  const style = opts.style || "short";
  const W = opts.hw ?? 0.16;
  const H = opts.hh ?? 0.2;
  const D = opts.hd ?? 0.18;
  const headY = opts.headY ?? 1.66;
  const skullTop = opts.skullTop ?? headY + H * 0.5;

  if (style === "bald") {
    return { topY: skullTop, radius: Math.max(W, D) * 0.52, skullTop };
  }

  const sdf = (x, y, z) => sdHairStyle(style, x, y, z, W, H, D, headY, skullTop);

  function surfaceY(x, z, yLo, yHi) {
    let lo = yLo;
    let hi = yHi;
    // Ensure we start outside above hair
    if (sdf(x, hi, z) < 0) hi += H * 0.5;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) * 0.5;
      if (sdf(x, mid, z) < 0) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  function surfaceR(y, z, rHi) {
    let lo = 0;
    let hi = rHi;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) * 0.5;
      if (sdf(mid, y, z) < 0) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  const yCeil = skullTop + H * 1.35;
  const yFloor = skullTop - H * 0.05;
  let topY = skullTop;
  for (const [x, z] of [
    [0, 0],
    [0, -D * 0.08],
    [0, D * 0.05],
    [W * 0.12, 0],
    [-W * 0.12, 0],
  ]) {
    topY = Math.max(topY, surfaceY(x, z, yFloor, yCeil));
  }

  // Width at the upper crown (where a hat band sits)
  const yBand = mix(skullTop, topY, 0.55);
  let radius = W * 0.48;
  for (const z of [0, -D * 0.06, D * 0.04]) {
    radius = Math.max(radius, surfaceR(yBand, z, Math.max(W, D) * 1.35));
  }

  return { topY, radius, skullTop };
}

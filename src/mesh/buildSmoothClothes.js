/**
 * Full clothing shells via SDF → marching cubes (tops, bottoms, hood).
 * Slightly padded over the body so garments read as real cloth volumes.
 */
import * as THREE from "three";
import {
  clamp, mix, smin, smax, sdSphere, sdCapsule, sdEllipsoid, marchField,
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

function marchBox(sdf, bounds, res, opts = {}) {
  const { x0, x1, y0, y1, z0, z1 } = bounds;
  const nx = res.x ?? res;
  const ny = res.y ?? res;
  const nz = res.z ?? res;
  const field = sampleField(sdf, x0, x1, y0, y1, z0, z1, nx, ny, nz);
  return marchField(field, nx, ny, nz, x0, x1, y0, y1, z0, z1, {
    smoothIters: opts.smoothIters ?? 4,
    smoothStrength: opts.smoothStrength ?? 0.7,
  });
}

/** Puffy torso slab between yBot..yTop. */
function sdTorsoShell(px, py, pz, L, yBot, yTop, pad = 0.018) {
  const y = clamp(py, yBot, yTop);
  const t = clamp((y - yBot) / Math.max(1e-6, yTop - yBot), 0, 1);
  let rx;
  let rz;
  if (t < 0.35) {
    const u = t / 0.35;
    rx = mix(L.hipRX, L.waistRX, u);
    rz = mix(L.hipRZ, L.waistRZ, u);
  } else {
    const u = (t - 0.35) / 0.65;
    rx = mix(L.waistRX, L.chestRX, u);
    rz = mix(L.waistRZ, L.chestRZ, u);
  }
  rx += pad;
  rz += pad;
  const q = Math.hypot(px / rx, (pz + 0.01) / rz) - 1;
  // vertical soft slab
  const dy = Math.max(yBot - py, py - yTop);
  return Math.max(q * Math.min(rx, rz), dy) - pad * 0.15;
}

function sdSleeve(px, py, pz, side, L, len, rPad) {
  const y = L.yShoulder;
  const x0 = side * L.shoulderX;
  const x1 = side * (L.shoulderX + len);
  return sdCapsule(px, py, pz, x0, y, 0, x1, y, 0, L.rShoulder * 0.85 + rPad);
}

/** Hood volume reused inside full hoodie. */
function sdHoodVolume(px, py, pz, hw, hh, hd, headY, skullTop, neckY, neckBot) {
  const W = hw;
  const H = hh;
  const D = hd;
  const k = 0.03;
  const hoodTop = skullTop - H * 0.06;
  const cy = headY - H * 0.02;
  const cz = -D * 0.18;

  let outer = sdEllipsoid(px, py, pz, 0, cy, cz, W * 0.62, H * 0.58, D * 0.62);
  outer = smin(outer, sdEllipsoid(px, py, pz, 0, hoodTop - H * 0.18, cz - D * 0.02, W * 0.55, H * 0.28, D * 0.5), k);
  outer = smin(outer, sdEllipsoid(px, py, pz, -W * 0.48, headY + H * 0.02, -D * 0.02, W * 0.2, H * 0.42, D * 0.42), k);
  outer = smin(outer, sdEllipsoid(px, py, pz, W * 0.48, headY + H * 0.02, -D * 0.02, W * 0.2, H * 0.42, D * 0.42), k);
  outer = smin(outer, sdEllipsoid(px, py, pz, 0, neckY + 0.02, -D * 0.4, W * 0.42, H * 0.28, D * 0.28), k);
  outer = smin(outer, sdCapsule(px, py, pz, 0, hoodTop - H * 0.25, -D * 0.35, 0, neckBot + 0.02, -D * 0.32, W * 0.2), k);

  const inner = sdEllipsoid(px, py, pz, 0, cy + H * 0.02, cz + D * 0.04, W * 0.48, H * 0.48, D * 0.48);
  let d = smax(outer, -inner, 0.016);
  d = smax(d, pz - D * 0.18, 0.022);
  d = smax(d, py - hoodTop, 0.014);
  d = smax(d, neckBot - 0.02 - py, 0.02);
  return d;
}

/**
 * Full top garment: tee | polo | hoodie | jacket | overalls
 */
export function buildSmoothTop(mat, opts = {}) {
  const style = opts.style || "tee";
  const L = { ...humanLayout(), ...(opts.layout || {}) };
  const hw = opts.hw ?? 0.16;
  const hh = opts.hh ?? 0.2;
  const hd = opts.hd ?? 0.18;
  const headY = opts.headY ?? (L.yNeckTop + hh * 0.5);
  const skullTop = opts.skullTop ?? headY + hh * 0.5;
  const neckY = opts.neckY ?? (L.yNeck + L.yNeckTop) * 0.5;
  const neckBot = opts.neckBot ?? L.yNeck;
  const res = opts.resolution ?? 36;
  const k = 0.04;

  const longSleeve = style === "hoodie" || style === "jacket";
  const shortSleeve = style === "tee" || style === "polo";
  const sleeveLen = longSleeve ? L.armLenU + L.armLenL * 0.85 : shortSleeve ? L.armLenU * 0.55 : 0;
  // Hem above waist (overalls = short bib top like former tank)
  const yHem =
    style === "overalls" ? L.yWaist + 0.05
    : style === "hoodie" ? L.yWaist
    : L.yWaist + 0.015;
  const yNeckline = style === "overalls" ? L.yShoulder - 0.02 : L.yNeck - 0.02;
  const pad = style === "hoodie" || style === "jacket" ? 0.028 : 0.016;

  function sdf(px, py, pz) {
    let d = sdTorsoShell(px, py, pz, L, yHem, yNeckline, pad);

    // Soft shoulder caps
    d = smin(d, sdSphere(px, py, pz, L.shoulderX, L.yShoulder, 0, L.rShoulder + pad), k);
    d = smin(d, sdSphere(px, py, pz, -L.shoulderX, L.yShoulder, 0, L.rShoulder + pad), k);

    if (sleeveLen > 0) {
      const rPad = pad + (longSleeve ? 0.012 : 0.008);
      d = smin(d, sdSleeve(px, py, pz, 1, L, sleeveLen, rPad), k);
      d = smin(d, sdSleeve(px, py, pz, -1, L, sleeveLen, rPad), k);
      if (longSleeve) {
        const xC = L.shoulderX + sleeveLen;
        d = smin(d, sdSphere(px, py, pz, xC, L.yShoulder, 0, L.rWrist + 0.02), k * 0.8);
        d = smin(d, sdSphere(px, py, pz, -xC, L.yShoulder, 0, L.rWrist + 0.02), k * 0.8);
      }
    }

    if (style === "hoodie") {
      d = smin(
        d,
        sdEllipsoid(px, py, pz, 0, L.yWaist + 0.1, L.chestRZ + 0.02, 0.08, 0.055, 0.035),
        k
      );
      d = smin(
        d,
        sdEllipsoid(px, py, pz, 0, yHem + 0.015, 0, L.waistRX + 0.025, 0.028, L.waistRZ + 0.02),
        k
      );
      d = smin(
        d,
        sdHoodVolume(px, py, pz, hw, hh, hd, headY, skullTop, neckY, neckBot),
        0.035
      );
    } else if (style === "polo") {
      d = smin(d, sdEllipsoid(px, py, pz, 0, yNeckline - 0.01, L.chestRZ * 0.7, 0.045, 0.02, 0.03), k);
    } else if (style === "overalls") {
      // Big wide bib / front panel
      d = smin(
        d,
        sdEllipsoid(px, py, pz, 0, L.yChest - 0.02, L.chestRZ * 0.55, 0.14, 0.18, 0.07),
        k
      );
      d = smin(
        d,
        sdEllipsoid(px, py, pz, 0, L.yChest + 0.06, L.chestRZ * 0.45, 0.12, 0.1, 0.055),
        k
      );
      // Wide straps
      d = smin(d, sdCapsule(px, py, pz, -0.09, L.yShoulder + 0.02, 0.02, -0.1, L.yChest - 0.02, 0.06, 0.022), k);
      d = smin(d, sdCapsule(px, py, pz, 0.09, L.yShoulder + 0.02, 0.02, 0.1, L.yChest - 0.02, 0.06, 0.022), k);
      d = smin(d, sdSphere(px, py, pz, -0.08, L.yShoulder + 0.01, 0.02, 0.028), k);
      d = smin(d, sdSphere(px, py, pz, 0.08, L.yShoulder + 0.01, 0.02, 0.028), k);
    }
    // jacket: clean torso + sleeves only

    return d - 0.004;
  }

  const armReach = L.shoulderX + (sleeveLen || 0.08) + 0.08;
  const x0 = -armReach;
  const x1 = armReach;
  const y0 = yHem - 0.06;
  const y1 = style === "hoodie" ? skullTop + 0.02 : L.yShoulder + 0.1;
  const z0 = style === "hoodie" ? -hd * 0.95 : -L.chestRZ - 0.12;
  const z1 = L.chestRZ + (style === "overalls" ? 0.16 : 0.12);

  const geo = marchBox(
    sdf,
    { x0, x1, y0, y1, z0, z1 },
    {
      x: res + (longSleeve ? 6 : 0),
      y: style === "hoodie" ? res + 8 : res,
      z: res,
    },
    { smoothIters: 5, smoothStrength: 0.72 }
  );
  return finish(geo, mat, "top", { cloth: style });
}

/** @deprecated use buildSmoothTop with style hoodie — kept for callers */
export function buildSmoothHood(mat, opts = {}) {
  return buildSmoothTop(mat, { ...opts, style: "hoodie" });
}

/**
 * Bottoms: pants | shorts | mini-shorts | mini-skirt
 */
export function buildSmoothBottom(mat, opts = {}) {
  const style = opts.style || "pants";
  if (style === "mini-skirt" || style === "skirt") {
    return buildSmoothFlare(mat, { ...opts, style: "mini-skirt" });
  }

  const L = { ...humanLayout(), ...(opts.layout || {}) };
  const hipW = opts.hipW ?? L.hipRX * 2;
  const hipD = opts.hipD ?? L.hipRZ * 2;
  const res = opts.resolution ?? 34;
  const k = 0.04;
  const yTop = opts.yTop ?? L.yWaist - 0.04;
  const isShorts = style === "shorts" || style === "mini-shorts";
  const yBot = isShorts
    ? (opts.yBot ?? (style === "mini-shorts" ? L.yHip - 0.06 : (L.yHip + L.yKnee) * 0.55))
    : (opts.yBot ?? L.yAnkle + 0.04);
  const rPad = 0.016;
  const waistY = mix(L.yHip, L.yWaist, 0.65);
  const kCrotch = 0.085;

  function sdf(px, py, pz) {
    let d = sdEllipsoid(px, py, pz, 0, waistY, 0, L.waistRX + 0.028, 0.048, L.waistRZ + 0.022);
    const seatY = mix(L.yHip, L.yWaist, 0.3);
    d = smin(d, sdEllipsoid(px, py, pz, 0, seatY, L.hipZ * 0.35, L.hipRX + rPad, 0.12, L.hipRZ + rPad * 0.9), k);
    d = smin(
      d,
      sdEllipsoid(px, py, pz, 0, L.yHip - 0.02, -0.01, L.legX * 0.85, 0.1, L.hipRZ * 0.75),
      kCrotch
    );
    d = smin(
      d,
      sdEllipsoid(px, py, pz, 0, L.yHip - 0.08, 0.01, L.legX * 0.55, 0.08, 0.06),
      kCrotch
    );

    const legTop = L.yHip - 0.02;
    const kneeY = isShorts ? yBot + 0.02 : L.yKnee;
    let dLegs = Math.min(
      sdCapsule(px, py, pz, L.legX, legTop, 0, L.legX, kneeY, 0, L.rThigh + rPad),
      sdCapsule(px, py, pz, -L.legX, legTop, 0, -L.legX, kneeY, 0, L.rThigh + rPad)
    );
    d = smin(d, dLegs, kCrotch);

    if (style === "pants") {
      d = smin(d, sdCapsule(px, py, pz, L.legX, L.yKnee, 0, L.legX, yBot, 0, L.rCalf + rPad), k);
      d = smin(d, sdCapsule(px, py, pz, -L.legX, L.yKnee, 0, -L.legX, yBot, 0, L.rCalf + rPad), k);
      d = smin(d, sdSphere(px, py, pz, L.legX, yBot, 0, L.rAnkle + 0.018), k * 0.8);
      d = smin(d, sdSphere(px, py, pz, -L.legX, yBot, 0, L.rAnkle + 0.018), k * 0.8);
    } else {
      const hemR = style === "mini-shorts" ? L.rThigh * 0.95 : L.rThigh * 0.85;
      d = smin(d, sdSphere(px, py, pz, L.legX, yBot, 0, hemR), k * 0.8);
      d = smin(d, sdSphere(px, py, pz, -L.legX, yBot, 0, hemR), k * 0.8);
    }

    d = smax(d, pz - (L.hipRZ * 0.55 + 0.02), 0.025);
    d = smax(d, py - yTop - 0.02, 0.02);
    d = smax(d, yBot - 0.03 - py, 0.02);
    return d - 0.004;
  }

  const pad = 0.08;
  const geo = marchBox(
    sdf,
    {
      x0: -hipW * 0.7 - pad,
      x1: hipW * 0.7 + pad,
      y0: yBot - pad * 0.5,
      y1: yTop + pad * 0.4,
      z0: -hipD * 0.7 - pad,
      z1: hipD * 0.55 + pad,
    },
    { x: res, y: style === "pants" ? res + 8 : res, z: res },
    { smoothIters: 5, smoothStrength: 0.7 }
  );
  return finish(geo, mat, "bottom", { cloth: style });
}

/** @deprecated use buildSmoothFlare */
export function buildSmoothSkirt(mat, opts = {}) {
  return buildSmoothFlare(mat, { ...opts, style: "mini-skirt" });
}

/**
 * Mini-skirt A-line flare — length adapts to thigh; skinned as a pelvis shell
 * so walk cycles don't tear the hem across separate thigh bones.
 */
export function buildSmoothFlare(mat, opts = {}) {
  const style = "mini-skirt";
  const L = { ...humanLayout(), ...(opts.layout || {}) };
  const hipW = opts.hipW ?? L.hipRX * 2;
  const hipD = opts.hipD ?? L.hipRZ * 2;
  let yTop = opts.yTop ?? L.yWaist - 0.04;
  let yBot = opts.yBot ?? mix(L.yHip, L.yKnee, 0.35);
  // Guard against inverted / tiny spans (broke tall & short builds)
  const thighLen = Math.max(0.08, L.yHip - L.yKnee);
  const minH = Math.max(0.07, thighLen * 0.2);
  if (!(yTop > yBot + minH)) {
    yTop = L.yWaist - 0.02;
    yBot = Math.min(yTop - minH, L.yHip - thighLen * 0.35);
  }
  const legScale = opts.legScale ?? L.H?.leg ?? 1;
  const shortT = clamp((1.05 - legScale) / 0.55, 0, 1);
  const res = opts.resolution ?? (shortT > 0.4 ? 36 : 32);
  const k = 0.035;
  const midY = (yTop + yBot) * 0.5;
  const h = yTop - yBot;
  // Slightly less flare on short legs so hem doesn't balloon past the thighs
  const flare = mix(0.92, 0.82, shortT);

  function sdf(px, py, pz) {
    let d = sdEllipsoid(px, py, pz, 0, yTop - 0.01, -0.015, hipW * 0.48, h * 0.08, hipD * 0.5);
    d = smin(d, sdEllipsoid(px, py, pz, 0, mix(L.yHip, yTop, 0.4), -0.02, hipW * 0.54, h * 0.16, hipD * 0.56), k);
    d = smin(d, sdEllipsoid(px, py, pz, 0, midY + h * 0.05, -0.025, hipW * 0.6, h * 0.28, hipD * 0.64), k);
    d = smin(
      d,
      sdEllipsoid(px, py, pz, 0, yBot + h * 0.14, -0.03, hipW * 0.74 * flare, h * 0.24, hipD * 0.8 * flare),
      k
    );
    d = smin(
      d,
      sdEllipsoid(px, py, pz, 0, yBot + 0.04, -0.02, hipW * 0.82 * flare, h * 0.09, hipD * 0.86 * flare),
      k * 0.9
    );
    d = smin(d, sdEllipsoid(px, py, pz, 0, midY, -hipD * 0.35, hipW * 0.52, h * 0.32, hipD * 0.28), k);
    d = smax(d, py - yTop - 0.015, 0.016);
    d = smax(d, yBot - py, 0.02);
    const t = clamp((py - yBot) / Math.max(1e-6, yTop - yBot), 0, 1);
    // Tighter clearance on short builds so the shell hugs the pelvis
    const clearR = mix(hipW * mix(0.24, 0.2, shortT), hipW * 0.2, t);
    const clearZ = mix(hipD * mix(0.24, 0.2, shortT), hipD * 0.18, t);
    const hole = sdEllipsoid(px, py, pz, 0, py, -0.01, clearR, h * 0.5, clearZ);
    d = smax(d, -hole, 0.018);
    return d - 0.004;
  }

  const pad = 0.06;
  const geo = marchBox(
    sdf,
    {
      x0: -hipW * 0.95 * flare - pad,
      x1: hipW * 0.95 * flare + pad,
      y0: yBot - pad * 0.5,
      y1: yTop + pad * 0.5,
      z0: -hipD * 1.05 * flare - pad,
      z1: hipD * 0.85 * flare + pad,
    },
    { x: res + 2, y: res + (shortT > 0.3 ? 4 : 0), z: res },
    { smoothIters: 5, smoothStrength: 0.7 }
  );
  // Pelvis-only skinning: distance skin would bind hem verts to left/right thighs
  // and tear the skirt apart on short avatars during walk cycles.
  return finish(geo, mat, "mini-skirt", { cloth: style, skinBone: "pelvis" });
}

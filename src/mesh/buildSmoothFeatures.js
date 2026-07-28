/**
 * Smooth nose + ear feature meshes via SDF → marching cubes.
 * Built in local space around an anchor, then positioned by Head.
 */
import * as THREE from "three";
import {
  mix, smin, smax, sdSphere, sdCapsule, sdEllipsoid, marchField,
} from "./sdfCore.js";

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

function sdNose(style, px, py, pz, sc, k) {
  let d = 1e3;
  switch (style) {
    case "bridge":
      d = sdEllipsoid(px, py, pz, 0, 0.01 * sc, 0.012 * sc, 0.014 * sc, 0.038 * sc, 0.02 * sc);
      d = smin(d, sdCapsule(px, py, pz, 0, 0.03 * sc, 0.008 * sc, 0, -0.028 * sc, 0.016 * sc, 0.011 * sc), k);
      d = smin(d, sdSphere(px, py, pz, 0, -0.022 * sc, 0.022 * sc, 0.012 * sc), k);
      break;
    case "flat":
      d = sdEllipsoid(px, py, pz, 0, 0, 0.01 * sc, 0.024 * sc, 0.014 * sc, 0.014 * sc);
      d = smin(d, sdEllipsoid(px, py, pz, 0, -0.004 * sc, 0.016 * sc, 0.02 * sc, 0.01 * sc, 0.01 * sc), k);
      break;
    case "pointy":
      d = sdEllipsoid(px, py, pz, 0, 0.008 * sc, 0.01 * sc, 0.013 * sc, 0.018 * sc, 0.014 * sc);
      d = smin(d, sdCapsule(px, py, pz, 0, 0.005 * sc, 0.014 * sc, 0, -0.002 * sc, 0.042 * sc, 0.008 * sc), k);
      d = smin(d, sdSphere(px, py, pz, 0, -0.002 * sc, 0.048 * sc, 0.007 * sc), k * 0.8);
      d = smax(d, -(pz + 0.002 * sc), 0.006 * sc);
      break;
    case "bulbous":
      d = sdEllipsoid(px, py, pz, 0, 0.004 * sc, 0.006 * sc, 0.014 * sc, 0.016 * sc, 0.012 * sc);
      d = smin(d, sdSphere(px, py, pz, 0, -0.012 * sc, 0.024 * sc, 0.026 * sc), k);
      d = smin(d, sdSphere(px, py, pz, -0.012 * sc, -0.014 * sc, 0.018 * sc, 0.012 * sc), k * 0.9);
      d = smin(d, sdSphere(px, py, pz, 0.012 * sc, -0.014 * sc, 0.018 * sc, 0.012 * sc), k * 0.9);
      break;
    case "hooked":
      d = sdCapsule(px, py, pz, 0, 0.028 * sc, 0.008 * sc, 0, 0.0 * sc, 0.022 * sc, 0.01 * sc);
      d = smin(d, sdCapsule(px, py, pz, 0, 0.0 * sc, 0.022 * sc, 0, -0.028 * sc, 0.018 * sc, 0.009 * sc), k);
      d = smin(d, sdSphere(px, py, pz, 0, -0.032 * sc, 0.012 * sc, 0.011 * sc), k);
      break;
    case "snub":
      d = sdEllipsoid(px, py, pz, 0, 0.002 * sc, 0.01 * sc, 0.016 * sc, 0.014 * sc, 0.014 * sc);
      d = smin(d, sdSphere(px, py, pz, 0, 0.01 * sc, 0.022 * sc, 0.016 * sc), k);
      d = smin(d, sdSphere(px, py, pz, 0, -0.006 * sc, 0.018 * sc, 0.012 * sc), k);
      break;
    case "hawk":
      d = sdCapsule(px, py, pz, 0, 0.032 * sc, 0.006 * sc, 0, -0.01 * sc, 0.028 * sc, 0.01 * sc);
      d = smin(d, sdSphere(px, py, pz, 0, 0.008 * sc, 0.026 * sc, 0.014 * sc), k); // bridge bump
      d = smin(d, sdSphere(px, py, pz, 0, -0.02 * sc, 0.03 * sc, 0.011 * sc), k);
      break;
    case "broad":
      d = sdEllipsoid(px, py, pz, 0, -0.004 * sc, 0.014 * sc, 0.032 * sc, 0.014 * sc, 0.016 * sc);
      d = smin(d, sdEllipsoid(px, py, pz, 0, 0.012 * sc, 0.008 * sc, 0.012 * sc, 0.02 * sc, 0.01 * sc), k);
      d = smin(d, sdSphere(px, py, pz, -0.018 * sc, -0.01 * sc, 0.016 * sc, 0.012 * sc), k);
      d = smin(d, sdSphere(px, py, pz, 0.018 * sc, -0.01 * sc, 0.016 * sc, 0.012 * sc), k);
      break;
    case "petite":
      d = sdSphere(px, py, pz, 0, 0, 0.01 * sc, 0.014 * sc);
      d = smin(d, sdEllipsoid(px, py, pz, 0, 0.006 * sc, 0.004 * sc, 0.01 * sc, 0.01 * sc, 0.008 * sc), k);
      break;
    case "slope":
      // Soft ski-slope: concave feel via stepped capsules
      d = sdCapsule(px, py, pz, 0, 0.03 * sc, 0.006 * sc, 0, 0.008 * sc, 0.014 * sc, 0.01 * sc);
      d = smin(d, sdCapsule(px, py, pz, 0, 0.008 * sc, 0.014 * sc, 0, -0.016 * sc, 0.028 * sc, 0.011 * sc), k);
      d = smin(d, sdSphere(px, py, pz, 0, -0.02 * sc, 0.03 * sc, 0.013 * sc), k);
      break;
    case "button":
    default:
      d = sdSphere(px, py, pz, 0, 0, 0.012 * sc, 0.022 * sc);
      d = smin(d, sdEllipsoid(px, py, pz, 0, 0.006 * sc, 0.004 * sc, 0.016 * sc, 0.014 * sc, 0.01 * sc), k);
      break;
  }
  d = smax(d, -pz - 0.004 * sc, 0.006 * sc);
  return d - 0.0015 * sc;
}

function noseBounds(style, sc) {
  const pad = 0.02 * sc;
  let x0 = -0.04 * sc - pad;
  let x1 = 0.04 * sc + pad;
  let y0 = -0.05 * sc - pad;
  let y1 = 0.05 * sc + pad;
  let z0 = -0.01 * sc - pad * 0.4;
  let z1 = 0.06 * sc + pad;

  if (style === "flat" || style === "broad") {
    x0 = -0.055 * sc - pad; x1 = 0.055 * sc + pad;
    z1 = 0.045 * sc + pad;
  } else if (style === "pointy" || style === "hawk" || style === "slope") {
    z1 = 0.07 * sc + pad;
  } else if (style === "hooked") {
    y0 = -0.06 * sc - pad;
    z1 = 0.055 * sc + pad;
  } else if (style === "bulbous") {
    x0 = -0.05 * sc - pad; x1 = 0.05 * sc + pad;
    y0 = -0.055 * sc - pad;
    z1 = 0.065 * sc + pad;
  } else if (style === "petite") {
    x0 = -0.03 * sc - pad; x1 = 0.03 * sc + pad;
    y0 = -0.03 * sc - pad; y1 = 0.03 * sc + pad;
    z1 = 0.04 * sc + pad;
  } else if (style === "snub") {
    y1 = 0.04 * sc + pad;
    z1 = 0.05 * sc + pad;
  }
  return { x0, x1, y0, y1, z0, z1 };
}

/**
 * Nose in local space: origin ≈ bridge attach on face plane, +Z out from face.
 */
export function buildSmoothNose(mat, opts = {}) {
  const style = opts.style || "button";
  const sc = opts.scale ?? 1;
  const res = opts.resolution ?? 26;
  const k = 0.01 * sc;
  const { x0, x1, y0, y1, z0, z1 } = noseBounds(style, sc);
  const field = sampleField(
    (px, py, pz) => sdNose(style, px, py, pz, sc, k),
    x0, x1, y0, y1, z0, z1, res, res, res
  );
  const geo = marchField(field, res, res, res, x0, x1, y0, y1, z0, z1, {
    smoothIters: 4,
    smoothStrength: 0.7,
    weldEps: 8e-5,
  });
  return finish(geo, mat, "nose", { noseStyle: style });
}

function sdEar(style, px, py, pz, sc, k) {
  let d = 1e3;
  switch (style) {
    case "point":
      d = sdEllipsoid(px, py, pz, 0.01 * sc, 0, 0, 0.016 * sc, 0.032 * sc, 0.014 * sc);
      d = smin(d, sdCapsule(px, py, pz, 0.008 * sc, 0.01 * sc, 0, 0.006 * sc, 0.042 * sc, -0.002 * sc, 0.008 * sc), k);
      d = smin(d, sdSphere(px, py, pz, 0.005 * sc, 0.048 * sc, -0.002 * sc, 0.007 * sc), k * 0.85);
      d = smin(d, sdEllipsoid(px, py, pz, 0.012 * sc, -0.02 * sc, 0.002 * sc, 0.012 * sc, 0.014 * sc, 0.01 * sc), k);
      break;
    case "wide":
      d = sdEllipsoid(px, py, pz, 0.012 * sc, 0, 0, 0.022 * sc, 0.03 * sc, 0.016 * sc);
      d = smin(d, sdEllipsoid(px, py, pz, 0.018 * sc, -0.008 * sc, 0.004 * sc, 0.016 * sc, 0.018 * sc, 0.012 * sc), k);
      d = smin(d, sdSphere(px, py, pz, 0.01 * sc, 0.022 * sc, 0, 0.012 * sc), k);
      break;
    case "lobe":
      d = sdEllipsoid(px, py, pz, 0.01 * sc, 0.008 * sc, 0, 0.014 * sc, 0.022 * sc, 0.012 * sc);
      d = smin(d, sdSphere(px, py, pz, 0.01 * sc, 0.02 * sc, 0, 0.012 * sc), k);
      d = smin(d, sdSphere(px, py, pz, 0.012 * sc, -0.032 * sc, 0.004 * sc, 0.016 * sc), k); // dangling lobe
      d = smin(d, sdCapsule(px, py, pz, 0.01 * sc, -0.01 * sc, 0, 0.012 * sc, -0.028 * sc, 0.002 * sc, 0.008 * sc), k);
      break;
    case "elf":
      d = sdEllipsoid(px, py, pz, 0.008 * sc, 0, 0, 0.013 * sc, 0.028 * sc, 0.012 * sc);
      d = smin(d, sdCapsule(px, py, pz, 0.006 * sc, 0.015 * sc, -0.002 * sc, 0.002 * sc, 0.065 * sc, -0.01 * sc, 0.006 * sc), k);
      d = smin(d, sdSphere(px, py, pz, 0.001 * sc, 0.07 * sc, -0.012 * sc, 0.005 * sc), k * 0.8);
      d = smin(d, sdSphere(px, py, pz, 0.01 * sc, -0.018 * sc, 0.002 * sc, 0.011 * sc), k);
      break;
    case "floppy":
      d = sdEllipsoid(px, py, pz, 0.012 * sc, -0.004 * sc, 0.008 * sc, 0.018 * sc, 0.026 * sc, 0.016 * sc);
      d = smin(d, sdEllipsoid(px, py, pz, 0.016 * sc, -0.018 * sc, 0.016 * sc, 0.016 * sc, 0.018 * sc, 0.018 * sc), k);
      d = smin(d, sdSphere(px, py, pz, 0.014 * sc, -0.03 * sc, 0.02 * sc, 0.014 * sc), k);
      break;
    case "small":
      // Still short silhouette, but large enough attach footprint
      d = sdEllipsoid(px, py, pz, 0.01 * sc, 0, 0, 0.014 * sc, 0.022 * sc, 0.012 * sc);
      d = smin(d, sdSphere(px, py, pz, 0.008 * sc, 0.01 * sc, 0, 0.012 * sc), k);
      d = smin(d, sdSphere(px, py, pz, 0.01 * sc, -0.012 * sc, 0.001 * sc, 0.01 * sc), k);
      break;
    case "cupped":
      // Bowl / cupped silhouette — thicker rim, softer center mass
      d = sdEllipsoid(px, py, pz, 0.014 * sc, 0, 0, 0.02 * sc, 0.03 * sc, 0.018 * sc);
      d = smin(d, sdEllipsoid(px, py, pz, 0.02 * sc, 0, 0.004 * sc, 0.01 * sc, 0.024 * sc, 0.014 * sc), k);
      d = smin(d, sdSphere(px, py, pz, 0.008 * sc, 0.018 * sc, -0.002 * sc, 0.011 * sc), k);
      d = smin(d, sdSphere(px, py, pz, 0.01 * sc, -0.02 * sc, 0.002 * sc, 0.012 * sc), k);
      break;
    case "square":
      d = sdEllipsoid(px, py, pz, 0.012 * sc, 0, 0, 0.018 * sc, 0.028 * sc, 0.014 * sc);
      d = smin(d, sdEllipsoid(px, py, pz, 0.014 * sc, 0.016 * sc, 0, 0.014 * sc, 0.012 * sc, 0.012 * sc), k);
      d = smin(d, sdEllipsoid(px, py, pz, 0.014 * sc, -0.018 * sc, 0.002 * sc, 0.014 * sc, 0.012 * sc, 0.011 * sc), k);
      // Soft flatten outer edge
      d = smax(d, px - 0.028 * sc, 0.008 * sc);
      break;
    case "wing":
      // Swept back
      d = sdEllipsoid(px, py, pz, 0.01 * sc, 0.004 * sc, -0.008 * sc, 0.014 * sc, 0.024 * sc, 0.018 * sc);
      d = smin(d, sdCapsule(px, py, pz, 0.008 * sc, 0.01 * sc, -0.01 * sc, 0.016 * sc, 0.02 * sc, -0.03 * sc, 0.009 * sc), k);
      d = smin(d, sdSphere(px, py, pz, 0.018 * sc, 0.022 * sc, -0.034 * sc, 0.01 * sc), k);
      d = smin(d, sdSphere(px, py, pz, 0.01 * sc, -0.016 * sc, 0, 0.011 * sc), k);
      break;
    case "round":
    default:
      d = sdEllipsoid(px, py, pz, 0.01 * sc, 0, 0, 0.015 * sc, 0.026 * sc, 0.013 * sc);
      d = smin(d, sdSphere(px, py, pz, 0.008 * sc, 0.012 * sc, 0, 0.014 * sc), k);
      d = smin(d, sdSphere(px, py, pz, 0.01 * sc, -0.016 * sc, 0.002 * sc, 0.012 * sc), k);
      d = smin(d, sdCapsule(px, py, pz, 0.002 * sc, -0.01 * sc, 0, 0.018 * sc, 0.005 * sc, 0, 0.009 * sc), k);
      break;
  }

  // Attach pad — sinks into the temple so even small ears seal the skull surface
  const padIn = Math.max(0.016, 0.018 * sc);
  const padH = Math.max(0.024, 0.03 * sc);
  const padD = Math.max(0.018, 0.022 * sc);
  d = smin(
    d,
    sdEllipsoid(px, py, pz, -padIn * 0.35, 0, 0, padIn * 0.75, padH * 0.55, padD * 0.55),
    k * 1.1
  );
  d = smin(d, sdSphere(px, py, pz, -padIn * 0.15, 0.01 * sc, 0, Math.max(0.012, 0.014 * sc)), k);
  // Allow pad to live on the medial side; trim only past the plug depth
  d = smax(d, -px - padIn, 0.01 * sc);
  return d - 0.0012 * sc;
}

function earBounds(style, sc) {
  const pad = 0.018 * sc;
  const padIn = Math.max(0.016, 0.018 * sc);
  let x0 = -padIn - pad;
  let x1 = 0.04 * sc + pad;
  let y0 = -0.045 * sc - pad;
  let y1 = 0.05 * sc + pad;
  let z0 = -0.03 * sc - pad;
  let z1 = 0.03 * sc + pad;

  if (style === "wide" || style === "cupped") {
    x1 = 0.05 * sc + pad;
  } else if (style === "point") {
    y1 = 0.06 * sc + pad;
  } else if (style === "elf") {
    y1 = 0.085 * sc + pad;
    z0 = -0.04 * sc - pad;
  } else if (style === "lobe") {
    y0 = -0.06 * sc - pad;
  } else if (style === "floppy") {
    y0 = -0.055 * sc - pad;
    z1 = 0.05 * sc + pad;
    x1 = 0.05 * sc + pad;
  } else if (style === "small") {
    x1 = 0.032 * sc + pad;
    y0 = -0.032 * sc - pad;
    y1 = 0.032 * sc + pad;
  } else if (style === "wing") {
    z0 = -0.055 * sc - pad;
    y1 = 0.05 * sc + pad;
  } else if (style === "square") {
    x1 = 0.045 * sc + pad;
  }
  return { x0, x1, y0, y1, z0, z1 };
}

/**
 * Right ear in local space: origin at attach on skull side, +X outward, +Y up, +Z forward.
 * Mirror with scale.x = -1 for the left ear.
 */
export function buildSmoothEar(mat, opts = {}) {
  const style = opts.style || "round";
  const sc = opts.scale ?? 1;
  const res = opts.resolution ?? 26;
  const k = 0.01 * sc;
  const { x0, x1, y0, y1, z0, z1 } = earBounds(style, sc);
  const nx = res;
  const ny = res + 2;
  const nz = Math.max(18, res - 4);
  const field = sampleField(
    (px, py, pz) => sdEar(style, px, py, pz, sc, k),
    x0, x1, y0, y1, z0, z1, nx, ny, nz
  );
  const geo = marchField(field, nx, ny, nz, x0, x1, y0, y1, z0, z1, {
    smoothIters: 4,
    smoothStrength: 0.68,
    weldEps: 8e-5,
  });
  return finish(geo, mat, "ear", { earStyle: style });
}

/**
 * Right arched brow in local space: origin at brow center, +X toward temple, +Y up, +Z out.
 * Mirror with scale.x = -1 for the left brow.
 */
export function buildSmoothBrow(mat, opts = {}) {
  const sc = opts.scale ?? 1;
  const res = opts.resolution ?? 22;
  const k = 0.007 * sc;
  const thick = 0.0052 * sc;

  // Soft arch polyline (inner → peak → outer)
  const pts = [
    [-0.03 * sc, -0.003 * sc, 0.001 * sc],
    [-0.016 * sc, 0.005 * sc, 0.002 * sc],
    [0.0, 0.011 * sc, 0.003 * sc],
    [0.014 * sc, 0.007 * sc, 0.002 * sc],
    [0.028 * sc, -0.004 * sc, 0.001 * sc],
  ];

  function sdf(px, py, pz) {
    let d = 1e3;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const r = thick * (i === 0 || i === pts.length - 2 ? 0.85 : 1);
      d = smin(d, sdCapsule(px, py, pz, a[0], a[1], a[2], b[0], b[1], b[2], r), k);
    }
    // Soft tips
    d = smin(d, sdSphere(px, py, pz, pts[0][0], pts[0][1], pts[0][2], thick * 0.9), k);
    const tip = pts[pts.length - 1];
    d = smin(d, sdSphere(px, py, pz, tip[0], tip[1], tip[2], thick * 0.8), k);
    // Mild front bulge so it reads as a brow stroke on skin
    d = smin(
      d,
      sdEllipsoid(px, py, pz, 0, 0.004 * sc, 0.004 * sc, 0.022 * sc, 0.006 * sc, 0.005 * sc),
      k * 0.8
    );
    return d - 0.0008 * sc;
  }

  const pad = 0.012 * sc;
  const x0 = -0.038 * sc - pad;
  const x1 = 0.036 * sc + pad;
  const y0 = -0.016 * sc - pad;
  const y1 = 0.022 * sc + pad;
  const z0 = -0.01 * sc - pad * 0.5;
  const z1 = 0.014 * sc + pad;
  const field = sampleField(sdf, x0, x1, y0, y1, z0, z1, res + 4, res, Math.max(14, res - 6));
  const geo = marchField(field, res + 4, res, Math.max(14, res - 6), x0, x1, y0, y1, z0, z1, {
    smoothIters: 4,
    smoothStrength: 0.72,
    weldEps: 6e-5,
  });
  return finish(geo, mat, "brow", { browStyle: "arched" });
}

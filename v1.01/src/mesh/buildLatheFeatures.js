/**
 * Nose / ear / brow accents — nose is SDF bridge + lower bulb soft-union.
 */
import * as THREE from "three";
import { latheMesh, profileFromKeys, shaftProfile, clamp } from "./latheParts.js";
import { smin, sdSphere, sdCapsule, sdEllipsoid, marchField, mix } from "./sdfCore.js";

/**
 * Style recipes: bridge capsule (root → tip) + lower bulb ellipsoid.
 * Local space: origin on face skin, +Y up, +Z out of face.
 */
function noseRecipe(style, sc, width = 1) {
  const w = clamp(width, 0.5, 1.8);
  // Defaults: shorter/smaller bridge + tip (base scale already reduced vs older noses)
  let bridgeTopY = 0.016 * sc;
  let bridgeBotY = -0.004 * sc;
  let bridgeZ0 = 0.004 * sc;
  let bridgeZ1 = 0.02 * sc;
  let bridgeR = 0.0045 * sc;
  let tipY = -0.007 * sc;
  let tipZ = 0.024 * sc;
  let tipRx = 0.01 * sc;
  let tipRy = 0.008 * sc;
  let tipRz = 0.009 * sc;
  let blend = 0.007 * sc;

  switch (style) {
    case "bridge":
    case "straight":
      bridgeTopY = 0.024 * sc;
      bridgeBotY = -0.001 * sc;
      bridgeZ1 = 0.022 * sc;
      bridgeR = 0.0045 * sc;
      tipY = -0.006 * sc;
      tipZ = 0.026 * sc;
      tipRx = 0.0085 * sc;
      tipRy = 0.007 * sc;
      tipRz = 0.008 * sc;
      break;
    case "roman":
      bridgeTopY = 0.026 * sc;
      bridgeBotY = 0.0;
      bridgeZ0 = 0.007 * sc;
      bridgeZ1 = 0.028 * sc;
      bridgeR = 0.0055 * sc;
      tipY = -0.009 * sc;
      tipZ = 0.03 * sc;
      tipRx = 0.009 * sc;
      tipRy = 0.008 * sc;
      tipRz = 0.009 * sc;
      blend = 0.009 * sc;
      break;
    case "slope":
      bridgeTopY = 0.022 * sc;
      bridgeBotY = -0.01 * sc;
      bridgeZ0 = 0.003 * sc;
      bridgeZ1 = 0.03 * sc;
      bridgeR = 0.004 * sc;
      tipY = -0.013 * sc;
      tipZ = 0.034 * sc;
      tipRx = 0.008 * sc;
      tipRy = 0.0065 * sc;
      tipRz = 0.009 * sc;
      break;
    case "pointy":
      bridgeTopY = 0.02 * sc;
      bridgeBotY = -0.003 * sc;
      bridgeZ1 = 0.03 * sc;
      bridgeR = 0.0035 * sc;
      tipY = -0.004 * sc;
      tipZ = 0.034 * sc;
      tipRx = 0.0055 * sc;
      tipRy = 0.005 * sc;
      tipRz = 0.01 * sc;
      blend = 0.006 * sc;
      break;
    case "bulbous":
      bridgeTopY = 0.014 * sc;
      bridgeBotY = 0.0;
      bridgeZ1 = 0.016 * sc;
      bridgeR = 0.0055 * sc;
      tipY = -0.009 * sc;
      tipZ = 0.028 * sc;
      tipRx = 0.014 * sc;
      tipRy = 0.011 * sc;
      tipRz = 0.013 * sc;
      blend = 0.01 * sc;
      break;
    case "flat":
      bridgeTopY = 0.012 * sc;
      bridgeBotY = -0.003 * sc;
      bridgeZ1 = 0.013 * sc;
      bridgeR = 0.006 * sc;
      tipY = -0.006 * sc;
      tipZ = 0.018 * sc;
      tipRx = 0.014 * sc;
      tipRy = 0.0055 * sc;
      tipRz = 0.006 * sc;
      break;
    case "broad":
      bridgeTopY = 0.017 * sc;
      bridgeBotY = -0.004 * sc;
      bridgeZ1 = 0.019 * sc;
      bridgeR = 0.006 * sc;
      tipY = -0.007 * sc;
      tipZ = 0.024 * sc;
      tipRx = 0.016 * sc;
      tipRy = 0.007 * sc;
      tipRz = 0.009 * sc;
      break;
    case "hooked":
    case "hawk":
      bridgeTopY = 0.022 * sc;
      bridgeBotY = -0.006 * sc;
      bridgeZ0 = 0.006 * sc;
      bridgeZ1 = 0.026 * sc;
      bridgeR = 0.0045 * sc;
      tipY = -0.016 * sc;
      tipZ = 0.03 * sc;
      tipRx = 0.0085 * sc;
      tipRy = 0.007 * sc;
      tipRz = 0.01 * sc;
      blend = 0.008 * sc;
      break;
    case "snub":
      bridgeTopY = 0.01 * sc;
      bridgeBotY = 0.001 * sc;
      bridgeZ1 = 0.014 * sc;
      bridgeR = 0.005 * sc;
      tipY = 0.0;
      tipZ = 0.022 * sc;
      tipRx = 0.01 * sc;
      tipRy = 0.0085 * sc;
      tipRz = 0.009 * sc;
      break;
    case "petite":
      bridgeTopY = 0.01 * sc;
      bridgeBotY = -0.001 * sc;
      bridgeZ1 = 0.013 * sc;
      bridgeR = 0.003 * sc;
      tipY = -0.003 * sc;
      tipZ = 0.016 * sc;
      tipRx = 0.0055 * sc;
      tipRy = 0.005 * sc;
      tipRz = 0.006 * sc;
      blend = 0.004 * sc;
      break;
    case "button":
    default:
      bridgeTopY = 0.009 * sc;
      bridgeBotY = 0.0;
      bridgeZ1 = 0.012 * sc;
      bridgeR = 0.0038 * sc;
      tipY = -0.004 * sc;
      tipZ = 0.02 * sc;
      tipRx = 0.01 * sc;
      tipRy = 0.008 * sc;
      tipRz = 0.009 * sc;
      blend = 0.007 * sc;
      break;
  }

  // Width scales lateral radii (bridge + tip X)
  bridgeR *= mix(0.75, 1.35, (w - 0.5) / 1.3);
  tipRx *= w;
  tipRz *= mix(0.9, 1.1, (w - 0.5) / 1.3);

  return {
    bridgeTopY,
    bridgeBotY,
    bridgeZ0,
    bridgeZ1,
    bridgeR,
    tipY,
    tipZ,
    tipRx,
    tipRy,
    tipRz,
    blend,
  };
}

/**
 * Local tip offset from nose attach origin (+Y up, +Z out of face).
 * faceNoseY targets this tip, not the bridge root.
 */
export function noseTipLocal(opts = {}) {
  const style = opts.style || "button";
  const sc = clamp(opts.scale ?? 0.78, 0.35, 2.0);
  const width = clamp(opts.width ?? 1, 0.5, 1.8);
  const r = noseRecipe(style, sc, width);
  let tipY = r.tipY;
  let tipZ = r.tipZ + r.tipRz * 0.35;
  if (style === "hooked" || style === "hawk") {
    tipY = r.tipY - 0.008 * sc;
    tipZ = r.tipZ + 0.004 * sc + 0.01 * sc * 0.35;
  }
  return { y: tipY, z: tipZ, recipe: r };
}

/**
 * Nose grows +Z from origin (park on face skin). SDF soft-union of bridge + bulb.
 */
export function buildLatheNose(mat, opts = {}) {
  const style = opts.style || "button";
  const sc = clamp(opts.scale ?? 0.78, 0.35, 2.0);
  const width = clamp(opts.width ?? 1, 0.5, 1.8);
  const r = noseRecipe(style, sc, width);
  const tip = noseTipLocal({ style, scale: sc, width });

  const nx = 14;
  const ny = 16;
  const nz = 14;
  const pad = 0.012 * sc;
  const x0 = -Math.max(r.tipRx, r.bridgeR) - pad;
  const x1 = -x0;
  const y0 = Math.min(r.bridgeBotY, r.tipY - r.tipRy) - pad;
  const y1 = r.bridgeTopY + r.bridgeR + pad;
  const z0 = -pad * 0.4;
  const z1 = Math.max(r.bridgeZ1, r.tipZ + r.tipRz) + pad;

  const field = new Float32Array(nx * ny * nz);
  let i = 0;
  for (let iz = 0; iz < nz; iz++) {
    const pz = z0 + ((z1 - z0) * iz) / (nz - 1);
    for (let iy = 0; iy < ny; iy++) {
      const py = y0 + ((y1 - y0) * iy) / (ny - 1);
      for (let ix = 0; ix < nx; ix++) {
        const px = x0 + ((x1 - x0) * ix) / (nx - 1);
        const bridge = sdCapsule(
          px,
          py,
          pz,
          0,
          r.bridgeTopY,
          r.bridgeZ0,
          0,
          r.bridgeBotY,
          r.bridgeZ1,
          r.bridgeR
        );
        const bulb = sdEllipsoid(px, py, pz, 0, r.tipY, r.tipZ, r.tipRx, r.tipRy, r.tipRz);
        // Hawk / hooked: extra downward tip sphere for a hooked tip
        let d = smin(bridge, bulb, r.blend);
        if (style === "hooked" || style === "hawk") {
          const hook = sdSphere(px, py, pz, 0, r.tipY - 0.008 * sc, r.tipZ + 0.004 * sc, 0.01 * sc);
          d = smin(d, hook, r.blend * 0.85);
        }
        if (style === "roman") {
          const bump = sdSphere(px, py, pz, 0, r.bridgeTopY * 0.45, r.bridgeZ1 * 0.7, 0.009 * sc);
          d = smin(d, bump, r.blend * 0.7);
        }
        field[i++] = d;
      }
    }
  }

  const geo = marchField(field, nx, ny, nz, x0, x1, y0, y1, z0, z1, {
    smoothIters: 2,
    smoothStrength: 0.45,
  });
  if (!geo) return null;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "nose";
  mesh.userData.skinBone = "head";
  mesh.userData.tipLocal = { y: tip.y, z: tip.z };
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Ear grows +X from attach origin.
 */
export function buildLatheEar(mat, opts = {}) {
  const style = opts.style || "round";
  const sc = clamp(opts.scale ?? 1, 0.5, 2.5);
  const len = (style === "point" ? 0.055 : 0.048) * sc;
  const tipR = style === "point" ? 0.004 * sc : 0.01 * sc;
  const pts = profileFromKeys(
    [
      { y: 0, r: 0.012 * sc },
      { y: len * 0.35, r: 0.022 * sc },
      { y: len * 0.7, r: style === "wide" ? 0.026 * sc : 0.02 * sc },
      { y: len, r: tipR },
    ],
    2
  );
  const mesh = latheMesh(pts, { material: mat, name: "ear", skinBone: "head", segments: 12 });
  // Y-up → +X
  mesh.rotation.z = -Math.PI / 2;
  return mesh;
}

/** Simple arched brow as a short bent lathe (flat-ish). */
export function buildLatheBrow(mat, opts = {}) {
  const sc = clamp(opts.scale ?? 1, 0.4, 2);
  const pts = shaftProfile(0.04 * sc, 0.006 * sc, 0.005 * sc, 0.007 * sc);
  const mesh = latheMesh(pts, { material: mat, name: "brow", skinBone: "head", segments: 8 });
  mesh.rotation.z = Math.PI / 2;
  mesh.rotation.y = 0.15;
  return mesh;
}

export const buildSmoothNose = buildLatheNose;
export const buildSmoothEar = buildLatheEar;
export const buildSmoothBrow = buildLatheBrow;

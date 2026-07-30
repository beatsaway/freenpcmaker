/**
 * Nose / ear / brow accents — nose is SDF bridge + lower bulb soft-union.
 * Recipes stay mild (no exaggerated long/pointy caricatures).
 */
import * as THREE from "three";
import { latheMesh, profileFromKeys, shaftProfile, clamp } from "./latheParts.js";
import { smin, sdSphere, sdCapsule, sdEllipsoid, marchField, mix } from "./sdfCore.js";

/**
 * Style recipes: bridge capsule (root → tip) + lower bulb ellipsoid.
 * Local space: origin on face skin, +Y up, +Z out of face.
 * Tip Z stays modest so noses read as face volume, not floating beaks.
 */
function noseRecipe(style, sc, width = 1) {
  const w = clamp(width, 0.5, 1.8);
  // Mild defaults — short bridge, soft bulb
  let bridgeTopY = 0.014 * sc;
  let bridgeBotY = -0.002 * sc;
  let bridgeZ0 = 0.001 * sc; // root sits in/on skin
  let bridgeZ1 = 0.016 * sc;
  let bridgeR = 0.0045 * sc;
  let tipY = -0.006 * sc;
  let tipZ = 0.02 * sc;
  let tipRx = 0.01 * sc;
  let tipRy = 0.008 * sc;
  let tipRz = 0.008 * sc;
  let blend = 0.007 * sc;

  switch (style) {
    case "soft":
      bridgeTopY = 0.012 * sc;
      bridgeBotY = 0.0;
      bridgeZ1 = 0.014 * sc;
      tipY = -0.005 * sc;
      tipZ = 0.018 * sc;
      tipRx = 0.011 * sc;
      tipRy = 0.009 * sc;
      tipRz = 0.0085 * sc;
      blend = 0.009 * sc;
      break;
    case "round":
      bridgeTopY = 0.011 * sc;
      bridgeBotY = 0.001 * sc;
      bridgeZ1 = 0.013 * sc;
      tipY = -0.004 * sc;
      tipZ = 0.019 * sc;
      tipRx = 0.012 * sc;
      tipRy = 0.01 * sc;
      tipRz = 0.01 * sc;
      blend = 0.01 * sc;
      break;
    case "short":
      bridgeTopY = 0.008 * sc;
      bridgeBotY = 0.0;
      bridgeZ1 = 0.011 * sc;
      tipY = -0.002 * sc;
      tipZ = 0.016 * sc;
      tipRx = 0.009 * sc;
      tipRy = 0.0075 * sc;
      tipRz = 0.007 * sc;
      break;
    case "upturned":
      bridgeTopY = 0.01 * sc;
      bridgeBotY = 0.002 * sc;
      bridgeZ1 = 0.014 * sc;
      tipY = 0.002 * sc;
      tipZ = 0.02 * sc;
      tipRx = 0.01 * sc;
      tipRy = 0.008 * sc;
      tipRz = 0.0085 * sc;
      break;
    case "flared":
      bridgeTopY = 0.013 * sc;
      bridgeBotY = -0.002 * sc;
      bridgeZ1 = 0.015 * sc;
      tipY = -0.006 * sc;
      tipZ = 0.02 * sc;
      tipRx = 0.015 * sc;
      tipRy = 0.0075 * sc;
      tipRz = 0.008 * sc;
      break;
    case "bridge":
    case "straight":
      bridgeTopY = 0.02 * sc;
      bridgeBotY = -0.001 * sc;
      bridgeZ1 = 0.018 * sc;
      tipY = -0.005 * sc;
      tipZ = 0.021 * sc;
      tipRx = 0.0085 * sc;
      tipRy = 0.007 * sc;
      tipRz = 0.0075 * sc;
      break;
    case "roman":
    case "arched":
      // Mild arched bridge — not a long hooked beak
      bridgeTopY = 0.02 * sc;
      bridgeBotY = 0.0;
      bridgeZ0 = 0.002 * sc;
      bridgeZ1 = 0.02 * sc;
      bridgeR = 0.005 * sc;
      tipY = -0.007 * sc;
      tipZ = 0.022 * sc;
      tipRx = 0.009 * sc;
      tipRy = 0.0075 * sc;
      tipRz = 0.008 * sc;
      blend = 0.008 * sc;
      break;
    case "slope":
    case "soft-slope":
      bridgeTopY = 0.018 * sc;
      bridgeBotY = -0.006 * sc;
      bridgeZ0 = 0.001 * sc;
      bridgeZ1 = 0.02 * sc;
      tipY = -0.009 * sc;
      tipZ = 0.022 * sc;
      tipRx = 0.0085 * sc;
      tipRy = 0.0065 * sc;
      tipRz = 0.008 * sc;
      break;
    case "pointy":
      // Soft point — short tip, never a long protrusion
      bridgeTopY = 0.016 * sc;
      bridgeBotY = -0.002 * sc;
      bridgeZ1 = 0.018 * sc;
      bridgeR = 0.0038 * sc;
      tipY = -0.004 * sc;
      tipZ = 0.022 * sc;
      tipRx = 0.0065 * sc;
      tipRy = 0.0055 * sc;
      tipRz = 0.008 * sc;
      blend = 0.005 * sc;
      break;
    case "bulbous":
      bridgeTopY = 0.012 * sc;
      bridgeBotY = 0.0;
      bridgeZ1 = 0.014 * sc;
      tipY = -0.008 * sc;
      tipZ = 0.022 * sc;
      tipRx = 0.013 * sc;
      tipRy = 0.01 * sc;
      tipRz = 0.011 * sc;
      blend = 0.01 * sc;
      break;
    case "flat":
      bridgeTopY = 0.01 * sc;
      bridgeBotY = -0.002 * sc;
      bridgeZ1 = 0.011 * sc;
      tipY = -0.005 * sc;
      tipZ = 0.015 * sc;
      tipRx = 0.013 * sc;
      tipRy = 0.0055 * sc;
      tipRz = 0.0055 * sc;
      break;
    case "broad":
      bridgeTopY = 0.014 * sc;
      bridgeBotY = -0.003 * sc;
      bridgeZ1 = 0.016 * sc;
      tipY = -0.006 * sc;
      tipZ = 0.019 * sc;
      tipRx = 0.015 * sc;
      tipRy = 0.007 * sc;
      tipRz = 0.008 * sc;
      break;
    case "hooked":
    case "hawk":
      // Mild downturn only — keep tip short and soft
      bridgeTopY = 0.018 * sc;
      bridgeBotY = -0.004 * sc;
      bridgeZ0 = 0.002 * sc;
      bridgeZ1 = 0.019 * sc;
      tipY = -0.01 * sc;
      tipZ = 0.021 * sc;
      tipRx = 0.0085 * sc;
      tipRy = 0.007 * sc;
      tipRz = 0.0085 * sc;
      blend = 0.007 * sc;
      break;
    case "snub":
      bridgeTopY = 0.009 * sc;
      bridgeBotY = 0.001 * sc;
      bridgeZ1 = 0.013 * sc;
      tipY = 0.0;
      tipZ = 0.019 * sc;
      tipRx = 0.01 * sc;
      tipRy = 0.0085 * sc;
      tipRz = 0.0085 * sc;
      break;
    case "petite":
      bridgeTopY = 0.009 * sc;
      bridgeBotY = -0.001 * sc;
      bridgeZ1 = 0.011 * sc;
      tipY = -0.003 * sc;
      tipZ = 0.014 * sc;
      tipRx = 0.0055 * sc;
      tipRy = 0.005 * sc;
      tipRz = 0.0055 * sc;
      blend = 0.004 * sc;
      break;
    case "button":
    default:
      bridgeTopY = 0.009 * sc;
      bridgeBotY = 0.0;
      bridgeZ1 = 0.012 * sc;
      tipY = -0.004 * sc;
      tipZ = 0.018 * sc;
      tipRx = 0.01 * sc;
      tipRy = 0.008 * sc;
      tipRz = 0.008 * sc;
      blend = 0.007 * sc;
      break;
  }

  // Hard cap protrusion so no style becomes a long beak
  tipZ = Math.min(tipZ, 0.026 * sc);
  bridgeZ1 = Math.min(bridgeZ1, tipZ * 0.95);

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
    tipY = r.tipY - 0.004 * sc;
    tipZ = r.tipZ + 0.002 * sc + r.tipRz * 0.25;
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
  // Allow a little −Z into the face so the root seats flush
  const z0 = -pad * 0.55;
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
        let d = smin(bridge, bulb, r.blend);
        // Soft arched bump only (no hooked beak sphere)
        if (style === "roman" || style === "arched") {
          const bump = sdSphere(px, py, pz, 0, r.bridgeTopY * 0.45, r.bridgeZ1 * 0.65, 0.007 * sc);
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

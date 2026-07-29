/**
 * Smooth hat meshes via SDF → marching cubes.
 */
import * as THREE from "three";
import {
  mix, smin, smax, sdSphere, sdEllipsoid, marchField,
} from "./sdfCore.js";
import { probeHairCrown } from "./buildSmoothHair.js";

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

/**
 * Size a hat from hairstyle (when available); seat on the skull so hair can intersect.
 *
 * @param {{ style?:string, hw?:number, hh?:number, hd?:number, headY?:number, skullTop?:number, hairStyle?:string }} opts
 * @returns {{ scale:number, lift:number, seatY:number, radius:number }}
 */
export function fitHatToCrown(opts = {}) {
  const W = opts.hw ?? 0.16;
  const H = opts.hh ?? 0.2;
  const D = opts.hd ?? 0.18;
  const skullTop = opts.skullTop ?? opts.headTop ?? 1.76;
  const hairStyle = opts.hairStyle || opts.style || "short";
  const headY = opts.headY ?? skullTop - H * 0.5;

  let radius = Math.max(W, D) * 0.52;
  let scale = 1.05;

  // Adapt band size to hairstyle volume when we can measure it
  if (hairStyle && hairStyle !== "bald" && hairStyle !== "none") {
    try {
      const crown = probeHairCrown({
        style: hairStyle,
        hw: W,
        hh: H,
        hd: D,
        headY,
        skullTop,
      });
      if (crown?.radius > 0) {
        radius = crown.radius;
        const targetW = crown.radius * 2.05;
        scale = targetW / Math.max(1e-6, W);
        scale = Math.min(1.7, Math.max(1.0, scale));
      }
    } catch {
      // keep skull-based scale
    }
  }

  // Seat on skull — do not lift above hair to “clear” it
  const seatY = skullTop - 0.008;
  const lift = seatY - skullTop;

  return { scale, lift, seatY, radius };
}

/** @deprecated use fitHatToCrown */
export function hairHatClearance(hairStyle = "short") {
  const fitted = fitHatToCrown({ hairStyle, hw: 0.16, hh: 0.2, hd: 0.18, skullTop: 1.76 });
  return { scale: fitted.scale, lift: fitted.lift };
}

/** Party / wizard cone — tip up, band on skull. */
function buildSolidCone(mat, brimMat, W, H, D, top) {
  const g = new THREE.Group();
  g.name = "hat";
  g.userData.meshMethod = "solid-cone";
  g.userData.hatStyle = "cone";

  const baseR = Math.max(W, D) * 0.58;
  const coneH = Math.max(0.16, H * 1.05);
  const bandH = Math.max(0.02, H * 0.08);

  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(baseR * 0.98, baseR * 1.06, bandH, 28),
    brimMat || mat
  );
  band.position.set(0, top + bandH * 0.35, 0);
  band.castShadow = true;
  band.receiveShadow = true;
  g.add(band);

  const cone = new THREE.Mesh(new THREE.ConeGeometry(baseR * 0.96, coneH, 28), mat);
  cone.position.set(0, top + bandH * 0.55 + coneH * 0.48, 0);
  cone.castShadow = true;
  cone.receiveShadow = true;
  g.add(cone);

  // Small tip ball
  const tip = new THREE.Mesh(new THREE.SphereGeometry(baseR * 0.12, 10, 8), mat);
  tip.position.set(0, top + bandH * 0.55 + coneH * 0.95, 0);
  tip.castShadow = true;
  tip.receiveShadow = true;
  g.add(tip);

  return g;
}

/**
 * Solid parametric sunhat — MC hollows out wide brims; use closed primitives instead.
 */
function buildSolidSunhat(mat, brimMat, W, H, D, top) {
  const g = new THREE.Group();
  g.name = "hat";
  g.userData.meshMethod = "solid-sunhat";
  g.userData.hatStyle = "sunhat";

  const brimH = Math.max(0.022, H * 0.08);
  const brimR = Math.max(W, D) * 1.32;
  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(brimR * 0.96, brimR, brimH, 32),
    brimMat || mat
  );
  brim.position.set(0, top + brimH * 0.35, 0);
  brim.castShadow = true;
  brim.receiveShadow = true;
  g.add(brim);

  // Soft front tip of brim
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(W * 0.28, 12, 10),
    brimMat || mat
  );
  tip.scale.set(1.1, 0.35, 1.35);
  tip.position.set(0, top + brimH * 0.25, D * 0.85);
  tip.castShadow = true;
  tip.receiveShadow = true;
  g.add(tip);

  const crownH = Math.max(0.05, H * 0.4);
  const crownR = Math.max(W, D) * 0.5;
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(crownR * 0.98, crownR, crownH * 0.35, 24),
    mat
  );
  band.position.set(0, top + brimH * 0.6 + crownH * 0.12, 0);
  band.castShadow = true;
  band.receiveShadow = true;
  g.add(band);

  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(crownR * 0.9, crownR * 0.98, crownH * 0.7, 24),
    mat
  );
  wall.position.set(0, top + brimH * 0.55 + crownH * 0.55, 0);
  wall.castShadow = true;
  wall.receiveShadow = true;
  g.add(wall);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(crownR * 0.95, 20, 16),
    mat
  );
  dome.scale.set(1, 0.72, 1);
  dome.position.set(0, top + brimH * 0.55 + crownH * 0.85, 0);
  dome.castShadow = true;
  dome.receiveShadow = true;
  g.add(dome);

  return g;
}

/** Closed solid bowler — MC sphere+cut left a hollow crown. */
function buildSolidBowler(mat, brimMat, W, H, D, top) {
  const g = new THREE.Group();
  g.name = "hat";
  g.userData.meshMethod = "solid-bowler";
  g.userData.hatStyle = "bowler";

  const crownR = Math.max(W, D) * 0.5;
  const brimH = Math.max(0.018, H * 0.07);
  const brimR = Math.max(W, D) * 0.78;

  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(brimR * 0.98, brimR, brimH, 36),
    brimMat || mat
  );
  brim.position.set(0, top + brimH * 0.45, 0);
  brim.castShadow = true;
  brim.receiveShadow = true;
  g.add(brim);

  // Soft brim edge roll
  const rim = new THREE.Mesh(new THREE.TorusGeometry(brimR * 0.92, brimH * 0.55, 8, 36), brimMat || mat);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, top + brimH * 0.45, 0);
  rim.castShadow = true;
  rim.receiveShadow = true;
  g.add(rim);

  // Solid dome (full sphere, sunk so only the crown shows above the brim)
  const dome = new THREE.Mesh(new THREE.SphereGeometry(crownR, 28, 20), mat);
  dome.scale.set(1.02, 0.95, 1.02);
  dome.position.set(0, top + brimH * 0.35 + crownR * 0.42, 0);
  dome.castShadow = true;
  dome.receiveShadow = true;
  g.add(dome);

  // Fill under the dome so you never see an open cavity from any angle
  const plug = new THREE.Mesh(
    new THREE.CylinderGeometry(crownR * 0.92, crownR * 0.98, crownR * 0.55, 24),
    mat
  );
  plug.position.set(0, top + brimH * 0.5 + crownR * 0.2, 0);
  plug.castShadow = true;
  plug.receiveShadow = true;
  g.add(plug);

  return g;
}

/** Closed solid round cap / beanie-like dome. */
function buildSolidRoundcap(mat, W, H, D, top) {
  const g = new THREE.Group();
  g.name = "hat";
  g.userData.meshMethod = "solid-roundcap";
  g.userData.hatStyle = "roundcap";

  const crownR = Math.max(W, D) * 0.55;
  const bandH = Math.max(0.022, H * 0.1);

  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(crownR * 0.98, crownR * 1.02, bandH, 28),
    mat
  );
  band.position.set(0, top + bandH * 0.35, 0);
  band.castShadow = true;
  band.receiveShadow = true;
  g.add(band);

  const dome = new THREE.Mesh(new THREE.SphereGeometry(crownR, 28, 20), mat);
  dome.scale.set(1, 0.88, 1);
  dome.position.set(0, top + bandH * 0.25 + crownR * 0.38, 0);
  dome.castShadow = true;
  dome.receiveShadow = true;
  g.add(dome);

  const plug = new THREE.Mesh(
    new THREE.CylinderGeometry(crownR * 0.9, crownR * 0.96, crownR * 0.5, 24),
    mat
  );
  plug.position.set(0, top + bandH * 0.4 + crownR * 0.18, 0);
  plug.castShadow = true;
  plug.receiveShadow = true;
  g.add(plug);

  return g;
}

/**
 * @param {THREE.Material} mat main hat material
 * @param {{ style:string, hw:number, hh:number, hd:number, headTop:number, headY?:number, hairStyle?:string, hairMesh?:THREE.Object3D, headMesh?:THREE.Object3D, brimMat?:THREE.Material, resolution?:number }} opts
 */
export function buildSmoothHat(mat, opts = {}) {
  const style = opts.style || "none";
  if (style === "none") return null;

  const fitted = fitHatToCrown({
    hairStyle: opts.hairStyle || "short",
    hw: opts.hw ?? 0.16,
    hh: opts.hh ?? 0.2,
    hd: opts.hd ?? 0.18,
    headY: opts.headY,
    skullTop: opts.headTop ?? 1.76,
  });
  const scale = fitted.scale;
  const W = (opts.hw ?? 0.16) * scale;
  const H = (opts.hh ?? 0.2) * Math.min(1.12, 0.92 + scale * 0.12);
  const D = (opts.hd ?? 0.18) * scale;
  // Seat on skull (size may still follow hairstyle)
  const top = fitted.seatY;
  const brimMat = opts.brimMat || mat;
  const res = opts.resolution ?? 30;
  const k = 0.02;

  // Domed / solid hats: closed primitives — MC left hollow crowns
  if (style === "sunhat") return buildSolidSunhat(mat, brimMat, W, H, D, top);
  if (style === "bowler") return buildSolidBowler(mat, brimMat, W, H, D, top);
  if (style === "roundcap") return buildSolidRoundcap(mat, W, H, D, top);
  if (style === "cone") return buildSolidCone(mat, brimMat, W, H, D, top);

  function sdfCap(px, py, pz) {
    let d = sdEllipsoid(px, py, pz, 0, top + H * 0.02, -D * 0.02, W * 0.52, H * 0.2, D * 0.5);
    d = smin(d, sdEllipsoid(px, py, pz, 0, top - H * 0.02, 0, W * 0.5, H * 0.1, D * 0.48), k);
    // bill
    d = smin(d, sdEllipsoid(px, py, pz, 0, top - H * 0.06, D * 0.42, W * 0.32, H * 0.05, D * 0.28), k);
    d = smax(d, py - (top + H * 0.22), 0.01);
    return d - 0.002;
  }

  function sdfBeanie(px, py, pz) {
    let d = sdEllipsoid(px, py, pz, 0, top + H * 0.05, 0, W * 0.52, H * 0.28, D * 0.5);
    d = smin(d, sdSphere(px, py, pz, 0, top + H * 0.28, 0, W * 0.12), k);
    d = smax(d, (top - H * 0.12) - py, 0.012);
    return d - 0.002;
  }

  function sdfVisor(px, py, pz) {
    let d = sdEllipsoid(px, py, pz, 0, top - H * 0.04, 0, W * 0.5, H * 0.07, D * 0.18);
    d = smin(d, sdEllipsoid(px, py, pz, 0, top - H * 0.08, D * 0.32, W * 0.4, H * 0.04, D * 0.28), k);
    return d - 0.002;
  }

  function sdfHardhat(px, py, pz) {
    let d = sdEllipsoid(px, py, pz, 0, top + H * 0.04, 0, W * 0.55, H * 0.22, D * 0.52);
    d = smin(d, sdEllipsoid(px, py, pz, 0, top - H * 0.08, 0, W * 0.65, H * 0.06, D * 0.62), k);
    d = smax(d, py - (top + H * 0.28), 0.01);
    return d - 0.002;
  }

  const sdfMap = {
    cap: sdfCap,
    beanie: sdfBeanie,
    visor: sdfVisor,
    hardhat: sdfHardhat,
  };
  const sdf = sdfMap[style] || sdfCap;

  const wide = style === "hardhat";
  const pad = 0.04;
  const x0 = -(wide ? W * 1.4 : W * 0.75) - pad;
  const x1 = -x0;
  const y0 = top - H * 0.2 - pad;
  const y1 = top + (style === "beanie" ? H * 0.55 : H * 0.42) + pad;
  const z0 = -(wide ? D * 1.3 : D * 0.75) - pad;
  const z1 = (style === "cap" || style === "visor" ? D * 1.1 : D * 0.7) + pad;

  const nx = wide ? res + 6 : res;
  const ny = res;
  const nz = wide ? res + 6 : res;
  const field = sampleField(sdf, x0, x1, y0, y1, z0, z1, nx, ny, nz);
  const geo = marchField(field, nx, ny, nz, x0, x1, y0, y1, z0, z1, {
    smoothIters: 4,
    smoothStrength: 0.72,
  });

  void brimMat;
  return finish(geo, mat, "hat", { hatStyle: style });
}

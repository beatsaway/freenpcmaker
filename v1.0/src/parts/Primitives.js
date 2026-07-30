/**
 * Shared low-poly primitives.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export { buildStack, figureLayout, SHAPE, faceParams, skullSize, skullSeatLocalY, skullCrownLocalY, HEAD_NECK_SINK } from "./Stack.js";

/** Kept for hair/hat fallbacks — prefer stack.head from buildStack(cfg). */
export const LAYOUT = Object.freeze({
  headY: 1.6,
});

export function boxMesh(w, h, d, mat, x = 0, y = 0, z = 0) {
  return roundBoxMesh(w, h, d, mat, x, y, z, Math.min(w, h, d) * 0.12);
}

export function roundBoxMesh(w, h, d, mat, x = 0, y = 0, z = 0, radius = 0.03, segments = 2) {
  const r = Math.max(0.008, Math.min(radius, w * 0.49, h * 0.49, d * 0.49));
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, segments, r), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function cylMesh(rTop, rBot, h, mat, x = 0, y = 0, z = 0, segs = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function sphereMesh(r, mat, x = 0, y = 0, z = 0, wSeg = 10, hSeg = 8) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, wSeg, hSeg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function sleeveMesh(w, h, d, mat, x, y, z) {
  return roundBoxMesh(w, h, d, mat, x, y, z, Math.min(w, d) * 0.32);
}

/** Limb shaft — rounded box only (no joint spheres). */
export function limbMesh(w, h, d, mat, x = 0, y = 0, z = 0) {
  return roundBoxMesh(w, h, d, mat, x, y, z, Math.min(w, d) * 0.32);
}

export function disposeObject3D(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}

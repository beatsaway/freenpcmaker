/**
 * Skull exclusion — keep hair points outside the cranial volume.
 * Ported from JUSTHAIR to stop hang/side strands chord through the skull.
 */
import * as THREE from "three";

const _c = new THREE.Vector3();
const _d = new THREE.Vector3();

function mix(a, b, t) {
  return a + (b - a) * t;
}

/** Approximate solid skull radius along a direction from head center. */
export function skullRadiusAlong(L, dir) {
  const R = L.R ?? 0.06;
  const up = Math.max(0, dir.y);
  const down = Math.max(0, -dir.y);
  return R * (1.0 + up * 0.02 - down * 0.12);
}

/**
 * Push point outside skull by at least margin * R along ray from center.
 * Returns a new Vector3 (or clone of p if already outside).
 */
export function keepOutside(L, p, margin = 0.06) {
  const headY = L.headY ?? 0;
  const R = L.R ?? 0.06;
  _c.set(0, headY, 0);
  _d.copy(p).sub(_c);
  const dist = _d.length();
  if (dist < 1e-8) {
    return new THREE.Vector3(0, headY + R * (1.05 + margin), 0);
  }
  _d.multiplyScalar(1 / dist);
  const minR = skullRadiusAlong(L, _d) + margin * R;
  if (dist >= minR) return p.clone ? p.clone() : new THREE.Vector3(p.x, p.y, p.z);
  return _c.clone().addScaledVector(_d, minR);
}

/** Apply keepOutside along a polyline. */
export function keepCurveOutside(L, points, margin = 0.06) {
  return points.map((p, i) => {
    const m = mix(margin, margin * 0.85, i / Math.max(1, points.length - 1));
    return keepOutside(L, p, m);
  });
}

/** Mutate a flat xyz position buffer so every vertex stays outside the skull. */
export function keepBufferOutside(L, pos, margin = 0.05) {
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.length; i += 3) {
    p.set(pos[i], pos[i + 1], pos[i + 2]);
    const q = keepOutside(L, p, margin);
    pos[i] = q.x;
    pos[i + 1] = q.y;
    pos[i + 2] = q.z;
  }
  return pos;
}

/**
 * Shared SDF helpers + marching cubes → weld → Laplacian smooth.
 */
import * as THREE from "three";
import { edgeTable, triTable } from "three/addons/objects/MarchingCubes.js";

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
export function mix(a, b, t) {
  return a + (b - a) * t;
}
export function smin(a, b, k) {
  const h = clamp(0.5 + (0.5 * (b - a)) / Math.max(1e-6, k), 0, 1);
  return mix(b, a, h) - k * h * (1 - h);
}
export function smax(a, b, k) {
  return -smin(-a, -b, k);
}

export function sdSphere(px, py, pz, cx, cy, cz, r) {
  return Math.hypot(px - cx, py - cy, pz - cz) - r;
}

export function sdCapsule(px, py, pz, ax, ay, az, bx, by, bz, r) {
  const pax = px - ax;
  const pay = py - ay;
  const paz = pz - az;
  const bax = bx - ax;
  const bay = by - ay;
  const baz = bz - az;
  const baba = bax * bax + bay * bay + baz * baz;
  const paba = pax * bax + pay * bay + paz * baz;
  const h = clamp(paba / Math.max(1e-8, baba), 0, 1);
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - r;
}

export function sdEllipsoid(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const qx = (px - cx) / rx;
  const qy = (py - cy) / ry;
  const qz = (pz - cz) / rz;
  const len = Math.hypot(qx, qy, qz);
  return (len - 1) * Math.min(rx, ry, rz);
}

const EDGE_VERT = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

export function weldByPosition(geo, eps = 1e-4) {
  const pos = geo.attributes.position;
  const idx = geo.index;
  const inv = 1 / eps;
  const map = new Map();
  const newPos = [];
  const remap = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${Math.round(x * inv)},${Math.round(y * inv)},${Math.round(z * inv)}`;
    let id = map.get(key);
    if (id == null) {
      id = newPos.length / 3;
      map.set(key, id);
      newPos.push(x, y, z);
    }
    remap[i] = id;
  }
  const newIdx = new Uint32Array(idx.count);
  for (let i = 0; i < idx.count; i++) newIdx[i] = remap[idx.getX(i)];
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(newPos), 3));
  out.setIndex(new THREE.BufferAttribute(newIdx, 1));
  return out;
}

export function smoothGeometry(geo, iterations = 3, strength = 0.6) {
  const pos = geo.attributes.position;
  const idx = geo.index;
  const n = pos.count;
  const neighbors = Array.from({ length: n }, () => new Set());
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i);
    const b = idx.getX(i + 1);
    const c = idx.getX(i + 2);
    if (a === b || b === c || a === c) continue;
    neighbors[a].add(b); neighbors[a].add(c);
    neighbors[b].add(a); neighbors[b].add(c);
    neighbors[c].add(a); neighbors[c].add(b);
  }
  const tmp = new Float32Array(n * 3);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < n; i++) {
      const set = neighbors[i];
      if (!set.size) {
        tmp[i * 3] = pos.getX(i);
        tmp[i * 3 + 1] = pos.getY(i);
        tmp[i * 3 + 2] = pos.getZ(i);
        continue;
      }
      let sx = 0;
      let sy = 0;
      let sz = 0;
      for (const j of set) {
        sx += pos.getX(j);
        sy += pos.getY(j);
        sz += pos.getZ(j);
      }
      const inv = 1 / set.size;
      tmp[i * 3] = pos.getX(i) + (sx * inv - pos.getX(i)) * strength;
      tmp[i * 3 + 1] = pos.getY(i) + (sy * inv - pos.getY(i)) * strength;
      tmp[i * 3 + 2] = pos.getZ(i) + (sz * inv - pos.getZ(i)) * strength;
    }
    for (let i = 0; i < n; i++) pos.setXYZ(i, tmp[i * 3], tmp[i * 3 + 1], tmp[i * 3 + 2]);
  }
  pos.needsUpdate = true;
}

/**
 * Sample scalar field (negative = inside) → welded, smoothed BufferGeometry.
 */
export function marchField(field, nx, ny, nz, x0, x1, y0, y1, z0, z1, opts = {}) {
  const positions = [];
  const dx = (x1 - x0) / (nx - 1);
  const dy = (y1 - y0) / (ny - 1);
  const dz = (z1 - z0) / (nz - 1);
  const vertList = new Array(12);
  const g = (ix, iy, iz) => field[ix + nx * (iy + ny * iz)];

  for (let iz = 0; iz < nz - 1; iz++) {
    for (let iy = 0; iy < ny - 1; iy++) {
      for (let ix = 0; ix < nx - 1; ix++) {
        const vals = [
          g(ix, iy, iz), g(ix + 1, iy, iz), g(ix + 1, iy + 1, iz), g(ix, iy + 1, iz),
          g(ix, iy, iz + 1), g(ix + 1, iy, iz + 1), g(ix + 1, iy + 1, iz + 1), g(ix, iy + 1, iz + 1),
        ];
        let cubeIndex = 0;
        for (let i = 0; i < 8; i++) if (vals[i] < 0) cubeIndex |= 1 << i;
        const edges = edgeTable[cubeIndex];
        if (!edges) continue;

        const xs = [
          x0 + ix * dx, x0 + (ix + 1) * dx, x0 + (ix + 1) * dx, x0 + ix * dx,
          x0 + ix * dx, x0 + (ix + 1) * dx, x0 + (ix + 1) * dx, x0 + ix * dx,
        ];
        const ys = [
          y0 + iy * dy, y0 + iy * dy, y0 + (iy + 1) * dy, y0 + (iy + 1) * dy,
          y0 + iy * dy, y0 + iy * dy, y0 + (iy + 1) * dy, y0 + (iy + 1) * dy,
        ];
        const zs = [
          z0 + iz * dz, z0 + iz * dz, z0 + iz * dz, z0 + iz * dz,
          z0 + (iz + 1) * dz, z0 + (iz + 1) * dz, z0 + (iz + 1) * dz, z0 + (iz + 1) * dz,
        ];

        for (let e = 0; e < 12; e++) {
          if (!(edges & (1 << e))) continue;
          const [a, b] = EDGE_VERT[e];
          const t = vals[a] / (vals[a] - vals[b] + 1e-12);
          vertList[e] = [
            xs[a] + t * (xs[b] - xs[a]),
            ys[a] + t * (ys[b] - ys[a]),
            zs[a] + t * (zs[b] - zs[a]),
          ];
        }

        for (let i = 0; i < 16; i += 3) {
          const ea = triTable[cubeIndex * 16 + i];
          if (ea === -1) break;
          const A = vertList[ea];
          const B = vertList[triTable[cubeIndex * 16 + i + 1]];
          const C = vertList[triTable[cubeIndex * 16 + i + 2]];
          if (!A || !B || !C) continue;
          positions.push(A[0], A[1], A[2], C[0], C[1], C[2], B[0], B[1], B[2]);
        }
      }
    }
  }
  if (positions.length < 9) return null;

  let geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(positions), 3));
  const nV = positions.length / 3;
  const idx = new Uint32Array(nV);
  for (let i = 0; i < nV; i++) idx[i] = i;
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo = weldByPosition(geo, opts.weldEps ?? 1.5e-4);
  smoothGeometry(geo, opts.smoothIters ?? 4, opts.smoothStrength ?? 0.65);
  geo.computeVertexNormals();
  // Same idea as avatarbuilder box UVs: give the mesh something for clothMaterial.map
  if (opts.clothUVs !== false) assignClothUVs(geo, opts.uv);
  return geo;
}

/**
 * Project repeating UVs for pattern overlays (matches PatternFactory / clothMaterial).
 * Cylindrical around Y + height — works for body/tops/bottoms/shoes shells.
 * @param {THREE.BufferGeometry} geo
 * @param {{ uScale?:number, vScale?:number, y0?:number, y1?:number }} [uvOpts]
 */
export function assignClothUVs(geo, uvOpts = {}) {
  const pos = geo.attributes.position;
  if (!pos) return geo;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const y0 = uvOpts.y0 ?? bb.min.y;
  const y1 = uvOpts.y1 ?? bb.max.y;
  const ySpan = Math.max(1e-6, y1 - y0);
  const uScale = uvOpts.uScale ?? 1.35;
  const vScale = uvOpts.vScale ?? 1.35;
  const n = pos.count;
  const uvs = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Wrap around the torso/limb; V along height (like RoundedBox face unwrap density)
    const u = (Math.atan2(x, z) / (Math.PI * 2) + 0.5) * uScale;
    const v = ((y - y0) / ySpan) * vScale;
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  return geo;
}

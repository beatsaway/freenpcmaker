/**
 * Grow the full body mesh from elliptic tubes along skeleton chains.
 * See STRATEGY.md — tubes primary, no full-body SDF.
 */
import * as THREE from "three";
import { loftTube, mergeTubeParts } from "./loftTube.js";
import { buildStack } from "../parts/Stack.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function samplePolyline(points, count) {
  if (points.length < 2) return points.slice();
  const out = [];
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]));
  }
  const total = lengths[lengths.length - 1] || 1;
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1);
    const d = u * total;
    let s = 0;
    while (s < lengths.length - 2 && lengths[s + 1] < d) s++;
    const span = Math.max(1e-6, lengths[s + 1] - lengths[s]);
    const t = (d - lengths[s]) / span;
    out.push(points[s].clone().lerp(points[s + 1], t));
  }
  return out;
}

function radiiAlong(count, profileFn) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(profileFn(i / (count - 1)));
  return out;
}

/**
 * @param {object} cfg
 * @param {THREE.Material[]} mats [hip,torso,neck, ua,fa,hand, thigh,shin,shoe]
 */
export function buildBodyFromTubes(cfg, mats) {
  const st = buildStack(cfg);
  const {
    foot, shin, thigh, hip, torso, neck,
    shoulderY, handH,
    tw, td, hipW, hipD, armW, legW, legD, legX,
  } = st;

  const HIP_Z = -0.05;
  const LEG_Z = -0.02;
  const FOOT_Z = 0.02;
  const ARM_Z = 0;

  const radial = 12;
  const parts = [];

  // ——— Spine / trunk (hips → neck), elliptic + rear hip bias ———
  {
    const y0 = hip.bot + 0.01;
    const y1 = neck.top - 0.01;
    const n = 14;
    const centers = [];
    const radii = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const y = lerp(y0, y1, t);
      // Pull hip samples slightly back for a readable butt without SDF folds
      const hipAmt = Math.max(0, 1 - t / 0.45);
      const z = HIP_Z * hipAmt * hipAmt;
      centers.push(V(0, y, z));

      let rx;
      let rz;
      if (t < 0.22) {
        const u = t / 0.22;
        rx = lerp(hipW * 0.48, hipW * 0.5, u);
        rz = lerp(hipD * 0.55, hipD * 0.58, u);
      } else if (t < 0.45) {
        const u = (t - 0.22) / 0.23;
        rx = lerp(hipW * 0.5, tw * 0.42, u);
        rz = lerp(hipD * 0.58, td * 0.48, u);
      } else if (t < 0.82) {
        const u = (t - 0.45) / 0.37;
        rx = lerp(tw * 0.42, tw * 0.5, u);
        rz = lerp(td * 0.48, td * 0.55, u);
      } else {
        const u = (t - 0.82) / 0.18;
        rx = lerp(tw * 0.5, 0.048, u);
        rz = lerp(td * 0.55, 0.045, u);
      }
      radii.push({ rx, rz });
    }
    // Soft neck seal
    centers.push(V(0, neck.top + 0.01, 0));
    radii.push({ rx: 0.01, rz: 0.01 });

    const geo = loftTube({
      centers,
      radii,
      radialSegments: radial + 2,
      sealStart: false,
      sealEnd: true,
      partId: 0,
    });

    const joinY = hip.top + (torso.bot - hip.top) * 0.35;
    const neckJoinY = torso.top - 0.02;
    parts.push({
      geo,
      matIndex: (a, b, c) => {
        const y = (geo.attributes.position.getY(a) + geo.attributes.position.getY(b) + geo.attributes.position.getY(c)) / 3;
        if (y < joinY) return 0;
        if (y < neckJoinY) return 1;
        return 2;
      },
    });
  }

  // ——— Legs ———
  for (const side of [-1, 1]) {
    const x = side * Math.max(legX, legW * 0.75 + 0.01);
    const partId = side > 0 ? 3 : 4;
    const hipR = legW * 0.52;
    const kneeR = legW * 0.4;
    const ankleR = legW * 0.32;
    const key = [
      V(x, thigh.top + 0.02, HIP_Z * 0.6),
      V(x, thigh.y, LEG_Z * 0.5),
      V(x, shin.top, LEG_Z * 0.7),
      V(x, shin.y, LEG_Z),
      V(x, shin.bot + 0.02, FOOT_Z * 0.3),
    ];
    const centers = samplePolyline(key, 12);
    // Foot tip forward
    centers.push(V(x, foot.y, FOOT_Z + legD * 0.35));
    centers.push(V(x, foot.bot + 0.01, FOOT_Z + legD * 0.55));

    const radii = radiiAlong(centers.length, (t) => {
      if (t < 0.35) return { rx: lerp(hipR, kneeR, t / 0.35), rz: lerp(hipR * 0.9, kneeR * 0.9, t / 0.35) };
      if (t < 0.7) {
        const u = (t - 0.35) / 0.35;
        return { rx: lerp(kneeR, ankleR, u), rz: lerp(kneeR * 0.9, ankleR * 0.85, u) };
      }
      if (t < 0.88) return { rx: legW * 0.55, rz: legD * 0.55 };
      const u = (t - 0.88) / 0.12;
      return { rx: lerp(legW * 0.5, 0.01, u), rz: lerp(legD * 0.45, 0.01, u) };
    });

    const geo = loftTube({
      centers,
      radii,
      radialSegments: radial,
      sealStart: false,
      sealEnd: true,
      partId,
    });

    const kneeT = 0.38;
    const footT = 0.82;
    parts.push({
      geo,
      matIndex: (a, b, c) => {
        const t = (geo.attributes.limbT.getX(a) + geo.attributes.limbT.getX(b) + geo.attributes.limbT.getX(c)) / 3;
        if (t < kneeT) return 6;
        if (t < footT) return 7;
        return 8;
      },
    });
  }

  // ——— Arms (T-pose along ±X) ———
  const uaLen = 0.22 * (0.5 * st.H.torso + 0.5 * st.H.leg);
  const faLen = 0.2 * (0.5 * st.H.torso + 0.5 * st.H.leg);
  const handLen = handH * 1.1;
  const shoulderX = tw * 0.52 + armW * 0.15;

  for (const side of [-1, 1]) {
    const partId = side > 0 ? 1 : 2;
    const x0 = side * shoulderX;
    const x1 = side * (shoulderX + uaLen);
    const x2 = side * (shoulderX + uaLen + faLen);
    const x3 = side * (shoulderX + uaLen + faLen + handLen);
    const y = shoulderY;
    const z = ARM_Z;
    const rS = armW * 0.55;
    const rE = armW * 0.42;
    const rW = armW * 0.34;
    const rP = armW * 0.48;

    const key = [
      V(x0 * 0.85, y, z), // start slightly into torso for a buried shoulder
      V(x0, y, z),
      V((x0 + x1) * 0.5, y, z),
      V(x1, y, z),
      V((x1 + x2) * 0.5, y, z),
      V(x2, y, z),
      V((x2 + x3) * 0.5, y, z + 0.01),
      V(x3, y, z + 0.015),
    ];
    const centers = samplePolyline(key, 14);
    const tElbow = uaLen / (uaLen + faLen + handLen);
    const tWrist = (uaLen + faLen) / (uaLen + faLen + handLen);

    const radii = radiiAlong(centers.length, (t) => {
      if (t < tElbow) {
        const u = t / Math.max(1e-6, tElbow);
        const r = lerp(rS, rE, u);
        return { rx: r, rz: r * 0.92 };
      }
      if (t < tWrist) {
        const u = (t - tElbow) / Math.max(1e-6, tWrist - tElbow);
        const r = lerp(rE, rW, u);
        return { rx: r, rz: r * 0.9 };
      }
      const u = (t - tWrist) / Math.max(1e-6, 1 - tWrist);
      const r = lerp(rP, rP * 0.55, u);
      return { rx: r, rz: r * 0.75 };
    });

    const geo = loftTube({
      centers,
      radii,
      radialSegments: radial,
      sealStart: false,
      sealEnd: true,
      partId,
    });

    parts.push({
      geo,
      matIndex: (a, b, c) => {
        const t = (geo.attributes.limbT.getX(a) + geo.attributes.limbT.getX(b) + geo.attributes.limbT.getX(c)) / 3;
        if (t < tElbow) return 3;
        if (t < tWrist) return 4;
        return 5;
      },
    });
  }

  const geo = mergeTubeParts(parts, 9);
  const mesh = new THREE.Mesh(geo, mats);
  mesh.name = "body";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.stack = st;
  mesh.userData.meshMethod = "tubes";
  return mesh;
}

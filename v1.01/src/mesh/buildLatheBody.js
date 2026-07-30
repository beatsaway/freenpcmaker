/**
 * Segmented lathe body — of-revolution parts placed on buildStack anchors
 * (same centers / Z offsets the auto-rig joint map uses).
 *
 * Legs: one continuous chain per side (thigh + shin + L-foot) with matched
 * knee/ankle rings; foot is an L (vertical cuff + sole) so its top hole
 * faces the shin hole.
 * Arms: continuous T-pose chain + 90° shoulder elbow (mates arm hole, nests
 * on torso side — torso stays a closed Y-lathe with no side holes).
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { buildStack } from "../parts/Stack.js";
import { humanLayout } from "./humanLayout.js";
import {
  latheMesh,
  profileFromKeys,
  mix,
  withEndCaps,
  capDisc,
} from "./latheParts.js";

function setLimbTFromY(geo, offset = 0, scale = 1) {
  const pos = geo.attributes.position;
  const arr = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) arr[i] = offset + pos.getY(i) * scale;
  geo.setAttribute("limbT", new THREE.BufferAttribute(arr, 1));
  return geo;
}

function setLimbTConst(geo, t) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n);
  arr.fill(t);
  geo.setAttribute("limbT", new THREE.BufferAttribute(arr, 1));
  return geo;
}

/**
 * One continuous arm: inboard shoulder stub → upper → lower → hand.
 *
 * After T-pose, the proximal open end faces into the torso (±X toward center)
 * and nests against the chest wall — NOT toward the back (±Z) and NOT down.
 * Torso stays a closed Y-lathe; the stub overlaps it (same idea as L-foot).
 */
function tposeArmChain(side, spans, radii, mats, bones, segs, shoulder = {}) {
  const { uaLen, faLen, handLen } = spans;
  const { rShoulder, rElbow, rWrist, rPalm, rTip } = radii;
  const total = uaLen + faLen + handLen;
  const yElbow = uaLen;
  const yWrist = uaLen + faLen;
  // Reach from shoulder socket onto/into the torso side wall (world ±X)
  const stubLen = Math.max(
    rShoulder * 1.6,
    shoulder.inset ?? rShoulder * 2
  );

  // Tube through shoulder → upper arm: keep near-cylindrical at the merge
  // (no fat mid-bulge right after the shoulder — that read as too round).
  const pts = profileFromKeys(
    [
      { y: -stubLen, r: rShoulder * 0.96 },
      { y: -stubLen * 0.5, r: rShoulder },
      { y: 0, r: rShoulder },
      { y: uaLen * 0.2, r: rShoulder },
      { y: uaLen * 0.55, r: mix(rShoulder, rElbow, 0.35) },
      { y: yElbow, r: rElbow },
      { y: yElbow + faLen * 0.5, r: mix(rElbow, rWrist, 0.5) },
      { y: yWrist, r: rWrist },
      { y: yWrist + handLen * 0.45, r: rPalm },
      { y: total, r: rTip },
    ],
    2
  );
  const armGeo = new THREE.LatheGeometry(pts, segs, 0, Math.PI * 2);
  armGeo.computeVertexNormals();
  setLimbTFromY(armGeo);

  // Tiny soft pad at the torso nest only (much smaller than the old deltoid ball)
  const padGeo = new THREE.SphereGeometry(
    rShoulder * 0.68,
    Math.max(8, segs - 4),
    Math.max(6, segs - 6)
  );
  padGeo.translate(0, -stubLen * 0.35, 0);
  setLimbTConst(padGeo, -stubLen * 0.35);

  // Cap the INTO-TORSO end (y = -stubLen). After T-pose this faces chest center.
  // Geometry faces −Y in arm-local → world ∓X into torso (not toward the back).
  const inCapGeo = new THREE.CircleGeometry(rShoulder * 0.96, Math.max(10, segs - 2));
  inCapGeo.rotateX(Math.PI / 2); // normal → −Y
  inCapGeo.translate(0, -stubLen, 0);
  setLimbTConst(inCapGeo, -stubLen - 0.001);

  // Hand tip cap (normal → +Y along the arm)
  const tipCapGeo = new THREE.CircleGeometry(rTip, Math.max(8, segs - 2));
  tipCapGeo.rotateX(-Math.PI / 2); // normal → +Y
  tipCapGeo.translate(0, total, 0);
  setLimbTConst(tipCapGeo, total + 0.001);

  const merged = mergeGeometries([armGeo, padGeo, inCapGeo, tipCapGeo], false);
  const geo = merged || armGeo;
  geo.computeVertexNormals();

  // Material groups by limbT
  const index = geo.index;
  const lt = geo.attributes.limbT;
  const uaIdx = [];
  const faIdx = [];
  const handIdx = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    const t = (lt.getX(a) + lt.getX(b) + lt.getX(c)) / 3;
    const dest = t < yElbow ? uaIdx : t < yWrist ? faIdx : handIdx;
    dest.push(a, b, c);
  }
  const idxArr = new Uint32Array(uaIdx.length + faIdx.length + handIdx.length);
  let off = 0;
  idxArr.set(uaIdx, off);
  off += uaIdx.length;
  idxArr.set(faIdx, off);
  off += faIdx.length;
  idxArr.set(handIdx, off);
  geo.setIndex(new THREE.BufferAttribute(idxArr, 1));
  geo.clearGroups();
  off = 0;
  if (uaIdx.length) {
    geo.addGroup(off, uaIdx.length, 0);
    off += uaIdx.length;
  }
  if (faIdx.length) {
    geo.addGroup(off, faIdx.length, 1);
    off += faIdx.length;
  }
  if (handIdx.length) geo.addGroup(off, handIdx.length, 2);

  const clavicle = bones[3] || bones[0];
  const mesh = new THREE.Mesh(geo, mats);
  mesh.name = side > 0 ? "arm_l" : "arm_r";
  mesh.userData.meshMethod = "lathe";
  mesh.userData.skinBone = bones[0];
  mesh.userData.skinBands = {
    attr: "limbT",
    blend: 0.05,
    joints: [
      { bone: clavicle, t0: -1e6, t1: 0.01 },
      { bone: bones[0], t0: 0.01, t1: yElbow },
      { bone: bones[1], t0: yElbow, t1: yWrist },
      { bone: bones[2], t0: yWrist, t1: 1e6 },
    ],
  };

  // T-pose: local +Y → ±X out the arm; local −Y (stub) → ∓X into torso
  mesh.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  return mesh;
}

/**
 * Continuous leg: thigh + shin + L-shaped foot.
 * Local Y: 0 at ankle join → shinH at knee → shinH+thighH at hip.
 * Foot: vertical cuff (top hole = rAnkle, faces shin) + sole along +Z.
 */
function uprightLegChain(side, spans, radii, mats, bones, segs) {
  const { shinH, thighH, ankleY } = spans;
  const { rAnkle, rKnee, rThigh, rCalf, footD, footW, footH } = radii;
  const total = shinH + thighH;
  const yKnee = shinH;

  // --- Shin + thigh shaft (open at ankle for foot join) ---
  const legPts = profileFromKeys(
    [
      { y: 0, r: rAnkle },
      { y: shinH * 0.4, r: rCalf },
      { y: yKnee, r: rKnee },
      { y: yKnee + thighH * 0.5, r: rThigh * 1.04 },
      { y: total, r: rThigh },
    ],
    2
  );
  const legGeo = new THREE.LatheGeometry(legPts, segs, 0, Math.PI * 2);
  legGeo.computeVertexNormals();
  setLimbTFromY(legGeo);

  // --- L-foot cuff: top at y=0 matches rAnkle; drops to the sole ---
  const soleH = Math.max(0.024, footH * 0.45);
  // Reach from ankle down so the sole rests near the ground (y≈0 in world)
  const cuffH = Math.max(soleH * 0.85, Math.min(ankleY - soleH * 0.4, shinH * 0.55));
  const cuffPts = profileFromKeys(
    [
      { y: 0, r: rAnkle * 0.9 },
      { y: cuffH * 0.55, r: rAnkle * 0.96 },
      { y: cuffH, r: rAnkle },
    ],
    2
  );
  const cuffGeo = new THREE.LatheGeometry(cuffPts, segs, 0, Math.PI * 2);
  cuffGeo.translate(0, -cuffH, 0); // top (join) → y=0
  cuffGeo.computeVertexNormals();
  setLimbTConst(cuffGeo, -0.02);

  // --- Sole: heel→toe along +Z, under the cuff (L bend), near ground ---
  const len = Math.max(0.12, footD);
  const halfW = Math.max(0.03, footW * 0.5);
  const tipR = halfW * 0.32;
  const solePts = profileFromKeys(
    [
      { y: 0, r: halfW * 0.7 },
      { y: len * 0.28, r: halfW },
      { y: len * 0.72, r: halfW * 0.88 },
      { y: len, r: tipR },
    ],
    2
  );
  const soleGeo = new THREE.LatheGeometry(solePts, Math.max(10, segs - 2), 0, Math.PI * 2);
  // Thickness along local Z, then tip +Y onto +Z
  soleGeo.scale(1, 1, soleH / Math.max(0.02, halfW));
  soleGeo.rotateX(Math.PI / 2);
  const heelZ = -len * 0.16;
  const soleY = -cuffH + soleH * 0.5;
  soleGeo.translate(0, soleY, heelZ);
  soleGeo.computeVertexNormals();
  setLimbTConst(soleGeo, -0.04);

  // Toe tip cap — plugs the sole end hole (faces +Z)
  const tipCapGeo = new THREE.CircleGeometry(tipR, Math.max(10, segs - 2));
  tipCapGeo.translate(0, soleY, heelZ + len);
  setLimbTConst(tipCapGeo, -0.05);

  // Heel cap — plugs the sole heel hole (faces −Z)
  const heelR = halfW * 0.7;
  const heelCapGeo = new THREE.CircleGeometry(heelR, Math.max(10, segs - 2));
  heelCapGeo.rotateY(Math.PI);
  heelCapGeo.translate(0, soleY, heelZ);
  setLimbTConst(heelCapGeo, -0.05);

  // Hip cap only (ankle stays open into the cuff)
  const hipCap = capDisc(rThigh, {
    material: mats[0],
    skinBone: bones[2],
    segments: Math.max(8, segs - 2),
    face: "+y",
    name: "cap_hip",
  });
  const hipCapGeo = hipCap.geometry.clone();
  hipCapGeo.rotateX(-Math.PI / 2);
  hipCapGeo.translate(0, total, 0);
  setLimbTConst(hipCapGeo, total + 0.001);

  const merged = mergeGeometries(
    [legGeo, cuffGeo, soleGeo, tipCapGeo, heelCapGeo, hipCapGeo],
    false
  );
  const geo = merged || legGeo;
  geo.computeVertexNormals();

  // Material groups by limbT
  const index = geo.index;
  const pos = geo.attributes.position;
  const lt = geo.attributes.limbT;
  const footIdx = [];
  const shinIdx = [];
  const thighIdx = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    const t = (lt.getX(a) + lt.getX(b) + lt.getX(c)) / 3;
    const dest = t < 0.01 ? footIdx : t < yKnee ? shinIdx : thighIdx;
    dest.push(a, b, c);
  }
  const idxArr = new Uint32Array(footIdx.length + shinIdx.length + thighIdx.length);
  let off = 0;
  idxArr.set(footIdx, off);
  off += footIdx.length;
  idxArr.set(shinIdx, off);
  off += shinIdx.length;
  idxArr.set(thighIdx, off);
  geo.setIndex(new THREE.BufferAttribute(idxArr, 1));
  geo.clearGroups();
  off = 0;
  if (footIdx.length) {
    geo.addGroup(off, footIdx.length, 2);
    off += footIdx.length;
  }
  if (shinIdx.length) {
    geo.addGroup(off, shinIdx.length, 1);
    off += shinIdx.length;
  }
  if (thighIdx.length) geo.addGroup(off, thighIdx.length, 0);

  const mesh = new THREE.Mesh(geo, mats);
  mesh.name = side > 0 ? "leg_l" : "leg_r";
  mesh.userData.meshMethod = "lathe";
  mesh.userData.skinBone = bones[1];
  mesh.userData.skinBands = {
    attr: "limbT",
    blend: 0.05,
    joints: [
      { bone: bones[0], t0: -1e6, t1: 0.02 }, // foot
      { bone: bones[1], t0: 0.02, t1: yKnee }, // calf
      { bone: bones[2], t0: yKnee, t1: 1e6 }, // thigh
    ],
  };
  return mesh;
}

/**
 * @param {THREE.Material[]} mats  [pelvis, torso, neck, UA, FA, hand, thigh, shin, unused]
 * @param {{ layout?: object, segments?: number, cfg?: object }} opts
 */
export function buildLatheBody(mats, opts = {}) {
  const cfg = opts.cfg || {};
  const st = buildStack(cfg);
  const L = st.L || humanLayout(cfg);
  const segs = opts.segments ?? 14;
  const g = new THREE.Group();
  g.name = "body-lathe";
  g.userData.meshMethod = "lathe";

  const m = (i, fallback = 0) => mats[i] || mats[fallback] || mats[0];
  const {
    shin,
    thigh,
    hip,
    torso,
    neck,
    legX,
    shoulderSocketX,
    armAttachY,
    elbowX,
    wristX,
    handX,
    handH,
    offsets,
  } = st;

  const ARM_Z = offsets?.ARM_Z ?? 0.04;
  const HIP_Z = offsets?.HIP_Z ?? -0.035;
  const SHIN_Z = offsets?.SHIN_Z ?? -0.02;

  const rHip = Math.max(L.hipRX, L.hipRZ) * 0.98;
  const rChest = Math.max(L.chestRX, L.chestRZ);
  const rJoin = Math.max(L.waistRX, L.waistRZ);
  const joinScaleZ = (L.waistRZ / Math.max(1e-6, L.waistRX)) * 0.96;
  const joinZ = HIP_Z * 0.5;
  const waistY = hip.top; // === torso.bot

  // --- Trunk+neck: one continuous lathe (pelvis → waist → chest → neck top) ---
  // Same radius at chest→neck join so there is no separate mating hole/seam.
  {
    const y0 = hip.bot;
    const yNeckJoin = torso.top; // === neck.bot
    const y1 = neck.top;
    const rNeck = L.neckR ?? L.rNeckJoin ?? 0.034;
    const pts = profileFromKeys(
      [
        { y: y0, r: rHip * 0.72 },
        { y: mix(y0, waistY, 0.45), r: rHip },
        { y: waistY, r: rJoin },
        { y: mix(waistY, yNeckJoin, 0.45), r: rChest },
        { y: mix(waistY, yNeckJoin, 0.82), r: rChest * 0.92 },
        { y: yNeckJoin, r: rNeck },
        { y: mix(yNeckJoin, y1, 0.55), r: rNeck * 0.97 },
        { y: y1, r: rNeck * 0.92 },
      ],
      3
    );

    const geo = new THREE.LatheGeometry(pts, segs, 0, Math.PI * 2);
    geo.computeVertexNormals();

    // Three materials: bottom cloth / top cloth / neck skin
    const matBot = m(0);
    const matTop = m(1);
    const matNeck = m(2);
    const index = geo.index;
    const pos = geo.attributes.position;
    const botIdx = [];
    const topIdx = [];
    const neckIdx = [];
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      const b = index.getX(i + 1);
      const c = index.getX(i + 2);
      const cy = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3;
      const dest = cy < waistY ? botIdx : cy < yNeckJoin ? topIdx : neckIdx;
      dest.push(a, b, c);
    }
    const merged = new Uint32Array(botIdx.length + topIdx.length + neckIdx.length);
    let off = 0;
    merged.set(botIdx, off);
    off += botIdx.length;
    merged.set(topIdx, off);
    off += topIdx.length;
    merged.set(neckIdx, off);
    geo.setIndex(new THREE.BufferAttribute(merged, 1));
    geo.clearGroups();
    off = 0;
    if (botIdx.length) {
      geo.addGroup(off, botIdx.length, 0);
      off += botIdx.length;
    }
    if (topIdx.length) {
      geo.addGroup(off, topIdx.length, 1);
      off += topIdx.length;
    }
    if (neckIdx.length) geo.addGroup(off, neckIdx.length, 2);

    const mesh = new THREE.Mesh(geo, [matBot, matTop, matNeck]);
    mesh.name = "trunk";
    mesh.userData.meshMethod = "lathe";
    mesh.userData.skinBone = "spine_02";
    mesh.userData.latheR0 = pts[0].x;
    mesh.userData.latheR1 = pts[pts.length - 1].x;
    mesh.userData.latheY0 = y0;
    mesh.userData.latheY1 = y1;
    // Soft blend pelvis → spine → neck so the join never opens
    mesh.userData.skinBands = {
      blend: 0.07,
      joints: [
        { bone: "pelvis", t0: -1e6, t1: waistY - 0.02 },
        { bone: "spine_01", t0: waistY - 0.02, t1: waistY + torso.h * 0.22 },
        { bone: "spine_02", t0: waistY + torso.h * 0.22, t1: waistY + torso.h * 0.62 },
        { bone: "spine_03", t0: waistY + torso.h * 0.62, t1: yNeckJoin },
        { bone: "neck_01", t0: yNeckJoin, t1: 1e6 },
      ],
    };

    const trunk = withEndCaps(mesh, {
      material: matBot,
      skinBone: "pelvis",
      r0: rHip * 0.72,
      r1: rNeck * 0.92,
      // Bottom cap → pelvis; closed neck top is the head seat
      cap0: true,
      cap1: true,
      material1: matNeck,
      skinBone1: "neck_01",
    });
    // Top cap should use neck material if withEndCaps supports it — check below
    trunk.scale.z = joinScaleZ;
    trunk.position.z = joinZ;
    g.add(trunk);
  }

  // --- Legs: thigh + shin + L-foot (ankle hole faces shin, same rAnkle) ---
  const thighZ = HIP_Z * 0.4;
  const shinZ = SHIN_Z * 0.5;
  const legZ = mix(thighZ, shinZ, 0.55);
  const FOOT_Z = offsets?.FOOT_Z ?? -0.005;
  for (const side of [-1, 1]) {
    const sx = side * legX;
    const boneThigh = side > 0 ? "thigh_l" : "thigh_r";
    const boneCalf = side > 0 ? "calf_l" : "calf_r";
    const boneFoot = side > 0 ? "foot_l" : "foot_r";

    const rKnee = L.rKnee;
    const rAnkle = L.rAnkle;

    const leg = uprightLegChain(
      side,
      { shinH: shin.h, thighH: thigh.h, ankleY: L.yAnkle ?? shin.bot },
      {
        rAnkle,
        rKnee,
        rThigh: L.rThigh,
        rCalf: L.rCalf,
        footD: L.footD ?? 0.2,
        footW: L.footW ?? 0.1,
        footH: L.footH ?? 0.065,
      },
      [m(6), m(7), m(2)],
      [boneFoot, boneCalf, boneThigh],
      Math.max(12, segs)
    );
    // Origin at ankle join; slight Z toward FOOT_Z for the sole plane
    leg.position.set(sx, shin.bot, mix(legZ, FOOT_Z, 0.35));
    g.add(leg);
  }

  // --- Arms: continuous chain + 90° shoulder elbow nesting against torso ---
  const armY = armAttachY;
  const torsoHalfW = L.chestRX * joinScaleZ;
  for (const side of [-1, 1]) {
    const boneUA = side > 0 ? "upperarm_l" : "upperarm_r";
    const boneFA = side > 0 ? "lowerarm_l" : "lowerarm_r";
    const boneHand = side > 0 ? "hand_l" : "hand_r";
    const boneClav = side > 0 ? "clavicle_l" : "clavicle_r";

    const xShoulder = side * shoulderSocketX;
    const xElbow = side * elbowX;
    const xWrist = side * wristX;
    const xHandTip = side * (handX + handH * 0.35);

    const uaLen = Math.abs(xElbow - xShoulder);
    const faLen = Math.abs(xWrist - xElbow);
    const handLen = Math.abs(xHandTip - xWrist);

    const rElbow = L.rElbow;
    const rWrist = mix(L.rWrist, L.rPalm, 0.35);
    // Vertical stub long enough to reach from shoulder socket onto the torso wall
    const inset = Math.max(L.rShoulder * 1.7, Math.abs(shoulderSocketX) - torsoHalfW + L.rShoulder * 0.4);

    const arm = tposeArmChain(
      side,
      { uaLen, faLen, handLen },
      {
        rShoulder: L.rShoulder,
        rElbow,
        rWrist,
        rPalm: L.rPalm,
        rTip: L.rPalm * 0.7,
      },
      [m(3), m(4), m(5)],
      [boneUA, boneFA, boneHand, boneClav],
      Math.max(12, segs),
      { inset }
    );
    arm.position.set(xShoulder, armY, ARM_Z);
    g.add(arm);
  }

  return g;
}

export { humanLayout };

import * as THREE from "three";
import { buildStack, roundBoxMesh } from "./Primitives.js";
import { clothMaterial } from "../materials/PatternFactory.js";
import { buildLatheBottom } from "../mesh/buildLatheClothes.js";
import { buildLatheShoes } from "../mesh/buildLatheShoes.js";

function clampButtonCount(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 3;
  return Math.min(5, Math.max(2, v));
}

function clampButtonSize(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 1.4;
  return Math.min(2.4, Math.max(0.8, v));
}

/**
 * World Z of the painted trunk front at a given Y (matches buildLatheBody profile).
 * Collar sits near the neck hole where the lathe has already tapered — using full
 * chest depth there floats the lapel well in front of the cloth.
 */
function mix(a, b, t) {
  return a + (b - a) * t;
}

function clothesFrontZ(st, y = null) {
  const L = st.L || {};
  const hipZ = L.hipZ ?? st.offsets?.HIP_Z ?? -0.035;
  const joinZ = hipZ * 0.5;
  const chestRX = L.chestRX ?? (st.tw ?? 0.2) * 0.5;
  const chestRZ = L.chestRZ ?? (st.td ?? 0.2) * 0.5;
  const waistRX = Math.max(1e-6, L.waistRX ?? chestRX);
  const waistRZ = L.waistRZ ?? chestRZ;
  const joinScaleZ = (waistRZ / waistRX) * 0.96;
  const rChest = Math.max(chestRX, chestRZ);
  const rNeckJoin = L.rNeckJoin ?? (L.neckR ?? 0.04) * 1.02;

  const waistY = st.waistY ?? st.hip?.top ?? 0;
  const yTop = st.torso?.top ?? waistY + 0.3;
  const yChest = mix(waistY, yTop, 0.45);
  const yUpper = mix(waistY, yTop, 0.82);
  const yy = y == null ? mix(waistY, yTop, 0.55) : y;

  let r;
  if (yy >= yTop) r = rNeckJoin;
  else if (yy >= yUpper) {
    r = mix(rChest * 0.92, rNeckJoin, (yy - yUpper) / Math.max(1e-6, yTop - yUpper));
  } else if (yy >= yChest) {
    r = mix(rChest, rChest * 0.92, (yy - yChest) / Math.max(1e-6, yUpper - yChest));
  } else {
    r = rChest;
  }
  return joinZ + r * joinScaleZ;
}

/** Place a flat accent so its back face sits on / slightly into the cloth. */
function accentZ(st, y, depth, embed = 0.004) {
  const d = Math.max(0.006, depth);
  // Center so back face is at frontZ - embed (slightly into surface)
  return clothesFrontZ(st, y) + d * 0.5 - embed;
}

/**
 * Clothing: bottoms + shoes as meshes; tops are painted onto the body trunk/arms
 * (no separate upper shell — that peeled off the back when the spine bent).
 */
export class Clothes {
  static build(cfg) {
    const g = new THREE.Group();
    g.name = "clothes";
    g.add(Clothes.buildTop(cfg));
    g.add(Clothes.buildBottom(cfg));
    g.add(Clothes.buildShoes(cfg));
    return g;
  }

  static buildShoes(cfg) {
    const g = new THREE.Group();
    g.name = "shoes";
    const shoes = cfg.clothes?.shoes || {};
    const style = shoes.style || "sneaker";
    const mat = clothMaterial(shoes.color ?? 0x2a2a32, shoes.pattern || {});
    const st = buildStack(cfg);
    const mesh = buildLatheShoes(mat, { style, scale: shoes.scale ?? 1, layout: st.L });
    if (mesh) g.add(mesh);
    return g;
  }

  static buildBottom(cfg) {
    const g = new THREE.Group();
    g.name = "bottom";
    const bottom = cfg.clothes?.bottom || {};
    const style = bottom.style || "pants";
    const mat = clothMaterial(bottom.color ?? 0x3a4550, bottom.pattern || {});
    const st = buildStack(cfg);

    // Seat waistband on the true waist (body trunk join), not below on the hip
    let yTop = st.waistY ?? st.hip.top;
    let yBot = st.shin.bot + 0.02;
    if (style === "mini-shorts") {
      yBot = st.hipSocketY - st.thigh.h * 0.32;
    } else if (style === "shorts") {
      yBot = st.kneeY + st.thigh.h * 0.08;
    } else if (style === "mini-skirt") {
      const thighLen = Math.max(0.1, st.thigh.h);
      const legT = Math.min(1, Math.max(0, ((st.H?.leg ?? 1) - 0.5) / 1.0));
      const hemFrac = 0.28 + 0.2 * legT;
      yBot = st.hipSocketY - thighLen * hemFrac;
      yBot = Math.max(yBot, st.kneeY + thighLen * 0.22);
      yBot = Math.min(yBot, yTop - Math.max(0.07, thighLen * 0.22));
    }

    const mesh = buildLatheBottom(mat, {
      style,
      hipW: st.hipW,
      hipD: st.hipD,
      yTop,
      yBot,
      layout: st.L,
      legScale: st.H?.leg ?? 1,
    });
    if (mesh) g.add(mesh);
    return g;
  }

  static addButtons(g, st, count, { yStart, yEnd, size = 0.016, color = 0x1a1a1a } = {}) {
    const n = clampButtonCount(count);
    const btnSize = Math.max(0.008, size);
    const btn = clothMaterial(color, { type: "solid" });
    const depth = Math.max(0.006, btnSize * 0.45);
    const top = yStart ?? st.torso.top - 0.035;
    const botHint = yEnd ?? st.torso.y - st.torso.h * 0.12;
    const minSpacing = btnSize * 2.15;
    const regionSpan = Math.abs(top - botHint);
    const spacing = n <= 1 ? 0 : Math.max(minSpacing, regionSpan / (n - 1));
    for (let i = 0; i < n; i++) {
      const y = top - i * spacing;
      const m = roundBoxMesh(btnSize, btnSize, depth, btn, 0, y, accentZ(st, y, depth, 0.003), btnSize * 0.28);
      m.userData.skinBone = "spine_02";
      g.add(m);
    }
  }

  /**
   * No lathe top shell — BodySkin already paints torso / arms with the top
   * cloth material. Only small accents (collar / buttons) stay as meshes.
   */
  static buildTop(cfg) {
    const g = new THREE.Group();
    g.name = "top";
    const top = cfg.clothes?.top || {};
    const style = top.style || "tee";
    const st = buildStack(cfg);
    const btnScale = clampButtonSize(top.buttonSize ?? 1.4);
    const btnBase = 0.014 * btnScale;

    if (style === "polo") {
      const collar = clothMaterial(top.pattern?.color2 ?? 0xffffff, { type: "solid" });
      // On the upper chest taper — not above the neck hole
      const collarY = st.torso.top - 0.028;
      const collarD = 0.016;
      const collarM = roundBoxMesh(
        0.078,
        0.02,
        collarD,
        collar,
        0,
        collarY,
        accentZ(st, collarY, collarD, 0.005),
        0.005
      );
      collarM.userData.skinBone = "spine_03";
      g.add(collarM);
      const n = clampButtonCount(top.buttons ?? 3);
      const spacing = btnBase * 2.15;
      Clothes.addButtons(g, st, n, {
        yStart: st.torso.top - 0.05,
        yEnd: st.torso.top - 0.05 - spacing * (n - 1),
        size: btnBase,
        color: top.buttonColor ?? 0x222222,
      });
    } else if (style === "jacket") {
      const accent = clothMaterial(top.pattern?.color2 ?? 0xffffff, { type: "solid" });
      const collarY = st.torso.top - 0.018;
      const collarD = 0.014;
      const collarM = roundBoxMesh(
        Math.min(0.1, st.tw * 0.38),
        0.02,
        collarD,
        accent,
        0,
        collarY,
        accentZ(st, collarY, collarD, 0.005),
        0.005
      );
      collarM.userData.skinBone = "spine_03";
      g.add(collarM);
      Clothes.addButtons(g, st, top.buttons ?? 3, {
        yStart: st.torso.top - 0.05,
        yEnd: st.torso.y - st.torso.h * 0.1,
        size: btnBase * 1.05,
        color: top.buttonColor ?? 0x1a1a1a,
      });
    }
    return g;
  }

  static buildTopAccents(cfg) {
    return Clothes.buildTop(cfg);
  }
  static buildBottomAccents(cfg) {
    return Clothes.buildBottom(cfg);
  }
}

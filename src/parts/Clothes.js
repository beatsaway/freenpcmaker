import * as THREE from "three";
import { buildStack, roundBoxMesh, skullSize } from "./Primitives.js";
import { clothMaterial } from "../materials/PatternFactory.js";
import { buildSmoothTop, buildSmoothBottom } from "../mesh/buildSmoothClothes.js";
import { buildSmoothShoes } from "../mesh/buildSmoothShoes.js";

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
 * Full clothing shells (SDF) for tops, bottoms, and shoes.
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
    const mesh = buildSmoothShoes(mat, { style, scale: shoes.scale ?? 1, layout: st.L });
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

    let yTop = st.hip.top - 0.04;
    let yBot = st.shin.bot + 0.02;
    if (style === "mini-shorts") {
      yBot = st.hipSocketY - st.thigh.h * 0.32;
    } else if (style === "shorts") {
      yBot = st.kneeY + st.thigh.h * 0.08;
    } else if (style === "mini-skirt") {
      // Adaptive mini: hang a fraction of thigh length, shorter legs → shorter absolute hem
      yTop = Math.min(st.hip.top - 0.015, st.waistY - 0.02);
      const thighLen = Math.max(0.1, st.thigh.h);
      const legT = Math.min(1, Math.max(0, ((st.H?.leg ?? 1) - 0.5) / 1.0));
      const hemFrac = 0.28 + 0.2 * legT; // 0.28 short → 0.48 tall
      yBot = st.hipSocketY - thighLen * hemFrac;
      // Keep above mid-thigh / clear of knees; enforce min skirt height
      yBot = Math.max(yBot, st.kneeY + thighLen * 0.22);
      yBot = Math.min(yBot, yTop - Math.max(0.07, thighLen * 0.22));
    }

    const mesh = buildSmoothBottom(mat, {
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

  /** Front placket buttons for polo / jacket (2–5). Size drives spacing. */
  static addButtons(g, st, count, { yStart, yEnd, size = 0.016, color = 0x1a1a1a } = {}) {
    const n = clampButtonCount(count);
    const btnSize = Math.max(0.008, size);
    const btn = clothMaterial(color, { type: "solid" });
    const chestZ = st.L?.chestRZ ?? st.td * 0.5;
    const btnZ = chestZ + 0.014 + btnSize * 0.15;
    const top = yStart ?? st.torso.top - 0.035;
    const botHint = yEnd ?? st.torso.y - st.torso.h * 0.12;
    // Spacing scales with button size; never tighter than ~2.15× diameter
    const minSpacing = btnSize * 2.15;
    const regionSpan = Math.abs(top - botHint);
    const spacing = n <= 1 ? 0 : Math.max(minSpacing, regionSpan / (n - 1));
    const depth = Math.max(0.008, btnSize * 0.65);
    for (let i = 0; i < n; i++) {
      const y = top - i * spacing;
      const m = roundBoxMesh(btnSize, btnSize, depth, btn, 0, y, btnZ, btnSize * 0.28);
      m.userData.skinBone = "spine_02";
      g.add(m);
    }
  }

  static buildTop(cfg) {
    const g = new THREE.Group();
    g.name = "top";
    const top = cfg.clothes?.top || {};
    const style = top.style || "tee";
    const st = buildStack(cfg);
    const { hw, hh, hd } = skullSize(cfg, st);
    const topMat = clothMaterial(top.color ?? 0x3d8f6e, top.pattern || {});
    const btnScale = clampButtonSize(top.buttonSize ?? 1.4);
    const btnBase = 0.014 * btnScale;

    const mesh = buildSmoothTop(topMat, {
      style,
      hw,
      hh,
      hd,
      headY: st.head.y,
      skullTop: st.head.top,
      neckY: st.neck.y,
      neckBot: st.neck.bot,
      layout: st.L,
    });
    if (mesh) g.add(mesh);

    if (style === "polo") {
      const collar = clothMaterial(top.pattern?.color2 ?? 0xffffff, { type: "solid" });
      const collarM = roundBoxMesh(0.08, 0.024, 0.04, collar, 0, st.torso.top - 0.012, 0.055, 0.006);
      collarM.userData.skinBone = "spine_03";
      g.add(collarM);
      const n = clampButtonCount(top.buttons ?? 3);
      const spacing = btnBase * 2.15;
      Clothes.addButtons(g, st, n, {
        yStart: st.torso.top - 0.04,
        yEnd: st.torso.top - 0.04 - spacing * (n - 1),
        size: btnBase,
        color: top.buttonColor ?? 0x222222,
      });
    } else if (style === "jacket") {
      const accent = clothMaterial(top.pattern?.color2 ?? 0xffffff, { type: "solid" });
      const collarM = roundBoxMesh(
        Math.min(0.1, st.tw * 0.38),
        0.022,
        0.028,
        accent,
        0,
        st.torso.top + 0.004,
        (st.L?.chestRZ ?? 0.1) + 0.016,
        0.006
      );
      collarM.userData.skinBone = "spine_03";
      g.add(collarM);
      Clothes.addButtons(g, st, top.buttons ?? 3, {
        yStart: st.torso.top - 0.045,
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

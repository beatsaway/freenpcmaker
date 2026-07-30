import * as THREE from "three";
import { buildStack, skullSize } from "./Primitives.js";
import { basicMat } from "../materials/PatternFactory.js";
import { buildSmoothHair } from "../mesh/buildSmoothHair.js";
import { faceEyeY } from "../AvatarConfig.js";

/**
 * Hair — 48-slice bowl; hang is extra rim vertices (one mesh per slice).
 */
export class Hair {
  static build(cfg) {
    const style = cfg.hair?.style || "short";
    const g = new THREE.Group();
    g.name = "hair";
    if (style === "bald") return g;

    const mat = basicMat(cfg.hair?.color ?? 0x3a2a1a, 0.85);
    const st = buildStack(cfg);
    const sk = skullSize(cfg, st);
    const faceOpts = {
      R: sk.R,
      jawLen: sk.jawLen,
      crownY: st.head.top,
      chinY: st.head.bot,
      headY: st.head.y,
      eyeDrop: cfg.face?.eyeDrop ?? 0.5,
    };
    const eyeY = faceEyeY(st.head.y, sk.hh, faceOpts.eyeDrop, faceOpts);

    const hair = buildSmoothHair(mat, {
      style,
      hw: sk.hw,
      hh: sk.hh,
      hd: sk.hd,
      R: sk.R,
      jawLen: sk.jawLen,
      headY: st.head.y,
      skullTop: st.head.top,
      chinY: st.head.bot,
      eyeY,
      shoulderY: st.shoulderY ?? st.armAttachY,
      waistY: st.waistY,
      chestY: st.chestY,
    });
    if (hair) g.add(hair);
    return g;
  }
}

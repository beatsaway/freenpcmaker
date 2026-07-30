import * as THREE from "three";
import { buildStack, roundBoxMesh, skullSize } from "./Primitives.js";
import { basicMat } from "../materials/PatternFactory.js";
import { buildSmoothHat } from "../mesh/buildSmoothHats.js";

export class Hat {
  /**
   * @param {object} cfg
   * @param {{ hair?:THREE.Object3D, headMesh?:THREE.Object3D }} [ctx]
   */
  static build(cfg, ctx = {}) {
    const style = cfg.hat?.style || "none";
    const g = new THREE.Group();
    g.name = "hat";
    if (style === "none") return g;

    const mat = basicMat(cfg.hat?.color ?? 0x3d8f6e, 0.55);
    const brimMat = basicMat(cfg.hat?.color ?? 0x2a6a50, 0.65);
    const st = buildStack(cfg);
    const { hw, hh, hd } = skullSize(cfg, st);
    const hairStyle = cfg.hair?.style || "short";

    const hat =
      buildSmoothHat(mat, {
        style,
        hw,
        hh,
        hd,
        headTop: st.head.top,
        headY: st.head.y,
        hairStyle,
        brimMat,
      }) ||
      roundBoxMesh(hw * 1.1, hh * 0.28, hd * 1.05, mat, 0, st.head.top + hh * 0.08, 0, Math.min(hw, hd) * 0.2, 2);

    g.add(hat);
    return g;
  }
}

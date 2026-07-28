import * as THREE from "three";
import { buildStack, skullSize } from "./Primitives.js";
import { basicMat } from "../materials/PatternFactory.js";
import { buildSmoothHair } from "../mesh/buildSmoothHair.js";

/**
 * Hair anchored to stack.head — one smooth SDF volume per style.
 */
export class Hair {
  static build(cfg) {
    const style = cfg.hair?.style || "short";
    const g = new THREE.Group();
    g.name = "hair";
    if (style === "bald") return g;

    const mat = basicMat(cfg.hair?.color ?? 0x3a2a1a, 0.85);
    const st = buildStack(cfg);
    const { hw, hh, hd } = skullSize(cfg, st);

    const mesh = buildSmoothHair(mat, {
      style,
      hw,
      hh,
      hd,
      headY: st.head.y,
      skullTop: st.head.top,
    });
    if (mesh) g.add(mesh);
    return g;
  }
}

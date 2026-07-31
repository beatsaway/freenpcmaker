import * as THREE from "three";
import { buildStack } from "./Primitives.js";
import { buildLatheBody, humanLayout } from "../mesh/buildLatheBody.js";
import { skinMaterial, clothMaterial } from "../materials/PatternFactory.js";

function topCoverage(style) {
  switch (style) {
    case "tank":
    case "overalls":
      return { torso: true, upperArm: false, lowerArm: false };
    case "tee":
    case "polo":
      return { torso: true, upperArm: true, lowerArm: false };
    case "hoodie":
    case "jacket":
    case "longsleeve":
    default:
      return { torso: true, upperArm: true, lowerArm: true };
  }
}

function bottomCoverage(style) {
  switch (style) {
    case "mini-skirt":
    case "mini-shorts":
    case "shorts":
      return { pelvis: true, thigh: true, shin: false };
    default:
      return { pelvis: true, thigh: true, shin: true };
  }
}

/**
 * Segmented lathe body (of-revolution parts). Head stays separate.
 */
export class BodySkin {
  static build(cfg) {
    const g = new THREE.Group();
    g.name = "body-skin";

    const skin = skinMaterial(cfg.skinTone);
    const topCfg = cfg.clothes?.top || {};
    const bottomCfg = cfg.clothes?.bottom || {};
    const topMat = clothMaterial(topCfg.color ?? 0x3d8f6e, topCfg.pattern || {});
    const bottomMat = clothMaterial(bottomCfg.color ?? 0x3a4550, bottomCfg.pattern || {});
    const top = topCoverage(topCfg.style || "tee");
    const bottom = bottomCoverage(bottomCfg.style || "pants");
    const layout = humanLayout(cfg);

    const shinMat = bottom.shin ? bottomMat : skin;
    const body = buildLatheBody(
      [
        bottom.pelvis ? bottomMat : skin,
        top.torso ? topMat : skin,
        skin,
        top.upperArm ? topMat : skin,
        top.lowerArm ? topMat : skin,
        skin,
        bottom.thigh ? bottomMat : skin,
        shinMat,
        shinMat,
      ],
      { layout, segments: 14, cfg }
    );

    if (body) g.add(body);
    g.userData.stack = buildStack(cfg);
    return g;
  }
}

export const BodyLegs = { build: (cfg) => BodySkin.build(cfg) };
export const BodyTorso = { build: () => new THREE.Group() };

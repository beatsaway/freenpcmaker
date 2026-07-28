import * as THREE from "three";
import { buildStack, roundBoxMesh, sphereMesh, skullSize } from "./Primitives.js";
import { skinMaterial, basicMat } from "../materials/PatternFactory.js";
import { clampEyeScale, clampEyeDistance, eyeHalfSpread } from "../AvatarConfig.js";
import { buildSmoothNose, buildSmoothEar, buildSmoothBrow } from "../mesh/buildSmoothFeatures.js";
import { buildSmoothFace, faceSurfaceZ, faceSurfaceZFromSdf, headSurfaceX } from "../mesh/buildSmoothFace.js";

/** Local +Z = front of face. */
export const FACE = 1;

/** Tiny epsilon so features kiss the surface without z-fighting. */
const TOUCH = 0.002;

/**
 * Head sits on stack.neck.top — stack seats skull underside with a small sink.
 * Cranium / nose / ears = smooth SDF; eyes / brows stay separate accents.
 */
export class Head {
  static build(cfg) {
    const g = new THREE.Group();
    g.name = "head";
    const st = buildStack(cfg);
    const skin = skinMaterial(cfg.skinTone);
    const { hw, hh, hd, roundness } = skullSize(cfg, st);
    const headY = st.head.y;
    const faceOpts = { hw, hh, hd, headY, roundness };

    const cranium =
      buildSmoothFace(skin, faceOpts) ||
      roundBoxMesh(hw, hh, hd, skin, 0, headY, 0, Math.min(hw, hh, hd) * 0.35, 5);
    cranium.userData.skinBone = "head";
    g.add(cranium);

    g.userData.headMesh = cranium;
    g.userData.baseHeadY = headY;
    g.userData.stack = st;
    g.userData.faceOpts = faceOpts;

    FaceFeatures.addEyes(g, cfg, headY, hw, hh, hd, cranium, faceOpts);
    FaceFeatures.addNose(g, cfg, headY, hd, cranium, faceOpts);
    FaceFeatures.addEars(g, cfg, headY, hw, hh, cranium, faceOpts);
    FaceFeatures.addBrows(g, cfg, headY, hw, hh, hd, cranium, faceOpts);

    return g;
  }
}

export class FaceFeatures {
  static faceZ(hd) {
    return (hd / 2) * FACE;
  }

  /** Exact skin surface (almost no clearance — callers add half-depth to kiss). */
  static skinZ(mesh, x, y, faceOpts, hd) {
    if (faceOpts) return faceSurfaceZ(mesh, x, y, faceOpts, TOUCH);
    return FaceFeatures.faceZ(hd) + TOUCH;
  }

  static addEyes(g, cfg, headY, hw, hh, hd, headMesh, faceOpts) {
    const style = cfg.eyes?.style || "oval";
    const col = cfg.eyes?.color ?? 0x2a3a4a;
    // Cap eyeDistance so eyes stay on the front face (reset to max safe if too wide)
    const probeOpts = {
      ...faceOpts,
      frontZ: (x, y) => faceSurfaceZFromSdf(x, y, faceOpts, 0),
    };
    const eyeDist = clampEyeDistance(cfg.face?.eyeDistance ?? 1, hw, probeOpts);
    if (cfg.face) cfg.face.eyeDistance = eyeDist;
    const sc = clampEyeScale(cfg.eyes?.scale ?? 1, eyeDist, hw);
    const mat = basicMat(col, 0.35);
    const white = basicMat(0xf2f4f6, 0.5);
    const y = headY + hh * 0.08;
    const spread = eyeHalfSpread(eyeDist, hw);

    const makeEye = (x) => {
      // Surface, then offset by half eye depth so the back just touches
      const surf = FaceFeatures.skinZ(headMesh, x, y, faceOpts, hd);
      const eg = new THREE.Group();
      if (style === "wide") {
        const depth = 0.018;
        const z = surf + depth * 0.5;
        eg.add(roundBoxMesh(0.065 * sc, 0.032 * sc, depth, white, x, y, z, 0.008));
        eg.add(roundBoxMesh(0.032 * sc, 0.026 * sc, depth * 0.7, mat, x, y, z + 0.003 * FACE, 0.006));
      } else if (style === "almond") {
        const s = 0.036 * sc;
        const depth = 0.016;
        const z = surf + depth * 0.5;
        const sclera = roundBoxMesh(s, s, depth, white, x, y, z, 0.003, 1);
        sclera.rotation.z = Math.PI / 4;
        eg.add(sclera);
        const iris = roundBoxMesh(0.018 * sc, 0.018 * sc, depth * 0.7, mat, x, y, z + 0.003 * FACE, 0.002, 1);
        iris.rotation.z = Math.PI / 4;
        eg.add(iris);
      } else {
        const r = 0.02 * sc;
        const zScale = 0.55;
        const z = surf + r * zScale * 0.5;
        const sclera = sphereMesh(r, white, x, y, z, 10, 8);
        sclera.scale.set(1.45, 0.88, zScale);
        eg.add(sclera);
        const iris = sphereMesh(0.013 * sc, mat, x, y, z + 0.003 * FACE, 8, 6);
        iris.scale.set(1.25, 0.92, 0.7);
        eg.add(iris);
      }
      return eg;
    };

    g.add(makeEye(-spread));
    g.add(makeEye(spread));
  }

  static addNose(g, cfg, headY, hd, headMesh, faceOpts) {
    const style = cfg.nose?.style || "button";
    const sc = cfg.nose?.scale ?? 1;
    const skin = skinMaterial(cfg.skinTone);
    const y = headY - 0.015;
    // Nose SDF grows +Z from origin — park origin on the skin
    const surf = FaceFeatures.skinZ(headMesh, 0, y, faceOpts, hd);

    const nose = buildSmoothNose(skin, { style, scale: sc });
    if (nose) {
      nose.position.set(0, y, surf);
      g.add(nose);
    }
  }

  static addEars(g, cfg, headY, hw, hh, headMesh, faceOpts) {
    const style = cfg.ears?.style || "round";
    // Floor scale + scale with head width so tiny ears can't leave a temple gap
    const rawSc = cfg.ears?.scale ?? 1;
    const sc = Math.max(0.95, rawSc) * Math.max(0.9, hw / 0.16);
    const skin = skinMaterial(cfg.skinTone);
    const y = headY + (style === "point" ? 0.01 : 0);
    const z = 0;
    // Sink into the skull so the attach pad seals (negative clearance)
    const SINK = -0.01;

    const right = buildSmoothEar(skin, { style, scale: sc });
    if (!right) return;

    // Ear SDF grows +X from attach origin — park origin slightly inside temple skin
    const xR = faceOpts
      ? headSurfaceX(headMesh, y, z, 1, faceOpts, SINK)
      : hw / 2 + SINK;
    right.position.set(xR, y, z);
    g.add(right);

    const left = right.clone();
    left.scale.x = -1;
    const xL = faceOpts
      ? headSurfaceX(headMesh, y, z, -1, faceOpts, SINK)
      : -hw / 2 - SINK;
    left.position.set(xL, y, z);
    g.add(left);
  }

  static addBrows(g, cfg, headY, hw, hh, hd, headMesh, faceOpts) {
    const style = cfg.brows?.style || "straight";
    if (style === "none") return;

    const sc = cfg.brows?.scale ?? 1;
    const mat = basicMat(cfg.brows?.color ?? cfg.hair?.color ?? 0x3a2a1a, 0.8);
    const depth = 0.012;
    const baseY = headY + hh * 0.22;
    const eyeDist = cfg.face?.eyeDistance ?? 1;
    const spread = eyeHalfSpread(eyeDist, hw);
    const surf = FaceFeatures.skinZ(headMesh, spread, baseY, faceOpts, hd);
    const z = surf + depth * 0.5;

    const addBrow = (side, w, h, d, ox, oy, rotZ = 0) => {
      const m = roundBoxMesh(w * sc, h * sc, d, mat, side * (spread + ox), baseY + oy, z, Math.min(0.004, h * 0.3));
      m.rotation.z = side * rotZ;
      g.add(m);
    };

    switch (style) {
      case "thick":
        addBrow(-1, 0.062, 0.02, depth, 0, 0);
        addBrow(1, 0.062, 0.02, depth, 0, 0);
        break;
      case "thin":
        addBrow(-1, 0.058, 0.007, depth, 0, 0.002);
        addBrow(1, 0.058, 0.007, depth, 0, 0.002);
        break;
      case "short":
        addBrow(-1, 0.038, 0.012, depth, 0.008, 0);
        addBrow(1, 0.038, 0.012, depth, 0.008, 0);
        break;
      case "arched": {
        for (const side of [-1, 1]) {
          const brow = buildSmoothBrow(mat, { scale: sc });
          if (!brow) continue;
          const bx = side * spread;
          const surfB = FaceFeatures.skinZ(headMesh, bx, baseY, faceOpts, hd);
          brow.position.set(bx, baseY, surfB);
          if (side < 0) brow.scale.x = -1;
          g.add(brow);
        }
        break;
      }
      case "angled":
        addBrow(-1, 0.058, 0.012, depth, 0, 0.004, 0.4);
        addBrow(1, 0.058, 0.012, depth, 0, 0.004, 0.4);
        break;
      case "straight":
      default:
        addBrow(-1, 0.055, 0.012, depth, 0, 0);
        addBrow(1, 0.055, 0.012, depth, 0, 0);
        break;
    }
  }
}

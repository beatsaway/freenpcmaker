import * as THREE from "three";
import { buildStack, roundBoxMesh, sphereMesh, skullSize } from "./Primitives.js";
import { skinMaterial, basicMat } from "../materials/PatternFactory.js";
import {
  clampEyeScale,
  clampEyeDistance,
  eyeHalfSpread,
  faceEyeY,
  faceNoseY,
  faceMouthY,
  clampFaceFeatureDrops,
  faceFeatureScale,
  clampPupilScale,
  clampPupilLook,
} from "../AvatarConfig.js";
import { buildLatheNose, noseTipLocal } from "../mesh/buildLatheFeatures.js";
import {
  buildLatheFace,
  jawLayout,
  faceSurfaceZFromProfile,
  faceSurfaceZ,
} from "../mesh/buildLatheFace.js";

/** Local +Z = front of face. */
export const FACE = 1;

/** Clearance so features sit on/outside the skull surface. */
const TOUCH = 0.01;

/** Tag face meshes for calmer inverted-hull outlines (see glitchWire). */
function markFaceFeature(mesh, { soft = true, noOutline = false } = {}) {
  if (!mesh) return mesh;
  mesh.userData.faceFeature = true;
  if (soft) mesh.userData.outlineSoft = true;
  if (noOutline) mesh.userData.noOutline = true;
  return mesh;
}

/**
 * Head sits on stack.neck.top — Loomis sphere+jaw+chin soft-unioned to one SDF mesh.
 */
export class Head {
  static build(cfg) {
    const g = new THREE.Group();
    g.name = "head";
    const st = buildStack(cfg);
    const skin = skinMaterial(cfg.skinTone);
    const { hw, hh, hd, roundness, R, Rfull, length, width, jawLen } = skullSize(cfg, st);
    const headY = st.head.y;
    // Pass FULL Loomis R once — jawLayout applies ballScale. (Passing sk.R double-shrunk
    // the mesh so stack chin/crown no longer matched the SDF, and lips landed on the chin.)
    const faceOpts = {
      hw,
      hh,
      hd,
      R: Rfull ?? (R != null ? R / 0.88 : hh / 1.5),
      jawLen,
      headY,
      crownY: st.head.top,
      chinY: st.head.bot,
      roundness,
      length: length ?? cfg.face?.length ?? 1,
      width: width ?? cfg.face?.width ?? 1,
      eyeDrop: cfg.face?.eyeDrop ?? 0.5,
      noseDrop: cfg.face?.noseDrop ?? 0.5,
      mouthDrop: cfg.face?.mouthDrop ?? 0.5,
    };

    // Sync feature span to the real SDF mesh before placing eyes/nose/mouth
    const J = jawLayout(faceOpts);
    faceOpts.crownY = J.crownY;
    faceOpts.chinY = J.chinTipY;
    faceOpts.R = J.Rfull;
    faceOpts.jawLen = J.jawLen;

    if (cfg.face) clampFaceFeatureDrops(cfg.face, hh, faceOpts);
    faceOpts.eyeDrop = cfg.face?.eyeDrop ?? faceOpts.eyeDrop;
    faceOpts.noseDrop = cfg.face?.noseDrop ?? faceOpts.noseDrop;
    faceOpts.mouthDrop = cfg.face?.mouthDrop ?? faceOpts.mouthDrop;

    const cranium =
      buildLatheFace(skin, faceOpts) ||
      roundBoxMesh(hw, hh, hd, skin, 0, headY, 0, Math.min(hw, hh, hd) * 0.35, 5);
    cranium.userData.skinBone = "head";
    g.add(cranium);

    g.userData.headMesh = cranium;
    g.userData.baseHeadY = headY;
    g.userData.stack = st;
    g.userData.faceOpts = faceOpts;
    g.userData.jaw = J;

    FaceFeatures.addEyes(g, cfg, headY, hw, hh, hd, cranium, faceOpts);
    FaceFeatures.addNose(g, cfg, headY, hd, cranium, faceOpts);
    FaceFeatures.addMouth(g, cfg, headY, hw, hh, hd, cranium, faceOpts);
    FaceFeatures.addBrows(g, cfg, headY, hw, hh, hd, cranium, faceOpts);

    return g;
  }
}

export class FaceFeatures {
  static faceZ(hd) {
    // Lathe/ellipsoid front is at ~hd, not hd/2
    return (hd ?? 0.1) * 0.92 * FACE;
  }

  /**
   * Seat features on the real skull mesh (raycast), with profile fallback.
   */
  static skinZ(mesh, x, y, faceOpts, hd, clearance = TOUCH) {
    if (mesh?.geometry) {
      return faceSurfaceZ(mesh, x, y, { ...(faceOpts || {}), hd }, clearance);
    }
    const plane = FaceFeatures.faceZ(hd);
    if (!faceOpts) return plane + clearance;
    const curved = faceSurfaceZFromProfile(x, y, faceOpts, clearance);
    return Math.max(plane * 0.92, curved);
  }

  /**
   * Flat parallelogram plate (XY), extruded along Z.
   * skew is fraction of height for the slant.
   */
  static parallelogramMesh(w, h, d, mat, x, y, z, skew = 0.45) {
    const shape = new THREE.Shape();
    const sk = h * skew;
    shape.moveTo(-w * 0.5, -h * 0.5);
    shape.lineTo(w * 0.5, -h * 0.5 + sk);
    shape.lineTo(w * 0.5, h * 0.5 + sk);
    shape.lineTo(-w * 0.5, h * 0.5);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    geo.translate(0, 0, -d * 0.5);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  /** Eye-white half-extents + builder for a given whiteStyle. */
  static eyeWhiteDims(whiteStyle, sc, faceSc) {
    if (whiteStyle === "wide") {
      return { ew: 0.065 * sc, eh: 0.032 * sc, depth: 0.014 * faceSc };
    }
    if (whiteStyle === "almond") {
      const s = 0.036 * sc;
      return { ew: s, eh: s, depth: 0.012 * faceSc };
    }
    if (whiteStyle === "parallelogram") {
      return { ew: 0.058 * sc, eh: 0.028 * sc, depth: 0.012 * faceSc };
    }
    // oval — flatter so pupil can sit on the front face
    const r = 0.02 * sc;
    return { ew: r * 1.45, eh: r * 0.88, depth: Math.max(0.01 * faceSc, r * 0.35), r };
  }

  static makeEyePiece(style, ew, eh, depth, mat, x, y, z, faceSc, { isWhite = false } = {}) {
    if (style === "parallelogram") {
      return FaceFeatures.parallelogramMesh(ew, eh, depth, mat, x, y, z, 0.42);
    }
    if (style === "almond") {
      const s = Math.max(ew, eh);
      const m = roundBoxMesh(s, s, depth, mat, x, y, z, 0.0025 * faceSc, 1);
      m.rotation.z = Math.PI / 4;
      return m;
    }
    if (style === "square") {
      return roundBoxMesh(ew, eh, depth, mat, x, y, z, 0.002 * faceSc, 1);
    }
    if (style === "wide") {
      return roundBoxMesh(ew, eh, depth, mat, x, y, z, 0.008 * faceSc);
    }
    if (style === "circle" || (style === "oval" && !isWhite)) {
      // Flat disc-like pupil so it reads on top of the white
      const r = Math.max(ew, eh) * 0.52;
      const m = sphereMesh(r, mat, x, y, z, 10, 8);
      m.scale.set(1, 1, Math.min(0.35, (depth * 0.55) / Math.max(1e-6, r)));
      return m;
    }
    // oval white
    const r = Math.max(ew, eh) * 0.55;
    const m = sphereMesh(r, mat, x, y, z, 10, 8);
    m.scale.set(ew / r, eh / r, Math.min(0.45, depth / Math.max(1e-6, r)));
    return m;
  }

  static addEyes(g, cfg, headY, hw, hh, hd, headMesh, faceOpts) {
    const whiteStyle = cfg.eyes?.whiteStyle || cfg.eyes?.style || "oval";
    const pupilStyle = cfg.eyes?.pupilStyle || "circle";
    const col = cfg.eyes?.color ?? 0x2a3a4a;
    const probeOpts = {
      ...faceOpts,
      frontZ: (x, y) => faceSurfaceZFromProfile(x, y, faceOpts, 0),
    };
    const eyeDist = clampEyeDistance(cfg.face?.eyeDistance ?? 1, hw, {
      ...probeOpts,
      eyeScale: cfg.eyes?.scale ?? 1,
    });
    if (cfg.face) cfg.face.eyeDistance = eyeDist;
    const faceSc = faceFeatureScale(hw, hh);
    const sc = clampEyeScale(cfg.eyes?.scale ?? 1, eyeDist, hw) * faceSc;
    const pupilFrac = clampPupilScale(cfg.eyes?.pupilScale ?? 0.55);
    const lookX = clampPupilLook(cfg.eyes?.pupilX ?? 0);
    const lookY = clampPupilLook(cfg.eyes?.pupilY ?? 0);
    // Keep pupil inside white (room shrinks with pupil size)
    const lookRoom = Math.max(0.05, 1 - pupilFrac) * 0.55;
    const mat = basicMat(col, 0.35);
    mat.depthWrite = true;
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -2;
    mat.polygonOffsetUnits = -2;
    const white = basicMat(0xf2f4f6, 0.5);
    // faceEyeY = lower end of the sclera (not center / not top).
    // Box/parallelogram dims are full height; oval/almond sphere uses eh as half-extent.
    const eyeBottomY = faceEyeY(headY, hh, cfg.face?.eyeDrop ?? faceOpts?.eyeDrop ?? 0.5, faceOpts);
    const spread = eyeHalfSpread(eyeDist, hw);
    const dims = FaceFeatures.eyeWhiteDims(whiteStyle, sc, faceSc);
    const halfH = whiteStyle === "oval" || !whiteStyle ? dims.eh : dims.eh * 0.5;
    const y = eyeBottomY + halfH;

    const makeEye = (x) => {
      const surf = FaceFeatures.skinZ(headMesh, x, y, faceOpts, hd, 0.008);
      const eg = new THREE.Group();
      // Sclera center sits just off skin; pupil parks on the front face of the white
      const zWhite = surf + dims.depth * 0.45;
      const zPupil = zWhite + dims.depth * 0.55 + 0.003 * faceSc;
      const ox = dims.ew * 0.5 * lookRoom * lookX;
      const oy = dims.eh * 0.5 * lookRoom * lookY;

      const sclera = markFaceFeature(
        FaceFeatures.makeEyePiece(
          whiteStyle,
          dims.ew,
          dims.eh,
          dims.depth,
          white,
          x,
          y,
          zWhite,
          faceSc,
          { isWhite: true }
        )
      );
      sclera.name = "eyeWhite";
      eg.add(sclera);

      // Pupil slightly smaller than frac of white so edges stay framed
      const pw = dims.ew * pupilFrac * 0.92;
      const ph = dims.eh * pupilFrac * 0.92;
      const iris = markFaceFeature(
        FaceFeatures.makeEyePiece(
          pupilStyle,
          pw,
          ph,
          Math.max(0.004 * faceSc, dims.depth * 0.35),
          mat,
          x + ox,
          y + oy,
          zPupil,
          faceSc,
          { isWhite: false }
        ),
        { soft: false, noOutline: true }
      );
      iris.name = "eyePupil";
      iris.renderOrder = 3;
      eg.add(iris);
      return eg;
    };

    g.add(makeEye(-spread));
    g.add(makeEye(spread));
  }

  static addNose(g, cfg, headY, hd, headMesh, faceOpts) {
    const style = cfg.nose?.style || "button";
    const hw = faceOpts?.hw ?? 0.16;
    const hh = faceOpts?.hh ?? 0.16;
    const skin = skinMaterial(cfg.skinTone);
    // faceNoseY = tip of the nose (between eyes and chin tip), not the bridge root
    let tipY = faceNoseY(headY, hh, cfg.face?.noseDrop ?? faceOpts?.noseDrop ?? 0.5, faceOpts);
    const chinY = faceOpts?.chinY ?? faceOpts?.headBot ?? headY - (faceOpts?.jawLen ?? hh);
    const eyeBottom = faceEyeY(headY, hh, cfg.face?.eyeDrop ?? faceOpts?.eyeDrop ?? 0.5, faceOpts);
    // Keep tip clearly below eyes and above mouth band / chin
    const span = Math.max(1e-4, (faceOpts?.crownY ?? headY + hh) - chinY);
    tipY = Math.min(tipY, eyeBottom - span * 0.04);
    tipY = Math.max(tipY, chinY + span * 0.28);

    const scale = (cfg.nose?.scale ?? 0.78) * faceFeatureScale(hw, hh);
    const width = cfg.nose?.width ?? 1;
    const tip = noseTipLocal({ style, scale, width });

    const nose = buildLatheNose(skin, { style, scale, width });
    if (nose) {
      // Shift attach origin so the tip lands on tipY
      const originY = tipY - tip.y;
      // Seat flush on skin — small sink so the bridge root is in the face, not floating
      const surf = FaceFeatures.skinZ(headMesh, 0, originY, faceOpts, hd, 0.001);
      nose.position.set(0, originY, surf - 0.003);
      nose.name = "nose";
      nose.userData.skinBone = "head";
      markFaceFeature(nose);
      g.add(nose);
    }
  }

  static addMouth(g, cfg, headY, hw, hh, hd, headMesh, faceOpts) {
    const style = cfg.mouth?.style || "smile";
    if (style === "none") return;

    const faceSc = faceFeatureScale(hw, hh);
    const sc = (cfg.mouth?.scale ?? 0.62) * faceSc;
    const thick = Math.min(1.85, Math.max(0.35, Number(cfg.mouth?.lipThickness) || 1));
    const curve = Math.min(1, Math.max(-1, Number(cfg.mouth?.curvature) ?? 0.55));
    const lipLen = Math.min(1.7, Math.max(0.45, Number(cfg.mouth?.lipLength ?? cfg.mouth?.length) || 1));
    const lipCol = cfg.mouth?.color ?? 0xc47880;
    const lip = basicMat(lipCol, 0.55);
    lip.polygonOffset = true;
    lip.polygonOffsetFactor = -1;
    lip.polygonOffsetUnits = -1;
    const depth = 0.014 * faceSc;

    const mg = new THREE.Group();
    mg.name = "mouth";
    mg.userData.skinBone = "head";

    // Cap lips to jaw width AND nose→chin height so they fit the lower face
    const jawRoom = Math.max(0.024, hw * 0.62);
    const chinY = faceOpts?.chinY ?? faceOpts?.headBot ?? headY - (faceOpts?.jawLen ?? hh);
    const eyeBottom = faceEyeY(headY, hh, cfg.face?.eyeDrop ?? faceOpts?.eyeDrop ?? 0.5, faceOpts);
    const span = Math.max(1e-4, (faceOpts?.crownY ?? headY + hh) - chinY);
    // Match addNose tip clamp so mouth band uses the same nose reference
    let noseTip = faceNoseY(headY, hh, cfg.face?.noseDrop ?? faceOpts?.noseDrop ?? 0.5, faceOpts);
    noseTip = Math.min(noseTip, eyeBottom - span * 0.04);
    noseTip = Math.max(noseTip, chinY + span * 0.28);
    const vertRoom = Math.max(0.016, noseTip - chinY);
    const rawW = (style === "wide" ? 0.042 : style === "small" ? 0.024 : 0.034) * sc * lipLen;
    const baseW = Math.min(rawW, jawRoom, vertRoom * 1.05);
    const uh = Math.min(0.005 * sc * thick, vertRoom * 0.1, jawRoom * 0.1);
    const lh = Math.min(0.0065 * sc * thick, vertRoom * 0.12, jawRoom * 0.12);
    const curveAmp = Math.min(0.014 * sc, vertRoom * 0.18, jawRoom * 0.18);
    const segs = 7;
    const midGap = Math.min(0.0026 * sc * (0.75 + thick * 0.35), vertRoom * 0.08);

    // Mouth center: layout Y, then clamp so lips clear nose tip and chin tip
    let y0 = faceMouthY(headY, hh, cfg.face?.mouthDrop ?? faceOpts?.mouthDrop ?? 0.5, faceOpts);
    const lipPad = uh + lh + midGap * 2 + vertRoom * 0.06;
    y0 = Math.min(y0, noseTip - lipPad);
    y0 = Math.max(y0, chinY + lipPad);
    // If the gap is tight, sit in the middle of nose→chin
    if (noseTip - chinY < lipPad * 2.4) {
      y0 = noseTip + (chinY - noseTip) * 0.55;
    }

    const lipYAt = (t, sign = 1) => {
      // t in [-1,1]; smile (+curve) lifts corners, frown drops them
      const corner = t * t; // 0 center → 1 corners
      return y0 + sign * midGap + curve * curveAmp * corner;
    };

    const addLipArc = (name, halfH, ySign, widthScale) => {
      const wSeg = (baseW * widthScale) / segs;
      for (let i = 0; i < segs; i++) {
        const t0 = -1 + (2 * i) / segs;
        const t1 = -1 + (2 * (i + 1)) / segs;
        const t = (t0 + t1) * 0.5;
        const x = t * baseW * widthScale * 0.5;
        const y = lipYAt(t, ySign);
        const surf = FaceFeatures.skinZ(headMesh, x, y, faceOpts, hd, 0.002);
        const z = surf + depth * 0.4;
        // Tangent tilt along the smile curve
        const yL = lipYAt(t0, ySign);
        const yR = lipYAt(t1, ySign);
        const rotZ = Math.atan2(yR - yL, (t1 - t0) * baseW * widthScale * 0.5);
        const piece = roundBoxMesh(
          wSeg * 1.12,
          halfH,
          depth,
          lip,
          x,
          y,
          z,
          Math.min(0.005 * faceSc, halfH * 0.4)
        );
        piece.rotation.z = rotZ;
        piece.name = name;
        piece.userData.skinBone = "head";
        markFaceFeature(piece);
        mg.add(piece);
      }
    };

    addLipArc("lipUpper", uh, 1, 1);
    addLipArc("lipLower", lh, -1, 0.94);

    g.add(mg);
  }

  /** Ears deferred — not building yet. */
  static addEars() {}

  static addBrows(g, cfg, headY, hw, hh, hd, headMesh, faceOpts) {
    const style = cfg.brows?.style || "straight";
    if (style === "none") return;

    const faceSc = faceFeatureScale(hw, hh);
    const sc = (cfg.brows?.scale ?? 1) * faceSc;
    const browLen = Math.min(1.75, Math.max(0.5, Number(cfg.brows?.length) || 1));
    const mat = basicMat(cfg.brows?.color ?? cfg.hair?.color ?? 0x3a2a1a, 0.85);
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -2;
    mat.polygonOffsetUnits = -2;
    const depth = 0.014 * faceSc;
    const eyeBottom = faceEyeY(headY, hh, cfg.face?.eyeDrop ?? faceOpts?.eyeDrop ?? 0.5, faceOpts);
    // Brows sit above the eye top (bottom + typical white half-height + gap)
    const eyeHalfEst = 0.028 * faceSc;
    const baseY = eyeBottom + eyeHalfEst * 2 + 0.01 * faceSc;
    const eyeDist = cfg.face?.eyeDistance ?? 1;
    const spread = eyeHalfSpread(eyeDist, hw);

    const addBrow = (side, w, h, ox, oy, rotZ = 0) => {
      const x = side * (spread + ox);
      const y = baseY + oy;
      const surf = FaceFeatures.skinZ(headMesh, x, y, faceOpts, hd, 0.014);
      const z = surf + depth * 0.65;
      const m = roundBoxMesh(
        w * sc * browLen,
        h * sc,
        depth,
        mat,
        x,
        y,
        z,
        Math.min(0.004, h * sc * 0.35)
      );
      m.rotation.z = side * rotZ;
      m.name = "brow";
      m.userData.skinBone = "head";
      markFaceFeature(m);
      g.add(m);
    };

    switch (style) {
      case "thick":
        addBrow(-1, 0.042, 0.014, 0, 0);
        addBrow(1, 0.042, 0.014, 0, 0);
        break;
      case "thin":
        addBrow(-1, 0.038, 0.005, 0, 0.002);
        addBrow(1, 0.038, 0.005, 0, 0.002);
        break;
      case "short":
        addBrow(-1, 0.026, 0.008, 0.006, 0);
        addBrow(1, 0.026, 0.008, 0.006, 0);
        break;
      case "arched": {
        const segs = 4;
        for (const side of [-1, 1]) {
          for (let i = 0; i < segs; i++) {
            const u = i / (segs - 1);
            const ox = mix(-0.014, 0.015, u);
            const oy = Math.sin(u * Math.PI) * 0.007;
            addBrow(side, 0.012, 0.007, ox, oy, 0.15 - u * 0.35);
          }
        }
        break;
      }
      case "angled":
        addBrow(-1, 0.04, 0.008, 0, 0.003, 0.4);
        addBrow(1, 0.04, 0.008, 0, 0.003, 0.4);
        break;
      case "straight":
      default:
        addBrow(-1, 0.038, 0.008, 0, 0);
        addBrow(1, 0.038, 0.008, 0, 0);
        break;
    }

    function mix(a, b, t) {
      return a + (b - a) * t;
    }
  }
}

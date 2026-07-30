/**
 * Lathed shoe shells — L-shaped (ankle cuff + sole) aligned to body L-foot.
 * Sole sits near the ground under the cuff; cuff top meets the ankle join.
 */
import * as THREE from "three";
import { humanLayout } from "./humanLayout.js";
import { latheMesh, profileFromKeys, clamp, withEndCaps, capDisc } from "./latheParts.js";

const FOOT_Z = -0.005;

/**
 * @param {THREE.Material} mat
 * @param {{ style?:string, scale?:number, layout?:object }} opts
 */
export function buildLatheShoes(mat, opts = {}) {
  const L = { ...humanLayout(), ...(opts.layout || {}) };
  const style = opts.style || "sneaker";
  if (style === "none" || style === "bare") return null;

  const sc = clamp(opts.scale ?? 1, 0.6, 1.8);
  const g = new THREE.Group();
  g.name = "shoes-lathe";

  const ankleY = L.yAnkle ?? 0.1;
  const rAnkle = (L.rAnkle ?? 0.03) * sc * 1.08; // ease over body ankle
  const footLen = (L.footD ?? 0.2) * sc * (style === "slippers" ? 0.88 : 1.08);
  const footW = (L.footW ?? 0.1) * sc * 0.55;
  const soleH = Math.max(0.03, (L.footH ?? 0.065) * sc * 0.58);
  const tall = style === "boot" || style === "hi-top";
  // Same vertical span as body L-foot: ankle down to near-ground sole
  const cuffH = Math.max(soleH * 0.9, ankleY - soleH * 0.4);

  const makeShoe = (side) => {
    const bone = side > 0 ? "foot_l" : "foot_r";
    const sx = side * L.legX;
    const part = new THREE.Group();
    part.name = bone;
    part.userData.skinBone = bone;

    const bootExtra =
      style === "boot" ? Math.max(0.06, ankleY * 0.45) : style === "hi-top" ? Math.max(0.03, ankleY * 0.25) : 0;
    const cuffTopY = ankleY + bootExtra;
    const cuffBotY = ankleY - cuffH;
    const soleY = cuffBotY + soleH * 0.5;

    // Vertical cuff — top at ankle (or above for boots), bottom into sole
    const cuff = latheMesh(
      profileFromKeys(
        [
          { y: 0, r: rAnkle * 0.95 },
          { y: (cuffTopY - cuffBotY) * 0.5, r: rAnkle * 1.04 },
          { y: cuffTopY - cuffBotY, r: rAnkle },
        ],
        2
      ),
      { material: mat, name: `${bone}_cuff`, skinBone: bone, segments: 12 }
    );
    const cuffG = withEndCaps(cuff, {
      material: mat,
      skinBone: bone,
      r0: rAnkle * 0.95,
      r1: rAnkle,
      cap0: false,
      cap1: false,
      segments: 10,
    });
    cuffG.position.set(sx, cuffBotY, FOOT_Z);
    part.add(cuffG);

    // Sole along +Z, seated under the cuff (matches body foot height)
    const tipR = footW * 0.32;
    const sole = latheMesh(
      profileFromKeys(
        [
          { y: 0, r: footW * 0.7 },
          { y: footLen * 0.28, r: footW },
          { y: footLen * 0.72, r: footW * 0.88 },
          { y: footLen, r: tipR },
        ],
        2
      ),
      { material: mat, name: `${bone}_sole`, skinBone: bone, segments: 12 }
    );
    sole.rotation.x = Math.PI / 2;
    sole.scale.z = soleH / Math.max(0.02, footW);
    const heelZ = FOOT_Z - footLen * 0.16;
    sole.position.set(sx, soleY, heelZ);
    part.add(sole);

    // Tip + heel caps (same radii as sole ends)
    const tip = capDisc(tipR, {
      material: mat,
      skinBone: bone,
      segments: 10,
      face: "+z",
      name: `${bone}_tip`,
    });
    tip.position.set(sx, soleY, heelZ + footLen);
    part.add(tip);

    const heel = capDisc(footW * 0.7, {
      material: mat,
      skinBone: bone,
      segments: 10,
      face: "-z",
      name: `${bone}_heel`,
    });
    heel.position.set(sx, soleY, heelZ);
    part.add(heel);

    return part;
  };

  g.add(makeShoe(-1));
  g.add(makeShoe(1));
  return g;
}

export const buildSmoothShoes = buildLatheShoes;

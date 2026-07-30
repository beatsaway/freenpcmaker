/**
 * Lathed hats — of-revolution crowns + optional brim discs.
 */
import * as THREE from "three";
import { latheMesh, profileFromKeys, clamp } from "./latheParts.js";
import { probeHairCrown } from "./buildLatheHair.js";

/**
 * @param {THREE.Material} mat
 * @param {object} opts
 */
export function buildLatheHat(mat, opts = {}) {
  const style = opts.style || "none";
  if (style === "none") return null;

  const hw = opts.hw ?? 0.16;
  const hh = opts.hh ?? 0.16;
  const hd = opts.hd ?? 0.18;
  const headTop = opts.headTop ?? (opts.headY ?? 1.66) + hh;
  const headY = opts.headY ?? headTop - hh;
  const brimMat = opts.brimMat || mat;
  const crownR = probeHairCrown({
    hw,
    hd,
    hairStyle: opts.hairStyle || "short",
  });

  const g = new THREE.Group();
  g.name = "hat-lathe";

  if (style === "cone") {
    const cone = latheMesh(
      profileFromKeys(
        [
          { y: 0, r: crownR * 0.95 },
          { y: hh * 0.85, r: crownR * 0.2 },
          { y: hh * 1.1, r: 0.01 },
        ],
        2
      ),
      { material: mat, name: "hat", skinBone: "head", segments: 16 }
    );
    cone.position.y = headTop - hh * 0.05;
    g.add(cone);
    return g;
  }

  if (style === "sunhat" || style === "bowler" || style === "roundcap") {
    const h = style === "bowler" ? hh * 0.55 : hh * 0.35;
    const crown = latheMesh(
      profileFromKeys(
        [
          { y: 0, r: crownR * 0.92 },
          { y: h * 0.6, r: crownR * (style === "bowler" ? 0.95 : 0.88) },
          { y: h, r: crownR * (style === "bowler" ? 0.7 : 0.4) },
        ],
        2
      ),
      { material: mat, name: "hat-crown", skinBone: "head", segments: 16 }
    );
    crown.position.y = headTop - 0.02;
    g.add(crown);
    if (style === "sunhat") {
      const brim = latheMesh(
        profileFromKeys(
          [
            { y: 0, r: crownR * 0.9 },
            { y: 0.008, r: crownR * 1.55 },
            { y: 0.014, r: crownR * 1.5 },
          ],
          1
        ),
        { material: brimMat, name: "brim", skinBone: "head", segments: 20 }
      );
      brim.position.y = headTop - 0.015;
      g.add(brim);
    }
    return g;
  }

  // cap / beanie / visor / hardhat default
  const tall = style === "beanie" ? hh * 0.55 : hh * 0.32;
  const crown = latheMesh(
    profileFromKeys(
      [
        { y: 0, r: crownR * 0.98 },
        { y: tall * 0.55, r: crownR * 1.02 },
        { y: tall, r: crownR * (style === "beanie" ? 0.55 : 0.75) },
      ],
      2
    ),
    { material: mat, name: "hat-crown", skinBone: "head", segments: 16 }
  );
  crown.position.y = headTop - hh * 0.08;
  // Slight forward tilt for caps
  if (style === "cap" || style === "visor") crown.rotation.x = -0.12;
  g.add(crown);

  if (style === "cap" || style === "visor") {
    const bill = latheMesh(
      profileFromKeys(
        [
          { y: 0, r: 0.01 },
          { y: 0.06, r: crownR * 0.55 },
          { y: 0.09, r: crownR * 0.5 },
        ],
        2
      ),
      {
        material: brimMat,
        name: "bill",
        skinBone: "head",
        segments: 10,
        phiStart: -Math.PI * 0.35,
        phiLength: Math.PI * 0.7,
      }
    );
    bill.rotation.x = Math.PI / 2;
    bill.position.set(0, headTop - hh * 0.12, hd * 0.55);
    g.add(bill);
  }

  return g;
}

export const buildSmoothHat = buildLatheHat;

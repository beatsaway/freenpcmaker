/**
 * Lathed hairstyle shells — stacked of-revolution volumes per style.
 */
import * as THREE from "three";
import { latheMesh, profileFromKeys, clamp, mix } from "./latheParts.js";

function scalpShell(mat, hw, hh, hd, headY, bulge = 1.08, down = 0.15) {
  const cy = headY;
  const top = cy + hh * 0.98;
  const bot = cy - hh * down;
  const r = Math.max(hw, hd) * bulge;
  const pts = profileFromKeys(
    [
      { y: bot, r: r * 0.55 },
      { y: cy, r: r },
      { y: mix(cy, top, 0.7), r: r * 0.92 },
      { y: top, r: r * 0.35 },
    ],
    3
  );
  const mesh = latheMesh(pts, { material: mat, name: "hair", skinBone: "head", segments: 18 });
  mesh.scale.set(hw / Math.max(hw, hd), 1, hd / Math.max(hw, hd));
  return mesh;
}

/**
 * @param {THREE.Material} mat
 * @param {{ style:string, hw:number, hh:number, hd:number, headY:number, skullTop?:number }} opts
 */
export function buildLatheHair(mat, opts = {}) {
  const style = opts.style || "short";
  if (style === "bald") return null;
  const hw = opts.hw ?? 0.16;
  const hh = opts.hh ?? 0.16;
  const hd = opts.hd ?? 0.18;
  const headY = opts.headY ?? 1.66;
  const g = new THREE.Group();
  g.name = "hair-lathe";

  const base = scalpShell(mat, hw, hh, hd, headY, style.includes("long") ? 1.12 : 1.06, style.includes("long") ? 0.55 : 0.12);
  g.add(base);

  if (style === "spiky" || style === "punk") {
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const spike = latheMesh(
        profileFromKeys(
          [
            { y: 0, r: 0.018 },
            { y: 0.06, r: 0.012 },
            { y: 0.1, r: 0.002 },
          ],
          2
        ),
        { material: mat, name: "spike", skinBone: "head", segments: 8 }
      );
      spike.position.set(Math.cos(ang) * hw * 0.35, headY + hh * 0.55, Math.sin(ang) * hd * 0.25);
      g.add(spike);
    }
  } else if (style === "bun" || style === "topknot") {
    const bun = latheMesh(
      profileFromKeys(
        [
          { y: 0, r: 0.01 },
          { y: 0.03, r: 0.045 },
          { y: 0.07, r: 0.04 },
          { y: 0.09, r: 0.01 },
        ],
        2
      ),
      { material: mat, name: "bun", skinBone: "head", segments: 12 }
    );
    bun.position.set(0, headY + hh * 0.75, -hd * 0.15);
    g.add(bun);
  } else if (style === "ponytail" || style === "long-straight" || style === "long-wave") {
    const tail = latheMesh(
      profileFromKeys(
        [
          { y: 0, r: 0.03 },
          { y: 0.12, r: 0.028 },
          { y: 0.28, r: 0.022 },
          { y: 0.38, r: 0.01 },
        ],
        2
      ),
      { material: mat, name: "tail", skinBone: "head", segments: 12 }
    );
    tail.position.set(0, headY - hh * 0.1, -hd * 0.55);
    tail.rotation.x = 0.35;
    g.add(tail);
  } else if (style === "mohawk") {
    const ridge = latheMesh(
      profileFromKeys(
        [
          { y: 0, r: 0.02 },
          { y: 0.08, r: 0.028 },
          { y: 0.14, r: 0.01 },
        ],
        2
      ),
      { material: mat, name: "mohawk", skinBone: "head", segments: 10, phiLength: Math.PI * 0.45 }
    );
    ridge.position.set(0, headY + hh * 0.2, 0);
    ridge.rotation.z = Math.PI / 2;
    g.add(ridge);
  }

  return g;
}

/** Crown radius sample for hat sizing. */
export function probeHairCrown(opts = {}) {
  const hw = opts.hw ?? 0.16;
  const hd = opts.hd ?? 0.18;
  const style = opts.hairStyle || opts.style || "short";
  let bulge = 1.06;
  if (style === "bald") bulge = 1.0;
  else if (String(style).includes("long") || style === "bun" || style === "topknot") bulge = 1.14;
  else if (style === "spiky" || style === "punk" || style === "mohawk") bulge = 1.18;
  return Math.max(hw, hd) * bulge;
}

export const buildSmoothHair = buildLatheHair;

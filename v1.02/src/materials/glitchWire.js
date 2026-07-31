/**
 * Mesh outline via inverted hull — thickness snaps every hand-drawn frame (~12fps).
 * Optional uBass (0..1) boosts line boil + color glitch (Circle Beat).
 * Face features use uCalm so expand/shake stay thin and stable (less z-fight glitch).
 */
import * as THREE from "three";

/** Limited animation rate — like drawing on twos at 24fps. */
export const HAND_FPS = 12;

const VERT = /* glsl */ `
uniform float uExpand;
uniform float uFrame;
uniform float uBass;
uniform float uCalm;
#include <common>
#include <skinning_pars_vertex>
void main() {
  #include <skinbase_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  float draw = floor(uFrame);
  float f = draw * 0.28;
  float calm = clamp(uCalm, 0.0, 1.0);
  float boil = mix(1.0 + uBass * 2.4, 1.0 + uBass * 0.35, calm);
  vec3 p = transformed;
  float pressure =
    0.55 * sin(p.y * 14.0 + p.x * 6.0 + f * 1.1) +
    0.40 * sin(p.x * 22.0 - p.z * 9.0 - f * 0.85) +
    0.30 * sin((p.y * 1.3 + p.z) * 35.0 + f * 1.35) +
    0.22 * sin(dot(p, vec3(9.0, 23.0, 5.0)) + f * 1.6);
  pressure = pressure / (1.0 + abs(pressure));
  float stress = pow(max(0.0, sin(p.y * 8.0 + p.x * 4.0 + f * 0.7)), 3.5);
  float jump = fract(sin(floor(draw * 0.35) * 12.9898 + p.y * 4.0) * 43758.5453);
  float thick = mix(0.06, 1.95, 0.5 + 0.5 * pressure) + stress * 0.55;
  thick *= mix(0.45, 1.35, jump);
  // Bass opens the thin↔thick swing (muted when calm)
  thick = mix(thick, mix(0.02, 2.35, 0.5 + 0.5 * pressure), uBass * mix(0.55, 0.12, calm));
  // Calm: keep strokes near a thin, even shell
  thick = mix(thick, mix(0.72, 1.08, 0.5 + 0.5 * pressure * 0.35), calm);
  float fleck = fract(sin(dot(p.xy, vec2(12.9898, 78.233)) + draw * 3.1) * 43758.5453);
  float fleckCut = mix(0.93 - uBass * 0.12, 0.995, calm);
  if (fleck > fleckCut) thick *= mix(mix(0.42, 0.2, uBass), 0.85, calm);
  transformed += normalize(objectNormal) * uExpand * thick * (0.85 + boil * 0.15);
  float jx = fract(sin(draw * 12.9898 + 1.3) * 43758.5453) - 0.5;
  float jy = fract(sin(draw * 78.233 + 8.1) * 43758.5453) - 0.5;
  float lx = fract(sin(p.x * 11.0 + draw * 7.0) * 23421.0) - 0.5;
  float ly = fract(sin(p.y * 13.0 + draw * 5.0) * 19234.0) - 0.5;
  float shake = uExpand * mix(1.15 + boil * 1.1, 0.18, calm);
  transformed.x += (jx * 0.5 + lx * 0.35) * shake;
  transformed.y += (jy * 0.5 + ly * 0.35) * shake;
  #include <project_vertex>
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uBass;
uniform float uFrame;
uniform float uCalm;
void main() {
  vec3 c = uColor;
  float b = uBass * (1.0 - clamp(uCalm, 0.0, 1.0) * 0.85);
  if (b > 0.1) {
    float t = fract(sin(uFrame * 2.7 + b * 11.0) * 43758.5453);
    vec3 swapped = (t < 0.34) ? c.gbr : ((t < 0.67) ? c.brg : vec3(c.b, c.r, c.g));
    c = mix(uColor, swapped, smoothstep(0.1, 0.8, b) * (0.4 + 0.6 * step(1.0 - b * 0.6, t)));
    c += vec3(0.15, 0.55, 0.35) * b * b * step(0.75, t);
  }
  gl_FragColor = vec4(c, 1.0);
}
`;

function toneFromMaterial(material) {
  const src = Array.isArray(material) ? material[0] : material;
  const c = new THREE.Color(0x444444);
  if (src?.color) c.copy(src.color);
  if (src?.map) c.lerp(new THREE.Color(0x666666), 0.25);
  c.multiplyScalar(0.28);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s * 0.85), Math.min(0.22, hsl.l));
  return c;
}

function meshWorldRadius(obj) {
  if (!obj?.geometry) return 1;
  if (!obj.geometry.boundingSphere) obj.geometry.computeBoundingSphere();
  const r = obj.geometry.boundingSphere?.radius ?? 1;
  const sx = Math.abs(obj.scale?.x ?? 1);
  const sy = Math.abs(obj.scale?.y ?? 1);
  const sz = Math.abs(obj.scale?.z ?? 1);
  return r * Math.max(sx, sy, sz);
}

function wantsSoftOutline(obj) {
  if (obj.userData?.outlineSoft || obj.userData?.faceFeature) return true;
  // Tiny face pieces (lips / pupils / brows) — body expand swallows them
  return meshWorldRadius(obj) < 0.03;
}

export function createOutlineMaterial({
  skinned = false,
  color = 0x1a1a22,
  expand = 0.005,
  calm = 0,
} = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uExpand: { value: expand },
      uFrame: { value: 0 },
      uBass: { value: 0 },
      uCalm: { value: calm },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    skinning: skinned,
    // Soft face outlines: don't write depth — cuts z-fight with skull / stacked lids
    depthWrite: calm < 0.5,
    depthTest: true,
    polygonOffset: calm > 0.4,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

/** Attach hand-stroke outlines; returns materials to tick. */
export function attachMeshOutline(root) {
  const mats = [];
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry || obj.userData.isOutline) return;
    if (obj.userData.noOutline) return;

    const soft = wantsSoftOutline(obj);
    const mat = createOutlineMaterial({
      skinned: !!obj.isSkinnedMesh,
      color: toneFromMaterial(obj.material),
      expand: soft ? 0.0016 : 0.007,
      calm: soft ? 0.88 : 0,
    });
    let outline;
    if (obj.isSkinnedMesh) {
      outline = new THREE.SkinnedMesh(obj.geometry, mat);
      outline.bind(obj.skeleton, obj.bindMatrix);
      outline.bindMode = obj.bindMode;
      outline.position.copy(obj.position);
      outline.quaternion.copy(obj.quaternion);
      outline.scale.copy(obj.scale);
      obj.parent?.add(outline);
    } else {
      outline = new THREE.Mesh(obj.geometry, mat);
      obj.add(outline);
    }
    outline.userData.isOutline = true;
    outline.userData.outlineSoft = soft;
    outline.castShadow = false;
    outline.receiveShadow = false;
    // Soft: draw after fill so thin shell isn't eaten by skull depth
    outline.renderOrder = soft ? (obj.renderOrder || 0) + 2 : (obj.renderOrder || 0) - 1;
    outline.frustumCulled = false;
    mats.push(mat);
  });
  return mats;
}

/**
 * @param {number} frame integer hand-drawn frame index
 * @param {number} [bass=0] low-band 0..1
 */
export function tickMeshOutline(mats, frame, bass = 0) {
  const b = Math.max(0, Math.min(1, Number(bass) || 0));
  for (const m of mats) {
    if (m?.uniforms?.uFrame) m.uniforms.uFrame.value = frame;
    if (m?.uniforms?.uBass) m.uniforms.uBass.value = b;
  }
}

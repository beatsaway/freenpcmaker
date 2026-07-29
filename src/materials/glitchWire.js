/**
 * Mesh outline via inverted hull — thickness wobbles like a hand-drawn stroke.
 */
import * as THREE from "three";

const VERT = /* glsl */ `
uniform float uExpand;
uniform float uTime;
#include <common>
#include <skinning_pars_vertex>
void main() {
  #include <skinbase_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  // Calligraphic pressure: wide thin↔thick swings + sharp stress peaks
  vec3 p = transformed;
  float pressure =
    0.50 * sin(p.y * 18.0 + p.x * 7.0 + uTime * 0.55) +
    0.35 * sin(p.x * 27.0 - p.z * 12.0 - uTime * 0.4) +
    0.28 * sin((p.y * 1.4 + p.z) * 41.0 + uTime * 0.75) +
    0.18 * sin(dot(p, vec3(9.0, 23.0, 5.0)) + uTime * 1.1);
  // Emphasize extremes (calligraphy “press / lift”)
  pressure = pressure / (1.0 + abs(pressure));
  float stress = pow(max(0.0, sin(p.y * 9.0 + p.x * 5.0 + uTime * 0.3)), 4.0);
  float thick = mix(0.12, 1.85, 0.5 + 0.5 * pressure) + stress * 0.7;
  transformed += normalize(objectNormal) * uExpand * thick;
  #include <project_vertex>
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4(uColor, 1.0);
}
`;

function toneFromMaterial(material) {
  const src = Array.isArray(material) ? material[0] : material;
  const c = new THREE.Color(0x444444);
  if (src?.color) c.copy(src.color);
  if (src?.map) c.lerp(new THREE.Color(0x666666), 0.25);
  // Keep hue, crush to a dark ink-like value
  c.multiplyScalar(0.28);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s * 0.85), Math.min(0.22, hsl.l));
  return c;
}

export function createOutlineMaterial({ skinned = false, color = 0x1a1a22, expand = 0.005 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uExpand: { value: expand },
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    skinning: skinned,
    depthWrite: true,
  });
}

/** Attach hand-stroke outlines; returns materials to animate. */
export function attachMeshOutline(root) {
  const mats = [];
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry || obj.userData.isOutline) return;
    const mat = createOutlineMaterial({
      skinned: !!obj.isSkinnedMesh,
      color: toneFromMaterial(obj.material),
      expand: 0.007,
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
    outline.renderOrder = (obj.renderOrder || 0) - 1;
    outline.frustumCulled = false;
    mats.push(mat);
  });
  return mats;
}

export function tickMeshOutline(mats, time) {
  for (const m of mats) {
    if (m?.uniforms?.uTime) m.uniforms.uTime.value = time;
  }
}

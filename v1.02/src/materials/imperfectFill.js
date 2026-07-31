/**
 * Imperfect flat fill — misses / bleeds the outline, snaps with hand-drawn frames.
 * Optional uBass (0..1) boosts blot hop + rim nicks + RGB glitch (Circle Beat).
 */
import * as THREE from "three";

/** Integer drawing index (shared with 12fps loop). */
export const uPaintFrame = { value: 0 };
/** Low-band energy 0..1 — blot / glitch intensity. */
export const uBass = { value: 0 };

export function setPaintFrame(frame) {
  uPaintFrame.value = frame;
}

export function setBassEnergy(v) {
  uBass.value = Math.max(0, Math.min(1, Number(v) || 0));
}

/** @deprecated use setPaintFrame */
export function setPaintTime(t) {
  uPaintFrame.value = Math.floor(t * 12);
}

/** Patch a MeshBasicMaterial for imperfect hand-painted fill. */
export function applyImperfectFill(mat) {
  if (!mat || mat.userData._imperfectFill) return mat;
  mat.userData._imperfectFill = true;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPaintFrame = uPaintFrame;
    shader.uniforms.uBass = uBass;

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `uniform float uPaintFrame;
       uniform float uBass;
       varying vec3 vPaintNormal;
       varying vec3 vPaintView;
       #include <common>`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `uniform float uPaintFrame;
       uniform float uBass;
       varying vec3 vPaintNormal;
       varying vec3 vPaintView;
       #include <common>`
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <skinning_vertex>",
      `#include <skinning_vertex>
       {
         float draw = floor(uPaintFrame);
         float boil = 1.0 + uBass * 2.8;
         float n = fract(sin(dot(transformed.xyz, vec3(12.9898, 78.233, 45.164)) + draw * 1.7) * 43758.5453);
         float n2 = fract(sin(transformed.y * 31.0 + transformed.x * 17.0 + draw * 2.3) * 23421.13);
         float over = step(0.78 - uBass * 0.2, n2);
         float push = mix(-0.015, -0.003, n) + over * (0.01 + n * 0.01);
         push *= mix(1.0, 1.0 + uBass * 1.8, 0.5 + 0.5 * n);
         transformed += normalize(objectNormal) * push * boil * 0.55;
         // Whole-mesh blot hop — bass pumps the jump
         float jx = fract(sin(draw * 12.9898 + 1.3) * 43758.5453) - 0.5;
         float jy = fract(sin(draw * 78.233 + 8.1) * 43758.5453) - 0.5;
         float jz = fract(sin(draw * 45.164 + 3.7) * 19234.67) - 0.5;
         transformed += vec3(jx, jy * 0.55, jz) * (0.0075 * boil);
       }
      `
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      `#include <project_vertex>
       vPaintNormal = normalize(normalMatrix * objectNormal);
       vPaintView = normalize(-mvPosition.xyz);
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `{
         vec3 nn = normalize(vPaintNormal);
         vec3 vv = normalize(vPaintView);
         float rim = 1.0 - abs(dot(nn, vv));
         float f = floor(uPaintFrame);
         float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + f * 3.1) * 43758.5453);
         float g2 = fract(sin(gl_FragCoord.x * 0.17 + gl_FragCoord.y * 0.31 + f * 2.0) * 19234.67);
         float bite = mix(0.72, 0.45, rim) - uBass * 0.22;
         if (rim > 0.28 - uBass * 0.1 && g > bite) discard;
         if (rim > 0.12 && g2 > (0.988 - uBass * 0.08)) discard;
       }
       #include <opaque_fragment>
       {
         // Mesh body color glitch — neon flashes + dark/bright punches (bass-gated)
         float b = uBass;
         float f = floor(uPaintFrame);
         float t = fract(sin(dot(gl_FragCoord.xy, vec2(19.1, 47.3)) + f * 5.2 + b * 9.0) * 43758.5453);
         float t2 = fract(sin(gl_FragCoord.x * 0.13 + f * 3.7 + b * 6.1) * 24634.91);
         if (b > 0.05) {
           vec3 rgb = gl_FragColor.rgb;
           vec3 swapped = (t < 0.33) ? rgb.gbr : ((t < 0.66) ? rgb.brg : rgb.rbg);
           float mixA = smoothstep(0.05, 0.55, b) * (0.5 + 0.5 * step(1.0 - b * 0.7, t));
           rgb = mix(rgb, swapped, mixA);

           vec3 neon = (t2 < 0.33)
             ? vec3(0.15, 1.0, 0.75)
             : ((t2 < 0.66) ? vec3(1.0, 0.2, 0.85) : vec3(0.55, 1.0, 0.2));
           float neonAmt = smoothstep(0.08, 0.7, b) * (0.25 + 0.75 * step(1.0 - b * 0.75, t2));
           rgb = mix(rgb, neon, neonAmt * 0.9);
           rgb += neon * b * 0.45 * step(0.7, t);

           float lum = dot(rgb, vec3(0.299, 0.587, 0.114));
           float crush = smoothstep(0.1, 0.75, b);
           if (t < 0.28 * crush) {
             rgb = mix(rgb, vec3(lum * 0.1), 0.65 + 0.3 * b);
           } else if (t > 1.0 - 0.28 * crush) {
             rgb = mix(rgb, rgb * (1.8 + b * 1.4) + neon * 0.2, 0.55 + 0.4 * b);
           }

           gl_FragColor.rgb = clamp(rgb, 0.0, 1.8);
         }
       }`
    );
  };
  mat.customProgramCacheKey = () => "imperfect-hand-fill-v5-meshglitch";
  return mat;
}

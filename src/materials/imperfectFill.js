/**
 * Imperfect flat fill — misses / bleeds the outline, snaps with hand-drawn frames.
 */
import * as THREE from "three";

/** Integer drawing index (shared with 12fps loop). */
export const uPaintFrame = { value: 0 };

export function setPaintFrame(frame) {
  uPaintFrame.value = frame;
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

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `uniform float uPaintFrame;
       varying vec3 vPaintNormal;
       varying vec3 vPaintView;
       #include <common>`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `uniform float uPaintFrame;
       varying vec3 vPaintNormal;
       varying vec3 vPaintView;
       #include <common>`
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <skinning_vertex>",
      `#include <skinning_vertex>
       {
         float draw = floor(uPaintFrame);
         float n = fract(sin(dot(transformed.xyz, vec3(12.9898, 78.233, 45.164)) + draw * 1.7) * 43758.5453);
         float n2 = fract(sin(transformed.y * 31.0 + transformed.x * 17.0 + draw * 2.3) * 23421.13);
         float over = step(0.78, n2);
         float push = mix(-0.015, -0.003, n) + over * (0.01 + n * 0.01);
         transformed += normalize(objectNormal) * push;
         // Whole-mesh blot hop — same quiet snap family as shadow
         float jx = fract(sin(draw * 12.9898 + 1.3) * 43758.5453) - 0.5;
         float jy = fract(sin(draw * 78.233 + 8.1) * 43758.5453) - 0.5;
         float jz = fract(sin(draw * 45.164 + 3.7) * 19234.67) - 0.5;
         transformed += vec3(jx, jy * 0.55, jz) * 0.0032;
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
         if (rim > 0.28 && g > mix(0.72, 0.45, rim)) discard;
         if (rim > 0.12 && g2 > 0.988) discard;
       }
       #include <opaque_fragment>`
    );
  };
  mat.customProgramCacheKey = () => "imperfect-hand-fill-v3-blot";
  return mat;
}

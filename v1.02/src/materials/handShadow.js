/**
 * Shadow as ink blot + same-color calligraphic outline (snaps with hand frames).
 */
import * as THREE from "three";

export const uHandShadowFrame = { value: 0 };

export function setHandShadowFrame(frame) {
  uHandShadowFrame.value = frame;
}

/** Patch ShadowMaterial for calligraphic ink fill + outline. */
export function applyHandShadow(mat) {
  if (!mat || mat.userData._handShadow) return mat;
  mat.userData._handShadow = true;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uHandShadowFrame = uHandShadowFrame;

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `uniform float uHandShadowFrame;
       #include <common>
       float inkHash(vec2 p, float f) {
         return fract(sin(dot(p, vec2(127.1, 311.7)) + f * 19.7) * 43758.5453);
       }
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );",
      `{
         float lit = 1.0;
         float draw = floor(uHandShadowFrame);
         float fStroke = draw * 0.28; // same slow weight pace as mesh outline
         #if NUM_DIR_LIGHT_SHADOWS > 0
         {
           vec4 sc = vDirectionalShadowCoord[0];
           vec2 uv = sc.xy / max(sc.w, 1e-4);
           vec2 jump = vec2(
             inkHash(vec2(draw, 1.3), draw) - 0.5,
             inkHash(vec2(draw, 8.1), draw) - 0.5
           ) * 0.0018;
           float a = 0.0;
           vec2 o1 = jump + vec2( 0.0018, -0.0014);
           vec2 o2 = jump + vec2(-0.0014,  0.0018);
           vec4 s0 = sc; s0.xy += jump * sc.w;
           vec4 s1 = sc; s1.xy += o1 * sc.w;
           vec4 s2 = sc; s2.xy += o2 * sc.w;
           a += getShadow(directionalShadowMap[0], directionalLightShadows[0].shadowMapSize, directionalLightShadows[0].shadowBias, directionalLightShadows[0].shadowRadius, s0);
           a += getShadow(directionalShadowMap[0], directionalLightShadows[0].shadowMapSize, directionalLightShadows[0].shadowBias, directionalLightShadows[0].shadowRadius, s1);
           a += getShadow(directionalShadowMap[0], directionalLightShadows[0].shadowMapSize, directionalLightShadows[0].shadowBias, directionalLightShadows[0].shadowRadius, s2);
           lit = a * 0.333;
         }
         #else
         lit = getShadowMask();
         #endif
         float shadowAmt = 1.0 - lit;
         float fill = shadowAmt;
         float outline = 0.0;
         #if NUM_DIR_LIGHT_SHADOWS > 0
         {
           vec2 uvEdge = vDirectionalShadowCoord[0].xy / max(vDirectionalShadowCoord[0].w, 1e-4);
           float cell = inkHash(floor(uvEdge * 36.0), draw);
           float cut = mix(0.40, 0.48, cell);
           fill = smoothstep(cut - 0.06, cut + 0.07, shadowAmt);
           float rim = smoothstep(0.18, 0.45, shadowAmt) * (1.0 - smoothstep(0.6, 0.9, shadowAmt));
           float fleck = inkHash(floor(uvEdge * 48.0 + draw * 0.7), draw + 3.0);
           if (rim > 0.35 && fleck > 0.93) fill *= 0.55;

           // Calligraphic outline — dilate shell, subtract fill (same color as shadow)
           float pressure =
             0.55 * sin(uvEdge.x * 14.0 + uvEdge.y * 6.0 + fStroke * 1.1) +
             0.40 * sin(uvEdge.x * 22.0 - uvEdge.y * 9.0 - fStroke * 0.85) +
             0.30 * sin((uvEdge.x * 1.3 + uvEdge.y) * 35.0 + fStroke * 1.35);
           pressure = pressure / (1.0 + abs(pressure));
           float stress = pow(max(0.0, sin(uvEdge.y * 8.0 + uvEdge.x * 4.0 + fStroke * 0.7)), 3.5);
           float jumpW = inkHash(vec2(floor(draw * 0.35), floor(uvEdge.y * 4.0)), draw);
           // Thin→thick like mesh hull (scaled for shadow UV)
           float thick = mix(0.04, 0.16, 0.5 + 0.5 * pressure) + stress * 0.05;
           thick *= mix(0.55, 1.25, jumpW);
           float outerCut = cut - thick;
           float shell = smoothstep(outerCut - 0.03, outerCut + 0.05, shadowAmt);
           outline = max(0.0, shell - fill * 0.9);
           // Mild outline fleck (same family as fill, quieter)
           if (outline > 0.2 && fleck > 0.9) outline *= 0.45;
         }
         #endif
         float amt = max(fill, outline);
         gl_FragColor = vec4(color, opacity * amt);
       }`
    );
  };

  mat.customProgramCacheKey = () => "hand-ink-shadow-outline-v1";
  return mat;
}

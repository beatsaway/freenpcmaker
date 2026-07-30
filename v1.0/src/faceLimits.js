/**
 * Keep eyes on the front of the face — clamp eyeDistance to skull-safe max.
 */
import { buildStack, skullSize } from "./parts/Stack.js";
import { faceSurfaceZFromSdf } from "./mesh/buildSmoothFace.js";
import { clampEyeDistance, clampEyeScale } from "./AvatarConfig.js";

/** Mutates cfg.face.eyeDistance (and eye scale) to the max that stays frontal. */
export function applyEyeDistanceCap(cfg) {
  if (!cfg?.face) return cfg;
  const st = buildStack(cfg);
  const sk = skullSize(cfg, st);
  const faceOpts = {
    hw: sk.hw,
    hh: sk.hh,
    hd: sk.hd,
    headY: st.head.y,
    roundness: sk.roundness,
    eyeDrop: cfg.face.eyeDrop ?? 0.35,
    noseDrop: cfg.face.noseDrop ?? 0.5,
  };
  const probeOpts = {
    ...faceOpts,
    frontZ: (x, y) => faceSurfaceZFromSdf(x, y, faceOpts, 0),
  };
  cfg.face.eyeDistance = clampEyeDistance(cfg.face.eyeDistance ?? 1, sk.hw, {
    ...probeOpts,
    eyeScale: cfg.eyes?.scale ?? 1,
  });
  if (cfg.eyes) {
    cfg.eyes.scale = clampEyeScale(cfg.eyes.scale, cfg.face.eyeDistance, sk.hw);
    // Keep gap after scale clamp (big eyes push distance out)
    cfg.face.eyeDistance = clampEyeDistance(cfg.face.eyeDistance, sk.hw, {
      ...probeOpts,
      eyeScale: cfg.eyes.scale,
    });
  }
  return cfg;
}

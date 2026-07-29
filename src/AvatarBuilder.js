/**
 * AvatarBuilder — factory API for low-poly NPC avatars.
 *
 * @example
 * import { AvatarBuilder } from "./AvatarBuilder.js";
 * const npc = AvatarBuilder.create({ hair: { style: "crew" } });
 * scene.add(npc);
 */
import { LowPolyAvatar } from "./LowPolyAvatar.js";
import {
  resolveConfig,
  randomConfig,
  DEFAULT_CONFIG,
  BODY_SHAPES,
  EYE_STYLES,
  EYE_SCALE_MIN,
  EYE_SCALE_MAX,
  HEAD_SCALE_MIN,
  HEAD_SCALE_MAX,
  maxEyeScaleForDistance,
  clampEyeScale,
  BROW_STYLES,
  NOSE_STYLES,
  EAR_STYLES,
  HAIR_STYLES,
  HAT_STYLES,
  TOP_STYLES,
  BOTTOM_STYLES,
  SHOE_STYLES,
  PATTERN_TYPES,
} from "./AvatarConfig.js";
import { PRESETS } from "./presets.js";

export class AvatarBuilder {
  /** Create avatar from partial config. */
  static create(partial = {}, place = {}) {
    return new LowPolyAvatar(partial, place);
  }

  /** Random NPC (optional seed for reproducibility). */
  static random(seed, place = {}) {
    return new LowPolyAvatar(randomConfig(seed), place);
  }

  /** Named preset. */
  static fromPreset(name, place = {}) {
    const p = PRESETS[name];
    if (!p) throw new Error(`Unknown preset: ${name}. Try: ${Object.keys(PRESETS).join(", ")}`);
    return new LowPolyAvatar(p, place);
  }

  static presets() {
    return Object.keys(PRESETS);
  }

  static defaults() {
    return structuredClone(DEFAULT_CONFIG);
  }

  /** Enumerations for UI builders. */
  static catalog() {
    return {
      bodyShapes: [...BODY_SHAPES],
      eyeStyles: [...EYE_STYLES],
      browStyles: [...BROW_STYLES],
      noseStyles: [...NOSE_STYLES],
      earStyles: [...EAR_STYLES],
      hairStyles: [...HAIR_STYLES],
      hatStyles: [...HAT_STYLES],
      topStyles: [...TOP_STYLES],
      bottomStyles: [...BOTTOM_STYLES],
      shoeStyles: [...SHOE_STYLES],
      patterns: [...PATTERN_TYPES],
      presets: Object.keys(PRESETS),
    };
  }

  static resolve(partial) {
    return resolveConfig(partial);
  }
}

export { LowPolyAvatar };
export {
  resolveConfig,
  randomConfig,
  DEFAULT_CONFIG,
  BODY_SHAPES,
  EYE_STYLES,
  EYE_SCALE_MIN,
  EYE_SCALE_MAX,
  EYE_DISTANCE_MIN,
  EYE_DISTANCE_MAX,
  EYE_GAP_MIN,
  PUPIL_SCALE_MIN,
  PUPIL_SCALE_MAX,
  PUPIL_LOOK_MIN,
  PUPIL_LOOK_MAX,
  FACE_WIDTH_MIN,
  FACE_WIDTH_MAX,
  FACE_DROP_MIN,
  FACE_DROP_MAX,
  BUTTON_SIZE_MIN,
  BUTTON_SIZE_MAX,
  HEAD_SCALE_MIN,
  HEAD_SCALE_MAX,
  maxEyeScaleForDistance,
  minEyeDistanceForScale,
  clampEyeScale,
  clampEyeDistance,
  clampPupilScale,
  clampPupilLook,
  maxEyeDistanceForWidth,
  eyeHalfSpread,
  faceEyeY,
  faceNoseY,
  clampFaceFeatureDrops,
  maxEyeDropForNose,
  minNoseDropForEye,
  BROW_STYLES,
  NOSE_STYLES,
  EAR_STYLES,
  HAIR_STYLES,
  HAIR_SHORT,
  HAIR_LONG,
  HAT_STYLES,
  TOP_STYLES,
  BOTTOM_STYLES,
  SHOE_STYLES,
  PATTERN_TYPES,
  randomPattern,
} from "./AvatarConfig.js";
export { PRESETS } from "./presets.js";
export { createPatternTexture, clothMaterial } from "./materials/PatternFactory.js";
export { applyEyeDistanceCap } from "./faceLimits.js";
export { skullSize } from "./parts/Stack.js";

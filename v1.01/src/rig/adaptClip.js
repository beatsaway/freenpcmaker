/**
 * Adapt Mesh2Motion human clips to custom-proportion skeletons.
 *
 * Clips key .position on every bone using the stock rig-human lengths.
 * Playing them raw snaps our fitted avatar back to one body size each frame.
 * Solution: keep quaternion (and optional root motion); drop limb/spine positions
 * so bone lengths stay at the jointMap rest pose we bound against.
 */
import { AnimationClip, VectorKeyframeTrack } from "three";

/** Approximate head-top height of static/rigs/rig-human.glb (world Y). */
export const HUMAN_TEMPLATE_HEIGHT = 1.64;

/**
 * @param {import('three').AnimationClip} clip
 * @param {{ heightScale?: number, keepRootMotion?: boolean }} [opts]
 * @returns {import('three').AnimationClip}
 */
export function adaptClipToProportions(clip, opts = {}) {
  const heightScale = opts.heightScale ?? 1;
  const keepRootMotion = opts.keepRootMotion !== false;
  const tracks = [];

  for (const track of clip.tracks) {
    const name = track.name;
    const isQuat = name.endsWith(".quaternion");
    const isPos = name.endsWith(".position");
    const isScale = name.endsWith(".scale");

    if (isQuat) {
      tracks.push(track);
      continue;
    }

    if (isScale) continue; // stock scale is identity; keep our bind scales

    if (isPos) {
      const bone = name.slice(0, -".position".length).split("/").pop();
      // Root locomotion only — limb/spine translations would fight custom lengths
      if (keepRootMotion && bone === "root") {
        if (heightScale !== 1 && Number.isFinite(heightScale) && heightScale > 0) {
          const values = new Float32Array(track.values.length);
          for (let i = 0; i < track.values.length; i++) {
            values[i] = track.values[i] * heightScale;
          }
          tracks.push(new VectorKeyframeTrack(name, track.times, values));
        } else {
          tracks.push(track);
        }
      }
      continue;
    }

    // Unknown track type — keep
    tracks.push(track);
  }

  const adapted = new AnimationClip(clip.name, clip.duration, tracks);
  adapted.userData = {
    ...(clip.userData || {}),
    adaptedFrom: clip.name,
    heightScale,
    rotationOnly: true,
  };
  return adapted;
}

/**
 * Cache adapted clips per height bucket so Randomize doesn't rebuild every time.
 * @param {import('three').AnimationClip[]} sourceClips
 * @param {number} avatarHeight world Y of head top
 */
const _adaptCache = new Map();

export function getAdaptedClips(sourceClips, avatarHeight) {
  const heightScale = (avatarHeight || HUMAN_TEMPLATE_HEIGHT) / HUMAN_TEMPLATE_HEIGHT;
  const key = heightScale.toFixed(3);
  if (_adaptCache.has(key)) return _adaptCache.get(key);

  const adapted = sourceClips.map((c) => adaptClipToProportions(c, { heightScale }));
  _adaptCache.set(key, adapted);
  return adapted;
}

export function clearAdaptedClipCache() {
  _adaptCache.clear();
}

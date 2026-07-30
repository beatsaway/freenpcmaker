/**
 * Load Mesh2Motion human animation library (shared clips for all avatars).
 */
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { assetUrl } from "./assetUrl.js";

const HUMAN_ANIM_PATHS = [
  "animations/human-base-animations.glb",
  "animations/human-addon-animations.glb",
];

let _cache = null;

/**
 * @returns {Promise<import('three').AnimationClip[]>}
 */
export async function loadHumanAnimationClips() {
  if (_cache) return _cache;
  const loader = new GLTFLoader();
  const clips = [];
  for (const path of HUMAN_ANIM_PATHS) {
    const url = assetUrl(path);
    try {
      const gltf = await loader.loadAsync(url);
      for (const clip of gltf.animations || []) {
        // Avoid name collisions across files
        if (!clips.some((c) => c.name === clip.name)) clips.push(clip);
      }
    } catch (err) {
      console.warn("[animLibrary] failed to load", url, err);
    }
  }
  clips.sort((a, b) => a.name.localeCompare(b.name));
  _cache = clips;
  return clips;
}

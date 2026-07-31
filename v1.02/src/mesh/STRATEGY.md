# Avatar mesh strategy (Lathe)

## Goal

Readable stylized human **parts of revolution** — torso, limbs, skull, garments each lathed from a 2D profile. Seams between parts are intentional (no SDF soft-union).

## Method

**Profile curve → `THREE.LatheGeometry` → optional non-uniform scale → place limbs**

- Trunk / pelvis / neck: lathe around world Y, slight Z squash for depth
- Arms / legs: lathe shaft along local Y, then `placeLimb` from joint to joint (T-pose)
- Skull: unit lathe ellipsoid profile, scaled to `hw` / `hd`
- Nose / ears: short lathes rotated onto the face/temple
- Hair / hats / clothes / shoes: lathe shells sized from `humanLayout`

## Why lathe (not SDF)

- Predictable topology and UVs
- Fast to rebuild / no marching-cubes blobs
- Clear part boundaries for per-mesh `skinBone` tagging

## Skinning

Each lathe mesh sets `userData.skinBone` (hips, spine_02, neck, thigh_*, etc.). Auto-rig uses explicit single-bone weights; distance skin is fallback only.

## Separate accents

Eyes, most brows, polo/jacket buttons stay RoundedBox / Sphere primitives.

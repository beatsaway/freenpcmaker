# Avatar mesh strategy (avatarbuilder3)

## Goal

One **smooth, connected** human body shell (limbs fused into torso) — not separate tubes floating near the trunk.

## Method

**Analytic SDF → marching cubes → weld → light smooth**

Volumes (fixed human proportions):

- Trunk: elliptic cylinder along the spine (hips → neck), mild rear-hip bias
- Arms: capsules shoulder → hand (T-pose), soft-union into trunk
- Legs: capsules hip → foot, soft-union into trunk; hard-ish separation between L/R
- Small joint balls only where they help the blend (shoulders / hips)

## Why not plain tubes

Separate lofts leave gaps at armpits/hips unless you do heavy topology welding. SDF smooth-union gives one continuous surface by construction.

## Why this is safer than avatarbuilder2’s SDF

- Canonical proportions first (no extreme random thickness)
- Enforced leg/arm clearance
- Wide soft blend only limb↔torso; never soft-glue both legs together
- Weld + Laplacian after MC to kill spikes

## Separate still

- **Face / cranium**: same SDF → MC pipeline (`buildSmoothFace`) — smooth skull only
- Eyes, brows: separate accent meshes on the face plane
- **Nose / ears**: same SDF → MC pipeline (`buildSmoothFeatures`)
- **Hair**: same SDF → MC pipeline (`buildSmoothHair`) — one smooth volume per style
- **Hoodie / tops / bottoms / shoes / hats**: full SDF garments (`buildSmoothClothes`, `buildSmoothShoes`, `buildSmoothHats`)
- Small accents only where useful (polo collar contrast)

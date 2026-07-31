import * as THREE from "three";
import { resolveConfig, deepMerge } from "./AvatarConfig.js";
import { applyEyeDistanceCap } from "./faceLimits.js";
import { disposeObject3D } from "./parts/Primitives.js";
import { BodySkin } from "./parts/Body.js";
import { Head } from "./parts/Head.js";
import { Hair } from "./parts/Hair.js";
import { Hat } from "./parts/Hat.js";
import { Clothes } from "./parts/Clothes.js";
import { buildStack } from "./parts/Stack.js";

/**
 * LowPolyAvatar — THREE.Group assembled bottom-up from the stack.
 * Faces local +Z. Use facing ≈ 0 toward a +Z camera.
 */
export class LowPolyAvatar extends THREE.Group {
  /**
   * @param {object} partialConfig
   * @param {{ facing?: number, x?: number, y?: number, z?: number }} place
   */
  constructor(partialConfig = {}, place = {}) {
    super();
    this.name = "LowPolyAvatar";
    this.config = resolveConfig(partialConfig);
    this.userData.idle = { t: Math.random() * 10 };

    this.position.set(place.x ?? 0, place.y ?? 0, place.z ?? 0);
    this.rotation.y = place.facing ?? 0;
    this.scale.setScalar(this.config.scale ?? 1);

    this.rebuild();
  }

  /** Full rebuild: skin → clothes → head (hair+hat parented for idle) */
  rebuild() {
    while (this.children.length) {
      const c = this.children[0];
      this.remove(c);
      disposeObject3D(c);
    }

    const cfg = this.config;
    applyEyeDistanceCap(cfg);
    const stack = buildStack(cfg);
    this.add(BodySkin.build(cfg));
    this.add(Clothes.build(cfg));

    const head = Head.build(cfg);
    const hair = Hair.build(cfg);
    head.add(hair);
    head.add(Hat.build(cfg, { hair, headMesh: head.userData.headMesh }));
    // Nest neck under rear of skull (not through face center / chin ring)
    const headZ = stack.offsets?.HEAD_Z ?? 0.03;
    head.position.z = headZ;
    head.userData.headZ = headZ;
    this.add(head);

    this.userData.head = head;
    this.userData.stack = stack;
    this.userData.baseHeadY = 0; // head group stays at origin; parts use stack Y inside
  }

  /** Patch config and rebuild. */
  update(partial) {
    this.config = deepMerge(this.config, partial);
    if (partial.scale != null) this.scale.setScalar(this.config.scale);
    this.rebuild();
    return this;
  }

  /** Soft idle bob — whole head group (hair + hat included). */
  tick(dt = 0.016) {
    const idle = this.userData.idle;
    idle.t += dt;
    const head = this.userData.head;
    if (!head) return;
    head.rotation.y = Math.sin(idle.t * 1.15) * 0.05;
    head.position.y = Math.sin(idle.t * 2.0) * 0.006;
    head.position.z = head.userData.headZ ?? 0.03;
  }

  dispose() {
    disposeObject3D(this);
    this.clear();
  }

  /** JSON-serializable config snapshot. */
  toJSON() {
    return structuredClone(this.config);
  }
}

/**
 * PatternFactory — canvas textures (CSS-like overlays) with scale + rotation.
 */
import * as THREE from "three";
import { applyImperfectFill } from "./imperfectFill.js";

function hexToCss(hex) {
  const n = hex >>> 0;
  return `#${(n & 0xffffff).toString(16).padStart(6, "0")}`;
}

/**
 * @param {{ type, color, color2, scale, opacity, rotation }} opts
 * rotation in degrees
 */
export function createPatternTexture(opts = {}) {
  const {
    type = "solid",
    color = 0x3d8f6e,
    color2 = 0xffffff,
    scale = 1,
    opacity = 0.85,
    rotation = 0,
    size = 128,
  } = opts;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const c1 = hexToCss(color);
  const c2 = hexToCss(color2);
  const step = Math.max(3, Math.round(14 / Math.max(0.3, scale)));

  ctx.fillStyle = c1;
  ctx.fillRect(0, 0, size, size);

  if (type === "solid") {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(((rotation % 360) * Math.PI) / 180);
  ctx.translate(-size / 2, -size / 2);
  // draw oversized so rotation doesn’t leave empty corners
  const pad = size;
  ctx.translate(-pad / 2, -pad / 2);
  const W = size + pad;
  const H = size + pad;

  ctx.globalAlpha = opacity;
  ctx.fillStyle = c2;
  ctx.strokeStyle = c2;
  ctx.lineWidth = Math.max(1, step * 0.28);

  switch (type) {
    case "stripes":
    case "stripes-h":
      for (let y = 0; y < H; y += step) ctx.fillRect(0, y, W, step * 0.45);
      break;
    case "stripes-v":
      for (let x = 0; x < W; x += step) ctx.fillRect(x, 0, step * 0.45, H);
      break;
    case "stripes-thin":
      for (let y = 0; y < H; y += step) ctx.fillRect(0, y, W, Math.max(1, step * 0.2));
      break;
    case "dots":
      for (let y = step / 2; y < H; y += step) {
        for (let x = step / 2; x < W; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, step * 0.22, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    case "polka":
      for (let y = step / 2; y < H; y += step * 1.4) {
        for (let x = step / 2; x < W; x += step * 1.4) {
          ctx.beginPath();
          ctx.arc(x, y, step * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    case "checkers":
      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          if ((x / step + y / step) % 2 === 0) ctx.fillRect(x, y, step, step);
        }
      }
      break;
    case "grid":
      for (let i = 0; i <= W; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i, H);
        ctx.moveTo(0, i); ctx.lineTo(W, i);
        ctx.stroke();
      }
      break;
    case "crosshatch":
      for (let i = -H; i < W + H; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i + H, H);
        ctx.moveTo(i, H); ctx.lineTo(i + H, 0);
        ctx.stroke();
      }
      break;
    case "diagonal":
      for (let i = -H; i < W + H; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + H, H);
        ctx.stroke();
      }
      break;
    case "chevron":
      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step * 2) {
          ctx.beginPath();
          ctx.moveTo(x, y + step);
          ctx.lineTo(x + step, y);
          ctx.lineTo(x + step * 2, y + step);
          ctx.stroke();
        }
      }
      break;
    case "zigzag":
      for (let y = step; y < H; y += step) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += step) {
          const yy = y + ((x / step) % 2 === 0 ? 0 : -step * 0.6);
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      break;
    case "diamonds":
      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          const cx = x + step / 2;
          const cy = y + step / 2;
          const r = step * 0.35;
          ctx.beginPath();
          ctx.moveTo(cx, cy - r);
          ctx.lineTo(cx + r, cy);
          ctx.lineTo(cx, cy + r);
          ctx.lineTo(cx - r, cy);
          ctx.closePath();
          ctx.fill();
        }
      }
      break;
    case "triangles":
      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          ctx.beginPath();
          ctx.moveTo(x + step / 2, y + 2);
          ctx.lineTo(x + step - 2, y + step - 2);
          ctx.lineTo(x + 2, y + step - 2);
          ctx.closePath();
          ctx.fill();
        }
      }
      break;
    case "waves":
      for (let y = step; y < H; y += step) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 4) {
          const yy = y + Math.sin(x * 0.08 * scale) * (step * 0.35);
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      break;
    case "speckles": {
      // deterministic pseudo-random from color/scale so rebuilds match
      let seed = ((color >>> 0) ^ ((color2 >>> 0) * 31) ^ Math.round(scale * 1000)) >>> 0;
      const pr = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      for (let i = 0; i < 180 * scale; i++) {
        const x = pr() * W;
        const y = pr() * H;
        ctx.beginPath();
        ctx.arc(x, y, 0.8 + pr() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "argyle":
      for (let i = -H; i < W + H; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i + H, H);
        ctx.moveTo(i, H); ctx.lineTo(i + H, 0);
        ctx.stroke();
      }
      for (let y = step / 2; y < H; y += step * 2) {
        for (let x = step / 2; x < W; x += step * 2) {
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    case "herringbone": {
      const h = step;
      for (let y = 0; y < H; y += h) {
        const flip = Math.floor(y / h) % 2;
        for (let x = -h; x < W + h; x += h) {
          ctx.beginPath();
          if (flip) {
            ctx.moveTo(x, y);
            ctx.lineTo(x + h * 0.5, y + h);
            ctx.lineTo(x + h, y);
          } else {
            ctx.moveTo(x + h * 0.5, y);
            ctx.lineTo(x, y + h);
            ctx.lineTo(x + h, y + h);
          }
          ctx.stroke();
        }
      }
      break;
    }
    case "plaid":
      for (let y = 0; y < H; y += step) ctx.fillRect(0, y, W, step * 0.25);
      ctx.globalAlpha = opacity * 0.7;
      for (let x = 0; x < W; x += step) ctx.fillRect(x, 0, step * 0.25, H);
      break;
    case "bricks": {
      const bh = step;
      const bw = step * 1.8;
      for (let row = 0, y = 0; y < H; y += bh, row++) {
        const ox = row % 2 ? bw * 0.5 : 0;
        for (let x = -bw; x < W + bw; x += bw) {
          ctx.strokeRect(x + ox, y, bw - 1, bh - 1);
        }
      }
      break;
    }
    case "stars":
      for (let y = step; y < H; y += step * 1.5) {
        for (let x = step; x < W; x += step * 1.5) {
          const r = step * 0.28;
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
            const px = x + Math.cos(a) * r;
            const py = y + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        }
      }
      break;
    case "rings":
      for (let y = step; y < H; y += step * 1.3) {
        for (let x = step; x < W; x += step * 1.3) {
          ctx.beginPath();
          ctx.arc(x, y, step * 0.32, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      break;
    default:
      break;
  }

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Cloth / shoe material — flat color with imperfect hand-paint fill. */
export function clothMaterial(color, pattern = {}) {
  const type = pattern.type || "solid";
  if (type === "solid") {
    return applyImperfectFill(new THREE.MeshBasicMaterial({ color }));
  }
  const map = createPatternTexture({
    type,
    color,
    color2: pattern.color2 ?? 0xffffff,
    scale: pattern.scale ?? 1,
    opacity: pattern.opacity ?? 0.75,
    rotation: pattern.rotation ?? 0,
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return applyImperfectFill(
    new THREE.MeshBasicMaterial({
      map,
      color: 0xffffff,
    })
  );
}

export function skinMaterial(hex) {
  return applyImperfectFill(new THREE.MeshBasicMaterial({ color: hex }));
}

export function basicMat(hex, _rough = 0.55) {
  return applyImperfectFill(new THREE.MeshBasicMaterial({ color: hex }));
}

/**
 * Compact avatar code — comma-separated groups (no keywords).
 *
 * Example:
 *   1,edc9a8,1 1 1 1 1 1 1,1 1 1 1,0 2a3a4a 1,0,0,0,3 3a2a1a,0 3d8f6e,0 3d8f6e 0 3,0 3a4550,0 2a2a32,Idle,50,Idle|Walk
 *
 * Groups (in order):
 *   body, skin, prop×7, face×6, eyes, brows, nose, ears, hair, hat, top, bot, shoe [, play] [, speed%] [, pack]
 *
 * Also accepts the older keyword form (body: 1 …) for pastes.
 * Older compact codes without a speed group still decode (pack stays after play).
 */
import {
  BODY_SHAPES,
  EYE_STYLES,
  EYE_PUPIL_STYLES,
  BROW_STYLES,
  NOSE_STYLES,
  EAR_STYLES,
  HAIR_STYLES,
  HAT_STYLES,
  TOP_STYLES,
  BOTTOM_STYLES,
  SHOE_STYLES,
  PATTERN_TYPES,
  resolveConfig,
} from "./AvatarConfig.js";

export const LOOK_CODE_VERSION = "AV3";

function idx(list, value, fallback = 0) {
  const i = list.indexOf(value);
  return i >= 0 ? i : fallback;
}

function pick(list, i, fallback = list[0]) {
  const n = Math.round(Number(i));
  if (!Number.isFinite(n)) return fallback;
  return list[((n % list.length) + list.length) % list.length] ?? fallback;
}

function hex6(n) {
  const v = (Number(n) >>> 0) & 0xffffff;
  return v.toString(16).padStart(6, "0");
}

function parseHex(tok) {
  if (tok == null) return undefined;
  const s = String(tok).replace(/^#/, "").trim();
  if (!/^[0-9a-fA-F]{3,8}$/.test(s)) return undefined;
  if (s.length === 3) {
    return parseInt(s[0] + s[0] + s[1] + s[1] + s[2] + s[2], 16);
  }
  return parseInt(s.slice(0, 6), 16);
}

function num(tok, fallback) {
  const v = Number(tok);
  return Number.isFinite(v) ? v : fallback;
}

function f2(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  const s = v.toFixed(2);
  return s.replace(/\.?0+$/, "") || "0";
}

function toks(group) {
  return String(group || "")
    .trim()
    .split(/[\s]+/)
    .filter(Boolean);
}

/**
 * Encode config (+ optional animation) to compact comma-chain code.
 * @param {object} cfg
 * @param {{ play?: string, pack?: string[], speed?: number }} [anim]
 *   speed is playback rate (1 = 100%). Encoded as integer percent when present.
 * @returns {string}
 */
export function encodeLookCode(cfg = {}, anim = {}) {
  const c = resolveConfig(cfg);
  const topPat = c.clothes?.top?.pattern?.type ?? "solid";
  const groups = [
    String(idx(BODY_SHAPES, c.bodyShape)),
    hex6(c.skinTone),
    [c.height?.leg, c.height?.torso, c.height?.neck, c.height?.head, c.body?.armThick, c.body?.legThick, c.body?.hipThick].map(f2).join(" "),
    [c.face?.eyeDistance, c.face?.roundness, c.face?.length, c.face?.width, c.face?.eyeDrop, c.face?.noseDrop, c.face?.mouthDrop].map(f2).join(" "),
    `${idx(EYE_STYLES, c.eyes?.whiteStyle || c.eyes?.style)} ${idx(EYE_PUPIL_STYLES, c.eyes?.pupilStyle || "circle")} ${hex6(c.eyes?.color)} ${f2(c.eyes?.scale)} ${f2(c.eyes?.pupilScale ?? 0.55)} ${f2(c.eyes?.pupilX ?? 0)} ${f2(c.eyes?.pupilY ?? 0)}`,
    String(idx(BROW_STYLES, c.brows?.style)),
    `${idx(NOSE_STYLES, c.nose?.style)} ${f2(c.nose?.width ?? 0.9)} ${f2(c.nose?.scale ?? 0.78)}`,
    String(idx(EAR_STYLES, c.ears?.style)),
    `${idx(HAIR_STYLES, c.hair?.style)} ${hex6(c.hair?.color)}`,
    `${idx(HAT_STYLES, c.hat?.style)} ${hex6(c.hat?.color)}`,
    `${idx(TOP_STYLES, c.clothes?.top?.style)} ${hex6(c.clothes?.top?.color)} ${idx(PATTERN_TYPES, topPat)} ${Math.min(5, Math.max(2, Math.round(c.clothes?.top?.buttons ?? 3)))} ${f2(c.clothes?.top?.buttonSize ?? 1.4)} ${hex6(c.clothes?.top?.buttonColor ?? 0x222222)}`,
    `${idx(BOTTOM_STYLES, c.clothes?.bottom?.style)} ${hex6(c.clothes?.bottom?.color)}`,
    `${idx(SHOE_STYLES, c.clothes?.shoes?.style)} ${hex6(c.clothes?.shoes?.color)}`,
  ];
  if (anim.play) groups.push(String(anim.play).replace(/,/g, " "));
  if (anim.speed != null && Number.isFinite(Number(anim.speed))) {
    // Always emit play before speed so decode order stays stable
    if (!anim.play) groups.push("");
    groups.push(String(Math.round(Math.max(0, Number(anim.speed) * 100))));
  }
  if (anim.pack?.length) groups.push(anim.pack.map((n) => String(n).replace(/\|/g, " ")).join("|"));
  return groups.join(",");
}

function partialFromMap(map, anim) {
  const partial = {};

  if (map.body) partial.bodyShape = pick(BODY_SHAPES, map.body[0]);
  if (map.skin) {
    const h = parseHex(map.skin[0]);
    if (h != null) partial.skinTone = h;
  }

  if (map.prop) {
    const p = map.prop;
    partial.height = {
      leg: num(p[0], 1),
      torso: num(p[1], 1),
      neck: num(p[2], 1),
      head: num(p[3], 1),
    };
    partial.body = {
      armThick: num(p[4], 1),
      legThick: num(p[5], 1),
      hipThick: num(p[6], 1),
    };
  }

  if (map.face) {
    const f = map.face;
    partial.face = {
      eyeDistance: num(f[0], 1),
      roundness: num(f[1], 1),
      length: num(f[2], 1),
      width: num(f[3], 0.92),
      eyeDrop: num(f[4], 0.5),
      noseDrop: num(f[5], 0.5),
      mouthDrop: num(f[6], 0.5),
    };
  }

  if (map.eyes) {
    const e = map.eyes;
    // New: white pupil color scale pupilScale pupilX pupilY
    // Old: style color scale pupilScale pupilX pupilY  (e[1] is hex)
    const secondIsHex = e[1] != null && /^[0-9a-fA-F]{3,8}$/i.test(String(e[1]).replace(/^#/, ""));
    if (secondIsHex) {
      const white = pick(EYE_STYLES, e[0]);
      partial.eyes = {
        style: white,
        whiteStyle: white,
        pupilStyle: "circle",
        color: parseHex(e[1]) ?? 0x2a3a4a,
        scale: num(e[2], 1),
        pupilScale: num(e[3], 0.55),
        pupilX: num(e[4], 0),
        pupilY: num(e[5], 0),
      };
    } else {
      const white = pick(EYE_STYLES, e[0]);
      partial.eyes = {
        style: white,
        whiteStyle: white,
        pupilStyle: pick(EYE_PUPIL_STYLES, e[1], "circle"),
        color: parseHex(e[2]) ?? 0x2a3a4a,
        scale: num(e[3], 1),
        pupilScale: num(e[4], 0.55),
        pupilX: num(e[5], 0),
        pupilY: num(e[6], 0),
      };
    }
  }

  if (map.brows) partial.brows = { style: pick(BROW_STYLES, map.brows[0]), scale: 1 };
  if (map.nose) {
    const n = map.nose;
    partial.nose = {
      style: pick(NOSE_STYLES, n[0]),
      width: num(n[1], 0.9),
      scale: num(n[2], 0.78),
    };
  }
  if (map.ears) partial.ears = { style: pick(EAR_STYLES, map.ears[0]), scale: 1 };

  if (map.hair) {
    partial.hair = {
      style: pick(HAIR_STYLES, map.hair[0]),
      color: parseHex(map.hair[1]) ?? 0x3a2a1a,
    };
  }

  if (map.hat) {
    partial.hat = {
      style: pick(HAT_STYLES, map.hat[0]),
      color: parseHex(map.hat[1]) ?? 0x3d8f6e,
    };
  }

  if (map.top) {
    const t = map.top;
    partial.clothes = partial.clothes || {};
    partial.clothes.top = {
      style: pick(TOP_STYLES, t[0]),
      color: parseHex(t[1]) ?? 0x3d8f6e,
      pattern: {
        type: pick(PATTERN_TYPES, t[2], "solid"),
        color2: 0xffffff,
        scale: 1,
        rotation: 0,
        opacity: 0.85,
      },
      buttons: Math.min(5, Math.max(2, Math.round(num(t[3], 3)))),
      buttonSize: Math.min(2.4, Math.max(0.8, num(t[4], 1.4))),
      buttonColor: parseHex(t[5]) ?? 0x222222,
    };
  }

  if (map.bot) {
    partial.clothes = partial.clothes || {};
    partial.clothes.bottom = {
      style: pick(BOTTOM_STYLES, map.bot[0]),
      color: parseHex(map.bot[1]) ?? 0x3a4550,
      pattern: { type: "solid", color2: 0x555555, scale: 1, rotation: 0, opacity: 0.85 },
    };
  }

  if (map.shoe) {
    partial.clothes = partial.clothes || {};
    partial.clothes.shoes = {
      style: pick(SHOE_STYLES, map.shoe[0]),
      color: parseHex(map.shoe[1]) ?? 0x2a2a32,
      pattern: { type: "solid", color2: 0x555555, scale: 1, rotation: 0, opacity: 0.85 },
    };
  }

  return { ok: true, partial, anim: anim || {} };
}

function decodeKeywordForm(text) {
  const raw = String(text).replace(/\r/g, "\n").replace(/;/g, "\n");
  const map = Object.create(null);
  const anim = {};

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (/^AV\d+$/i.test(trimmed)) continue;
    const m = trimmed.match(/^([a-zA-Z]+)\s*:?\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const rest = m[2].trim();
    if (key === "play") {
      if (rest) anim.play = rest;
      continue;
    }
    if (key === "speed" || key === "spd") {
      const pct = Number(rest);
      if (Number.isFinite(pct)) anim.speed = Math.max(0, pct / 100);
      continue;
    }
    if (key === "pack") {
      anim.pack = rest.split("|").map((s) => s.trim()).filter(Boolean);
      continue;
    }
    map[key] = toks(rest);
  }

  if (!Object.keys(map).length && !anim.play && !anim.pack?.length) {
    return { ok: false, error: "No look data found" };
  }
  return partialFromMap(map, anim);
}

function decodeCompactForm(text) {
  let raw = String(text).trim().replace(/\r?\n/g, " ").replace(/\s+,/g, ",").replace(/,\s+/g, ",");
  raw = raw.replace(/^AV\d+\s*/i, "");
  const groups = raw.split(",").map((g) => g.trim());
  if (groups.length < 13) {
    return { ok: false, error: "Code too short — need at least 13 groups" };
  }

  const map = {
    body: toks(groups[0]),
    skin: toks(groups[1]),
    prop: toks(groups[2]),
    face: toks(groups[3]),
    eyes: toks(groups[4]),
    brows: toks(groups[5]),
    nose: toks(groups[6]),
    ears: toks(groups[7]),
    hair: toks(groups[8]),
    hat: toks(groups[9]),
    top: toks(groups[10]),
    bot: toks(groups[11]),
    shoe: toks(groups[12]),
  };
  const anim = {};
  if (groups[13]) anim.play = groups[13];
  // Optional speed% group (pure number). Older codes put pack directly after play.
  let packIdx = 14;
  if (groups[14] != null && groups[14] !== "" && /^\d+(\.\d+)?$/.test(groups[14].trim())) {
    anim.speed = Math.max(0, Number(groups[14]) / 100);
    packIdx = 15;
  }
  if (groups[packIdx]) anim.pack = groups[packIdx].split("|").map((s) => s.trim()).filter(Boolean);

  return partialFromMap(map, anim);
}

/**
 * Decode compact or legacy keyword code.
 * @param {string} text
 * @returns {{ ok: true, partial: object, anim: { play?: string, pack?: string[], speed?: number } } | { ok: false, error: string }}
 */
export function decodeLookCode(text) {
  if (text == null || !String(text).trim()) {
    return { ok: false, error: "Empty code" };
  }
  const s = String(text).trim();
  // Keyword form if it has labeled rows like "body:" / "prop:"
  if (/^(?:AV\d+\s*)?(?:body|skin|prop|face)\s*:/im.test(s) || /\n\s*(?:body|skin|prop)\s*:/i.test(s)) {
    return decodeKeywordForm(s);
  }
  return decodeCompactForm(s);
}

/** Decode then resolve into a full config (+ anim). */
export function applyLookCode(text) {
  const decoded = decodeLookCode(text);
  if (!decoded.ok) return decoded;
  return {
    ok: true,
    config: resolveConfig(decoded.partial),
    anim: decoded.anim || {},
  };
}

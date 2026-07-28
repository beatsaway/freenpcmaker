/**
 * Free NPC Maker demo — T-pose auto-rig + Mesh2Motion human animation dropdown.
 * ✦ on a setting = included when Randomize is pressed; ✦ off = keep current value.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SkeletonHelper } from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  AvatarBuilder,
  autoRigAvatar,
  loadHumanAnimationClips,
  getAdaptedClips,
  randomConfig,
  resolveConfig,
  PRESETS,
  maxEyeScaleForDistance,
  clampEyeScale,
  clampEyeDistance,
  maxEyeDistanceForWidth,
  applyEyeDistanceCap,
  skullSize,
  encodeLookCode,
  applyLookCode,
  EYE_SCALE_MIN,
  EYE_DISTANCE_MIN,
  HEAD_SCALE_MIN,
  HEAD_SCALE_MAX,
} from "../src/index.js";

const lookCodeEl = document.getElementById("look-code");
const btnLookCopy = document.getElementById("btn-look-copy");
const btnLookApply = document.getElementById("btn-look-apply");
const randLookMod = document.getElementById("rand-look-mod");
const randAnimMod = document.getElementById("rand-anim-mod");
const currentClipCheck = document.getElementById("current-clip-check");
const currentClipNameEl = document.getElementById("current-clip-name");
const exportCountEl = document.getElementById("export-count");
const btnExport = document.getElementById("btn-export");
const btnExportMesh = document.getElementById("btn-export-mesh");
const btnExportAll = document.getElementById("btn-export-all");
const btnExportNone = document.getElementById("btn-export-none");
const downloadLink = document.getElementById("download-link");
const animFilter = document.getElementById("anim-filter");
const animClipsEl = document.getElementById("anim-clips");
const btnPlay = document.getElementById("btn-play");
const btnRandom = document.getElementById("btn-random");
const controlsEl = document.getElementById("controls");
const statusEl = document.getElementById("status");
const canvas = document.getElementById("c");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 40);
camera.position.set(2.2, 1.5, 2.6);

const orbit = new OrbitControls(camera, canvas);
orbit.target.set(0, 1.0, 0);
orbit.enableDamping = true;
orbit.autoRotate = true;
orbit.autoRotateSpeed = 1.2;
const ORBIT_SPEED_FRONT = 0.85; // facing NPC front (+Z)
const ORBIT_SPEED_BACK = 5.5; // facing NPC back — whip around

// Cinematic three-point: dim fill, warm key, cool rim
scene.add(new THREE.AmbientLight(0xffffff, 0.18));
const hemi = new THREE.HemisphereLight(0xffe8d6, 0x1a2030, 0.35);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xfff0dd, 1.55);
key.position.set(3.2, 5.5, 2.4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 22;
key.shadow.camera.left = -4;
key.shadow.camera.right = 4;
key.shadow.camera.top = 5;
key.shadow.camera.bottom = -1;
key.shadow.bias = -0.00015;
key.shadow.normalBias = 0.035;
scene.add(key);

const fill = new THREE.DirectionalLight(0x9bb6ff, 0.28);
fill.position.set(-3.5, 2.2, 1.5);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xb8d4ff, 0.75);
rim.position.set(-1.5, 3.5, -4);
scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(4.5, 64),
  new THREE.MeshStandardMaterial({
    color: 0x0a0a0c,
    roughness: 0.18,
    metalness: 0.72,
    envMapIntensity: 1.1,
  })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const clock = new THREE.Clock();
const presetNames = Object.keys(PRESETS);
const startPreset = presetNames[Math.floor(Math.random() * presetNames.length)] || "jordan";
let currentConfig = resolveConfig(PRESETS[startPreset]);
let rigged = null;
let mixer = null;
let sourceClips = [];
let adaptedClips = [];
let action = null;
let playing = true;
let skeletonHelper = null;
let busy = false;
/** Currently previewing clip name */
let currentClipName = "";
/** @type {string|null|undefined} undefined = keep select; 'random' = pick random clip */
let pendingAnimPrefer;

/** ✦ on (true) = included in Randomize. Missing keys default to on. */
const randomLocks = Object.create(null);
/** Clip names checked for GLB export package. */
const exportSelected = new Set();
let exporting = false;

const catalog = AvatarBuilder.catalog();

const RANDOM_PATHS = [
  "bodyShape",
  "skinTone",
  "height.leg",
  "height.torso",
  "height.neck",
  "height.head",
  "body.armThick",
  "body.legThick",
  "body.hipThick",
  "face.eyeDistance",
  "face.roundness",
  "face.length",
  "face.width",
  "eyes.style",
  "eyes.color",
  "eyes.scale",
  "brows.style",
  "nose.style",
  "ears.style",
  "hair.style",
  "hair.color",
  "hat.style",
  "hat.color",
  "clothes.top.style",
  "clothes.top.color",
  "clothes.top.pattern",
  "clothes.top.buttons",
  "clothes.bottom.style",
  "clothes.bottom.color",
  "clothes.shoes.style",
  "clothes.shoes.color",
];

function setStatus(msg) {
  statusEl.textContent = msg;
}

function hexCss(n) {
  return `#${(n >>> 0).toString(16).padStart(6, "0")}`;
}
function parseHex(css) {
  return parseInt(css.replace("#", ""), 16);
}

function dumpLookCode() {
  if (!lookCodeEl) return;
  // Don't clobber while the user is editing
  if (document.activeElement === lookCodeEl) return;
  lookCodeEl.value = encodeLookCode(currentConfig, {
    play: currentClipName || undefined,
    pack: [...exportSelected],
  });
}

function isRandOn(key) {
  return randomLocks[key] !== false;
}

function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setPath(obj, path, val) {
  const parts = path.split(".");
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (o[k] == null || typeof o[k] !== "object") o[k] = {};
    o = o[k];
  }
  o[parts[parts.length - 1]] = val;
}

function syncStarButton(btn, key) {
  const on = isRandOn(key);
  btn.classList.toggle("on", on);
  const label =
    key === "module.look"
      ? on
        ? "Look included in Randomize"
        : "Look locked — skip on Randomize"
      : key === "module.anim"
        ? on
          ? "Animation included in Randomize"
          : "Animation locked — skip on Randomize"
        : on
          ? "Included in Randomize"
          : "Locked — skip on Randomize";
  btn.title = label;
  btn.setAttribute("aria-pressed", on ? "true" : "false");
}

function syncModulePanes() {
  document.getElementById("pane-look")?.classList.toggle("module-rand-off", !isRandOn("module.look"));
  document.getElementById("pane-anim")?.classList.toggle("module-rand-off", !isRandOn("module.anim"));
}

function makeStar(key) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "rand-star";
  btn.textContent = "✦";
  btn.setAttribute("aria-label", `Toggle randomize for ${key}`);
  syncStarButton(btn, key);
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    randomLocks[key] = !isRandOn(key);
    syncStarButton(btn, key);
    btn.closest(".field")?.classList.toggle("rand-off", !isRandOn(key));
  });
  return btn;
}

function labelWithStar(text, randKey) {
  const lab = document.createElement("label");
  if (randKey) lab.append(makeStar(randKey));
  const span = document.createElement("span");
  span.className = "lab-text";
  span.textContent = text;
  lab.append(span);
  return { lab, span };
}

/** Merge a full randomConfig into base, only overwriting ✦-on paths (and only if Look module is on). */
function mergeRandomLocked(base, full) {
  const out = structuredClone(base);
  if (!isRandOn("module.look")) return resolveConfig(out);
  for (const path of RANDOM_PATHS) {
    if (!isRandOn(path)) continue;
    const v = getPath(full, path);
    if (v !== undefined) setPath(out, path, structuredClone(v));
  }
  return resolveConfig(out);
}

function clearRigged() {
  if (rigged?.group) scene.remove(rigged.group);
  if (skeletonHelper) {
    scene.remove(skeletonHelper);
    skeletonHelper = null;
  }
  mixer = null;
  action = null;
  rigged = null;
}

function forEachNpcMaterial(root, fn) {
  root?.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) if (m) fn(m);
  });
}

function setNpcOpacity(root, opacity) {
  forEachNpcMaterial(root, (m) => {
    m.transparent = true;
    m.opacity = opacity;
    m.depthWrite = opacity > 0.92;
    m.needsUpdate = true;
  });
}

function tweenNpcOpacity(root, from, to, ms) {
  return new Promise((resolve) => {
    if (!root) {
      resolve();
      return;
    }
    if (prefersReducedMotion || ms <= 0) {
      setNpcOpacity(root, to);
      resolve();
      return;
    }
    const t0 = performance.now();
    function step(now) {
      const t = Math.min(1, (now - t0) / ms);
      const e = t * t * (3 - 2 * t);
      setNpcOpacity(root, from + (to - from) * e);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}

function populateAnimSelect(preferName) {
  if (!adaptedClips.length) {
    currentClipName = "";
    refreshAnimClipList();
    return;
  }
  if (preferName === "random" && adaptedClips.length) {
    currentClipName = adaptedClips[Math.floor(Math.random() * adaptedClips.length)].name;
  } else if (preferName && adaptedClips.some((c) => c.name === preferName)) {
    currentClipName = preferName;
  } else if (currentClipName && adaptedClips.some((c) => c.name === currentClipName)) {
    // keep
  } else {
    const prefer = adaptedClips.find((c) => /idle|walk|run/i.test(c.name)) || adaptedClips[0];
    currentClipName = prefer.name;
  }
  refreshAnimClipList();
}

function updateExportCount() {
  const n = exportSelected.size;
  exportCountEl.textContent = `${n}`;
  // Allow click even with 0 checked — we'll offer the currently viewed clip
  btnExport.disabled = !rigged || exporting;
  btnExport.title = n
    ? `Download with ${n} animation${n === 1 ? "" : "s"}`
    : currentClipName
      ? `No clips checked — will offer “${currentClipName}”`
      : "Check clips to include in download";
  if (btnExportMesh) {
    btnExportMesh.disabled = !rigged || exporting;
    btnExportMesh.title = "Download this avatar mesh with rig, but no animation";
  }
  syncCurrentClipRow();
}

function syncCurrentClipRow() {
  if (currentClipNameEl) {
    currentClipNameEl.textContent = currentClipName || "—";
    currentClipNameEl.title = currentClipName || "";
  }
  if (currentClipCheck) {
    currentClipCheck.disabled = !currentClipName;
    currentClipCheck.checked = !!(currentClipName && exportSelected.has(currentClipName));
  }
}

function refreshAnimClipList() {
  const filter = (animFilter?.value || "").trim().toLowerCase();
  animClipsEl.innerHTML = "";
  if (!adaptedClips.length) {
    animClipsEl.innerHTML = `<div class="clip-row"><span class="name">No clips loaded</span></div>`;
    updateExportCount();
    return;
  }

  const names = new Set(adaptedClips.map((c) => c.name));
  for (const n of [...exportSelected]) {
    if (!names.has(n)) exportSelected.delete(n);
  }

  for (const clip of adaptedClips) {
    if (filter && !clip.name.toLowerCase().includes(filter)) continue;
    const row = document.createElement("div");
    row.className = "clip-row" + (currentClipName === clip.name ? " active" : "");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.title = "Include in GLB export";
    cb.checked = exportSelected.has(clip.name);
    cb.addEventListener("click", (e) => e.stopPropagation());
    cb.addEventListener("change", () => {
      if (cb.checked) exportSelected.add(clip.name);
      else exportSelected.delete(clip.name);
      updateExportCount();
    });

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = clip.name;
    name.title = "Click to preview";

    row.append(cb, name);
    row.addEventListener("click", (e) => {
      if (e.target === cb) return;
      currentClipName = clip.name;
      playing = true;
      playSelected();
      refreshAnimClipList();
    });
    animClipsEl.appendChild(row);
  }
  updateExportCount();
}

function saveArrayBuffer(buffer, filename) {
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  downloadLink.href = url;
  downloadLink.download = filename;
  downloadLink.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * @param {{ withAnims?: boolean }} [opts]
 * withAnims true → checked clips; false → mesh + rig only
 */
async function exportGlbPackage(opts = {}) {
  const withAnims = opts.withAnims !== false;
  if (!rigged?.group || exporting) return;

  const clips = withAnims
    ? adaptedClips
        .filter((c) => exportSelected.has(c.name))
        .map((c) => {
          const cl = c.clone();
          cl.name = String(cl.name).replace(/\s+/g, "_");
          return cl;
        })
    : [];

  if (withAnims && !clips.length) {
    if (!currentClipName) {
      setStatus("No animation selected to download");
      return;
    }
    const ok = window.confirm(
      `No clips are checked.\n\nDownload with the currently viewed animation “${currentClipName}”?`
    );
    if (!ok) return;
    const src = adaptedClips.find((c) => c.name === currentClipName);
    if (!src) {
      setStatus("Current clip not found");
      return;
    }
    const cl = src.clone();
    cl.name = String(cl.name).replace(/\s+/g, "_");
    clips.push(cl);
  }

  exporting = true;
  btnExport.disabled = true;
  if (btnExportMesh) btnExportMesh.disabled = true;
  setStatus(
    withAnims
      ? `Exporting GLB · ${clips.length} clip${clips.length === 1 ? "" : "s"}…`
      : "Exporting rigged mesh (no animations)…"
  );

  const wasPlaying = playing;
  if (mixer) mixer.stopAllAction();
  if (rigged.skeleton?.pose) rigged.skeleton.pose();
  rigged.group.updateMatrixWorld(true);

  const group = rigged.group;
  const parent = group.parent;
  const exportScene = new THREE.Scene();
  exportScene.add(group);

  try {
    const exporter = new GLTFExporter();
    const exportOpts = { binary: true, onlyVisible: false, embedImages: true };
    if (clips.length) exportOpts.animations = clips;
    const result = await new Promise((resolve, reject) => {
      exporter.parse(exportScene, resolve, reject, exportOpts);
    });
    if (!(result instanceof ArrayBuffer)) throw new Error("Export did not return binary GLB");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const filename = withAnims ? `avatar-${stamp}.glb` : `avatar-mesh-${stamp}.glb`;
    saveArrayBuffer(result, filename);
    setStatus(
      withAnims
        ? `Downloaded ${filename} · ${clips.length} animations`
        : `Downloaded ${filename} · mesh + rig only`
    );
  } catch (err) {
    console.error(err);
    setStatus(`Export failed: ${err.message || err}`);
  } finally {
    if (parent) parent.add(group);
    else scene.add(group);
    exporting = false;
    updateExportCount();
    if (wasPlaying) {
      playing = true;
      playSelected();
    } else {
      playSelected();
      if (action) {
        playing = false;
        action.paused = true;
        syncPlayButton();
      }
    }
  }
}

function syncPlayButton() {
  btnPlay.textContent = playing ? "■" : "▶";
  btnPlay.title = playing ? "Pause" : "Play";
  btnPlay.setAttribute("aria-label", playing ? "Pause" : "Play");
}

function playSelected() {
  if (!mixer || !adaptedClips.length) return;
  const clip = adaptedClips.find((c) => c.name === currentClipName) || adaptedClips[0];
  if (!clip) return;
  currentClipName = clip.name;
  mixer.stopAllAction();
  action = mixer.clipAction(clip);
  action.reset();
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.paused = !playing;
  action.play();
  syncPlayButton();
  syncCurrentClipRow();
}

async function rebuildRigged() {
  if (busy) return;
  busy = true;
  setStatus("Fitting skeleton to this body build…");
  btnRandom.disabled = true;
  const prevAnim = pendingAnimPrefer !== undefined ? pendingAnimPrefer : currentClipName;
  pendingAnimPrefer = undefined;
  try {
    applyEyeDistanceCap(currentConfig);
    buildLookControls();
    clearRigged();
    const result = await autoRigAvatar(currentConfig);
    rigged = result;
    scene.add(result.group);

    skeletonHelper = new SkeletonHelper(result.group);
    skeletonHelper.visible = false;
    scene.add(skeletonHelper);

    adaptedClips = getAdaptedClips(sourceClips, result.meta?.totalHeight);
    mixer = new THREE.AnimationMixer(result.group);
    populateAnimSelect(prevAnim);
    playSelected();
    dumpLookCode();
    updateExportCount();
    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus(`Rig failed: ${err.message || err}`);
  } finally {
    busy = false;
    btnRandom.disabled = false;
  }
}

function section(title) {
  const d = document.createElement("div");
  d.className = "field section";
  d.textContent = title;
  controlsEl.appendChild(d);
}

function selectField(label, options, get, set, randKey) {
  const wrap = document.createElement("div");
  wrap.className = "field";
  if (randKey && !isRandOn(randKey)) wrap.classList.add("rand-off");
  const { lab } = labelWithStar(label, randKey);
  const sel = document.createElement("select");
  options.forEach((v) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    sel.appendChild(o);
  });
  sel.value = get();
  sel.addEventListener("change", () => {
    set(sel.value);
    rebuildRigged();
  });
  wrap.append(lab, sel);
  controlsEl.appendChild(wrap);
}

function colorField(label, get, set, randKey) {
  const wrap = document.createElement("div");
  wrap.className = "field";
  if (randKey && !isRandOn(randKey)) wrap.classList.add("rand-off");
  const { lab } = labelWithStar(label, randKey);
  const inp = document.createElement("input");
  inp.type = "color";
  inp.value = hexCss(get());
  inp.addEventListener("change", () => {
    set(parseHex(inp.value));
    rebuildRigged();
  });
  wrap.append(lab, inp);
  controlsEl.appendChild(wrap);
}

function rangeField(label, min, max, step, get, set, randKey, onLive) {
  const wrap = document.createElement("div");
  wrap.className = "field";
  if (randKey && !isRandOn(randKey)) wrap.classList.add("rand-off");
  const { lab, span } = labelWithStar(`${label} ${Number(get()).toFixed(2)}`, randKey);
  const inp = document.createElement("input");
  inp.type = "range";
  inp.min = String(min);
  inp.max = String(max);
  inp.step = String(step);
  inp.value = String(get());
  inp.addEventListener("input", () => {
    span.textContent = `${label} ${Number(inp.value).toFixed(2)}`;
    if (onLive) onLive(Number(inp.value));
  });
  inp.addEventListener("change", () => {
    set(Number(inp.value));
    rebuildRigged();
  });
  wrap.append(lab, inp);
  controlsEl.appendChild(wrap);
}

function ensureClothes() {
  if (!currentConfig.clothes) currentConfig.clothes = {};
  if (!currentConfig.clothes.top) {
    currentConfig.clothes.top = { style: "tee", color: 0x3d8f6e, pattern: { type: "solid", color2: 0xffffff, scale: 1, rotation: 0 } };
  }
  if (!currentConfig.clothes.bottom) {
    currentConfig.clothes.bottom = { style: "pants", color: 0x3a4550, pattern: { type: "solid", color2: 0x555555, scale: 1, rotation: 0 } };
  }
  if (!currentConfig.clothes.shoes) {
    currentConfig.clothes.shoes = { style: "sneaker", color: 0x2a2a32, pattern: { type: "solid", color2: 0x555555, scale: 1, rotation: 0 } };
  }
  if (!currentConfig.clothes.top.pattern) currentConfig.clothes.top.pattern = { type: "solid", color2: 0xffffff, scale: 1, rotation: 0 };
  if (!currentConfig.clothes.bottom.pattern) currentConfig.clothes.bottom.pattern = { type: "solid", color2: 0x555555, scale: 1, rotation: 0 };
  if (!currentConfig.clothes.shoes.pattern) currentConfig.clothes.shoes.pattern = { type: "solid", color2: 0x555555, scale: 1, rotation: 0 };
}

function buildLookControls() {
  controlsEl.innerHTML = "";
  ensureClothes();
  const c = currentConfig;

  section("Body");
  selectField("Shape", catalog.bodyShapes, () => c.bodyShape, (v) => { c.bodyShape = v; }, "bodyShape");
  colorField("Skin", () => c.skinTone, (v) => { c.skinTone = v; }, "skinTone");
  if (!c.height) c.height = { leg: 1, torso: 1, neck: 1, head: 1 };
  if (!c.body) c.body = { hipThick: 1, armThick: 1, legThick: 1 };

  section("Proportions");
  rangeField("Legs", 0.5, 1.7, 0.05, () => c.height.leg, (v) => { c.height.leg = v; }, "height.leg");
  rangeField("Torso", 0.5, 1.7, 0.05, () => c.height.torso, (v) => { c.height.torso = v; }, "height.torso");
  rangeField("Neck", 0.5, 1.7, 0.05, () => c.height.neck, (v) => { c.height.neck = v; }, "height.neck");
  rangeField("Head size", HEAD_SCALE_MIN, HEAD_SCALE_MAX, 0.05, () => c.height.head, (v) => { c.height.head = v; }, "height.head");
  rangeField("Arm thick", 0.55, 2.0, 0.05, () => c.body.armThick ?? 1, (v) => { c.body.armThick = v; }, "body.armThick");
  rangeField("Leg thick", 0.55, 2.0, 0.05, () => c.body.legThick ?? 1, (v) => { c.body.legThick = v; }, "body.legThick");
  rangeField("Hip thick", 0.9, 2.2, 0.05, () => c.body.hipThick ?? 1, (v) => { c.body.hipThick = v; }, "body.hipThick");

  section("Face");
  if (!c.face) c.face = { eyeDistance: 1, roundness: 1, length: 1, width: 1 };
  {
    const eyeDistMax = maxEyeDistanceForWidth(skullSize(c).hw);
    rangeField("Eye distance", EYE_DISTANCE_MIN, eyeDistMax, 0.05, () => c.face.eyeDistance ?? 1, (v) => {
      c.face.eyeDistance = clampEyeDistance(v, skullSize(c).hw);
      c.eyes.scale = clampEyeScale(c.eyes.scale, c.face.eyeDistance, skullSize(c).hw);
      buildLookControls();
    }, "face.eyeDistance");
  }
  rangeField("Face round", 0.45, 1.25, 0.05, () => c.face.roundness ?? 1, (v) => { c.face.roundness = v; }, "face.roundness");
  rangeField("Face length", 0.65, 2, 0.05, () => c.face.length ?? 1, (v) => { c.face.length = v; }, "face.length");
  rangeField("Face width", 0.75, 1.35, 0.05, () => c.face.width ?? 1, (v) => { c.face.width = v; }, "face.width");
  selectField("Eyes", catalog.eyeStyles, () => c.eyes.style, (v) => { c.eyes.style = v; }, "eyes.style");
  colorField("Eye color", () => c.eyes.color, (v) => { c.eyes.color = v; }, "eyes.color");
  {
    const eyeMax = maxEyeScaleForDistance(c.face.eyeDistance ?? 1);
    rangeField("Eye scale", EYE_SCALE_MIN, eyeMax, 0.05, () => clampEyeScale(c.eyes.scale, c.face.eyeDistance ?? 1), (v) => {
      c.eyes.scale = clampEyeScale(v, c.face.eyeDistance ?? 1);
    }, "eyes.scale");
  }
  if (!c.brows) c.brows = { style: "straight", scale: 1 };
  selectField("Brows", catalog.browStyles, () => c.brows.style, (v) => { c.brows.style = v; }, "brows.style");
  selectField("Nose", catalog.noseStyles, () => c.nose.style, (v) => { c.nose.style = v; }, "nose.style");
  selectField("Ears", catalog.earStyles, () => c.ears.style, (v) => { c.ears.style = v; }, "ears.style");

  section("Hair / hat");
  selectField("Hair", catalog.hairStyles, () => c.hair.style, (v) => { c.hair.style = v; }, "hair.style");
  colorField("Hair color", () => c.hair.color, (v) => { c.hair.color = v; }, "hair.color");
  selectField("Hat", catalog.hatStyles, () => c.hat.style, (v) => { c.hat.style = v; }, "hat.style");
  colorField("Hat color", () => c.hat.color, (v) => { c.hat.color = v; }, "hat.color");

  section("Clothes · top");
  selectField("Top style", catalog.topStyles, () => c.clothes.top.style, (v) => { c.clothes.top.style = v; }, "clothes.top.style");
  colorField("Top color", () => c.clothes.top.color, (v) => { c.clothes.top.color = v; }, "clothes.top.color");
  selectField("Top pattern", catalog.patterns, () => c.clothes.top.pattern.type, (v) => { c.clothes.top.pattern.type = v; }, "clothes.top.pattern");
  if (c.clothes.top.style === "polo" || c.clothes.top.style === "jacket") {
    if (c.clothes.top.buttons == null) c.clothes.top.buttons = 3;
    rangeField("Buttons", 2, 5, 1, () => c.clothes.top.buttons ?? 3, (v) => { c.clothes.top.buttons = Math.round(v); }, "clothes.top.buttons");
  }

  section("Clothes · bottom");
  selectField("Bottom style", catalog.bottomStyles, () => c.clothes.bottom.style, (v) => { c.clothes.bottom.style = v; }, "clothes.bottom.style");
  colorField("Bottom color", () => c.clothes.bottom.color, (v) => { c.clothes.bottom.color = v; }, "clothes.bottom.color");

  section("Shoes");
  selectField("Shoe style", catalog.shoeStyles, () => c.clothes.shoes.style, (v) => { c.clothes.shoes.style = v; }, "clothes.shoes.style");
  colorField("Shoe color", () => c.clothes.shoes.color, (v) => { c.clothes.shoes.color = v; }, "clothes.shoes.color");
  dumpLookCode();
  syncModulePanes();
}

if (randLookMod) {
  syncStarButton(randLookMod, "module.look");
  randLookMod.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    randomLocks["module.look"] = !isRandOn("module.look");
    syncStarButton(randLookMod, "module.look");
    syncModulePanes();
  });
}
if (randAnimMod) {
  syncStarButton(randAnimMod, "module.anim");
  randAnimMod.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    randomLocks["module.anim"] = !isRandOn("module.anim");
    syncStarButton(randAnimMod, "module.anim");
    syncModulePanes();
  });
}

syncModulePanes();

currentClipCheck?.addEventListener("change", () => {
  if (!currentClipName) return;
  if (currentClipCheck.checked) exportSelected.add(currentClipName);
  else exportSelected.delete(currentClipName);
  refreshAnimClipList();
});

btnRandom.addEventListener("click", async () => {
  if (busy) return;
  const full = randomConfig(Date.now() + Math.random() * 1e9);
  currentConfig = mergeRandomLocked(currentConfig, full);
  pendingAnimPrefer = isRandOn("module.anim") ? "random" : currentClipName;
  buildLookControls();
  const prevGroup = rigged?.group;
  if (prevGroup) await tweenNpcOpacity(prevGroup, 1, 0, 120);
  await rebuildRigged();
  const nextGroup = rigged?.group;
  if (nextGroup) {
    setNpcOpacity(nextGroup, 0);
    await tweenNpcOpacity(nextGroup, 0, 1, 140);
  }
});

btnPlay.addEventListener("click", () => {
  if (!action) return;
  playing = !playing;
  action.paused = !playing;
  syncPlayButton();
});

animFilter?.addEventListener("input", () => refreshAnimClipList());
btnExportAll?.addEventListener("click", () => {
  for (const c of adaptedClips) exportSelected.add(c.name);
  refreshAnimClipList();
});
btnExportNone?.addEventListener("click", () => {
  exportSelected.clear();
  refreshAnimClipList();
});
btnExport?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  exportGlbPackage({ withAnims: true });
});
btnExportMesh?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  const ok = window.confirm(
    "You will download this avatar mesh with rig, but no animation.\n\nContinue?"
  );
  if (!ok) return;
  exportGlbPackage({ withAnims: false });
});

btnLookCopy?.addEventListener("click", async () => {
  const text = encodeLookCode(currentConfig, {
    play: currentClipName || undefined,
    pack: [...exportSelected],
  });
  lookCodeEl.value = text;
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Genes copied");
  } catch {
    lookCodeEl.select();
    setStatus("Genes ready — press Ctrl+C to copy");
  }
});

btnLookApply?.addEventListener("click", () => {
  const result = applyLookCode(lookCodeEl.value);
  if (!result.ok) {
    setStatus(`Genes: ${result.error}`);
    return;
  }
  currentConfig = result.config;
  if (result.anim?.pack?.length) {
    exportSelected.clear();
    for (const n of result.anim.pack) exportSelected.add(n);
  }
  pendingAnimPrefer = result.anim?.play || currentClipName;
  buildLookControls();
  dumpLookCode();
  rebuildRigged();
  setStatus("Genes pasted");
});

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function tick() {
  requestAnimationFrame(tick);
  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);
  // Slow across the front half, fast across the back (avatar faces +Z; θ=0 is front)
  const backAmt = 0.5 - 0.5 * Math.cos(orbit.getAzimuthalAngle()); // 0 front → 1 back
  const t = backAmt * backAmt; // ease — linger slow in front, rush the back
  orbit.autoRotateSpeed = ORBIT_SPEED_FRONT + (ORBIT_SPEED_BACK - ORBIT_SPEED_FRONT) * t;
  orbit.update();
  renderer.render(scene, camera);
}
tick();

buildLookControls();

/** Bottom dock: only one of Look / Animation / Genes open at a time. */
function showDockTab(tabId) {
  const tabs = [...document.querySelectorAll(".dock-tab[data-tab]")];
  const panes = {
    look: document.getElementById("pane-look"),
    anim: document.getElementById("pane-anim"),
    code: document.getElementById("pane-code"),
  };
  for (const tab of tabs) {
    const on = tab.dataset.tab === tabId;
    tab.classList.toggle("active", on);
    tab.setAttribute("aria-selected", on ? "true" : "false");
  }
  for (const [id, pane] of Object.entries(panes)) {
    if (!pane) continue;
    pane.hidden = id !== tabId;
  }
}

for (const tab of document.querySelectorAll(".dock-tab[data-tab]")) {
  tab.addEventListener("click", (e) => {
    if (e.target.closest("button")) return; // spark / download keep their own handlers
    showDockTab(tab.dataset.tab);
  });
  tab.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      showDockTab(tab.dataset.tab);
    }
  });
}
showDockTab("code");

const aboutDialog = document.getElementById("about-dialog");
document.getElementById("btn-about")?.addEventListener("click", () => {
  aboutDialog?.showModal();
});

const splash = document.getElementById("splash");
function startApp() {
  if (!splash || splash.classList.contains("is-done")) return;
  splash.classList.add("is-done");
  document.body.classList.remove("prestart");
}
splash?.addEventListener("click", startApp);
splash?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    startApp();
  }
});

setStatus("Loading human animation library…");
loadHumanAnimationClips()
  .then((list) => {
    sourceClips = list;
    setStatus(`Loaded ${list.length} clips — fitting avatar…`);
    pendingAnimPrefer = "random";
    return rebuildRigged();
  })
  .catch((err) => {
    setStatus(`Anim load failed: ${err.message || err}`);
  });

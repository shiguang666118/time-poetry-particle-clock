import * as THREE from 'three';
import type { InteractionState, ThemeName } from './interaction';
import { DEFAULT_INTERACTION_STATE } from './interaction';
import { getClockHandAngles } from './clock';
import { createWatchParticleData } from './particles';
import {
  TIME_POETRY_CLEAN_LINES,
  TIME_POETRY_GLYPHS,
  getClockHourSector,
  getPoetryLineWindowForHourSector
} from './poetry';
import { LOOP_DURATION_SECONDS, normalizeLoopTime } from './timeline';

// ─── Theme color definitions ───────────────────────────────────────────
interface ThemeColors {
  inner: [number, number, number];
  mid: [number, number, number];
  outer: [number, number, number];
  accent: [number, number, number];
  secondHand: number;
  secondGlow: number;
  secondTail: number;
  hourHand: number;
  minuteHand: number;
  centerDot: number;
  centerGlow: number;
  ring: number;
  tick: number;
  tickMinor: number;
  hourLabel: string;
  hourLabelMajor: string;
  clearColor: number;
  fogColor: number;
}

const THEMES: Record<ThemeName, ThemeColors> = {
  aurora: {
    inner: [0.95, 0.85, 0.65],
    mid: [0.85, 0.45, 0.65],
    outer: [0.55, 0.35, 0.85],
    accent: [1.0, 0.55, 0.25],
    secondHand: 0xff8844,
    secondGlow: 0xff7730,
    secondTail: 0xff3050,
    hourHand: 0xddaa88,
    minuteHand: 0xd0d0e0,
    centerDot: 0xfff0e0,
    centerGlow: 0xdd8844,
    ring: 0x9060bb,
    tick: 0xddbb88,
    tickMinor: 0x705040,
    hourLabel: 'rgba(255, 255, 255, 0)',
    hourLabelMajor: 'rgba(255, 255, 255, 0)',
    clearColor: 0x000000,
    fogColor: 0x000000
  },
  cyber: {
    inner: [0.3, 0.95, 0.8],
    mid: [0.1, 0.7, 0.95],
    outer: [0.4, 0.2, 0.95],
    accent: [0.0, 1.0, 0.7],
    secondHand: 0x00ffaa,
    secondGlow: 0x00dd88,
    secondTail: 0xff2060,
    hourHand: 0x88ddcc,
    minuteHand: 0xb0d0e8,
    centerDot: 0xe0fff0,
    centerGlow: 0x00cc88,
    ring: 0x3080cc,
    tick: 0x60ccaa,
    tickMinor: 0x305050,
    hourLabel: 'rgba(255, 255, 255, 0)',
    hourLabelMajor: 'rgba(255, 255, 255, 0)',
    clearColor: 0x000000,
    fogColor: 0x000000
  },
  gold: {
    inner: [1.0, 0.9, 0.7],
    mid: [0.85, 0.65, 0.35],
    outer: [0.6, 0.4, 0.2],
    accent: [1.0, 0.85, 0.5],
    secondHand: 0xffcc44,
    secondGlow: 0xddaa30,
    secondTail: 0xcc4422,
    hourHand: 0xeebb66,
    minuteHand: 0xd0c0a0,
    centerDot: 0xfff8e0,
    centerGlow: 0xccaa44,
    ring: 0x886622,
    tick: 0xccaa66,
    tickMinor: 0x554422,
    hourLabel: 'rgba(255, 255, 255, 0)',
    hourLabelMajor: 'rgba(255, 255, 255, 0)',
    clearColor: 0x000000,
    fogColor: 0x000000
  }
};

// ─── Shaders ────────────────────────────────────────────────────────────

const vertexShader = `
attribute vec3 aScatter;
attribute float aDelay;
attribute float aIntensity;
attribute float aVoid;
attribute float aRim;
attribute float aGlyphIndex;
attribute float aGlyphStrength;

uniform float uLoop;
uniform float uPixelRatio;
uniform vec3 uPointer;
uniform float uPointerForce;
uniform float uSecondAngle;
uniform float uTime;
uniform float uBreathPhase;

varying float vAlpha;
varying float vIntensity;
varying float vSecondGlow;
varying float vRadius;
varying float vAngle;
varying float vRim;
varying float vVoid;
varying float vGlyphIndex;
varying float vGlyphMix;

float pulse(float center, float width, float x) {
  float d = abs(fract(x - center + 0.5) - 0.5);
  return smoothstep(width, 0.0, d);
}

void main() {
  float radius = length(position.xy);
  float angle = atan(position.y, position.x);

  // ── Breathing pulse ──
  float breathAmp = 0.025 + radius * 0.015;
  float breathOffset = sin(uBreathPhase + radius * 2.5) * breathAmp;
  vec2 breathDir = normalize(position.xy + 0.001);
  vec3 breathDisplace = vec3(breathDir * breathOffset, sin(uBreathPhase * 0.7 + radius * 3.0) * 0.008);

  // ── Vortex drift ── particles slowly spiral along tangent
  float vortexSpeed = 0.03 * radius;
  float tangentAngle = angle + 3.14159265 * 0.5;
  vec3 vortexDisplace = vec3(
    cos(tangentAngle) * vortexSpeed * sin(uTime * 0.4 + aDelay * 6.28),
    sin(tangentAngle) * vortexSpeed * sin(uTime * 0.4 + aDelay * 6.28),
    0.0
  );

  // ── Wave erosion plus pointer-driven rupture ──
  float edgeMask = smoothstep(0.82, 1.34, radius);
  float shellMask = smoothstep(0.16, 0.38, radius) * (1.0 - smoothstep(1.6, 1.85, radius));
  float breakCenter = fract(0.02 + uLoop * 0.55);
  float bite = pulse(breakCenter, 0.105, aDelay) * edgeMask;
  float afterShock = pulse(fract(breakCenter - 0.03), 0.04, aDelay) * 0.42 * edgeMask;
  float fractureFlicker = sin(uTime * 2.4 + aDelay * 18.0 + radius * 5.0) * 0.5 + 0.5;

  // ── Pointer interaction ──
  float pointerDistance = distance(position.xy, uPointer.xy);
  float pointerStrength = clamp(uPointerForce * 1.45, 0.0, 1.0);
  float pointerPush = (1.0 - smoothstep(0.0, 0.9, pointerDistance)) * pointerStrength;
  float pointerVoid = (1.0 - smoothstep(0.02, 0.9, pointerDistance)) * pointerStrength;
  float pointerRim = (1.0 - smoothstep(0.0, 0.1, abs(pointerDistance - 0.92))) * shellMask * pointerStrength;
  float dynamicRim = clamp(max(aRim, pointerRim), 0.0, 1.0);
  float dynamicVoid = clamp(max(aVoid, pointerVoid), 0.0, 1.0);
  float passiveErosion = (bite + afterShock) * 0.08;
  float erosion = clamp(passiveErosion + dynamicRim * (0.52 + fractureFlicker * 0.32), 0.0, 1.0) * aIntensity;
  vec3 pointerDirection = normalize(vec3(position.xy - uPointer.xy, 0.18));
  float activeErosion = max(erosion * 0.82, pointerPush * (1.0 - dynamicVoid));

  // ── Second hand kick — push particles outward + Z bounce ──
  float angleDiffKick = mod(angle - uSecondAngle + 6.28318530, 6.28318530);
  float secondKick = smoothstep(0.15, 0.0, angleDiffKick) * smoothstep(0.3, 0.8, radius);
  vec3 secondDisplace = vec3(breathDir * secondKick * 0.04, secondKick * 0.03);
  vec3 ruptureDisplace = aScatter * (dynamicRim * (0.5 + fractureFlicker * 0.7) + dynamicVoid * 1.15);

  // ── Combine displacements ──
  vec3 displaced = position
    + aScatter * activeErosion
    + ruptureDisplace
    + pointerDirection * pointerPush * (0.1 + aIntensity * 0.34)
    + breathDisplace
    + vortexDisplace
    + secondDisplace;

  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  float glyphMix = clamp((dynamicRim * 1.75 + activeErosion * 0.5 + pointerPush * 0.28) * aGlyphStrength, 0.0, 1.0);
  float size = mix(2.65, 5.85, activeErosion + secondKick * 0.5 + dynamicRim * 0.9) * uPixelRatio;
  size *= mix(1.0, 3.6, glyphMix);
  size *= mix(1.0, 0.0, dynamicVoid);
  gl_PointSize = size * clamp(5.0 / -mvPosition.z, 0.72, 1.28);
  gl_Position = projectionMatrix * mvPosition;

  float biteFade = mix(1.0, 0.22, bite * (1.0 - pointerPush));
  float voidFade = step(dynamicVoid, 0.82);
  vAlpha = mix(0.86, 1.0, activeErosion + dynamicRim * 0.7) * biteFade * voidFade;
  vIntensity = 0.52 + aIntensity + activeErosion + pointerPush * 0.7 + secondKick * 0.4 + dynamicRim * 0.74;
  vRadius = radius;
  vAngle = angle;
  vRim = dynamicRim;
  vVoid = dynamicVoid;
  vGlyphIndex = aGlyphIndex;
  vGlyphMix = smoothstep(0.28, 0.92, glyphMix);

  // Glow near the second hand sweep — wider trail
  float trail = smoothstep(0.7, 0.0, angleDiffKick) * smoothstep(0.0, 0.05, angleDiffKick);
  float tip = smoothstep(0.12, 0.0, angleDiffKick);
  vSecondGlow = (trail * 0.6 + tip * 1.2) * smoothstep(0.3, 0.8, radius);
}
`;

const fragmentShader = `
precision highp float;

varying float vAlpha;
varying float vIntensity;
varying float vSecondGlow;
varying float vRadius;
varying float vAngle;
varying float vRim;
varying float vVoid;
varying float vGlyphIndex;
varying float vGlyphMix;

uniform float uTime;
uniform vec3 uColorInner;
uniform vec3 uColorMid;
uniform vec3 uColorOuter;
uniform vec3 uColorAccent;
uniform sampler2D uGlyphAtlas;
uniform float uGlyphGrid;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float distanceToCenter = length(uv);
  float disc = smoothstep(0.5, 0.04, distanceToCenter);
  float core = smoothstep(0.15, 0.0, distanceToCenter);
  float glyphColumn = mod(vGlyphIndex, uGlyphGrid);
  float glyphRow = floor(vGlyphIndex / uGlyphGrid);
  vec2 glyphPointUv = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y);
  vec2 glyphUv = (vec2(glyphColumn, glyphRow) + glyphPointUv) / uGlyphGrid;
  float glyphAlpha = texture2D(uGlyphAtlas, glyphUv).a;

  float t = clamp(vIntensity, 0.0, 1.0);
  vec3 baseColor = mix(uColorMid, uColorInner, t);
  baseColor = mix(baseColor, uColorOuter, smoothstep(1.0, 1.5, vRadius));

  // Shimmer — more organic, less mechanical
  float shimmer = sin(vAngle * 10.0 + uTime * 1.2) * 0.5 + 0.5;
  float shimmer2 = sin(vAngle * 21.0 - uTime * 2.1 + vRadius * 4.0) * 0.5 + 0.5;
  baseColor += (shimmer * shimmer2) * (0.03 + vRim * 0.15);

  // Second hand sweep glow
  vec3 glowColor = uColorAccent * vSecondGlow;

  // Final composite
  vec3 color = baseColor + core * (0.18 + vRim * 0.45) + glowColor + vec3(vRim * 0.28);
  color = mix(color, max(color, uColorAccent + vec3(0.18)), vGlyphMix * glyphAlpha);
  float shapeAlpha = mix(disc, glyphAlpha, vGlyphMix);

  gl_FragColor = vec4(color, shapeAlpha * vAlpha * (1.0 - vVoid));
}
`;

// ─── Star field background shader ───────────────────────────────────────

const starVertexShader = `
attribute float aStarSize;
attribute float aStarPhase;

uniform float uTime;
uniform float uPixelRatio;

varying float vStarAlpha;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

  // Twinkle
  float twinkle = sin(uTime * 1.2 + aStarPhase * 6.28) * 0.5 + 0.5;
  twinkle = twinkle * twinkle; // sharper twinkle
  vStarAlpha = 0.15 + twinkle * 0.65;

  gl_PointSize = aStarSize * uPixelRatio * (0.6 + twinkle * 0.4);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const starFragmentShader = `
precision highp float;

varying float vStarAlpha;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float disc = smoothstep(0.5, 0.0, d);
  float core = smoothstep(0.15, 0.0, d);

  vec3 color = vec3(1.0, 0.96, 0.88) * (0.6 + core * 0.4);
  gl_FragColor = vec4(color, disc * vStarAlpha);
}
`;

// ─── Aurora arc shader ──────────────────────────────────────────────────

const auroraVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const auroraFragmentShader = `
precision highp float;

varying vec2 vUv;
uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uOpacity;

void main() {
  // Flowing gradient along U
  float flow = sin(vUv.x * 6.28 + uTime * 0.5) * 0.5 + 0.5;
  float edge = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);

  // Breathing width
  float breath = sin(uTime * 0.8 + vUv.x * 3.14) * 0.5 + 0.5;
  edge *= 0.5 + breath * 0.5;

  vec3 color = mix(uColor1, uColor2, flow);
  float alpha = edge * uOpacity * (0.6 + flow * 0.4);

  gl_FragColor = vec4(color, alpha);
}
`;

// ─── Exports & Types ────────────────────────────────────────────────────

export interface ParticleWatchScene {
  renderer: THREE.WebGLRenderer;
  start: () => void;
  stop: () => void;
  replay: () => void;
  setInteractionState: (nextState: InteractionState) => void;
  setPointerFromClient: (clientX: number, clientY: number, force?: number) => void;
  clearPointer: () => void;
  setTheme: (theme: ThemeName) => void;
  setTimeMultiplier: (multiplier: number) => void;
  dispose: () => void;
}

/** Create a tapered hand shape using a custom geometry */
function createTaperedHand(
  length: number,
  baseWidth: number,
  tipWidth: number,
  color: number,
  opacity: number,
  glowColor?: number
): THREE.Group {
  const group = new THREE.Group();

  // Main hand body — tapered shape
  const shape = new THREE.Shape();
  shape.moveTo(-baseWidth / 2, 0);
  shape.lineTo(-tipWidth / 2, length);
  shape.lineTo(tipWidth / 2, length);
  shape.lineTo(baseWidth / 2, 0);
  shape.closePath();

  const extrudeSettings = { depth: 0.008, bevelEnabled: false };
  const bodyGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  const bodyMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.z = 0.02;
  group.add(body);

  // Glow outline
  if (glowColor !== undefined) {
    const glowMat = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: opacity * 0.3,
    });
    const glowGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.002, bevelEnabled: false });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.scale.set(1.8, 1.05, 1);
    glow.position.z = 0.015;
    group.add(glow);
  }

  return group;
}

function createRing(radius: number, opacity: number, color: number = 0x9060bb): THREE.LineLoop {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index < 360; index += 1) {
    const angle = (index / 360) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.018));
  }

  return new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
}

function createGlyphAtlas(glyphs: readonly string[]): { texture: THREE.CanvasTexture; grid: number } {
  const grid = Math.ceil(Math.sqrt(glyphs.length));
  const cellSize = 96;
  const canvas = document.createElement('canvas');
  canvas.width = grid * cellSize;
  canvas.height = grid * cellSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create poetry glyph atlas.');
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.floor(cellSize * 0.68)}px "Noto Serif SC", "Songti SC", "Microsoft YaHei", SimSun, serif`;

  glyphs.forEach((glyph, index) => {
    const column = index % grid;
    const row = Math.floor(index / grid);
    const x = column * cellSize + cellSize / 2;
    const y = row * cellSize + cellSize / 2 + cellSize * 0.02;
    ctx.fillText(glyph, x, y);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return { texture, grid };
}

interface PoetryShard {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  velocity: THREE.Vector3;
  phase: number;
  aspect: number;
  height: number;
  poetryLineIndex: number;
}

function createPoetryLineTexture(line: string): { texture: THREE.CanvasTexture; aspect: number } {
  const fontSize = 54;
  const paddingX = 42;
  const paddingY = 30;
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) {
    throw new Error('Failed to measure poetry shard text.');
  }

  const font = `700 ${fontSize}px "Noto Serif SC", "Songti SC", "Microsoft YaHei", SimSun, serif`;
  measureCtx.font = font;
  const width = Math.ceil(measureCtx.measureText(line).width + paddingX * 2);
  const height = fontSize + paddingY * 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(1024, Math.max(256, width));
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create poetry shard texture.');
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255, 225, 170, 0.75)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = 'rgba(255, 250, 235, 0.96)';
  ctx.fillText(line, canvas.width / 2, canvas.height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return { texture, aspect: canvas.width / canvas.height };
}

function createPoetryShards(
  dial: THREE.Group
): { shards: PoetryShard[]; textures: THREE.CanvasTexture[]; poetryLineIndices: number[] } {
  const selectedLines = [
    '一寸光阴一寸金',
    '黑发不知勤学早',
    '白首方悔读书迟',
    '少壮不努力',
    '老大徒伤悲',
    '盛年不重来',
    '岁月不待人',
    '莫等闲白了少年头空悲切',
    '三更灯火五更鸡',
    '正是男儿读书时',
    '劝君惜取少年时',
    '花有重开日',
    '人无再少年',
    '业精于勤荒于嬉',
    '行成于思毁于随',
    '学海无涯苦作舟',
    '书山有路勤为径',
    '锲而不舍金石可镂'
  ].map((line) => {
    return {
      line,
      poetryLineIndex: TIME_POETRY_CLEAN_LINES.indexOf(line)
    };
  }).filter(({ poetryLineIndex }) => poetryLineIndex >= 0);

  const textureRefs = selectedLines.map(({ line }) => createPoetryLineTexture(line));
  const shards = textureRefs.map(({ texture, aspect }, index) => {
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending
    });
    const sprite = new THREE.Sprite(material);
    const angle = -0.42 + index * 0.095;
    const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
    const velocity = direction.clone().multiplyScalar(0.76 + (index % 5) * 0.08);
    velocity.z = 0.08 + (index % 4) * 0.035;
    const height = 0.078 + Math.min(selectedLines[index].line.length, 12) * 0.002;
    sprite.position.copy(direction.multiplyScalar(1.15));
    sprite.position.z = 0.11 + index * 0.001;
    sprite.scale.set(height * aspect, height, 1);
    sprite.rotation.z = angle * 0.18 - 0.12;
    dial.add(sprite);

    return {
      sprite,
      material,
      velocity,
      phase: index * 0.37,
      aspect,
      height,
      poetryLineIndex: selectedLines[index].poetryLineIndex
    };
  });

  return {
    shards,
    textures: textureRefs.map(({ texture }) => texture),
    poetryLineIndices: selectedLines.map(({ poetryLineIndex }) => poetryLineIndex)
  };
}

/** Create hour number labels — themed colors */
function createHourMarkers(dial: THREE.Group, theme: ThemeColors): THREE.Sprite[] {
  const sprites: THREE.Sprite[] = [];
  for (let h = 1; h <= 12; h++) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.clearRect(0, 0, 64, 64);
    ctx.font = '500 34px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Major hours (12, 3, 6, 9) brighter
    const isMajor = h % 3 === 0;
    if (isMajor) {
      ctx.fillStyle = theme.hourLabelMajor;
      ctx.shadowColor = theme.hourLabelMajor;
      ctx.shadowBlur = 8;
    } else {
      ctx.fillStyle = theme.hourLabel;
    }

    ctx.fillText(String(h), 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const sprite = new THREE.Sprite(spriteMaterial);

    // Position: 12 o'clock at top (+Y), clockwise
    const angle = -(h / 12) * Math.PI * 2 + Math.PI / 2;
    const radius = 1.05;
    sprite.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.04);
    const scale = isMajor ? 0.18 : 0.14;
    sprite.scale.set(scale, scale, 1);
    dial.add(sprite);
    sprites.push(sprite);
  }
  return sprites;
}

/** Create animated outer arc segments */
function createOuterArcs(dial: THREE.Group, theme: ThemeColors): THREE.Group {
  const arcsGroup = new THREE.Group();

  const arcColors = [theme.ring, theme.outer[0] > 0.5 ? 0xaa6622 : 0x6050dd, 0x20a0aa, theme.ring];
  for (let i = 0; i < 4; i++) {
    const startAngle = (i / 4) * Math.PI * 2;
    const arcLength = Math.PI * 0.35;
    const points: THREE.Vector3[] = [];
    const segments = 40;
    const radius = 1.72 + i * 0.04;
    for (let s = 0; s <= segments; s++) {
      const angle = startAngle + (s / segments) * arcLength;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.01));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: arcColors[i],
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    arcsGroup.add(new THREE.Line(geo, mat));
  }

  dial.add(arcsGroup);
  return arcsGroup;
}

/** Create tick marks with varying sizes */
function createTickMarks(dial: THREE.Group, theme: ThemeColors): void {
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * Math.PI * 2;
    const isMajor = i % 5 === 0;
    const innerR = isMajor ? 1.15 : 1.22;
    const outerR = 1.32;
    const opacity = isMajor ? 0.46 : 0.16;

    const points = [
      new THREE.Vector3(Math.cos(angle) * innerR, Math.sin(angle) * innerR, 0.02),
      new THREE.Vector3(Math.cos(angle) * outerR, Math.sin(angle) * outerR, 0.02)
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: isMajor ? theme.tick : theme.tickMinor,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      linewidth: 1
    });
    dial.add(new THREE.Line(geo, mat));

    // Add small dots at the tip of major ticks
    if (isMajor) {
      const dotGeo = new THREE.SphereGeometry(0.012, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({
        color: theme.tick,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(Math.cos(angle) * outerR, Math.sin(angle) * outerR, 0.025);
      dial.add(dot);
    }
  }
}

/** Create star field behind the dial */
function createStarField(scene: THREE.Scene): { points: THREE.Points; material: THREE.ShaderMaterial } {
  const count = 500;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Distribute in a wide sphere behind the dial
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const r = 3 + Math.random() * 8;
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
    positions[i * 3 + 2] = -1 - Math.random() * 6; // behind the dial
    sizes[i] = 1.0 + Math.random() * 2.5;
    phases[i] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aStarSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aStarPhase', new THREE.BufferAttribute(phases, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: starVertexShader,
    fragmentShader: starFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
    }
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return { points, material: mat };
}

/** Create aurora arc bands outside the dial */
function createAuroraBands(dial: THREE.Group, theme: ThemeColors): THREE.Mesh[] {
  const bands: THREE.Mesh[] = [];
  const configs = [
    { radius: 1.82, width: 0.06, color1: theme.inner, color2: theme.mid, opacity: 0.12 },
    { radius: 1.92, width: 0.04, color1: theme.mid, color2: theme.outer, opacity: 0.08 },
    { radius: 2.02, width: 0.03, color1: theme.outer, color2: theme.accent, opacity: 0.06 },
  ];

  for (const cfg of configs) {
    // Create a torus-like ring using a tube
    const curve = new THREE.EllipseCurve(0, 0, cfg.radius, cfg.radius, 0, Math.PI * 2, false, 0);
    const curvePoints = curve.getPoints(128);
    const path = new THREE.CatmullRomCurve3(
      curvePoints.map(p => new THREE.Vector3(p.x, p.y, 0.005)),
      true
    );

    const geo = new THREE.TubeGeometry(path, 128, cfg.width, 4, true);
    const mat = new THREE.ShaderMaterial({
      vertexShader: auroraVertexShader,
      fragmentShader: auroraFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Vector3(cfg.color1[0], cfg.color1[1], cfg.color1[2]) },
        uColor2: { value: new THREE.Vector3(cfg.color2[0], cfg.color2[1], cfg.color2[2]) },
        uOpacity: { value: cfg.opacity }
      }
    });

    const mesh = new THREE.Mesh(geo, mat);
    dial.add(mesh);
    bands.push(mesh);
  }

  return bands;
}

/** Create central lens flare sprite */
function createLensFlare(dial: THREE.Group, _theme: ThemeColors): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255, 240, 220, 0.4)');
  gradient.addColorStop(0.2, 'rgba(255, 200, 150, 0.15)');
  gradient.addColorStop(0.5, 'rgba(200, 120, 80, 0.05)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.2, 1.2, 1);
  sprite.position.z = 0.01;
  dial.add(sprite);
  return sprite;
}


// ─── Main Scene Factory ─────────────────────────────────────────────────

export function createParticleWatchScene(canvas: HTMLCanvasElement): ParticleWatchScene {
  let currentTheme = THEMES.aurora;
  let timeMultiplier = 1;
  let targetTimeMultiplier = 1;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  });
  renderer.setClearColor(currentTheme.clearColor, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(currentTheme.fogColor, 0.04);

  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
  camera.position.set(0, 0, 6.85);
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const dialPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const pointerWorld = new THREE.Vector3(99, 99, 99);
  const pointerLocal = new THREE.Vector3(99, 99, 99);

  const dial = new THREE.Group();
  dial.rotation.x = -0.5;
  dial.rotation.y = 0;
  scene.add(dial);

  // ── Particles ──
  const particleData = createWatchParticleData(1208);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(particleData.positions, 3));
  geometry.setAttribute('aScatter', new THREE.BufferAttribute(particleData.scatter, 3));
  geometry.setAttribute('aDelay', new THREE.BufferAttribute(particleData.delay, 1));
  geometry.setAttribute('aIntensity', new THREE.BufferAttribute(particleData.intensity, 1));
  geometry.setAttribute('aVoid', new THREE.BufferAttribute(particleData.voidMask, 1));
  geometry.setAttribute('aRim', new THREE.BufferAttribute(particleData.rimMask, 1));
  geometry.setAttribute('aGlyphIndex', new THREE.BufferAttribute(particleData.glyphIndex, 1));
  geometry.setAttribute('aGlyphStrength', new THREE.BufferAttribute(particleData.glyphStrength, 1));

  const glyphAtlas = createGlyphAtlas(TIME_POETRY_GLYPHS);

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uLoop: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uPointer: { value: new THREE.Vector3(99, 99, 99) },
      uPointerForce: { value: 0 },
      uSecondAngle: { value: 0 },
      uTime: { value: 0 },
      uBreathPhase: { value: 0 },
      uColorInner: { value: new THREE.Vector3(...currentTheme.inner) },
      uColorMid: { value: new THREE.Vector3(...currentTheme.mid) },
      uColorOuter: { value: new THREE.Vector3(...currentTheme.outer) },
      uColorAccent: { value: new THREE.Vector3(...currentTheme.accent) },
      uGlyphAtlas: { value: glyphAtlas.texture },
      uGlyphGrid: { value: glyphAtlas.grid }
    }
  });

  const particles = new THREE.Points(geometry, material);
  dial.add(particles);
  const poetryShards = createPoetryShards(dial);

  // ── Rings ──
  dial.add(createRing(1.5, 0.08, currentTheme.ring));
  dial.add(createRing(1.55, 0.05, currentTheme.ring));
  dial.add(createRing(1.62, 0.035, currentTheme.ring));
  dial.add(createRing(1.68, 0.02, currentTheme.ring));

  // ── Hour numbers ──
  createHourMarkers(dial, currentTheme);

  // ── Tick marks ──
  createTickMarks(dial, currentTheme);

  // ── Outer arcs ──
  const outerArcs = createOuterArcs(dial, currentTheme);

  // ── Aurora bands ──
  const auroraBands = createAuroraBands(dial, currentTheme);
  auroraBands.forEach((band) => {
    (band.material as THREE.ShaderMaterial).uniforms.uOpacity.value *= 0.42;
  });

  // ── Lens flare ──
  const lensFlare = createLensFlare(dial, currentTheme);
  lensFlare.material.opacity = 0.16;

  // ── Star field ──
  const starField = createStarField(scene);
  starField.points.visible = false;

  // ── Clock hands — themed colors ──
  const hourHand = createTaperedHand(0.78, 0.038, 0.014, currentTheme.hourHand, 0.92, currentTheme.ring);
  const minuteHand = createTaperedHand(1.12, 0.028, 0.008, currentTheme.minuteHand, 0.88, currentTheme.ring);

  // Second hand — themed
  const secondHandGroup = new THREE.Group();
  const secondMainGeo = new THREE.BoxGeometry(0.006, 1.38, 0.003);
  secondMainGeo.translate(0, 1.38 / 2, 0.028);
  const secondMainMat = new THREE.MeshBasicMaterial({
    color: currentTheme.secondHand,
    transparent: true,
    opacity: 0.96
  });
  secondHandGroup.add(new THREE.Mesh(secondMainGeo, secondMainMat));

  // Second hand glow
  const secondGlowGeo = new THREE.BoxGeometry(0.03, 1.38, 0.002);
  secondGlowGeo.translate(0, 1.38 / 2, 0.026);
  const secondGlowMat = new THREE.MeshBasicMaterial({
    color: currentTheme.secondGlow,
    transparent: true,
    opacity: 0.08
  });
  secondHandGroup.add(new THREE.Mesh(secondGlowGeo, secondGlowMat));

  // Second hand tail
  const secondTailGeo = new THREE.BoxGeometry(0.006, 0.25, 0.003);
  secondTailGeo.translate(0, -0.125, 0.028);
  const secondTailMat = new THREE.MeshBasicMaterial({
    color: currentTheme.secondTail,
    transparent: true,
    opacity: 0.82
  });
  secondHandGroup.add(new THREE.Mesh(secondTailGeo, secondTailMat));

  // Tip
  const tipGeo = new THREE.SphereGeometry(0.015, 8, 8);
  const tipMat = new THREE.MeshBasicMaterial({
    color: currentTheme.secondHand,
    transparent: true,
    opacity: 0.95
  });
  const tip = new THREE.Mesh(tipGeo, tipMat);
  tip.position.set(0, 1.38, 0.03);
  secondHandGroup.add(tip);

  // Center pivot — layered
  const centerOuter = new THREE.Mesh(
    new THREE.RingGeometry(0.025, 0.05, 32),
    new THREE.MeshBasicMaterial({ color: currentTheme.centerGlow, transparent: true, opacity: 0.38, side: THREE.DoubleSide })
  );
  centerOuter.position.z = 0.035;

  const centerDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 24, 16),
    new THREE.MeshBasicMaterial({ color: currentTheme.centerDot, transparent: true, opacity: 0.95 })
  );
  centerDot.position.z = 0.03;

  const centerGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 16, 16),
    new THREE.MeshBasicMaterial({ color: currentTheme.centerGlow, transparent: true, opacity: 0.1 })
  );
  centerGlow.position.z = 0.025;

  const hands = new THREE.Group();
  hands.add(hourHand);
  hands.add(minuteHand);
  hands.add(secondHandGroup);
  hands.add(centerOuter);
  hands.add(centerDot);
  hands.add(centerGlow);
  dial.add(hands);

  const ambient = new THREE.AmbientLight(0xffffff, 0.18);
  scene.add(ambient);

  let running = false;
  let animationFrame = 0;
  let startedAt = performance.now();
  let pausedAt = 0;
  let interactionState: InteractionState = {
    ...DEFAULT_INTERACTION_STATE,
    rotationX: -0.5,
    rotationY: 0,
    zoom: 6.85,
    orbitSpeed: 0
  };
  let pointerForce = 0;
  let pointerTargetForce = 0;
  let pointerHitActive = false;
  let poetryHourSector = 12;
  // For time acceleration visual: accumulated offset in seconds
  let timeAccelOffset = 0;

  function resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    starField.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
  }

  function updateClockHands(_elapsed: number): void {
    // Smooth multiplier transition
    timeMultiplier += (targetTimeMultiplier - timeMultiplier) * 0.08;

    // Add acceleration offset for visual fast-forward
    if (timeMultiplier > 1.1) {
      timeAccelOffset += (timeMultiplier - 1) * (1 / 60); // per frame offset
    }

    const { hourAngle, minuteAngle, secondAngle } = getClockHandAngles(new Date(), timeAccelOffset);

    hourHand.rotation.z = hourAngle;
    minuteHand.rotation.z = minuteAngle;
    secondHandGroup.rotation.z = secondAngle;

    // Shader second angle for glow sweep
    const shaderSecondAngle = Math.PI / 2 + secondAngle;
    material.uniforms.uSecondAngle.value = shaderSecondAngle;
  }

  function applyThemeColors(theme: ThemeColors): void {
    material.uniforms.uColorInner.value.set(...theme.inner);
    material.uniforms.uColorMid.value.set(...theme.mid);
    material.uniforms.uColorOuter.value.set(...theme.outer);
    material.uniforms.uColorAccent.value.set(...theme.accent);

    renderer.setClearColor(theme.clearColor, 1);
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.set(theme.fogColor);
    }

    // Update hand colors
    secondMainMat.color.set(theme.secondHand);
    secondGlowMat.color.set(theme.secondGlow);
    secondTailMat.color.set(theme.secondTail);
    tipMat.color.set(theme.secondHand);
    (centerOuter.material as THREE.MeshBasicMaterial).color.set(theme.centerGlow);
    (centerDot.material as THREE.MeshBasicMaterial).color.set(theme.centerDot);
    (centerGlow.material as THREE.MeshBasicMaterial).color.set(theme.centerGlow);

    // Update aurora band colors
    const configs = [
      { color1: theme.inner, color2: theme.mid },
      { color1: theme.mid, color2: theme.outer },
      { color1: theme.outer, color2: theme.accent },
    ];
    auroraBands.forEach((band, i) => {
      const mat = band.material as THREE.ShaderMaterial;
      if (configs[i]) {
        mat.uniforms.uColor1.value.set(configs[i].color1[0], configs[i].color1[1], configs[i].color1[2]);
        mat.uniforms.uColor2.value.set(configs[i].color2[0], configs[i].color2[1], configs[i].color2[2]);
      }
    });
  }

  function updatePoetryShards(elapsed: number): void {
    const source = pointerHitActive ? pointerLocal : new THREE.Vector3(0.72, 0.04, 0);
    const radial = new THREE.Vector3(source.x, source.y, 0);
    if (radial.lengthSq() < 0.01) {
      radial.set(1, 0, 0);
    }
    radial.normalize();
    const tangent = new THREE.Vector3(-radial.y, radial.x, 0);
    const visibility = Math.max(0, Math.min(1, (pointerForce - 0.18) / 0.9));
    const visibleLines = getPoetryLineWindowForHourSector(poetryHourSector, poetryShards.poetryLineIndices, 2);

    poetryShards.shards.forEach((shard) => {
      const visibleSlot = visibleLines.indexOf(shard.poetryLineIndex);
      if (visibleSlot < 0) {
        shard.material.opacity = 0;
        return;
      }

      const phase = elapsed * 0.78 + shard.phase;
      const drift = visibility * (0.2 + visibleSlot * 0.14 + Math.sin(phase) * 0.035);
      const side = (visibleSlot - 0.5) * 0.28;
      const base = source
        .clone()
        .add(radial.clone().multiplyScalar(0.28 + visibleSlot * 0.12))
        .add(tangent.clone().multiplyScalar(side));
      const position = base
        .add(radial.clone().multiplyScalar(shard.velocity.length() * drift))
        .add(tangent.clone().multiplyScalar(Math.sin(phase * 1.3) * 0.045 * visibility));
      position.z = 0.26 + visibleSlot * 0.035 + Math.sin(phase * 0.9) * 0.02 * visibility;

      shard.sprite.position.lerp(position, 0.32);
      shard.sprite.rotation.z = Math.atan2(radial.y, radial.x) * 0.12 - 0.05 + Math.sin(phase) * 0.025;
      const scale = 1.08 + visibility * 0.42;
      shard.sprite.scale.set(shard.height * shard.aspect * scale, shard.height * scale, 1);
      shard.material.opacity = visibility * (0.9 - visibleSlot * 0.1) * (0.9 + Math.sin(phase * 1.7) * 0.08);
    });
  }

  function render(now: number): void {
    if (!running) return;

    const elapsed = (now - startedAt) / 1000;
    const loop = normalizeLoopTime(elapsed, LOOP_DURATION_SECONDS);
    material.uniforms.uLoop.value = loop;
    pointerForce += (pointerTargetForce - pointerForce) * 0.24;
    material.uniforms.uPointerForce.value = pointerForce;
    material.uniforms.uTime.value = elapsed;
    material.uniforms.uBreathPhase.value = elapsed * 1.6; // ~4s period

    updateClockHands(elapsed);

    // Star field time
    starField.material.uniforms.uTime.value = elapsed;
    // Slow counter-rotation of star field
    starField.points.rotation.z = -elapsed * 0.015;

    // Aurora band time
    auroraBands.forEach(band => {
      const mat = band.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = elapsed;
    });

    // Lens flare pulse
    const flarePulse = 0.9 + Math.sin(elapsed * 1.5) * 0.15;
    lensFlare.scale.setScalar(flarePulse * 1.2);

    // Rotate outer arcs slowly
    outerArcs.rotation.z = elapsed * 0.08;

    // Pulse the center glow
    const pulse = 0.8 + Math.sin(elapsed * 3) * 0.2;
    centerGlow.scale.setScalar(pulse);
    updatePoetryShards(elapsed);

    const orbit = loop * Math.PI * 2 * interactionState.orbitSpeed;
    const cameraZoom = interactionState.zoom + Math.cos(orbit) * 0.18 * interactionState.orbitSpeed;
    camera.position.set(0, 0, cameraZoom);
    camera.lookAt(0, 0, 0);

    const autoX = 0;
    const autoY = 0;
    dial.rotation.z = 0;
    dial.rotation.x = interactionState.rotationX + autoX;
    dial.rotation.y = interactionState.rotationY + autoY;

    renderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(render);
  }

  function start(): void {
    if (running) return;
    running = true;
    const now = performance.now();
    if (pausedAt > 0) {
      startedAt += now - pausedAt;
      pausedAt = 0;
    } else {
      startedAt = now;
    }
    animationFrame = window.requestAnimationFrame(render);
  }

  function stop(): void {
    if (!running) return;
    running = false;
    pausedAt = performance.now();
    window.cancelAnimationFrame(animationFrame);
  }

  function replay(): void {
    startedAt = performance.now();
    pausedAt = 0;
    timeAccelOffset = 0;
    if (!running) start();
  }

  function setInteractionState(nextState: InteractionState): void {
    interactionState = { ...nextState };
  }

  function setPointerFromClient(clientX: number, clientY: number, force = 1): void {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera(pointerNdc, camera);
    dial.updateMatrixWorld(true);
    const worldPlane = dialPlane.clone().applyMatrix4(dial.matrixWorld);
    const hit = raycaster.ray.intersectPlane(worldPlane, pointerWorld);
    if (!hit) return;
    dial.worldToLocal(pointerLocal.copy(hit));
    material.uniforms.uPointer.value.copy(pointerLocal);
    poetryHourSector = getClockHourSector(pointerLocal.x, pointerLocal.y);
    pointerTargetForce = force;
    pointerHitActive = true;
  }

  function clearPointer(): void {
    material.uniforms.uPointer.value.set(99, 99, 99);
    pointerTargetForce = 0;
    pointerHitActive = false;
  }

  function setTheme(theme: ThemeName): void {
    currentTheme = THEMES[theme];
    applyThemeColors(currentTheme);
  }

  function setTimeMultiplier(multiplier: number): void {
    targetTimeMultiplier = Math.max(1, Math.min(multiplier, 30));
  }

  function dispose(): void {
    stop();
    window.removeEventListener('resize', resize);
    geometry.dispose();
    material.dispose();
    glyphAtlas.texture.dispose();
    poetryShards.shards.forEach((shard) => shard.material.dispose());
    poetryShards.textures.forEach((texture) => texture.dispose());
    renderer.dispose();
  }

  window.addEventListener('resize', resize);
  resize();
  renderer.render(scene, camera);

  return {
    renderer,
    start,
    stop,
    replay,
    setInteractionState,
    setPointerFromClient,
    clearPointer,
    setTheme,
    setTimeMultiplier,
    dispose
  };
}

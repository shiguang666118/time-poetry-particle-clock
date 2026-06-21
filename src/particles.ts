import {
  TIME_POETRY_CLEAN_LINES,
  getTimePoetryGlyphIndex
} from './poetry';

export interface WatchParticleData {
  count: number;
  positions: Float32Array;
  scatter: Float32Array;
  delay: Float32Array;
  intensity: Float32Array;
  voidMask: Float32Array;
  rimMask: Float32Array;
  glyphIndex: Float32Array;
  glyphStrength: Float32Array;
}

interface PointRecord {
  x: number;
  y: number;
  z: number;
  scatterX: number;
  scatterY: number;
  scatterZ: number;
  delay: number;
  intensity: number;
  voidMask: number;
  rimMask: number;
  glyphIndex: number;
  glyphStrength: number;
}

interface PointOptions {
  voidMask?: number;
  rimMask?: number;
  scatterBoost?: number;
  intensityBoost?: number;
  lineIndex?: number;
  charOffset?: number;
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function addPoint(
  points: PointRecord[],
  x: number,
  y: number,
  z: number,
  random: () => number,
  options: PointOptions = {}
): void {
  const angle = Math.atan2(y, x);
  const radius = Math.hypot(x, y);
  const voidMask = clamp01(options.voidMask ?? 0);
  const rimMask = clamp01(options.rimMask ?? 0);
  const edgeBias = clamp01((radius - 1.1) / 0.42);
  const waveDelay = (angle / (Math.PI * 2) + 1) % 1;
  const ruptureBoost = voidMask * 0.68 + rimMask * 0.72 + (options.scatterBoost ?? 0);
  const lift = 0.05 + random() * 0.2 + edgeBias * 0.42 + ruptureBoost * 0.26;
  const burst = 0.18 + edgeBias * 0.82 + random() * 0.22 + ruptureBoost * 0.54;
  const tangent = angle + Math.PI / 2;
  const glyphStrength = clamp01(0.08 + edgeBias * 0.72 + rimMask * 0.85 + random() * 0.18);
  const lineIndex = options.lineIndex ?? Math.floor((angle + Math.PI) / (Math.PI * 2) * TIME_POETRY_CLEAN_LINES.length);
  const charOffset = options.charOffset ?? Math.floor(radius * 18 + angle * 5);

  points.push({
    x,
    y,
    z,
    scatterX:
      Math.cos(angle) * burst +
      Math.cos(tangent) * (random() - 0.5) * 0.36,
    scatterY:
      Math.sin(angle) * burst +
      Math.sin(tangent) * (random() - 0.5) * 0.36,
    scatterZ: lift * (random() > 0.35 ? 1 : -0.55),
    delay: waveDelay,
    intensity: clamp01(0.28 + edgeBias * 0.62 + rimMask * 0.42 + (options.intensityBoost ?? 0) + random() * 0.22),
    voidMask,
    rimMask,
    glyphIndex: getTimePoetryGlyphIndex(lineIndex, charOffset),
    glyphStrength
  });
}

export function createWatchParticleData(seed = 1): WatchParticleData {
  const random = mulberry32(seed);
  const points: PointRecord[] = [];

  for (let ring = 0; ring < 74; ring += 1) {
    const radius = 0.13 + ring * 0.0186;
    const ringPoints = Math.max(24, Math.floor(radius * 250));
    for (let index = 0; index < ringPoints; index += 1) {
      const angle = (index / ringPoints) * Math.PI * 2;
      const skipCenter = radius < 0.26 && index % 3 !== 0;
      if (skipCenter) continue;
      addPoint(
        points,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        (random() - 0.5) * 0.002,
        random,
        {
          lineIndex: ring,
          charOffset: index
        }
      );
    }
  }

  const outerRings = [1.43, 1.47, 1.51, 1.55, 1.59];
  for (let ringIndex = 0; ringIndex < outerRings.length; ringIndex += 1) {
    const radius = outerRings[ringIndex];
    const ringPoints = 760;
    for (let index = 0; index < ringPoints; index += 1) {
      const angle = (index / ringPoints) * Math.PI * 2;
      addPoint(
        points,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        0.012 + (radius - 1.43) * 0.42,
        random,
        {
          lineIndex: 18 + ringIndex,
          charOffset: index
        }
      );
    }
  }

  for (let mark = 0; mark < 60; mark += 1) {
    const angle = (mark / 60) * Math.PI * 2;
    const length = mark % 5 === 0 ? 0.2 : 0.09;
    const thickness = mark % 5 === 0 ? 12 : 5;
    for (let lane = 0; lane < thickness; lane += 1) {
      for (let step = 0; step < 10; step += 1) {
        const radius = 1.18 + (step / 9) * length + (lane - thickness / 2) * 0.0022;
        addPoint(
          points,
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          0.026 + random() * 0.01,
          random,
          {
            lineIndex: mark,
            charOffset: step + lane
          }
        );
      }
    }
  }

  const positions = new Float32Array(points.length * 3);
  const scatter = new Float32Array(points.length * 3);
  const delay = new Float32Array(points.length);
  const intensity = new Float32Array(points.length);
  const voidMask = new Float32Array(points.length);
  const rimMask = new Float32Array(points.length);
  const glyphIndex = new Float32Array(points.length);
  const glyphStrength = new Float32Array(points.length);

  points.forEach((point, index) => {
    const offset = index * 3;
    positions[offset] = point.x;
    positions[offset + 1] = point.y;
    positions[offset + 2] = point.z;
    scatter[offset] = point.scatterX;
    scatter[offset + 1] = point.scatterY;
    scatter[offset + 2] = point.scatterZ;
    delay[index] = point.delay;
    intensity[index] = point.intensity;
    voidMask[index] = point.voidMask;
    rimMask[index] = point.rimMask;
    glyphIndex[index] = point.glyphIndex;
    glyphStrength[index] = point.glyphStrength;
  });

  return {
    count: points.length,
    positions,
    scatter,
    delay,
    intensity,
    voidMask,
    rimMask,
    glyphIndex,
    glyphStrength
  };
}

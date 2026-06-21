import { describe, expect, it } from 'vitest';
import { createWatchParticleData } from './particles';
import { TIME_POETRY_GLYPHS } from './poetry';

describe('createWatchParticleData', () => {
  it('creates stable watch particles for the same seed', () => {
    const first = createWatchParticleData(42);
    const second = createWatchParticleData(42);

    expect(first.count).toBeGreaterThan(6000);
    expect(first.positions.length).toBe(first.count * 3);
    expect(first.scatter.length).toBe(first.count * 3);
    expect(first.delay.length).toBe(first.count);
    expect(first.intensity.length).toBe(first.count);
    expect(first.voidMask.length).toBe(first.count);
    expect(first.rimMask.length).toBe(first.count);
    expect(first.glyphIndex.length).toBe(first.count);
    expect(first.glyphStrength.length).toBe(first.count);
    expect(Array.from(first.positions.slice(0, 24))).toEqual(Array.from(second.positions.slice(0, 24)));
  });

  it('keeps erosion metadata normalized', () => {
    const data = createWatchParticleData(9);
    const delays = Array.from(data.delay);
    const intensities = Array.from(data.intensity);
    const voidMask = Array.from(data.voidMask);
    const rimMask = Array.from(data.rimMask);
    const glyphStrength = Array.from(data.glyphStrength);

    expect(Math.min(...delays)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...delays)).toBeLessThanOrEqual(1);
    expect(Math.min(...intensities)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...intensities)).toBeLessThanOrEqual(1);
    expect(Math.min(...voidMask)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...voidMask)).toBeLessThanOrEqual(1);
    expect(Math.min(...rimMask)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...rimMask)).toBeLessThanOrEqual(1);
    expect(Math.min(...glyphStrength)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...glyphStrength)).toBeLessThanOrEqual(1);
  });

  it('keeps the watch face intact until pointer interaction is applied', () => {
    const data = createWatchParticleData(12);
    const voided = Array.from(data.voidMask).filter((value) => value > 0.55).length;
    const rim = Array.from(data.rimMask).filter((value) => value > 0.55).length;

    expect(voided).toBe(0);
    expect(rim).toBe(0);
  });

  it('assigns glyphs from the time poetry atlas', () => {
    const data = createWatchParticleData(18);
    const glyphIndices = Array.from(data.glyphIndex);

    expect(TIME_POETRY_GLYPHS.length).toBeGreaterThan(40);
    expect(Math.min(...glyphIndices)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...glyphIndices)).toBeLessThan(TIME_POETRY_GLYPHS.length);
    expect(new Set(glyphIndices.slice(0, 400)).size).toBeGreaterThan(12);
  });
});

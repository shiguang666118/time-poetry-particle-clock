import { describe, expect, it } from 'vitest';
import {
  TIME_POETRY_CLEAN_LINES,
  TIME_POETRY_GLYPHS,
  TIME_POETRY_LINES,
  getClockHourSector,
  getPoetryLineWindow,
  getPoetryLineWindowForHourSector,
  getTimePoetryGlyphIndex
} from './poetry';

describe('time poetry glyph source', () => {
  it('keeps a substantial set of time and study poetry lines', () => {
    expect(TIME_POETRY_LINES.length).toBeGreaterThanOrEqual(36);
    expect(TIME_POETRY_CLEAN_LINES.every((line) => line.length > 0)).toBe(true);
    expect(TIME_POETRY_GLYPHS.length).toBeGreaterThan(80);
  });

  it('maps glyph indices in poem order instead of random isolated characters', () => {
    const line = TIME_POETRY_CLEAN_LINES[0];
    const reconstructed = Array.from({ length: line.length }, (_, index) => {
      return TIME_POETRY_GLYPHS[getTimePoetryGlyphIndex(0, index)];
    }).join('');

    expect(reconstructed).toBe(line);
  });

  it('wraps through a line without leaving the glyph atlas', () => {
    const line = TIME_POETRY_CLEAN_LINES[1];
    const glyphs = Array.from({ length: line.length * 2 + 3 }, (_, index) => {
      return TIME_POETRY_GLYPHS[getTimePoetryGlyphIndex(1, index)];
    });

    expect(glyphs.join('').startsWith(line + line)).toBe(true);
    expect(glyphs.every(Boolean)).toBe(true);
  });

  it('maps pointer positions to upright clock hour sectors', () => {
    expect(getClockHourSector(0, 1)).toBe(12);
    expect(getClockHourSector(0.5, 0.866)).toBe(1);
    expect(getClockHourSector(0.866, 0.5)).toBe(2);
    expect(getClockHourSector(1, 0)).toBe(3);
    expect(getClockHourSector(0, -1)).toBe(6);
  });

  it('limits large visible poetry lines to a small hour-sector-selected window', () => {
    const first = getPoetryLineWindowForHourSector(1, [0, 1, 2, 3], 2);
    const later = getPoetryLineWindowForHourSector(2, [0, 1, 2, 3], 2);

    expect(first).toHaveLength(2);
    expect(new Set(first).size).toBe(2);
    expect(later).toHaveLength(2);
    expect(later).not.toEqual(first);
    expect([...first, ...later].every((index) => index >= 0 && index < TIME_POETRY_CLEAN_LINES.length)).toBe(true);
  });

  it('selects poetry lines by clock sector while preserving 12 o clock as the first slot', () => {
    expect(getPoetryLineWindowForHourSector(12, [3, 8, 12], 2)).toEqual([3, 8]);
    expect(getPoetryLineWindowForHourSector(1, [3, 8, 12], 2)).toEqual([8, 12]);
    expect(getPoetryLineWindowForHourSector(2, [3, 8, 12], 2)).toEqual([12, 3]);
    expect(getPoetryLineWindowForHourSector(3, [3, 8, 12], 2)).toEqual([3, 8]);

    expect(getPoetryLineWindow(2.9, [3, 8, 12], 2)).toEqual([12, 3]);
  });
});

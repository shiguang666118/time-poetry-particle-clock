import { describe, expect, it } from 'vitest';
import { normalizeLoopTime } from './timeline';

describe('normalizeLoopTime', () => {
  it('wraps elapsed seconds into a normalized loop position', () => {
    expect(normalizeLoopTime(26, 25)).toBeCloseTo(1 / 25, 8);
  });

  it('keeps exact loop boundaries at zero', () => {
    expect(normalizeLoopTime(50, 25)).toBe(0);
  });
});

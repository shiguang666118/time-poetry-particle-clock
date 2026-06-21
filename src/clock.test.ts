import { describe, expect, it } from 'vitest';
import { getClockHandAngles } from './clock';

describe('getClockHandAngles', () => {
  it('uses the actual current time instead of a fixed pose', () => {
    const time = new Date(2026, 5, 17, 3, 15, 30, 500);
    const angles = getClockHandAngles(time);

    expect(angles.secondAngle).toBeCloseTo(-(30.5 / 60) * Math.PI * 2, 8);
    expect(angles.minuteAngle).toBeCloseTo(-((15 + 30.5 / 60) / 60) * Math.PI * 2, 8);
    expect(angles.hourAngle).toBeCloseTo(-((3 + (15 + 30.5 / 60) / 60) / 12) * Math.PI * 2, 8);
  });
});

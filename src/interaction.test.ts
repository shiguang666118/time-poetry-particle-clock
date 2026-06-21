import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INTERACTION_STATE,
  applyDragRotation,
  clampZoom,
  updateControlValue
} from './interaction';

describe('interaction state', () => {
  it('accumulates drag rotation from pointer movement', () => {
    const state = applyDragRotation(DEFAULT_INTERACTION_STATE, 24, -12);

    expect(state.rotationX).toBeCloseTo(DEFAULT_INTERACTION_STATE.rotationX - 0.024);
    expect(state.rotationY).toBeCloseTo(DEFAULT_INTERACTION_STATE.rotationY + 0.048);
  });

  it('clamps zoom to the supported camera range', () => {
    expect(clampZoom(2)).toBe(5.2);
    expect(clampZoom(12)).toBe(10.5);
    expect(clampZoom(8.4)).toBe(8.4);
  });

  it('updates control values inside their bounds', () => {
    const state = updateControlValue(DEFAULT_INTERACTION_STATE, 'burst', 2);

    expect(state.burst).toBe(1.6);
    expect(updateControlValue(state, 'glow', -1).glow).toBe(0.25);
  });
});

export type ThemeName = 'aurora' | 'cyber' | 'gold';

export const THEME_ORDER: ThemeName[] = ['aurora', 'cyber', 'gold'];

export interface InteractionState {
  rotationX: number;
  rotationY: number;
  zoom: number;
  burst: number;
  orbitSpeed: number;
  glow: number;
  autopilot: boolean;
  theme: ThemeName;
  timeMultiplier: number;
}

export type NumericControl = 'burst' | 'orbitSpeed' | 'glow' | 'zoom';

export const DEFAULT_INTERACTION_STATE: InteractionState = {
  rotationX: -0.82,
  rotationY: 0.18,
  zoom: 8.15,
  burst: 1,
  orbitSpeed: 1,
  glow: 1,
  autopilot: true,
  theme: 'aurora',
  timeMultiplier: 1
};

const CONTROL_LIMITS: Record<NumericControl, { min: number; max: number }> = {
  burst: { min: 0.15, max: 1.6 },
  orbitSpeed: { min: 0, max: 1.8 },
  glow: { min: 0.25, max: 1.8 },
  zoom: { min: 5.2, max: 10.5 }
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampZoom(value: number): number {
  return clamp(value, CONTROL_LIMITS.zoom.min, CONTROL_LIMITS.zoom.max);
}

export function applyDragRotation(state: InteractionState, deltaX: number, deltaY: number): InteractionState {
  return {
    ...state,
    autopilot: false,
    rotationX: clamp(state.rotationX + deltaY * 0.002, -0.95, 0.32),
    rotationY: clamp(state.rotationY + deltaX * 0.002, -0.95, 0.95)
  };
}

export function updateControlValue(
  state: InteractionState,
  control: NumericControl,
  value: number
): InteractionState {
  const limits = CONTROL_LIMITS[control];
  return {
    ...state,
    [control]: clamp(value, limits.min, limits.max)
  };
}

export function toggleAutopilot(state: InteractionState): InteractionState {
  return {
    ...state,
    autopilot: !state.autopilot
  };
}

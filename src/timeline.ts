export const LOOP_DURATION_SECONDS = 25;

export function normalizeLoopTime(
  elapsedSeconds: number,
  durationSeconds = LOOP_DURATION_SECONDS
): number {
  if (!Number.isFinite(elapsedSeconds) || !Number.isFinite(durationSeconds)) {
    throw new Error('Loop time inputs must be finite numbers.');
  }

  if (durationSeconds <= 0) {
    throw new Error('Loop duration must be greater than zero.');
  }

  return ((elapsedSeconds % durationSeconds) + durationSeconds) % durationSeconds / durationSeconds;
}

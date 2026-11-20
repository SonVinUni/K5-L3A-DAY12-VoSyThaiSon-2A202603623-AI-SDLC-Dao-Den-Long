export function frameMetrics(samples) {
  if (!samples.length || samples.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('No valid benchmark frame intervals.')
  }
  const frames = samples.length
  const sorted = samples.toSorted((a, b) => a - b)
  const tail = sorted.slice(-Math.max(1, Math.ceil(frames * .01)))
  const sum = (values) => values.reduce((total, value) => total + value, 0)
  return { frames, avg_fps: 1000 * frames / sum(samples),
    p1_low_fps: 1000 * tail.length / sum(tail), frame_ms_p95: sorted[Math.ceil(frames * .95) - 1] }
}

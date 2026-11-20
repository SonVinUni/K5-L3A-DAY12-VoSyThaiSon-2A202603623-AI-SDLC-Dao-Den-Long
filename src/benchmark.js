import { createBenchGame, stepBench } from './bench-scene.js'
import { frameMetrics } from './bench-metrics.js'
import { createWorld } from './world.js'

export function startBenchmark(host, seed, duration) {
  const world = createWorld(host, { pixelRatio: 1 })
  const game = createBenchGame(seed)
  const samples = []
  const warmup = 3000
  return new Promise((resolve, reject) => {
    let first, previous
    const frame = (stamp) => {
      try {
        first ??= stamp
        const elapsed = stamp - first
        const goalTick = Math.floor(elapsed * .06)
        while (game.tick < goalTick) stepBench(game)
        world.draw(game, elapsed * 2 * Math.PI / 15000, elapsed / 1000, 'bench')
        if (previous === undefined) window.lanternBenchFirstFrame?.()
        if (elapsed >= warmup && elapsed <= warmup + duration * 1000 &&
            previous !== undefined && previous - first >= warmup && stamp > previous) samples.push(stamp - previous)
        previous = stamp
        if (elapsed >= warmup + duration * 1000) {
          resolve({ ...frameMetrics(samples), renderer: world.rendererLabel() })
        } else requestAnimationFrame(frame)
      } catch (error) {
        reject(error)
      }
    }
    requestAnimationFrame(frame)
  })
}

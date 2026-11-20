import { writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { defaultInput, newGame, seededRandom, stepGame } from '../src/simulation.js'

const rssMb = () => process.memoryUsage().rss / 1048576

function soak(seed, nights) {
  const started = performance.now()
  const results = []
  let crashes = 0
  let mem_start_mb = 0
  for (let i = 1; i <= nights; i += 1) {
    const nightSeed = seed + i
    try {
      let game = newGame(nightSeed, {}, 1 + (i - 1) % 3)
      if (i === 1) mem_start_mb = rssMb()
      const random = seededRandom(nightSeed)
      const input = { ...defaultInput }
      for (let tick = 0; tick < game.startTime * 60 && game.state === 'playing'; tick += 1) {
        if (tick % 30 === 0) {
          const angle = random() * Math.PI * 2
          input.move = [Math.cos(angle), Math.sin(angle)]
        }
        input.jump = random() < .05
        input.dash = random() < .03
        input.pulse = random() < .02
        input.interact = random() < .10
        stepGame(game, input)
      }
      results.push(game.state)
      game = null
    } catch (error) {
      crashes += 1
      results.push('crash')
      console.error('Đêm ' + i + ': ' + error.message)
    }
  }
  return { nights, crashes, results, mem_start_mb, mem_end_mb: rssMb(),
    duration_s: (performance.now() - started) / 1000 }
}

try {
  const { values } = parseArgs({ options: {
    seed: { type: 'string' }, nights: { type: 'string' }, out: { type: 'string' },
  } })
  const seed = Number(values.seed)
  const nights = Number(values.nights)
  if (!/^-?\d+$/.test(values.seed ?? '') || !/^\d+$/.test(values.nights ?? '') ||
      !Number.isSafeInteger(seed) || !Number.isSafeInteger(nights) || nights < 1 ||
      !Number.isSafeInteger(seed + nights) || !values.out) throw new Error('Tham số soak không hợp lệ.')
  const result = soak(seed, nights)
  await writeFile(values.out, JSON.stringify(result, null, 2) + '\n')
  if (result.crashes) process.exitCode = 1
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}

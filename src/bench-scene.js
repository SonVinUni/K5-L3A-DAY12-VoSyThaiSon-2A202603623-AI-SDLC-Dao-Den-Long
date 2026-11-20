import { moveWanderingShade, updateSafety } from './enemies.js'
import { newGame, seededRandom } from './simulation.js'

const goldenAngle = Math.PI * (3 - Math.sqrt(5))

function spread(random, total, radius, height) {
  const shift = random() * 2 * Math.PI
  return Array.from({ length: total }, (_, i) => {
    const angle = i * goldenAngle + shift + random() * .03
    const dist = Math.sqrt((i + .5) / total) * radius
    return [dist * Math.cos(angle), height, dist * Math.sin(angle)]
  })
}

export function createBenchGame(seed) {
  const random = seededRandom(seed)
  return newGame(seed, {
    random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
    shades: spread(random, 200, 38, .8).map((pos) => ({ pos, state: 'wander' })),
    motes: spread(random, 100, 37, 0),
    lanterns: [1, 2, 3].map((id) => ({ id: 'L' + id, lit: true, fuel: 100 })),
  })
}

export function stepBench(game) {
  game.tick += 1
  game.sim_tick += 1
  updateSafety(game)
  for (const shade of game.shades) moveWanderingShade(game, shade)
}

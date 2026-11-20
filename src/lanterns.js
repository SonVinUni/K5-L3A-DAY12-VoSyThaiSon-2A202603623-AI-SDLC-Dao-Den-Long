import { HZ, tuning } from './rules.js'

const epsilon = 1e-8
const maximum = tuning.fuel_max * HZ
const lowThreshold = tuning.low_fuel_threshold * HZ
const fuelPerMote = tuning.fuel_per_mote * HZ
const drainPerTick = tuning.drain_per_s
const decayPerTick = tuning.fuel_decay_per_s

export const lanternFuel = (lantern) => Number((lantern.fuelUnits / HZ).toFixed(1))
export const isSafeLantern = (lantern) => lantern.lit && lantern.fuelUnits >= lowThreshold
export const isWeakLantern = (lantern) => lantern.lit && lantern.fuelUnits < lowThreshold
export const metersTo = (pos, target) => Math.hypot(pos[0] - target[0], pos[2] - target[2])
export const capacity = (successes) => Math.min(tuning.capacity_max, tuning.carry_capacity + 2 * successes)
export const ignitionCost = (lantern) => lantern.ever_lit ? tuning.relight_cost : tuning.lantern_cost
export const dawnTarget = (count) => Math.ceil(tuning.win_ratio * count - epsilon)

export function makeLanterns(positions, updates = []) {
  return positions.map((point, index) => {
    const id = 'L' + (index + 1)
    const update = updates.find((lantern) => lantern.id === id)
    const deposited = update?.deposited ?? 0
    const cost = update?.ever_lit ? tuning.relight_cost : tuning.lantern_cost
    const lit = update?.lit ?? deposited >= cost
    const fuel = update?.fuel ?? tuning.fuel_max
    // A supplied value below the safe threshold cannot round up into it.
    const fuelUnits = lit ? Math.floor(fuel * HZ + epsilon) : 0
    return { id, pos: [...(update?.pos ?? point)], deposited, lit, fuelUnits,
      ever_lit: lit || (update?.ever_lit ?? false), relit_count: 0 }
  })
}

export function closestLantern(lanterns, pos, accepts, limit = Infinity) {
  let closest
  let best = Infinity
  for (const lantern of lanterns) {
    if (!accepts(lantern)) continue
    const range = metersTo(pos, lantern.pos)
    if (range <= limit + epsilon && range < best - epsilon) {
      closest = lantern
      best = range
    }
  }
  return closest
}

export function interactiveLantern(game) {
  return closestLantern(game.lanterns, game.player.pos, (lantern) =>
    lantern.lit ? lantern.fuelUnits < maximum : lantern.deposited < ignitionCost(lantern),
  tuning.interact_radius)
}

export function addLight(game, emit) {
  const player = game.player
  if (!player.carried) return
  const lantern = interactiveLantern(game)
  if (!lantern) return
  if (lantern.lit) {
    const amount = Math.min(player.carried, Math.ceil((maximum - lantern.fuelUnits) / fuelPerMote))
    if (!amount) return
    lantern.fuelUnits = Math.min(maximum, lantern.fuelUnits + amount * fuelPerMote)
    player.carried -= amount
    game.score += amount * tuning.score.per_mote
    emit('refuel', { lantern_id: lantern.id, amount, fuel: lanternFuel(lantern) })
    return
  }

  const relight = lantern.ever_lit
  const cost = ignitionCost(lantern)
  const amount = Math.min(player.carried, cost - lantern.deposited)
  if (!amount) return
  lantern.deposited += amount
  player.carried -= amount
  game.score += amount * tuning.score.per_mote
  emit('deposit', { lantern_id: lantern.id, amount, deposited: lantern.deposited })
  if (lantern.deposited !== cost) return

  lantern.lit = lantern.ever_lit = true
  lantern.fuelUnits = maximum
  player.successful_lights += 1
  if (relight) lantern.relit_count += 1
  game.score += relight ? tuning.score.per_relit : tuning.score.per_lantern
  emit('lantern_lit', { lantern_id: lantern.id, relight })
}

export function burnFuel(game, emit) {
  for (const lantern of game.lanterns) {
    if (!lantern.lit) continue
    const drainers = lantern.fuelUnits > 0 && isWeakLantern(lantern) ? game.shades.filter((shade) =>
      shade.state === 'drain' && shade.target_lantern_id === lantern.id &&
      metersTo(shade.pos, lantern.pos) <= 2 + epsilon) : []
    lantern.fuelUnits = Math.max(0, lantern.fuelUnits - decayPerTick - drainPerTick * drainers.length)
    for (const shade of drainers) {
      shade.drainTicks += 1
      if (shade.drainTicks % HZ === 0) {
        emit('fuel_drain', { lantern_id: lantern.id, shade_id: shade.id, fuel: lanternFuel(lantern) })
      }
    }
    if (lantern.fuelUnits === 0) {
      lantern.lit = false
      lantern.deposited = 0
      emit('lantern_out', { lantern_id: lantern.id })
    }
  }
}

export function dawnBonus(lanterns, flames) {
  return flames * tuning.score.per_flame_left + lanterns.reduce((score, lantern) =>
    score + (lantern.lit ? tuning.score.per_lit_at_dawn + Math.floor(lantern.fuelUnits / HZ) : 0), 0)
}

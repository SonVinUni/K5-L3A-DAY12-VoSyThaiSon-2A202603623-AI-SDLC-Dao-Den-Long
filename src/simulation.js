import { HZ, tuning } from './rules.js'
import { addLight, burnFuel, capacity, dawnBonus, dawnTarget, interactiveLantern, lanternFuel, makeLanterns } from './lanterns.js'
import { maps, surface } from './maps.js'
import { movePlayer } from './physics.js'
import { contacts, emitPulse, makeDrifter, makeShade, moveEnemies, updateSafety, xz } from './enemies.js'

export { HZ, tuning }
export const START_SEED = 42
export const buttons = ['jump', 'interact', 'pulse', 'dash', 'pause']
export const defaultInput = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false,
  pulse: false, dash: false, pause: false }
export const distance = xz
const epsilon = 1e-8

function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), state | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

function idFactory(prefix, supplied = []) {
  const reserved = new Set(supplied.map(({ id }) => id).filter(Boolean))
  let sequence = 0
  return () => {
    let id
    do { id = prefix + (++sequence) } while (reserved.has(id))
    reserved.add(id)
    return id
  }
}

function byId(a, b) {
  const idA = /^([A-Za-z]+)([0-9]+)$/.exec(a.id)
  const idB = /^([A-Za-z]+)([0-9]+)$/.exec(b.id)
  if (idA && idB && idA[1] === idB[1]) {
    const difference = Number(idA[2]) - Number(idB[2])
    if (difference) return difference
  }
  return a.id === b.id ? 0 : a.id < b.id ? -1 : 1
}

function moteIndex(map, pos) {
  return map.motes.findIndex((point) => xz(point, pos) < epsilon && Math.abs(point[1] - pos[1]) < epsilon)
}

function addMote(game, pos, kind, ticks = 0, point = -1, id = game.nextMote()) {
  game.motes.set(id, { id, pos: [...pos], kind, ticks, point })
}

function randomMote(game) {
  const used = new Set(Array.from(game.motes.values(), ({ point }) => point))
  const emptyPoints = game.map.motes.map((_, index) => index).filter((index) => !used.has(index))
  if (!emptyPoints.length) return
  const point = emptyPoints[Math.floor(game.random() * emptyPoints.length)]
  addMote(game, game.map.motes[point], 'random', 0, point)
}

function spawnEnemy(game, drifter) {
  const list = drifter ? game.drifters : game.shades
  const valid = game.map.mist.filter((pos) => (drifter || xz(pos, game.player.pos) >= 15 - epsilon) &&
    !list.some((enemy) => enemy.state !== 'removed' && xz(enemy.pos, pos) <= epsilon))
  if (!valid.length) return
  const [x, y, z] = valid[Math.floor(game.random() * valid.length)]
  const heading = game.random() * Math.PI * 2
  const enemy = drifter ? makeDrifter(game.nextDrifter(), [x, y + .85, z], 'idle', 0, 0, heading)
    : makeShade(game.nextShade(), [x, y + .8, z], 'spawning', 30, heading)
  list.push(enemy)
  list.sort(byId)
  return enemy
}

export function newGame(seed = START_SEED, scenario = {}, night = 1) {
  const map = maps[night]
  const start = night === 3 ? [0, 0, -11] : [0, 0, 0]
  const overrides = scenario.player ?? {}
  const pos = [...(overrides.pos ?? start)]
  const lanterns = makeLanterns(map.lanterns, scenario.lanterns)
  const game = {
    tick: 0, sim_tick: 0, night, map, start, state: 'playing', score: 0, jumped: false,
    startTime: scenario.time_left_s ?? tuning['night' + night + '_duration_s'],
    random: seededRandom(seed), safeRadius: tuning.safe_radius, lastInput: { ...defaultInput },
    randomMotes: scenario.random_motes !== false,
    randomShades: scenario.random_shades !== false,
    randomDrifters: night > 1 && scenario.random_drifters !== false,
    windEnabled: night === 3 && scenario.wind_enabled !== false,
    wind: { active: false, dir_deg: 0, warning: false },
    nextMote: idFactory('M', (scenario.motes ?? []).filter((mote) => !Array.isArray(mote))),
    nextShade: idFactory('S', scenario.shades), nextDrifter: idFactory('D', scenario.drifters),
    player: {
      pos, vel: [0, 0, 0], vertical: 0, facing: 0, carried: overrides.carried ?? 0,
      flames: overrides.flames ?? tuning.flames, invuln: overrides.invuln_ticks ?? 0,
      dashCd: overrides.dash_cd_ticks ?? 0, pulseCd: overrides.pulse_cd_ticks ?? 0,
      charm: overrides.charm_ticks ?? 0, successful_lights: overrides.successful_lights ?? 0, dashLeft: 0, launch: null, respawn: 0,
      grounded: surface(night, pos[0], pos[2]) === pos[1],
    },
    lanterns, motes: new Map(), shades: [], drifters: [], charms: [],
  }
  game.time_left_s = game.startTime

  if (scenario.motes) {
    for (const mote of scenario.motes) {
      const pos = Array.isArray(mote) ? mote : mote.pos
      const kind = mote.kind ?? 'random'
      addMote(game, pos, kind, mote.ttl_ticks ?? Math.round((mote.ttl_s ?? 8) * HZ),
        kind === 'random' ? moteIndex(map, pos) : -1, mote.id)
    }
  } else if (game.randomMotes) {
    for (let count = 0; count < 20; count += 1) randomMote(game)
  }
  game.shades = (scenario.shades ?? []).map((shade) =>
    makeShade(shade.id ?? game.nextShade(), shade.pos, shade.state, shade.state_ticks_left,
      game.random() * Math.PI * 2, shade.target_lantern_id)).sort(byId)
  game.drifters = (scenario.drifters ?? []).map((drifter) =>
    makeDrifter(drifter.id ?? game.nextDrifter(), drifter.pos, drifter.state, drifter.stolen,
      drifter.state_ticks_left ?? (drifter.state === 'flee' ? 240 : 0), game.random() * Math.PI * 2)).sort(byId)
  game.charms = (scenario.charms ?? map.charms.map((pos) => ({ pos }))).map((charm, i) => {
    const id = charm.id ?? 'C' + (i + 1)
    const respawn = charm.respawn_ticks ?? charm.respawn_ticks_left ?? Math.round((charm.respawn_s ?? 45) * HZ)
    const available = charm.available ?? true
    const point = charm.pos ?? map.charms[Number(id.slice(1)) - 1] ?? start
    return { id, pos: [...point], available, respawn: available ? 0 : respawn }
  }).sort(byId)

  return game
}

export const nearbyLantern = interactiveLantern

function dropMotes(game, count, center, local) {
  for (let index = 0; index < count; index += 1) {
    let pos = [...center]
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const angle = game.random() * Math.PI * 2
      const radius = local ? 0 : 1.5 + game.random()
      const x = center[0] + radius * Math.cos(angle)
      const z = center[2] + radius * Math.sin(angle)
      const height = surface(game.night, x, z)
      if (height === null) continue
      pos = [x, height, z]
      break
    }
    addMote(game, pos, 'dropped', 480)
  }
}

function advanceCounters(game) {
  game.sim_tick += 1
  game.time_left_s = Math.max(0, game.startTime - game.sim_tick / HZ)
  const player = game.player
  for (const timer of ['invuln', 'dashCd', 'pulseCd', 'charm']) {
    if (player[timer] > 0) player[timer] -= 1
  }
  if (player.charm) player.dashCd = 0
  for (const enemy of [...game.shades, ...game.drifters]) {
    if (enemy.stateTicks > 0) enemy.stateTicks -= 1
  }
  for (const [id, mote] of game.motes) {
    if (mote.kind === 'dropped' && --mote.ticks <= 0) game.motes.delete(id)
  }
  for (const charm of game.charms) {
    if (!charm.available && charm.respawn > 0) charm.respawn -= 1
    if (charm.respawn === 0) charm.available = true
  }
  if (game.windEnabled) {
    const cycle = game.sim_tick % 1800
    if (cycle === 1680) game.wind.dir_deg = Math.floor(game.random() * 360)
    game.wind.warning = cycle >= 1680
    game.wind.active = game.sim_tick >= 1800 && cycle < 300
  }
}

function moveOrRespawn(game, input, pressed, emit) {
  const player = game.player
  if (player.respawn > 0) {
    player.respawn -= 1
    if (player.respawn === 0) {
      player.pos = [...game.start]
      player.vel = [0, 0, 0]
      player.vertical = player.facing = 0
      player.grounded = true
      player.invuln = Math.round(tuning.invuln_s * HZ)
    }
    return false
  }
  movePlayer(game, input, pressed, tuning, emit)
  if (player.pos[1] >= -10) return true

  const lost = player.carried
  player.flames -= 1
  player.carried = 0
  player.respawn = 60
  player.dashLeft = 0
  player.launch = null
  player.vel = [0, 0, 0]
  player.vertical = 0
  emit('player_hit', { by: 'fall', flames: player.flames, dropped: 0, lost })
  return false
}

function collect(game, emit) {
  const player = game.player
  const reachable = (pos) => xz(player.pos, pos) <= tuning.pickup_radius + epsilon &&
    Math.abs(player.pos[1] - pos[1]) <= 1.5 + epsilon
  for (const [id, mote] of game.motes) {
    if (player.carried >= capacity(player.successful_lights)) break
    if (!reachable(mote.pos)) continue
    game.motes.delete(id)
    player.carried += 1
    emit('mote_picked', { carried: player.carried })
  }
  for (const charm of game.charms) {
    if (!charm.available || !reachable(charm.pos)) continue
    charm.available = false
    charm.respawn = 2700
    player.charm = 600
    player.dashCd = 0
    emit('charm_picked', { charm_id: charm.id, charm_ticks: player.charm })
  }
}

function spawn(game, emit) {
  const { sim_tick: tick, map } = game
  if (game.randomMotes && tick % 240 === 0 && game.motes.size < 30) randomMote(game)
  if (game.randomShades && tick >= 300 && (tick - 300) % map.shadePeriod === 0) {
    const batch = tick === 300 ? 2 : 1
    for (let i = 0; i < batch && game.shades.length < map.shadeCap; i += 1) {
      const shade = spawnEnemy(game, false)
      if (shade) emit('shade_spawned', { id: shade.id })
    }
  }
  if (game.randomDrifters && tick % 1200 === 0 &&
      game.drifters.filter(({ state }) => state !== 'removed').length < 2) {
    spawnEnemy(game, true)
  }
}

export function stepGame(game, input) {
  if (game.state === 'won' || game.state === 'lost') return []
  game.tick += 1
  game.jumped = false
  const events = []
  const emit = (name, data) => events.push({ type: 'event', tick: game.tick, name, data })
  const pressed = (button) => input[button] && !game.lastInput[button]
  if (pressed('pause')) {
    game.state = game.state === 'paused' ? 'playing' : 'paused'
    emit(game.state === 'paused' ? 'paused' : 'resumed', {})
  }
  if (game.state === 'paused') {
    game.lastInput = { ...input }
    return events
  }

  advanceCounters(game)
  if (game.sim_tick === 1) emit('night_start', { night: game.night })
  burnFuel(game, emit)
  const activePlayer = game.player.flames > 0 && moveOrRespawn(game, input, pressed, emit)
  if (activePlayer) {
    collect(game, emit)
    if (pressed('interact')) addLight(game, emit)
  }
  updateSafety(game)
  const drop = (count, pos, local) => dropMotes(game, count, pos, local)
  if (activePlayer && pressed('pulse') && !game.player.pulseCd && game.player.carried >= tuning.pulse_cost) {
    emitPulse(game, tuning, emit, drop)
  }
  moveEnemies(game)
  if (activePlayer) contacts(game, tuning, emit, drop)
  spawn(game, emit)
  game.lastInput = { ...input }

  if (game.player.flames <= 0) finish('lost', 'no_flames')
  else if (game.time_left_s === 0) {
    const lit = game.lanterns.filter((lantern) => lantern.lit).length
    if (lit >= dawnTarget(game.lanterns.length)) finish('won', 'dawn_survived')
    else finish('lost', 'dawn')
  }
  return events

  function finish(result, reason) {
    game.state = result
    if (result === 'won') {
      game.score += dawnBonus(game.lanterns, game.player.flames)
    }
    emit('game_over', { result, reason })
  }
}

const round = (value) => Number(value.toFixed(3))
const vector = (pos) => pos.map(round)
const seconds = (ticks) => round(ticks / HZ)

export function snapshot(game) {
  const { tick, sim_tick, state, night, time_left_s, score, wind, player, lanterns, shades, motes, drifters, charms } = game
  return {
    type: 'snapshot', tick, sim_tick, state, night, time_left_s, score,
    wind: { active: wind.active, dir_deg: wind.dir_deg },
    player: { pos: vector(player.pos), vel: vector(player.vel), grounded: player.grounded,
      invuln: player.invuln > 0, flames: player.flames, carried: player.carried,
      capacity: capacity(player.successful_lights),
      dash_cd_s: seconds(player.dashCd), pulse_cd_s: seconds(player.pulseCd), charm_s: seconds(player.charm) },
    lanterns: lanterns.map((lantern) => {
      const { id, pos, lit, deposited, ever_lit, relit_count } = lantern
      return { id, pos: vector(pos), lit, deposited, fuel: lanternFuel(lantern), ever_lit, relit_count }
    }),
    shades: shades.map(({ id, pos, state }) => ({ id, pos: vector(pos), state })),
    motes_active: motes.size,
    motes: Array.from(motes.values(), ({ id, pos, kind, ticks }) =>
      ({ id, pos: vector(pos), kind, ttl_s: kind === 'dropped' ? seconds(ticks) : null })),
    drifters: drifters.filter(({ state }) => state !== 'removed')
      .map(({ id, pos, state, stolen }) => ({ id, pos: vector(pos), state, stolen })),
    charms: charms.map(({ id, available, respawn }) => ({ id, available, respawn_s: seconds(respawn) })),
  }
}

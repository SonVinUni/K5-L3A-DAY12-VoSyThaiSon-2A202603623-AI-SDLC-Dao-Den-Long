import contract from '../game.contract.json' with { type: 'json' }

export const tuning = contract.tuning
export const HZ = 60
export const ISLAND_RADIUS = 27
export const START_SEED = 42
export const buttons = ['jump', 'interact', 'pulse']
export const defaultInput = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false }
const lanternPositions = [[0, 0, 12], [11, 0, 4], [7, 0, -10], [-7, 0, -10], [-11, 0, 4]]
const radians = Math.PI / 180
const dt = 1 / HZ

export function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2])
}

function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), state | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

function polar(radius, angle, height = 0) {
  return [radius * Math.cos(angle), height, radius * Math.sin(angle)]
}

function fieldMotes(random) {
  return Array.from({ length: 67 }, (_, index) => {
    const angle = index * 2.399963 + (random() - 0.5) * 0.18
    const radius = index < 12 ? 2.4 + index * 0.39 : 4 + 21 * Math.sqrt((index - 12 + random()) / 55)
    return polar(radius, angle)
  })
}

export function newGame(seed = START_SEED, scenario = {}) {
  const lanterns = lanternPositions.map((pos, index) => ({
    id: 'L' + (index + 1), pos: [...pos], lit: false, deposited: 0,
  }))
  for (const update of scenario.lanterns ?? []) {
    const lantern = lanterns.find(({ id }) => id === update.id)
    if (update.pos) lantern.pos = [...update.pos]
    if (update.deposited !== undefined) lantern.deposited = update.deposited
    if (update.lit !== undefined) lantern.lit = update.lit
    else if (lantern.deposited >= tuning.lantern_cost) lantern.lit = true
  }

  const random = seededRandom(seed)
  const startMotes = scenario.motes ?? (scenario.random_motes === false ? [] : fieldMotes(random))
  const startShades = scenario.shades ?? []
  const reservedIds = new Set(startShades.map(({ id }) => id).filter(Boolean))
  let shadeId = 0
  function nextShadeId() {
    let id
    do { id = 'S' + (++shadeId) } while (reservedIds.has(id))
    reservedIds.add(id)
    return id
  }
  const startTime = scenario.time_left_s ?? tuning.night1_duration_s

  return {
    tick: 0, state: 'playing', score: 0, startTime, time_left_s: startTime,
    random, nextShadeId, randomShades: scenario.random_shades !== false,
    lastInput: { ...defaultInput }, nextPulse: 0, invulnerableThrough: 0,
    player: {
      pos: [...(scenario.player?.pos ?? [0, 0, 0])],
      carried: scenario.player?.carried ?? 0,
      flames: scenario.player?.flames ?? tuning.flames,
      velocityY: 0,
      facing: 0,
    },
    lanterns,
    motes: new Map(startMotes.map((pos, index) => ['M' + (index + 1), [...pos]])),
    shades: startShades.map(({ pos, id }) => ({
      id: id ?? nextShadeId(), pos: [...pos], state: 'chase', stunnedThrough: 0,
    })),
  }
}

function movePlayer(player, input, jump) {
  const [x, z] = input.move
  const yaw = (input.cam_yaw_deg % 360) * radians
  const directionX = x * Math.cos(yaw) + z * Math.sin(yaw)
  const directionZ = -x * Math.sin(yaw) + z * Math.cos(yaw)
  const step = tuning.player_speed * dt / Math.max(1, Math.hypot(x, z))
  const radius = Math.hypot(player.pos[0], player.pos[2])
  let nextX = player.pos[0] + directionX * step
  let nextZ = player.pos[2] + directionZ * step
  const nextRadius = Math.hypot(nextX, nextZ)
  if (radius <= ISLAND_RADIUS + 1e-9 && nextRadius > ISLAND_RADIUS) {
    nextX *= ISLAND_RADIUS / nextRadius
    nextZ *= ISLAND_RADIUS / nextRadius
  }
  player.pos[0] = nextX
  player.pos[2] = nextZ
  if (x || z) player.facing = Math.atan2(directionX, directionZ)
  if (jump && player.pos[1] <= 0) player.velocityY = 6.1
  if (player.pos[1] !== 0 || player.velocityY !== 0) {
    player.pos[1] = Math.max(0, player.pos[1] + player.velocityY * dt)
    player.velocityY = player.pos[1] ? player.velocityY - 19 * dt : 0
  }
}

export function nearbyLantern(game) {
  let closest
  let best = Infinity
  for (const lantern of game.lanterns) {
    if (lantern.lit) continue
    const meters = distance(game.player.pos, lantern.pos)
    if (meters <= tuning.interact_radius + 1e-9 && meters < best) {
      closest = lantern
      best = meters
    }
  }
  return closest
}

function keepOutsideLanterns(pos, lanterns) {
  for (let pass = 0; pass < lanterns.length; pass += 1) {
    let moved = false
    for (const lantern of lanterns) {
      if (!lantern.lit) continue
      const meters = distance(pos, lantern.pos)
      if (meters >= tuning.safe_radius) continue
      const angle = meters ? Math.atan2(pos[2] - lantern.pos[2], pos[0] - lantern.pos[0]) : 0
      pos[0] = lantern.pos[0] + Math.cos(angle) * (tuning.safe_radius + 1e-8)
      pos[2] = lantern.pos[2] + Math.sin(angle) * (tuning.safe_radius + 1e-8)
      moved = true
    }
    if (!moved) break
  }
}

export function stepGame(game, input) {
  if (game.state !== 'playing') return []
  game.tick += 1
  game.time_left_s = Math.max(0, game.startTime - game.tick / HZ)
  const events = []
  const emit = (name, data) => events.push({ type: 'event', tick: game.tick, name, data })
  const pressed = (button) => input[button] && !game.lastInput[button]
  const player = game.player

  movePlayer(player, input, pressed('jump'))
  for (const [id, pos] of game.motes) {
    if (player.carried >= tuning.carry_capacity) break
    if (distance(player.pos, pos) > tuning.pickup_radius + 1e-9) continue
    game.motes.delete(id)
    player.carried += 1
    game.score += tuning.score.per_mote
    emit('mote_picked', { carried: player.carried })
  }

  if (pressed('interact') && player.carried > 0) {
    const lantern = nearbyLantern(game)
    if (lantern) {
      const amount = Math.min(tuning.lantern_cost - lantern.deposited, player.carried)
      if (amount > 0) {
        lantern.deposited += amount
        player.carried -= amount
        emit('deposit', { lantern_id: lantern.id, amount, deposited: lantern.deposited })
        if (lantern.deposited >= tuning.lantern_cost) {
          lantern.lit = true
          game.score += tuning.score.per_lantern
          emit('lantern_lit', { lantern_id: lantern.id })
        }
      }
    }
  }

  if (pressed('pulse') && player.carried >= tuning.pulse_cost && game.tick >= game.nextPulse) {
    player.carried -= tuning.pulse_cost
    game.nextPulse = game.tick + Math.ceil(tuning.pulse_cooldown_s * HZ)
    const stunned_ids = []
    for (const shade of game.shades) {
      const meters = distance(shade.pos, player.pos)
      if (meters > tuning.pulse_radius + 1e-9) continue
      const angle = meters ? Math.atan2(shade.pos[2] - player.pos[2], shade.pos[0] - player.pos[0]) : 0
      shade.pos[0] += Math.cos(angle) * tuning.pulse_push_m
      shade.pos[2] += Math.sin(angle) * tuning.pulse_push_m
      shade.stunnedThrough = game.tick + Math.ceil(tuning.pulse_stun_s * HZ)
      shade.state = 'stunned'
      game.score += tuning.score.per_stun
      stunned_ids.push(shade.id)
    }
    emit('pulse', { stunned_ids })
  }

  if (game.lanterns.every(({ lit }) => lit)) {
    finish('won', 'all_lit')
  } else {
    const firstSpawn = 12 * HZ
    if (game.randomShades && game.tick >= firstSpawn &&
        (game.tick - firstSpawn) % (24 * HZ) === 0 && game.shades.length < 5) {
      const pos = polar(24, game.random() * Math.PI * 2, 0.9)
      const id = game.nextShadeId()
      game.shades.push({ id, pos, state: 'chase', stunnedThrough: 0 })
      emit('shade_spawned', { id })
    }

    const playerSafe = game.lanterns.some((lantern) =>
      lantern.lit && distance(player.pos, lantern.pos) <= tuning.safe_radius + 1e-9)
    for (const shade of game.shades) {
      if (game.tick < shade.stunnedThrough) {
        keepOutsideLanterns(shade.pos, game.lanterns)
        continue
      }

      shade.state = 'chase'
      const meters = distance(shade.pos, player.pos)
      const stride = Math.min(meters, tuning.shade_speed * dt)
      if (meters > 0) {
        shade.pos[0] += (player.pos[0] - shade.pos[0]) * stride / meters
        shade.pos[2] += (player.pos[2] - shade.pos[2]) * stride / meters
      }
      keepOutsideLanterns(shade.pos, game.lanterns)
      if (playerSafe || game.tick < game.invulnerableThrough || player.flames <= 0 ||
          distance(shade.pos, player.pos) > tuning.shade_hit_radius + 1e-9) continue
      player.flames -= 1
      game.invulnerableThrough = game.tick + Math.ceil(tuning.invuln_s * HZ)
      emit('player_hit', { by: 'shade', flames: player.flames, dropped: 0 })
    }

    if (player.flames <= 0) finish('lost', 'no_flames')
    else if (game.time_left_s === 0) finish('lost', 'dawn')
  }
  game.lastInput = { ...input }
  return events

  function finish(result, reason) {
    game.state = result
    if (result === 'won') {
      game.score += Math.floor(game.time_left_s) * tuning.score.per_second_left +
        player.flames * tuning.score.per_flame_left
    }
    emit('game_over', { result, reason })
  }
}

const roundPos = (pos) => pos.map((coordinate) => Number(coordinate.toFixed(3)))

export function snapshot(game) {
  const { tick, state, time_left_s, score, player, lanterns, shades, motes } = game
  return {
    type: 'snapshot', tick, sim_tick: tick, state, time_left_s, score,
    player: { pos: roundPos(player.pos), flames: player.flames, carried: player.carried },
    lanterns: lanterns.map(({ id, pos, lit, deposited }) => ({ id, pos: roundPos(pos), lit, deposited })),
    shades: shades.map(({ id, pos, state }) => ({ id, pos: roundPos(pos), state })),
    motes_active: motes.size,
    motes: Array.from(motes, ([id, pos]) => ({ id, pos: roundPos(pos) })),
  }
}

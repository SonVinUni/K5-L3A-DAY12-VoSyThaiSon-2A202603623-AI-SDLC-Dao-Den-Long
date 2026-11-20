import { moveShade } from './physics.js'

export const shadeStates = ['spawning', 'wander', 'chase', 'recoil', 'stunned']
export const drifterStates = ['idle', 'chase', 'flee', 'removed']
export const xz = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2])
const epsilon = 1e-8

function direction(from, to) {
  const range = xz(from, to)
  return range > epsilon ? [(to[0] - from[0]) / range, (to[2] - from[2]) / range] : [1, 0]
}

function withinPulse(pos, player, radius) {
  return Math.hypot(pos[0] - player[0], pos[1] - player[1] - .8,
    pos[2] - player[2]) <= radius + epsilon
}

export function makeShade(id, pos, state = 'chase', stateTicks = 0, angle = 0) {
  return { id, pos: [...pos], state, stateTicks, angle, push: [0, 0], pushLeft: 0, safeExit: null }
}

export function makeDrifter(id, pos, state = 'idle', stolen = 0, stateTicks = 0, angle = 0) {
  return { id, pos: [...pos], state, stolen, stateTicks, angle }
}

function letFlee(drifter, ticks) {
  drifter.state = 'flee'
  drifter.stateTicks = ticks
}

export function updateSafety(game) {
  for (const shade of game.shades) {
    if (shade.safeExit) continue
    const lantern = game.lanterns.find(({ lit, pos }) => lit && xz(shade.pos, pos) < game.safeRadius - epsilon)
    if (lantern) shade.safeExit = { center: lantern.pos, ticks: 30 }
  }
}

export function emitPulse(game, rules, emit, drop) {
  const player = game.player
  player.carried -= rules.pulse_cost
  player.pulseCd = Math.round(rules.pulse_cooldown_s * 60)
  const stunned_ids = []
  for (const shade of game.shades) {
    if (!withinPulse(shade.pos, player.pos, rules.pulse_radius)) continue
    shade.state = 'stunned'
    shade.stateTicks = Math.round(rules.pulse_stun_s * 60)
    shade.push = direction(player.pos, shade.pos).map((axis) => axis * rules.pulse_push_m / 15)
    shade.pushLeft = 15
    game.score += rules.score.per_stun
    stunned_ids.push(shade.id)
  }

  emit('pulse', { stunned_ids })
  for (const drifter of game.drifters) {
    if (!withinPulse(drifter.pos, player.pos, rules.pulse_radius)) continue
    if (drifter.state === 'chase') letFlee(drifter, 240)
    else if (drifter.state === 'flee' && drifter.stolen) {
      const amount = drifter.stolen
      drifter.stolen = 0
      drop(amount, drifter.pos, true)
      letFlee(drifter, 120)
      emit('drifter_drop', { drifter_id: drifter.id, amount })
    }
  }
}

function canReach(game, shade, offset) {
  if (moveShade(game, shade, ...offset)) return true
  let low = 0
  let high = 1
  const before = shade.pos
  for (let i = 0; i < 8; i += 1) {
    const proportion = (low + high) / 2
    if (moveShade(game, shade, offset[0] * proportion, offset[1] * proportion)) low = proportion
    else high = proportion
    shade.pos = before
  }
  if (low > 0) moveShade(game, shade, offset[0] * low, offset[1] * low)
  return false
}

export function moveEnemies(game) {
  const player = game.player
  for (const shade of game.shades) {
    if (shade.safeExit) {
      const { center, ticks } = shade.safeExit
      const range = xz(shade.pos, center)
      const offset = direction(center, shade.pos).map((value) => value * (game.safeRadius + epsilon - range) / ticks)
      shade.pos[0] += offset[0]
      shade.pos[2] += offset[1]
      shade.safeExit.ticks -= 1
      if (shade.safeExit.ticks === 0) shade.safeExit = null
      continue
    }
    if (shade.state === 'spawning' && shade.stateTicks > 0) continue
    if (shade.state === 'stunned' || shade.state === 'recoil') {
      if (shade.pushLeft > 0) {
        if (canReach(game, shade, shade.push)) shade.pushLeft -= 1
        else shade.pushLeft = 0
      }
      if (shade.stateTicks > 0) continue
    }

    const range = xz(shade.pos, player.pos)
    if (shade.state !== 'chase' || range > 18) shade.state = range <= 12 ? 'chase' : 'wander'
    if (shade.state === 'chase') {
      const stride = Math.min(range, game.map.shadeSpeed / 60)
      canReach(game, shade, direction(shade.pos, player.pos).map((value) => value * stride))
    } else if (!moveShade(game, shade, Math.cos(shade.angle) * 1.5 / 60, Math.sin(shade.angle) * 1.5 / 60)) {
      shade.angle += Math.PI * .67
    }
  }

  for (const drifter of game.drifters) {
    if (drifter.state === 'removed') continue
    if (drifter.state === 'flee' && drifter.stateTicks <= 0) {
      drifter.state = 'removed'
      continue
    }
    if (drifter.state !== 'flee') {
      drifter.state = player.carried >= 5 && xz(drifter.pos, player.pos) <= 15 + epsilon ? 'chase' : 'idle'
    }
    const range = xz(drifter.pos, player.pos)
    const heading = drifter.state === 'flee' ? direction(player.pos, drifter.pos)
      : drifter.state === 'chase' ? direction(drifter.pos, player.pos) : [Math.cos(drifter.angle), Math.sin(drifter.angle)]
    const stride = drifter.state === 'idle' ? 2 / 60
      : drifter.state === 'chase' ? Math.min(7 / 60, range) : 7 / 60
    drifter.pos[0] += heading[0] * stride
    drifter.pos[2] += heading[1] * stride
    if (drifter.state === 'idle') drifter.angle += .012
  }
}

export function contacts(game, rules, emit, drop) {
  const player = game.player
  for (const drifter of game.drifters) {
    if (drifter.state !== 'chase' || xz(drifter.pos, player.pos) > 1.2 + epsilon || !player.carried) continue
    drifter.stolen = Math.min(3, player.carried)
    player.carried -= drifter.stolen
    letFlee(drifter, 240)
    emit('drifter_steal', { drifter_id: drifter.id, amount: drifter.stolen, carried: player.carried })
  }
  if (player.invuln || player.flames <= 0 || game.lanterns.some(({ lit, pos }) =>
    lit && xz(pos, player.pos) <= rules.safe_radius + epsilon)) return

  for (const shade of game.shades) {
    if (shade.safeExit || !['chase', 'wander'].includes(shade.state) ||
        xz(shade.pos, player.pos) > rules.shade_hit_radius + epsilon ||
        Math.abs(shade.pos[1] - player.pos[1]) > 1.5 + epsilon) continue
    player.flames -= 1
    player.invuln = Math.round(rules.invuln_s * 60)
    const dropped = Math.floor(player.carried * rules.hit_drop_ratio)
    player.carried -= dropped
    drop(dropped, player.pos, false)
    shade.state = 'recoil'
    shade.stateTicks = 60
    shade.pushLeft = 60
    shade.push = direction(player.pos, shade.pos).map((axis) => axis * 2 / 60)
    emit('player_hit', { by: 'shade', flames: player.flames, dropped })
    break
  }
}

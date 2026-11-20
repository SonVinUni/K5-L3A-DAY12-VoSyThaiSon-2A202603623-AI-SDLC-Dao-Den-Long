import { blocked, surface } from './maps.js'

const step = 1 / 60
const epsilon = 1e-8
const gravity = 20

export function movePlayer(game, input, pressed, rules, emit) {
  const player = game.player
  const [x, z] = input.move
  const rad = (input.cam_yaw_deg % 360) * Math.PI / 180
  const magnitude = Math.max(1, Math.hypot(x, z))
  const direction = [(x * Math.cos(rad) + z * Math.sin(rad)) / magnitude,
    (-x * Math.sin(rad) + z * Math.cos(rad)) / magnitude]
  if (x || z) player.facing = Math.atan2(direction[0], direction[1])
  if (pressed('dash') && !player.dashLeft && !player.dashCd) {
    player.dashLeft = Math.round(rules.dash_duration_s * 60)
    player.dashCd = player.charm ? 0 : Math.round(rules.dash_cooldown_s * 60)
    player.dashDirection = [Math.sin(player.facing), Math.cos(player.facing)]
    emit('dash', {})
  }

  const dashing = player.dashLeft > 0
  if (pressed('jump') && player.grounded && !dashing) {
    player.vertical = 7
    player.grounded = false
    game.jumped = true
  }
  const speed = dashing ? rules.dash_speed : player.charm ? 7.2 : rules.player_speed
  const horizontal = dashing ? player.dashDirection.map((value) => value * speed)
    : player.launch ?? direction.map((value) => value * speed)
  const angle = game.wind.dir_deg * Math.PI / 180
  const [windX, windZ] = game.wind.active ? [Math.cos(angle) * 2, Math.sin(angle) * 2] : [0, 0]
  const [oldX, oldY, oldZ] = player.pos
  let newX = oldX + (horizontal[0] + windX) * step
  let newZ = oldZ + (horizontal[1] + windZ) * step
  if (blocked(game.night, player.pos, newX, newZ)) {
    if (blocked(game.night, player.pos, newX, oldZ)) newX = oldX
    if (blocked(game.night, player.pos, newX, newZ)) newZ = oldZ
  }

  const floor = surface(game.night, newX, newZ)
  const followGround = player.grounded && floor !== null && Math.abs(floor - oldY) <= .14
  let newY = followGround ? floor : oldY
  if (!followGround && !dashing) {
    player.grounded = false
    newY += (player.vertical - gravity * step / 2) * step
    player.vertical -= gravity * step
    if (floor !== null && player.vertical <= 0 && newY <= floor && oldY + epsilon >= floor) {
      newY = floor
      player.vertical = 0
      player.grounded = true
      player.launch = null
    }
  }
  if (!followGround && dashing) player.grounded = false
  player.pos = [newX, newY, newZ]
  player.vel = [(newX - oldX) * 60, player.grounded || dashing ? 0 : player.vertical, (newZ - oldZ) * 60]
  if (dashing) player.dashLeft -= 1

  if (player.grounded) {
    const pad = game.map.pads.find(({ pos }) =>
      Math.abs(newY - pos[1]) <= epsilon && Math.hypot(newX - pos[0], newZ - pos[2]) <= 1 + epsilon)
    if (pad) {
      const dx = pad.target?.[0] - newX
      const dz = pad.target?.[1] - newZ
      const distance = Math.hypot(dx, dz)
      const launchDirection = pad.direction ?? [dx / distance, dz / distance]
      player.launch = launchDirection.map((value) => value * pad.speed)
      player.vertical = pad.vertical
      player.vel = [player.launch[0], pad.vertical, player.launch[1]]
      player.grounded = false
      game.jumped = true
    }
  }
}

export function moveShade(game, shade, dx, dz) {
  const x = shade.pos[0] + dx
  const z = shade.pos[2] + dz
  const floor = surface(game.night, x, z)
  const before = surface(game.night, shade.pos[0], shade.pos[2])
  if (floor === null || (before !== null && Math.abs(floor - before) > .2) ||
      blocked(game.night, shade.pos, x, z)) return false
  if (game.lanterns.some((lantern) => lantern.lit &&
      Math.hypot(x - lantern.pos[0], z - lantern.pos[2]) < game.safeRadius - epsilon)) return false
  shade.pos = [x, shade.pos[1] + (before === null ? 0 : floor - before), z]
  return true
}

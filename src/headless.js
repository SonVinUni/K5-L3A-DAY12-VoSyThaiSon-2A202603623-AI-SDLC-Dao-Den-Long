import { createWriteStream, readFileSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { parseArgs } from 'node:util'
import { buttons, defaultInput, newGame, snapshot, stepGame, tuning } from './simulation.js'
import { shadeStates, drifterStates } from './enemies.js'
import { maps } from './maps.js'

const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const count = (value) => Number.isSafeInteger(value) && value >= 0
const seconds = (value) => Number.isFinite(value) && value >= 0
const position = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)
const boolean = (value) => typeof value === 'boolean'
const identifier = (value) => typeof value === 'string' && value.trim().length > 0
const bounded = (max) => (value) => count(value) && value <= max

function requireValid(valid, field) {
  if (!valid) throw new Error('Trường không hợp lệ: ' + field)
}

function fields(object, checks, path) {
  for (const [name, check] of Object.entries(checks)) {
    if (Object.hasOwn(object, name)) requireValid(check(object[name]), path + '.' + name)
  }
}

function validateFrames(document) {
  requireValid(record(document) && Array.isArray(document.frames), 'frames')
  let previous = -1
  const checks = {
    move: (value) => Array.isArray(value) && value.length === 2 &&
      value.every((axis) => Number.isFinite(axis) && Math.abs(axis) <= 1),
    cam_yaw_deg: Number.isFinite,
  }
  for (const button of buttons) checks[button] = boolean
  for (const frame of document.frames) {
    requireValid(record(frame) && count(frame.tick) && frame.tick > previous, 'frames[].tick')
    fields(frame, checks, 'frames[]')
    previous = frame.tick
  }
  return document.frames
}

function entities(document, key, checks, { requirePos = false, allowVector = false } = {}) {
  if (!Object.hasOwn(document, key)) return
  requireValid(Array.isArray(document[key]), key)
  const ids = new Set()
  for (const item of document[key]) {
    if (allowVector && position(item)) continue
    requireValid(record(item) && (!requirePos || position(item.pos)), key + '[].pos')
    fields(item, { pos: position, id: identifier, ...checks }, key + '[]')
    if (item.id !== undefined) {
      requireValid(!ids.has(item.id), key + '[].id')
      ids.add(item.id)
    }
  }
}

function validateScenario(document, night) {
  requireValid(record(document), 'scenario')
  fields(document, {
    random_motes: boolean, random_shades: boolean, random_drifters: boolean,
    wind_enabled: boolean, time_left_s: seconds,
  }, 'scenario')
  if (Object.hasOwn(document, 'player')) {
    requireValid(record(document.player), 'player')
    fields(document.player, {
      pos: position, carried: bounded(tuning.carry_capacity), flames: count,
      invuln_ticks: count, dash_cd_ticks: count, pulse_cd_ticks: count, charm_ticks: count,
    }, 'player')
  }
  entities(document, 'motes', { kind: (value) => ['random', 'dropped'].includes(value),
    ttl_ticks: count, ttl_s: seconds }, { requirePos: true, allowVector: true })
  entities(document, 'shades', { state: (value) => shadeStates.includes(value),
    state_ticks_left: count }, { requirePos: true })
  entities(document, 'drifters', { state: (value) => drifterStates.includes(value),
    state_ticks_left: count, stolen: bounded(3) }, { requirePos: true })
  entities(document, 'charms', { available: boolean, respawn_ticks: count, respawn_ticks_left: count, respawn_s: seconds })
  entities(document, 'lanterns', { lit: boolean, deposited: bounded(tuning.lantern_cost) })
  const lanternIds = maps[night].lanterns.map((_, i) => 'L' + (i + 1))
  for (const lantern of document.lanterns ?? []) {
    requireValid(lanternIds.includes(lantern.id), 'lanterns[].id')
  }
  return document
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
}

function* run(game, frames, ticks, interval) {
  const input = { ...defaultInput }
  const inputKeys = Object.keys(input)
  let frameIndex = 0
  yield JSON.stringify(snapshot(game)) + '\n'
  while (game.tick < ticks && (game.state === 'playing' || game.state === 'paused')) {
    const frame = frames[frameIndex]
    if (frame?.tick === game.tick) {
      for (const key of inputKeys) if (Object.hasOwn(frame, key)) input[key] = frame[key]
      frameIndex += 1
    }
    for (const event of stepGame(game, input)) yield JSON.stringify(event) + '\n'
    if (game.tick % interval === 0) yield JSON.stringify(snapshot(game)) + '\n'
  }
  yield JSON.stringify({ type: 'end', ticks: game.tick, state: game.state, score: game.score }) + '\n'
}

async function main() {
  const { values } = parseArgs({
    options: {
      seed: { type: 'string' }, night: { type: 'string' }, ticks: { type: 'string' },
      out: { type: 'string' }, inputs: { type: 'string' }, scenario: { type: 'string' },
      'snapshot-every': { type: 'string', default: '10' },
    },
  })
  const night = Number(values.night)
  const ticks = Number(values.ticks)
  const interval = Number(values['snapshot-every'])
  if (!/^-?\d+$/.test(values.seed ?? '') || !Number.isSafeInteger(Number(values.seed)) ||
      !/^[123]$/.test(values.night ?? '') || !/^\d+$/.test(values.ticks ?? '') || !count(ticks) ||
      !values.out || !/^\d+$/.test(values['snapshot-every']) || !count(interval) || interval === 0) {
    throw new Error('Tham số headless không hợp lệ')
  }
  let frames = []
  let scenario = {}
  try {
    if (values.inputs !== undefined) frames = validateFrames(readJson(values.inputs))
    if (values.scenario !== undefined) scenario = validateScenario(readJson(values.scenario), night)
  } catch (error) {
    console.error('Inputs hoặc scenario không hợp lệ: ' + error.message)
    process.exitCode = 2
    return
  }
  await pipeline(run(newGame(Number(values.seed), scenario, night), frames, ticks, interval), createWriteStream(values.out))
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})

import { createWriteStream, readFileSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { parseArgs } from 'node:util'
import { buttons, defaultInput, newGame, snapshot, stepGame, tuning } from './simulation.js'

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isCount = (value) => Number.isSafeInteger(value) && value >= 0
const isPosition = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)

function requireValid(valid, field) {
  if (!valid) throw new Error('Trường không hợp lệ: ' + field)
}

function checkOptional(record, key, accepts, path = key) {
  if (Object.hasOwn(record, key)) requireValid(accepts(record[key]), path)
}

function validateFrames(document) {
  requireValid(isRecord(document) && Array.isArray(document.frames), 'frames')
  let previousTick = -1
  for (const frame of document.frames) {
    requireValid(isRecord(frame) && isCount(frame.tick) && frame.tick > previousTick, 'frames[].tick')
    checkOptional(frame, 'move', (move) => Array.isArray(move) && move.length === 2 &&
      move.every((axis) => Number.isFinite(axis) && Math.abs(axis) <= 1), 'frames[].move')
    checkOptional(frame, 'cam_yaw_deg', Number.isFinite, 'frames[].cam_yaw_deg')
    for (const button of [...buttons, 'dash']) {
      checkOptional(frame, button, (value) => typeof value === 'boolean', 'frames[].' + button)
    }
    previousTick = frame.tick
  }
  return document.frames
}

function validateScenario(document) {
  requireValid(isRecord(document), 'scenario')
  checkOptional(document, 'random_motes', (value) => typeof value === 'boolean')
  checkOptional(document, 'random_shades', (value) => typeof value === 'boolean')
  checkOptional(document, 'time_left_s', (value) => Number.isFinite(value) && value >= 0)
  checkOptional(document, 'motes', (value) => Array.isArray(value) && value.every(isPosition))
  const shadeIds = new Set()
  checkOptional(document, 'shades', (value) => Array.isArray(value) && value.every((shade) => {
    if (!isRecord(shade) || !isPosition(shade.pos)) return false
    if (!Object.hasOwn(shade, 'id')) return true
    if (typeof shade.id !== 'string' || !shade.id.trim() || shadeIds.has(shade.id)) return false
    shadeIds.add(shade.id)
    return true
  }))
  if (Object.hasOwn(document, 'player')) {
    const player = document.player
    requireValid(isRecord(player), 'player')
    checkOptional(player, 'pos', isPosition, 'player.pos')
    checkOptional(player, 'carried', (value) => isCount(value) && value <= tuning.carry_capacity, 'player.carried')
    checkOptional(player, 'flames', isCount, 'player.flames')
  }
  if (Object.hasOwn(document, 'lanterns')) {
    requireValid(Array.isArray(document.lanterns), 'lanterns')
    const seen = new Set()
    for (const lantern of document.lanterns) {
      requireValid(isRecord(lantern) && typeof lantern.id === 'string' &&
        /^L[1-5]$/.test(lantern.id) && !seen.has(lantern.id), 'lanterns[].id')
      seen.add(lantern.id)
      checkOptional(lantern, 'pos', isPosition, 'lanterns[].pos')
      checkOptional(lantern, 'lit', (value) => typeof value === 'boolean', 'lanterns[].lit')
      checkOptional(lantern, 'deposited', (value) => isCount(value) &&
        value <= tuning.lantern_cost, 'lanterns[].deposited')
    }
  }
  return document
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
}

function* run(game, frames, ticks, interval) {
  const input = { ...defaultInput }
  let frameIndex = 0
  yield JSON.stringify(snapshot(game)) + '\n'
  while (game.tick < ticks && game.state === 'playing') {
    const frame = frames[frameIndex]
    if (frame?.tick === game.tick) {
      Object.assign(input, frame)
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
  const ticks = Number(values.ticks)
  const interval = Number(values['snapshot-every'])
  if (!/^-?\d+$/.test(values.seed ?? '') || !Number.isSafeInteger(Number(values.seed)) ||
      values.night !== '1' || !/^\d+$/.test(values.ticks ?? '') || !isCount(ticks) ||
      !values.out || !/^\d+$/.test(values['snapshot-every']) || !isCount(interval) || interval === 0) {
    throw new Error('Tham số headless không hợp lệ')
  }
  let frames = []
  let scenario = {}
  try {
    if (values.inputs !== undefined) frames = validateFrames(readJson(values.inputs))
    if (values.scenario !== undefined) scenario = validateScenario(readJson(values.scenario))
  } catch (error) {
    console.error('Inputs hoặc scenario không hợp lệ: ' + error.message)
    process.exitCode = 2
    return
  }
  await pipeline(run(newGame(Number(values.seed), scenario), frames, ticks, interval), createWriteStream(values.out))
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, rmdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultInput, distance, newGame, stepGame, tuning } from '../src/simulation.js'
import { test } from 'node:test'

const cli = fileURLToPath(new URL('../src/headless.js', import.meta.url))
const noRandom = { random_motes: false, random_shades: false }
const inputs = (...frames) => ({ frames })
const events = (run) => run.rows.filter(({ type }) => type === 'event')
const snapshots = (run) => run.rows.filter(({ type }) => type === 'snapshot')

function run({ scenario, frames, ticks = 1, interval = 1, seed = 42 } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'lantern-test-'))
  const output = join(directory, 'out.jsonl')
  const scenarioFile = join(directory, 'scenario.json')
  const inputsFile = join(directory, 'inputs.json')
  const args = [cli, '--seed', String(seed), '--night', '1', '--ticks', String(ticks),
    '--snapshot-every', String(interval), '--out', output]
  try {
    if (scenario !== undefined) {
      writeFileSync(scenarioFile, JSON.stringify(scenario))
      args.push('--scenario', scenarioFile)
    }
    if (frames !== undefined) {
      writeFileSync(inputsFile, JSON.stringify(frames))
      args.push('--inputs', inputsFile)
    }
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' })
    assert.ifError(result.error)
    if (result.status !== 0) return result
    const raw = readFileSync(output, 'utf8')
    const rows = raw.trimEnd().split('\n').map(JSON.parse)
    return { ...result, raw, rows, end: rows.at(-1) }
  } finally {
    for (const file of [output, scenarioFile, inputsFile]) rmSync(file, { force: true })
    rmdirSync(directory)
  }
}

test('tick 0 comes before input, yaw and move persist across partial frames', () => {
  const result = run({ ticks: 3, scenario: noRandom, frames: inputs(
    { tick: 0, move: [0, 1] }, { tick: 1, cam_yaw_deg: 90 }) })
  assert.equal(result.status, 0)
  const step = tuning.player_speed / 60
  assert.deepEqual(snapshots(result).map(({ player }) => player.pos), [
    [0, 0, 0], [0, 0, step], [step, 0, step], [step * 2, 0, step],
  ])
  assert.equal(snapshots(result)[1].time_left_s, tuning.night1_duration_s - 1 / 60)
  assert.deepEqual(result.end, { type: 'end', ticks: 3, state: 'playing', score: 0 })
})

test('zero ticks and sparse snapshots follow the specified output schedule', () => {
  const zero = run({ ticks: 0, scenario: noRandom })
  assert.deepEqual(zero.rows.map((row) => [row.type, row.tick ?? row.ticks]), [['snapshot', 0], ['end', 0]])
  const sparse = run({ ticks: 21, interval: 10, scenario: noRandom })
  assert.deepEqual(snapshots(sparse).map(({ tick }) => tick), [0, 10, 20])
  assert.equal(sparse.end.ticks, 21)
})

test('invalid input and scenario files return code 2 with a stderr message', () => {
  for (const options of [
    { frames: inputs({ tick: 1 }, { tick: 1 }) },
    { frames: inputs({ tick: 1 }, { tick: 0 }) },
    { frames: inputs({ tick: 0, move: [0, 2] }) },
    { frames: inputs({ tick: 0, interact: 1 }) },
    { scenario: { player: { pos: [0, '0', 0] } } },
    { scenario: { shades: [{ pos: [1, 2] }] } },
    { scenario: { lanterns: [{ id: 'L9' }] } },
    { scenario: { random_shades: 'false' } },
  ]) {
    const result = run(options)
    assert.equal(result.status, 2)
    assert.ok(result.stderr.trim())
  }
})

test('scenario overrides only the named lantern and awards no points during setup', () => {
  const result = run({ ticks: 0, scenario: { ...noRandom,
    player: { pos: [4, 0, 5], carried: 3, flames: 2 },
    time_left_s: 125, lanterns: [{ id: 'L3', lit: true, pos: [2, 0, 2] }],
  } })
  const start = result.rows[0]
  assert.deepEqual(start.player, { pos: [4, 0, 5], carried: 3, flames: 2 })
  assert.equal(start.lanterns.length, 5)
  assert.deepEqual(start.lanterns.filter(({ lit }) => lit).map(({ id, pos }) => [id, pos]), [['L3', [2, 0, 2]]])
  assert.equal(start.time_left_s, 125)
  assert.equal(start.motes_active, 0)
  assert.equal(start.score, 0)
  assert.deepEqual(events(result), [])
})

test('pickup occurs at the inclusive XZ boundary and honors carry capacity', () => {
  const result = run({ scenario: { ...noRandom,
    player: { carried: tuning.carry_capacity - 1 },
    motes: [[tuning.pickup_radius, 9, 0], [0, 0, 0]],
  } })
  assert.equal(snapshots(result)[0].motes_active, 2)
  assert.deepEqual(events(result), [{ type: 'event', tick: 1, name: 'mote_picked',
    data: { carried: tuning.carry_capacity } }])
  assert.equal(snapshots(result)[1].motes_active, 1)
  assert.equal(result.end.score, tuning.score.per_mote)
})

test('jump is edge-triggered and lands while the key remains held', () => {
  const result = run({ ticks: 90, scenario: noRandom, frames: inputs({ tick: 0, jump: true }) })
  const history = snapshots(result)
  assert.equal(history[0].player.pos[1], 0)
  assert.ok(history[1].player.pos[1] > 0)
  assert.ok(history[15].player.pos[1] > history[1].player.pos[1])
  assert.ok(history.slice(50).every(({ player }) => player.pos[1] === 0))
})

test('holding interact does not deposit again until released and pressed', () => {
  const result = run({ ticks: 3, scenario: { ...noRandom,
    player: { carried: 2 * tuning.lantern_cost },
    lanterns: [{ id: 'L1', pos: [0, 0, 0] }, { id: 'L2', pos: [1, 0, 0] }],
  }, frames: inputs({ tick: 0, interact: true }, { tick: 1 }, { tick: 2, interact: false }) })
  assert.deepEqual(events(result).map(({ tick, name }) => [tick, name]), [[1, 'deposit'], [1, 'lantern_lit']])
  assert.equal(snapshots(result)[2].player.carried, tuning.lantern_cost)
})

test('pulse costs light, pushes and stuns named shades, and enforces cooldown', () => {
  const result = run({ ticks: 5, scenario: { ...noRandom,
    player: { carried: tuning.pulse_cost * 2 },
    shades: [{ id: 'test-shade', pos: [tuning.pulse_radius, 1, 0] }],
  }, frames: inputs({ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 2, pulse: true }) })
  assert.deepEqual(events(result).map(({ tick, name, data }) => [tick, name, data]), [
    [1, 'pulse', { stunned_ids: ['test-shade'] }],
  ])
  assert.deepEqual(snapshots(result)[1].shades[0], {
    id: 'test-shade', pos: [tuning.pulse_radius + tuning.pulse_push_m, 1, 0], state: 'stunned',
  })
  assert.equal(snapshots(result).at(-1).player.carried, tuning.pulse_cost)
  assert.equal(result.end.score, tuning.score.per_stun)
})

test('shade contact and invulnerability lead to no-flames and stop early', () => {
  const result = run({ ticks: 500, interval: 50, scenario: { ...noRandom,
    player: { flames: 2 }, shades: [{ pos: [0, 1, 0] }],
  } })
  const lastHit = 1 + tuning.invuln_s * 60
  assert.deepEqual(events(result).map(({ tick, name }) => [tick, name]), [
    [1, 'player_hit'], [lastHit, 'player_hit'], [lastHit, 'game_over'],
  ])
  assert.deepEqual(events(result).at(-1).data, { result: 'lost', reason: 'no_flames' })
  assert.equal(result.end.ticks, lastHit)
})

test('a lit lantern protects the player and keeps shades outside its safe radius', () => {
  const result = run({ ticks: 3, scenario: { ...noRandom, shades: [{ pos: [0, 1, 0] }],
    lanterns: [{ id: 'L1', lit: true, pos: [0, 0, 0] }],
  } })
  const after = snapshots(result).at(-1)
  assert.equal(after.player.flames, tuning.flames)
  assert.ok(Math.hypot(after.shades[0].pos[0], after.shades[0].pos[2]) >= tuning.safe_radius)
  assert.deepEqual(events(result), [])
})

test('lighting the last lantern stops early and awards win score once', () => {
  const result = run({ ticks: 300, interval: 10, scenario: { ...noRandom, time_left_s: 45,
    player: { carried: tuning.lantern_cost },
    lanterns: [{ id: 'L1', pos: [0, 0, 0] },
      ...[2, 3, 4, 5].map((number) => ({ id: 'L' + number, lit: true }))],
  }, frames: inputs({ tick: 0, interact: true }) })
  assert.deepEqual(events(result).map(({ name }) => name), ['deposit', 'lantern_lit', 'game_over'])
  assert.deepEqual(events(result).at(-1).data, { result: 'won', reason: 'all_lit' })
  const score = tuning.score.per_lantern + 44 * tuning.score.per_second_left +
    tuning.flames * tuning.score.per_flame_left
  assert.deepEqual(result.end, { type: 'end', ticks: 1, state: 'won', score })
})

test('dawn produces game_over and stops before the requested tick limit', () => {
  const result = run({ ticks: 120, scenario: { ...noRandom, time_left_s: 3 / 60 } })
  assert.equal(result.end.ticks, 3)
  assert.deepEqual(events(result).at(-1).data, { result: 'lost', reason: 'dawn' })
  assert.equal(snapshots(result).at(-1).time_left_s, 0)
})

test('same seed yields identical JSONL including spawned shade IDs', () => {
  const options = { ticks: 850, interval: 120 }
  const first = run(options)
  assert.equal(first.status, 0)
  assert.equal(first.raw, run(options).raw)
  assert.notEqual(first.raw, run({ ...options, seed: 43 }).raw)
  assert.deepEqual(events(first).find(({ name }) => name === 'shade_spawned').data, { id: 'S1' })
})

test('a full default seeded night can be won by gathering motes and visiting all lanterns', () => {
  const game = newGame(42)
  const frames = []
  const compareTo = (pos) => (a, b) => distance(a, pos) - distance(b, pos)

  while (game.state === 'playing') {
    const pos = game.player.pos
    const nearestLantern = game.lanterns.filter(({ lit }) => !lit)
      .sort((a, b) => compareTo(pos)(a.pos, b.pos))[0]
    const canLight = game.player.carried >= tuning.lantern_cost - nearestLantern.deposited
    const target = canLight ? nearestLantern.pos : [...game.motes.values()].sort(compareTo(pos))[0]
    assert.ok(target, 'There must be enough motes to light the island')

    const range = distance(pos, target)
    const interact = canLight && range <= tuning.interact_radius && !game.lastInput.interact
    const move = range > .01 && !interact
      ? [(target[0] - pos[0]) / range, (target[2] - pos[2]) / range] : [0, 0]
    const pulse = !game.lastInput.pulse && game.tick >= game.nextPulse &&
      game.shades.some((shade) => shade.state === 'chase' && distance(shade.pos, pos) < 2)
    frames.push({ tick: game.tick, move, interact, pulse })
    stepGame(game, { ...defaultInput, move, interact, pulse })
  }

  assert.equal(game.state, 'won')
  const replay = run({ ticks: 60 * 300, frames: { frames }, interval: 300 })
  assert.deepEqual(replay.end, { type: 'end', ticks: game.tick, state: 'won', score: game.score })
  assert.equal(events(replay).filter(({ name }) => name === 'lantern_lit').length, 5)
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultInput, distance, newGame, stepGame, tuning } from '../src/simulation.js'
import { events, inputs, quiet, run, snapshots } from './helpers/headless.js'

test('tick 0 precedes input and partial frames retain their previous fields', () => {
  const result = run({ ticks: 3, scenario: quiet, frames: inputs(
    { tick: 0, move: [0, 1] }, { tick: 1, cam_yaw_deg: 90 }) })
  const step = tuning.player_speed / 60
  assert.deepEqual(snapshots(result).map(({ player }) => player.pos), [
    [0, 0, 0], [0, 0, step], [step, 0, step], [step * 2, 0, step],
  ])
  assert.equal(snapshots(result)[1].time_left_s, 300 - 1 / 60)
  assert.deepEqual(result.end, { type: 'end', ticks: 3, state: 'playing', score: 0 })
})

test('zero ticks and sparse snapshots preserve the JSONL schedule', () => {
  const empty = run({ ticks: 0, scenario: quiet })
  assert.deepEqual(empty.rows.map((row) => [row.type, row.tick ?? row.ticks]), [['snapshot', 0], ['end', 0]])
  const sparse = run({ ticks: 21, interval: 10, scenario: quiet })
  assert.deepEqual(snapshots(sparse).map(({ tick }) => tick), [0, 10, 20])
  assert.deepEqual(sparse.rows[1], { type: 'event', tick: 1, name: 'night_start', data: { night: 1 } })
  assert.equal(sparse.end.ticks, 21)
})

test('malformed files produce stderr and exit 2', () => {
  for (const options of [
    { frames: inputs({ tick: 1 }, { tick: 1 }) },
    { frames: inputs({ tick: 1 }, { tick: 0 }) },
    { frames: inputs({ tick: 0, move: [0, 2] }) },
    { frames: inputs({ tick: 0, dash: 1 }) },
    { scenario: { player: { pos: [0, '0', 0] } } },
    { scenario: { shades: [{ pos: [1, 2] }] } },
    { scenario: { lanterns: [{ id: 'L9' }] } },
    { scenario: { random_drifters: 'false' } },
  ]) {
    const result = run(options)
    assert.equal(result.status, 2)
    assert.ok(result.stderr.trim())
  }
})

test('scenario setup updates only the designated lantern and emits no events at tick 0', () => {
  const result = run({ ticks: 0, scenario: { ...quiet, time_left_s: 125,
    player: { pos: [4, 0, 5], carried: 3, flames: 2 },
    lanterns: [{ id: 'L3', lit: true, pos: [2, 0, 2] }],
  } })
  const start = result.rows[0]
  assert.deepEqual(start.player.pos, [4, 0, 5])
  assert.equal(start.player.carried, 3)
  assert.equal(start.player.flames, 2)
  assert.equal(start.lanterns.length, 5)
  assert.deepEqual(start.lanterns.filter(({ lit }) => lit).map(({ id, pos }) => [id, pos]), [['L3', [2, 0, 2]]])
  assert.equal(start.time_left_s, 125)
  assert.equal(start.motes_active, 0)
  assert.equal(start.score, 0)
  assert.deepEqual(events(result), [])
})

test('pickup honors inclusive XZ and height bounds, carry capacity, and scores only when depositing', () => {
  const result = run({ scenario: { ...quiet, player: { carried: 9 },
    motes: [[0, 1.501, 0], [1, 1.5, 0], [0, 0, 0]],
  } })
  assert.deepEqual(events(result), [{ type: 'event', tick: 1, name: 'mote_picked', data: { carried: 10 } }])
  const remaining = snapshots(result)[1].motes
  assert.deepEqual(remaining.map(({ pos }) => pos), [[0, 1.501, 0], [0, 0, 0]])
  assert.equal(result.end.score, 0)
})

test('jump is edge-triggered and lands while the key remains held', () => {
  const result = run({ ticks: 90, scenario: quiet, frames: inputs({ tick: 0, jump: true }) })
  const history = snapshots(result)
  assert.equal(history[0].player.grounded, true)
  assert.ok(history[1].player.pos[1] > 0)
  assert.ok(history[15].player.pos[1] > history[1].player.pos[1])
  assert.ok(history.slice(49).every(({ player }) => player.grounded && player.pos[1] === 0))
})

test('deposit chooses the nearest unlit lantern, breaks ties by ID and requires a new press', () => {
  const result = run({ ticks: 4, scenario: { ...quiet, player: { carried: 10 },
    lanterns: [{ id: 'L1', pos: [-1, 0, 0], deposited: 8 }, { id: 'L2', pos: [1, 0, 0] }],
  }, frames: inputs({ tick: 0, interact: true }, { tick: 2, interact: false }, { tick: 3, interact: true }) })
  assert.deepEqual(events(result).map(({ tick, name, data }) => [tick, name, data]), [
    [1, 'deposit', { lantern_id: 'L1', amount: 2, deposited: 10 }],
    [1, 'lantern_lit', { lantern_id: 'L1' }],
    [4, 'deposit', { lantern_id: 'L2', amount: 8, deposited: 8 }],
  ])
  assert.equal(result.end.score, 200)
})

test('pulse respects 3D range, pushes over 15 ticks, stuns and enforces cooldown', () => {
  const result = run({ ticks: 16, scenario: { ...quiet, player: { carried: 6 },
    shades: [{ id: 'S1', pos: [5, .8, 0] }, { id: 'S2', pos: [5, 1, 0] }],
  }, frames: inputs({ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 2, pulse: true }) })
  assert.deepEqual(events(result)[0].data, { stunned_ids: ['S1'] })
  assert.equal(events(result).filter(({ name }) => name === 'pulse').length, 1)
  const after = snapshots(result)[15]
  assert.deepEqual(after.shades[0], { id: 'S1', pos: [9, .8, 0], state: 'stunned' })
  assert.equal(after.player.carried, 3)
  assert.equal(result.end.score, 5)
})

test('contacts choose the first shade by ID, drop half of carried motes and grant invulnerability', () => {
  const result = run({ ticks: 12, scenario: { ...quiet, player: { carried: 7 },
    shades: [{ id: 'S2', pos: [0, .8, 0] }, { id: 'S1', pos: [0, .8, 0] }],
  } })
  const rows = snapshots(result)
  assert.deepEqual(events(result), [{ type: 'event', tick: 1, name: 'player_hit',
    data: { by: 'shade', flames: 2, dropped: 3 } }])
  assert.equal(rows[1].shades[0].state, 'recoil')
  assert.equal(rows[1].shades[1].state, 'chase')
  assert.equal(rows[1].player.invuln, true)
  assert.equal(rows[1].player.carried, 4)
  assert.equal(rows[1].motes[0].ttl_s, 8)
})

test('lit lantern keeps shades outside after 30 ticks and suppresses contact during evacuation', () => {
  const result = run({ ticks: 35, scenario: { ...quiet, shades: [{ pos: [0, .8, 0] }],
    lanterns: [{ id: 'L1', lit: true, pos: [0, 0, 0] }],
  } })
  const after = snapshots(result).at(-1)
  assert.equal(after.player.flames, 3)
  assert.ok(Math.hypot(after.shades[0].pos[0], after.shades[0].pos[2]) >= 6)
  assert.deepEqual(events(result), [])
})

test('unordered results resolve no flames, then all lamps, then dawn', () => {
  const almostWon = Array.from({ length: 4 }, (_, index) => ({ id: 'L' + (index + 2), lit: true }))
  const won = run({ ticks: 80, interval: 10, scenario: { ...quiet, time_left_s: 1 / 60,
    player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 0] }, ...almostWon],
  }, frames: inputs({ tick: 0, interact: true }) })
  assert.deepEqual(won.end, { type: 'end', ticks: 1, state: 'won', score: 350 })
  const lost = run({ ticks: 30, scenario: { ...quiet, player: { flames: 1 },
    shades: [{ pos: [0, .8, 0] }],
  } })
  assert.deepEqual(events(lost).at(-1).data, { result: 'lost', reason: 'no_flames' })
  assert.equal(lost.end.ticks, 1)
  const dawn = run({ ticks: 120, scenario: { ...quiet, time_left_s: 3 / 60 } })
  assert.deepEqual(events(dawn).at(-1).data, { result: 'lost', reason: 'dawn' })
  assert.equal(dawn.end.ticks, 3)
})

test('same seed produces byte-identical JSONL and spawning IDs; different seed changes the run', () => {
  const options = { ticks: 850, interval: 120 }
  const first = run(options)
  assert.equal(first.raw, run(options).raw)
  assert.notEqual(first.raw, run({ ...options, seed: 43 }).raw)
  assert.deepEqual(events(first).filter(({ name }) => name === 'shade_spawned').slice(0, 2)
    .map(({ tick, data }) => [tick, data.id]), [[300, 'S1'], [300, 'S2']])
})



test('the default Đảo Bến seed can win all five lamps under v1.1 rules', () => {
  const game = newGame(42)
  const frames = []
  const offsets = [0, .32, -.32, .65, -.65, 1, -1, 1.45, -1.45, 2, -2, Math.PI]
  while (game.state === 'playing') {
    const pos = game.player.pos
    const closest = (a, b) => distance(pos, a.pos) - distance(pos, b.pos)
    const lantern = game.lanterns.filter(({ lit }) => !lit).sort(closest)[0]
    const mote = [...game.motes.values()].sort(closest)[0]
    const safe = game.lanterns.filter(({ lit }) => lit).sort(closest)[0]
    const ready = game.player.carried >= tuning.lantern_cost - lantern.deposited
    const target = ready ? lantern.pos : (mote ?? safe)?.pos ?? pos
    const range = distance(pos, target)
    const interact = ready && range <= tuning.interact_radius && !game.lastInput.interact
    const threats = game.shades.filter(({ state, pos: point }) =>
      (state === 'chase' || state === 'wander') && distance(point, pos) < 8)

    let move = [0, 0]
    let deviation = 0
    if (!interact && range > .1) {
      const heading = Math.atan2(target[2] - pos[2], target[0] - pos[0])
      let best = -Infinity
      for (const offset of offsets) {
        const angle = heading + offset
        const direction = [Math.cos(angle), Math.sin(angle)]
        const next = [pos[0] + direction[0] * 2, 0, pos[2] + direction[1] * 2]
        if (Math.hypot(next[0], next[2]) > 39) continue
        const danger = threats.reduce((sum, shade) =>
          sum + Math.max(0, 4 - distance(shade.pos, next)) ** 2, 0)
        const progress = range - distance(next, target) - .42 * danger
        if (progress <= best) continue
        best = progress
        move = direction
        deviation = offset
      }
    }
    const dash = range > 6 && !game.player.dashCd && !game.lastInput.dash && Math.abs(deviation) < 1.1
    const pulse = game.player.carried >= tuning.pulse_cost && !game.player.pulseCd &&
      !game.lastInput.pulse && threats.some((shade) => distance(shade.pos, pos) < 1.6)
    frames.push({ tick: game.tick, move, interact, dash, pulse })
    stepGame(game, { ...defaultInput, move, interact, dash, pulse })
  }
  assert.equal(game.state, 'won')
  const replay = run({ ticks: 18000, frames: { frames }, interval: 600 })
  assert.equal(events(replay).filter(({ name }) => name === 'lantern_lit').length, 5)
  assert.deepEqual(replay.end, { type: 'end', ticks: game.tick, state: 'won', score: game.score })
})

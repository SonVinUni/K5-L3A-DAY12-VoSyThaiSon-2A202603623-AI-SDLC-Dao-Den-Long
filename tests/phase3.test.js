import assert from 'node:assert/strict'
import { test } from 'node:test'
import { capacity, interactiveLantern } from '../src/lanterns.js'
import { defaultInput, newGame, stepGame } from '../src/simulation.js'
import { events, inputs, quiet, run, snapshots } from './helpers/headless.js'

const lit = (id, more = {}) => ({ id, lit: true, ...more })
const lamps = (count) => Array.from({ length: count }, (_, index) => lit('L' + (index + 1)))

test('all lamps lit does not end early, and dawn uses the threshold for each night', () => {
  const early = run({ scenario: { ...quiet, lanterns: lamps(5) }, ticks: 10 })
  assert.equal(early.end.state, 'playing')
  assert.ok(!events(early).some(({ name }) => name === 'game_over'))
  for (const [night, count] of [[1, 3], [2, 4], [3, 5]]) {
    const atDawn = { ...quiet, time_left_s: 1 / 60 }
    const win = run({ night, scenario: { ...atDawn, lanterns: lamps(count) } })
    const loss = run({ night, scenario: { ...atDawn, lanterns: lamps(count - 1) } })
    assert.deepEqual(events(win).at(-1).data, { result: 'won', reason: 'dawn_survived' })
    assert.equal(win.end.score, 150 + count * 149)
    assert.deepEqual(events(loss).at(-1).data, { result: 'lost', reason: 'dawn' })
    assert.equal(loss.end.score, 0)
  }
})

test('fuel exhausted on the dawn tick is removed from the count; the same tick may relight it', () => {
  const base = { ...quiet, time_left_s: 1 / 60,
    lanterns: [lit('L1', { pos: [0, 0, 0], fuel: 1 / 60, deposited: 10 }), lit('L2'), lit('L3')],
  }
  const expired = run({ scenario: base })
  assert.deepEqual(events(expired).map(({ name }) => name), ['lantern_out', 'game_over'])
  assert.deepEqual(events(expired).at(-1).data, { result: 'lost', reason: 'dawn' })
  const lamp = snapshots(expired).at(-1).lanterns[0]
  assert.deepEqual(lamp, { id: 'L1', pos: [0, 0, 0], lit: false, fuel: 0,
    ever_lit: true, deposited: 0, relit_count: 0 })

  const rescued = run({ scenario: { ...base, player: { carried: 5 } },
    frames: inputs({ tick: 0, interact: true }),
  })
  const log = events(rescued)
  assert.deepEqual(log.map(({ name }) => name), ['lantern_out', 'deposit', 'lantern_lit', 'game_over'])
  assert.deepEqual(log[2].data, { lantern_id: 'L1', relight: true })
  assert.deepEqual(log[3].data, { result: 'won', reason: 'dawn_survived' })
  assert.equal(rescued.end.score, 5 * 5 + 40 + 150 + 2 * 149 + 150)
  assert.equal(snapshots(rescued)[1].lanterns[0].relit_count, 1)
  assert.equal(snapshots(rescued)[1].player.capacity, 12)
})

test('losing the last flame on the dawn tick overrides a surviving majority of lamps', () => {
  const result = run({ scenario: { ...quiet, time_left_s: 1 / 60, lanterns: lamps(5),
    player: { pos: [41, -10, 0], flames: 1 } },
  })
  assert.deepEqual(events(result).map(({ name }) => name), ['player_hit', 'game_over'])
  assert.deepEqual(events(result).at(-1).data, { result: 'lost', reason: 'no_flames' })
  assert.equal(result.end.score, 0)
})

test('safe zone uses the exact 30-fuel boundary before snapshot rounding', () => {
  const base = { ...quiet, shades: [{ pos: [0.5, .8, 0], state: 'chase' }] }
  const exact = run({ scenario: { ...base, lanterns: [lit('L1', { pos: [0, 0, 0], fuel: 30 + 1 / 60 })] } })
  const below = run({ scenario: { ...base, lanterns: [lit('L1', { pos: [0, 0, 0], fuel: 30 })] } })
  const exactTick = snapshots(exact)[1]
  const belowTick = snapshots(below)[1]
  assert.equal(exactTick.lanterns[0].fuel, 30)
  assert.equal(belowTick.lanterns[0].fuel, 30)
  assert.equal(exactTick.player.flames, 3)
  assert.equal(belowTick.player.flames, 2)
})

test('restoring a lamp with multiple shades evacuates rather than harming Mây', () => {
  const result = run({ ticks: 30, scenario: { ...quiet, player: { carried: 2 },
    lanterns: [lit('L1', { pos: [0, 0, 0], fuel: 15 })], shades: [
      { id: 'S1', pos: [1, .8, 0], state: 'drain', target_lantern_id: 'L1' },
      { id: 'S2', pos: [0, .8, 1], state: 'chase' },
    ],
  }, frames: inputs({ tick: 0, interact: true }) })
  assert.deepEqual(events(result), [
    { type: 'event', tick: 1, name: 'refuel', data: { lantern_id: 'L1', amount: 2, fuel: 34.9 } },
  ])
  const first = snapshots(result)[1]
  assert.equal(first.shades[0].state, 'wander')
  const end = snapshots(result).at(-1)
  assert.equal(end.player.flames, 3)
  assert.ok(end.shades.every(({ pos }) => Math.hypot(pos[0], pos[2]) >= 6))
  assert.equal(result.end.score, 10)
})

test('capacity increases at lighting, affects pickup only from the next tick, and is capped', () => {
  const result = run({ ticks: 2, scenario: { ...quiet, player: { carried: 10 },
    motes: [[0, 0, 0]], lanterns: [{ id: 'L1', pos: [0, 0, 0], deposited: 9 }],
  }, frames: inputs({ tick: 0, interact: true }) })
  const rows = snapshots(result)
  assert.equal(rows[0].player.capacity, 10)
  assert.equal(rows[1].player.capacity, 12)
  assert.equal(rows[1].player.carried, 9)
  assert.equal(rows[1].motes_active, 1)
  assert.equal(rows[2].player.carried, 10)
  assert.equal(rows[2].motes_active, 0)
  assert.equal(capacity(8), 20)
  const reset = run({ ticks: 0, scenario: { ...quiet, lanterns: lamps(5) } })
  assert.equal(snapshots(reset)[0].player.capacity, 10)
})

test('drain adds five units per second per shade and emits per shade every 60 active ticks', () => {
  const result = run({ ticks: 120, interval: 60, scenario: { ...quiet,
    player: { pos: [0, 0, -20] }, lanterns: [lit('L1', { pos: [0, 0, 0], fuel: 29 })],
    shades: ['S2', 'S1'].map((id) => ({ id, pos: [1, .8, 0], state: 'drain', target_lantern_id: 'L1' })),
  } })
  assert.deepEqual(snapshots(result).map(({ lanterns }) => lanterns[0].fuel), [29, 18, 7])
  assert.deepEqual(events(result).map(({ tick, name, data }) => [tick, name, data.shade_id, data.fuel]), [
    [60, 'fuel_drain', 'S1', 18], [60, 'fuel_drain', 'S2', 18],
    [120, 'fuel_drain', 'S1', 7], [120, 'fuel_drain', 'S2', 7],
  ])
})

test('wander chooses the nearest weak lamp by ID; chase keeps the player as its target', () => {
  const result = run({ ticks: 2, scenario: { ...quiet, player: { pos: [0, 0, -15] },
    lanterns: [lit('L1', { pos: [-1, 0, 0], fuel: 25 }), lit('L2', { pos: [1, 0, 0], fuel: 25 })],
    shades: [{ id: 'S1', pos: [0, .8, 0], state: 'wander' }, { id: 'S2', pos: [0, .8, 0], state: 'chase' }],
  } })
  const [initial, first, next] = snapshots(result)
  assert.equal(initial.shades[0].state, 'wander')
  assert.equal(first.shades[0].state, 'drain')
  assert.equal(first.shades[1].state, 'chase')
  assert.equal(next.lanterns[0].fuel, 24.9)
  assert.equal(next.lanterns[1].fuel, 25)
})

test('a draining shade chases within six meters; hitting a draining shade scores fifteen', () => {
  const scenario = { ...quiet, player: { carried: 3 },
    lanterns: [lit('L1', { pos: [0, 0, 0], fuel: 25 })],
    shades: [{ id: 'S1', pos: [1.5, .8, 0], state: 'drain', target_lantern_id: 'L1' }],
  }
  const chase = run({ scenario })
  assert.equal(snapshots(chase)[1].shades[0].state, 'chase')
  const pulse = run({ ticks: 121, scenario, frames: inputs({ tick: 0, pulse: true }) })
  assert.equal(pulse.end.score, 15)
  assert.deepEqual(events(pulse)[0].data, { stunned_ids: ['S1'] })
  assert.equal(snapshots(pulse)[1].shades[0].state, 'stunned')
  assert.equal(snapshots(pulse)[121].shades[0].state, 'wander')
})

test('full lamps are not selected during interaction and fractional fuel arithmetic is bounded', () => {
  const game = newGame(42, { ...quiet, player: { carried: 3 },
    lanterns: [lit('L1', { pos: [0, 0, 0] }), { id: 'L2', pos: [1, 0, 0] }],
  })
  assert.equal(interactiveLantern(game).id, 'L2')
  const emitted = stepGame(game, { ...defaultInput, interact: true })
  assert.deepEqual(emitted.find(({ name }) => name === 'refuel').data, { lantern_id: 'L1', amount: 1, fuel: 100 })
  assert.equal(interactiveLantern(game).id, 'L2')
  assert.equal(game.player.carried, 2)
})

test('pause stops lamp fuel and the drain cadence, and repeated runs are byte-identical', () => {
  const options = { ticks: 65, scenario: { ...quiet, player: { pos: [0, 0, -20] },
    lanterns: [lit('L1', { pos: [0, 0, 0], fuel: 25 })],
    shades: [{ id: 'S1', pos: [1, .8, 0], state: 'drain', target_lantern_id: 'L1' }],
  }, frames: inputs({ tick: 0, pause: true }, { tick: 1, pause: false }, { tick: 5, pause: true }) }
  const first = run(options)
  const rows = snapshots(first)
  assert.equal(rows[5].lanterns[0].fuel, 25)
  assert.equal(rows[5].sim_tick, 0)
  assert.equal(rows[65].sim_tick, 60)
  assert.deepEqual(events(first).at(-1).data, { lantern_id: 'L1', shade_id: 'S1', fuel: 19 })
  assert.equal(first.raw, run(options).raw)
})

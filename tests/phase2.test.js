import assert from 'node:assert/strict'
import { test } from 'node:test'
import { events, inputs, quiet, run, snapshots } from './helpers/headless.js'

test('three nights use standard maps, timers, IDs, and structured snapshots after the v1.2 upgrade', () => {
  for (const [night, time, lamps, charms] of [[1, 240, 5, 0], [2, 270, 6, 1], [3, 300, 7, 2]]) {
    const result = run({ night, ticks: 0 })
    const state = result.rows[0]
    assert.equal(state.night, night)
    assert.equal(state.time_left_s, time)
    assert.equal(state.motes.length, 20)
    assert.equal(state.lanterns.length, lamps)
    assert.equal(state.charms.length, charms)
    assert.equal(new Set(state.motes.map(({ pos }) => pos.toString())).size, 20)
    assert.deepEqual(state.player.vel, [0, 0, 0])
    assert.deepEqual(state.wind, { active: false, dir_deg: 0 })
  }
})

test('pause holds simulation, motion and all duration counters while wall ticks advance', () => {
  const result = run({ ticks: 6, scenario: { ...quiet,
    player: { invuln_ticks: 5, dash_cd_ticks: 24, pulse_cd_ticks: 30, charm_ticks: 60 },
    motes: [{ pos: [4, 0, 4], kind: 'dropped', ttl_ticks: 50 }],
  }, frames: inputs({ tick: 0, move: [0, 1] }, { tick: 1, pause: true },
    { tick: 2, move: [1, 0], pause: false }, { tick: 4, pause: true }, { tick: 5, pause: false }) })
  const rows = snapshots(result)
  for (const age of [2, 3, 4]) {
    const value = rows[age]
    assert.equal(value.state, 'paused')
    assert.equal(value.sim_tick, 1)
    assert.equal(value.time_left_s, rows[1].time_left_s)
    assert.deepEqual(value.player, rows[1].player)
    assert.deepEqual(value.motes, rows[1].motes)
  }
  assert.equal(rows[5].sim_tick, 2)
  assert.deepEqual(events(result).map(({ tick, name }) => [tick, name]), [[2, 'paused'], [5, 'resumed']])
})

test('dash covers 2.8 m in 12 ticks, preserves altitude and re-arms after 90 simulated ticks', () => {
  const result = run({ ticks: 92, scenario: quiet, frames: inputs({ tick: 0, jump: true },
    { tick: 1, dash: true }, { tick: 2, dash: false }, { tick: 45, dash: true },
    { tick: 46, dash: false }, { tick: 91, dash: true }) })
  const rows = snapshots(result)
  assert.equal(rows[2].player.dash_cd_s, 1.5)
  assert.equal(rows[13].player.pos[2], 2.8)
  assert.equal(rows[1].player.pos[1], rows[13].player.pos[1])
  assert.deepEqual(events(result).filter(({ name }) => name === 'dash').map(({ tick }) => tick), [2, 92])
})

test('fall ignores invulnerability, loses all light once, and respawns after 60 simulated ticks', () => {
  const result = run({ ticks: 67, scenario: { ...quiet,
    player: { pos: [41, -10, 0], carried: 8, invuln_ticks: 450 },
  } })
  const rows = snapshots(result)
  assert.deepEqual(events(result), [{ type: 'event', tick: 1, name: 'player_hit',
    data: { by: 'fall', dropped: 0, lost: 8, flames: 2 } }])
  assert.equal(rows[60].player.pos[0], 41)
  assert.deepEqual(rows[61].player.pos, [0, 0, 0])
  assert.equal(rows[61].player.invuln, true)
  assert.equal(rows[61].player.carried, 0)
})

test('if all lamps are set but the last flame is lost on the same step, loss wins', () => {
  const result = run({ ticks: 20, scenario: { ...quiet, player: { flames: 1, pos: [42, -10, 0] },
    lanterns: Array.from({ length: 5 }, (_, i) => ({ id: 'L' + (i + 1), lit: true })),
  } })
  assert.deepEqual(events(result).at(-1).data, { result: 'lost', reason: 'no_flames' })
})

test('a drifter steals before a shade hits, and stolen light can be recovered by pulse', () => {
  const result = run({ night: 2, ticks: 2, scenario: { ...quiet, player: { carried: 9 },
    shades: [{ pos: [0, .8, 0] }], drifters: [{ id: 'D1', pos: [1, .8, 0], state: 'chase' }],
  }, frames: inputs({ tick: 1, pulse: true }) })
  const log = events(result)
  assert.deepEqual(log.slice(0, 2).map(({ name, data }) => [name, data]), [
    ['drifter_steal', { drifter_id: 'D1', amount: 3, carried: 6 }],
    ['player_hit', { by: 'shade', flames: 2, dropped: 3 }],
  ])
  assert.deepEqual(log.at(-1).data, { drifter_id: 'D1', amount: 3 })
  assert.equal(snapshots(result)[2].drifters[0].stolen, 0)
  assert.equal(snapshots(result)[2].motes.length, 6)
})

test('Gió Lạc spawns at simulation tick 1200, never at that wall tick during pause', () => {
  const result = run({ night: 2, ticks: 1210, interval: 1,
    scenario: { ...quiet, random_drifters: true }, frames: inputs({ tick: 0, pause: true },
      { tick: 1, pause: false }, { tick: 10, pause: true }),
  })
  const rows = snapshots(result)
  assert.equal(rows[1200].drifters.length, 0)
  assert.equal(rows[1210].sim_tick, 1200)
  assert.equal(rows[1210].drifters[0].id, 'D1')
})

test('Bùa Gió has 600 ticks, grants 7.2 m/s and allows edge-triggered dash without cooldown', () => {
  const result = run({ night: 2, ticks: 30, scenario: { ...quiet, charms: [{ id: 'C1', pos: [0, 0, 0] }] },
    frames: inputs({ tick: 1, move: [0, 1] }, { tick: 2, dash: true },
      { tick: 4, dash: false }, { tick: 5, dash: true }, { tick: 6, dash: false }, { tick: 15, dash: true }),
  })
  const rows = snapshots(result)
  assert.deepEqual(events(result)[0].data, { charm_id: 'C1', charm_ticks: 600 })
  assert.equal(rows[2].player.vel[2], 7.2)
  assert.equal(rows[3].player.dash_cd_s, 0)
  assert.equal(rows[1].charms[0].respawn_s, 45)
  assert.deepEqual(events(result).filter(({ name }) => name === 'dash').map(({ tick }) => tick), [3, 16])
})

test('Bùa Gió refreshes and dropped motes expire at the configured simulation ticks', () => {
  const result = run({ night: 2, ticks: 4, scenario: { ...quiet,
    player: { charm_ticks: 3 }, charms: [{ id: 'C1', pos: [1, 0, 0], available: false, respawn_ticks: 2 }],
    motes: [{ pos: [6, 0, 0], kind: 'dropped', ttl_ticks: 3 }],
  } })
  const rows = snapshots(result)
  assert.equal(rows[2].player.charm_s, 10)
  assert.equal(rows[3].motes.length, 0)
  assert.equal(events(result)[0].tick, 2)
})

test('Đảo Cau pad traverses the gap while held movement cannot overwrite launch; bridge stays walkable', () => {
  const leap = run({ night: 2, ticks: 85, scenario: { ...quiet, player: { pos: [20, 0, 18] } },
    frames: inputs({ tick: 1, move: [-1, 0] }),
  })
  const rows = snapshots(leap)
  assert.equal(rows[1].player.vel[1], 14)
  assert.equal(rows[42].player.grounded, false)
  assert.ok(rows[85].player.pos[0] > 42)
  assert.equal(rows[85].player.grounded, true)
  const bridge = run({ night: 2, ticks: 200, scenario: { ...quiet, player: { pos: [25, 0, 0] }, charms: [] },
    frames: inputs({ tick: 0, move: [1, 0] }),
  })
  assert.deepEqual(snapshots(bridge).at(-1).player.pos, [45, 0, 0])
})

test('Đảo Chuông allows ramp traversal and pad landing on the upper disk; its wall blocks walking up', () => {
  const byRamp = run({ night: 3, ticks: 100, scenario: { ...quiet,
    player: { pos: [31 * Math.cos(Math.PI / 6), 0, 15.5] },
  }, frames: inputs({ tick: 0, move: [-Math.cos(Math.PI / 6), -.5] }) })
  assert.equal(snapshots(byRamp).at(-1).player.pos[1], 3)
  const pad = run({ night: 3, ticks: 70, scenario: { ...quiet, player: { pos: [0, 3, 13] } } })
  const top = snapshots(pad).at(-1).player
  assert.equal(top.pos[1], 6)
  assert.equal(top.grounded, true)
  const wall = run({ night: 3, ticks: 60, scenario: { ...quiet, player: { pos: [0, 0, -9] } },
    frames: inputs({ tick: 0, move: [0, 1] }),
  })
  const foot = snapshots(wall).at(-1).player
  assert.equal(foot.pos[1], 0)
  assert.ok(foot.pos[2] <= -8)
})

test('gió mạnh starts at simulation tick 1800, pushes at 2 m/s and expires at 2100', () => {
  const result = run({ night: 3, ticks: 2100, interval: 1, scenario: {
    ...quiet, wind_enabled: true, player: { pos: [0, 0, -26] },
  } })
  const rows = snapshots(result)
  assert.equal(rows[1799].wind.active, false)
  assert.equal(rows[1800].wind.active, true)
  assert.equal(rows[2099].wind.active, true)
  assert.equal(rows[2100].wind.active, false)
  assert.ok(Math.abs(Math.hypot(rows[1800].player.vel[0], rows[1800].player.vel[2]) - 2) < .003)
})

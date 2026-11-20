import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, writeFile, mkdir, readFile, rm, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { createBenchGame, stepBench } from '../src/bench-scene.js'
import { frameMetrics } from '../src/bench-metrics.js'
import { assignBinding, controlCode, defaults, readBindings } from '../src/key-bindings.js'
import { newEntryStore, readEntries } from '../scripts/leaderboard.mjs'
import { startLocalServer } from '../scripts/local-server.mjs'

const script = (name) => fileURLToPath(new URL('../scripts/' + name + '.mjs', import.meta.url))

test('benchmark uses the specified slowest-one-percent mean and nearest-rank p95', () => {
  const samples = [...Array(198).fill(10), 20, 40]
  const stats = frameMetrics(samples)
  assert.equal(stats.frames, 200)
  assert.equal(stats.avg_fps, 200000 / 2040)
  assert.equal(stats.p1_low_fps, 1000 / 30)
  assert.equal(stats.frame_ms_p95, 10)
  assert.throws(() => frameMetrics([]))
})

test('standard benchmark keeps 200 wandering shades, 100 grounded motes, and three full lamps', () => {
  const game = createBenchGame(42)
  assert.equal(game.shades.length, 200)
  assert.equal(game.motes.size, 100)
  assert.deepEqual(game.player.pos, [0, 0, 0])
  const before = game.shades.map(({ pos }) => [...pos])
  for (let tick = 0; tick < 480; tick += 1) stepBench(game)
  assert.ok(game.shades.every(({ state }) => state === 'wander'))
  assert.notDeepEqual(game.shades.map(({ pos }) => pos), before)
  assert.equal(game.motes.size, 100)
  assert.deepEqual(game.lanterns.filter(({ lit }) => lit).map(({ id, fuelUnits }) => [id, fuelUnits]), [
    ['L1', 6000], ['L2', 6000], ['L3', 6000],
  ])
  assert.equal(game.time_left_s, 240)
  assert.equal(game.player.flames, 3)
})

test('soak runs ten seeded nights and records a result for each without errors', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lantern-soak-'))
  try {
    const out = join(directory, 'soak.json')
    const result = spawnSync(process.execPath, [script('soak'), '--seed', '7', '--nights', '10', '--out', out], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(await readFile(out, 'utf8'))
    assert.equal(report.nights, 10)
    assert.equal(report.crashes, 0)
    assert.equal(report.results.length, 10)
    assert.ok(report.results.every((state) => state === 'won' || state === 'lost'))
    assert.ok(report.mem_start_mb > 0 && report.mem_end_mb > 0 && report.duration_s > 0)
  } finally {
    await rm(join(directory, 'soak.json'), { force: true })
    await rmdir(directory)
  }
})

test('key binding changes detect duplicates and leave unaffected default aliases usable', () => {
  const saved = readBindings({})
  assert.deepEqual(saved, defaults)
  assert.ok(assignBinding(saved, 'jump', 'KeyW').error)
  assert.ok(assignBinding(saved, 'jump', 'MetaLeft').error)
  const update = assignBinding(saved, 'jump', 'ArrowUp')
  assert.equal(controlCode(update.bindings, 'ArrowUp'), 'Space')
  assert.equal(controlCode(update.bindings, 'KeyW'), 'KeyW')
  assert.equal(controlCode(update.bindings, 'KeyP'), 'Escape')
  assert.deepEqual(readBindings({ ...saved, left: 'KeyW' }), defaults)
})

test('web leaderboard is persistent, validates names, sorts ties, and exports the same top ten', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lantern-ranks-'))
  const dataPath = join(directory, 'data', 'leaderboard.json')
  const dist = join(directory, 'dist')
  await mkdir(dist)
  await writeFile(join(dist, 'index.html'), '<html lang="vi"><title>Đảo Đèn Lồng</title></html>')
  const entry = (name, score) => ({ name, score, nights_won: 1, seed: 42 })
  const ranks = newEntryStore(dataPath, (() => {
    let value = 1
    return () => new Date(Date.UTC(2026, 0, value++))
  })())
  let server
  try {
    assert.deepEqual(await readEntries(dataPath), [])
    const values = [['First', 100], ['Later', 100], ...Array.from({ length: 10 }, (_, i) => ['User_' + i, i])]
    await Promise.all(values.map(([name, score]) => ranks.add(entry(name, score))))
    server = await startLocalServer({ dist, dataPath })
    const page = await fetch(server.url)
    assert.equal(page.status, 200)
    const reject = await fetch(server.url + '/api/leaderboard', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry('bad name', 500)),
    })
    assert.equal(reject.status, 400)
    const next = await fetch(server.url + '/api/leaderboard', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry('Champion', 200)),
    })
    assert.equal(next.status, 201)
    await server.close()
    server = await startLocalServer({ dist, dataPath })
    const read = await fetch(server.url + '/api/leaderboard')
    const live = await read.json()
    assert.equal(live.entries.length, 10)
    assert.deepEqual(live.entries.slice(0, 3).map(({ name }) => name), ['Champion', 'First', 'Later'])
    const file = join(directory, 'export.json')
    const exported = spawnSync(process.execPath, [script('run'), '--export-leaderboard', file], {
      encoding: 'utf8', env: { ...process.env, DAO_DEN_LONG_LEADERBOARD: dataPath },
    })
    assert.equal(exported.status, 0, exported.stderr)
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), live)
  } finally {
    if (server) await server.close()
    for (const path of [dataPath, join(dist, 'index.html'), join(directory, 'export.json')]) await rm(path, { force: true })
    await rmdir(join(directory, 'data')).catch((error) => { if (error.code !== 'ENOENT') throw error })
    await rmdir(dist)
    await rmdir(directory)
  }
})

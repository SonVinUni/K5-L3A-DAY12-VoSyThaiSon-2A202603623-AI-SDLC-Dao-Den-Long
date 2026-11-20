import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, rmdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('../../src/headless.js', import.meta.url))
export const quiet = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false }
export const inputs = (...frames) => ({ frames })
export const events = (run) => run.rows.filter(({ type, name }) => type === 'event' && name !== 'night_start')
export const snapshots = (run) => run.rows.filter(({ type }) => type === 'snapshot')

export function run({ scenario, frames, ticks = 1, interval = 1, seed = 42, night = 1 } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'lantern-test-'))
  const output = join(directory, 'out.jsonl')
  const args = [cli, '--seed', String(seed), '--night', String(night), '--ticks', String(ticks),
    '--snapshot-every', String(interval), '--out', output]
  const files = []
  try {
    for (const [flag, data] of [['scenario', scenario], ['inputs', frames]]) {
      if (data === undefined) continue
      const file = join(directory, flag + '.json')
      files.push(file)
      writeFileSync(file, JSON.stringify(data))
      args.push('--' + flag, file)
    }
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' })
    assert.ifError(result.error)
    if (result.status !== 0) return result
    const raw = readFileSync(output, 'utf8')
    const rows = raw.trimEnd().split('\n').map(JSON.parse)
    return { ...result, raw, rows, end: rows.at(-1) }
  } finally {
    for (const file of [...files, output]) rmSync(file, { force: true })
    rmdirSync(directory)
  }
}

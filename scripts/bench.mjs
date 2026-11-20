import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { platform, release, arch } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'
import { startLocalServer } from './local-server.mjs'

function preferredChannel() {
  if (process.env.DAO_BENCH_BROWSER) return process.env.DAO_BENCH_BROWSER
  if (process.platform === 'darwin' && existsSync('/Applications/Google Chrome.app')) return 'chrome'
  if (process.platform === 'linux' && existsSync('/usr/bin/google-chrome')) return 'chrome'
  if (process.platform === 'win32' && process.env['ProgramFiles(x86)'] &&
      existsSync(join(process.env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'))) return 'msedge'
}

async function main() {
  const { values } = parseArgs({ options: {
    seed: { type: 'string' }, duration: { type: 'string' }, out: { type: 'string' },
  } })
  const seed = Number(values.seed)
  const duration = Number(values.duration)
  if (!/^-?\d+$/.test(values.seed ?? '') || !Number.isSafeInteger(seed) ||
      !Number.isFinite(duration) || duration <= 0 || !values.out) throw new Error('Tham số benchmark không hợp lệ.')
  const server = await startLocalServer()
  let browser
  try {
    const channel = preferredChannel()
    const executablePath = !channel && process.platform === 'linux'
      ? ['/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync) : undefined
    browser = await chromium.launch({ channel, executablePath, headless: false,
      args: ['--disable-frame-rate-limit', '--disable-gpu-vsync'] })
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
    let load_ms
    await page.exposeFunction('lanternBenchFirstFrame', () => { load_ms ??= process.uptime() * 1000 })
    await page.goto(server.url + '?benchmark=1&seed=' + seed + '&duration=' + duration)
    await page.waitForFunction(() => window.lanternBenchResult || window.lanternBenchError,
      undefined, { timeout: duration * 1000 + 30000 })
    const output = await page.evaluate(() => ({ result: window.lanternBenchResult, error: window.lanternBenchError }))
    if (output.error) throw new Error(output.error)
    if (!Number.isFinite(load_ms)) throw new Error('Không nhận được khung hình đầu tiên.')
    const result = { contract_version: '1.3', ...output.result, load_ms, peak_mem_mb: null,
      vsync_off: false, os: [platform(), release(), arch()].join(' ') }
    await writeFile(values.out, JSON.stringify(result, null, 2) + '\n')
    console.log(JSON.stringify(result))
  } finally {
    if (browser) await browser.close()
    await server.close()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})

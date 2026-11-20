import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { defaultLeaderboardPath, readEntries } from './leaderboard.mjs'
import { startLocalServer } from './local-server.mjs'

async function main() {
  const { values } = parseArgs({
    options: { 'export-leaderboard': { type: 'string' }, port: { type: 'string', default: '4173' },
      'no-open': { type: 'boolean' } },
  })
  if (values['export-leaderboard'] !== undefined) {
    const entries = await readEntries(defaultLeaderboardPath())
    await writeFile(values['export-leaderboard'], JSON.stringify({ entries }, null, 2) + '\n')
    return
  }

  const port = Number(values.port)
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Cổng không hợp lệ.')
  const server = await startLocalServer({ port })
  console.log('Đảo Đèn Lồng ' + server.url)
  if (!values['no-open']) {
    const commands = { win32: ['rundll32.exe', 'url.dll,FileProtocolHandler'], darwin: ['open'] }
    const [browser, ...args] = commands[process.platform] ?? ['xdg-open']
    const launch = spawn(browser, [...args, server.url], { detached: true, stdio: 'ignore', windowsHide: true })
    launch.on('error', () => console.error('Mở URL ở trên bằng trình duyệt của bạn.'))
    launch.unref()
  }
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close() })
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})

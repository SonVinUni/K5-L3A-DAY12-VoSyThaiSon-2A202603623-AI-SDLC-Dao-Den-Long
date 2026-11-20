import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

export const defaultLeaderboardPath = () =>
  resolve(process.env.DAO_DEN_LONG_LEADERBOARD || join(homedir(), '.dao-den-long', 'leaderboard.json'))

const validName = (name) => typeof name === 'string' && /^[A-Za-z0-9_]{3,12}$/.test(name)
const whole = (value) => Number.isSafeInteger(value) && value >= 0
const validScore = (entry) => entry && validName(entry.name) && whole(entry.score) &&
  whole(entry.nights_won) && entry.nights_won <= 3 && Number.isSafeInteger(entry.seed)
const sortEntries = (entries) => entries.toSorted((a, b) =>
  b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at)).slice(0, 10)

export async function readEntries(path) {
  try {
    const { entries } = JSON.parse(await readFile(path, 'utf8'))
    if (!Array.isArray(entries) || !entries.every((entry) => validScore(entry) &&
      typeof entry.achieved_at === 'string' && Number.isFinite(Date.parse(entry.achieved_at)))) {
      throw new Error('File bảng xếp hạng không hợp lệ.')
    }
    return sortEntries(entries)
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

export function newEntryStore(path, clock = () => new Date()) {
  let pendingWrite = Promise.resolve()
  const add = (entry) => {
    if (!validScore(entry)) {
      return Promise.reject(Object.assign(new Error('Tên cần 3–12 ký tự A–Z, 0–9 hoặc _. Điểm không hợp lệ.'), { status: 400 }))
    }
    const { name, score, nights_won, seed } = entry
    const result = pendingWrite.then(async () => {
      const existing = await readEntries(path)
      const entries = sortEntries([...existing, { name, score, nights_won, achieved_at: clock().toISOString(), seed }])
      await mkdir(dirname(path), { recursive: true })
      const temporary = path + '.' + randomUUID() + '.tmp'
      try {
        await writeFile(temporary, JSON.stringify({ entries }, null, 2) + '\n', 'utf8')
        await rename(temporary, path)
      } finally {
        await rm(temporary, { force: true })
      }
      return entries
    })
    pendingWrite = result.catch(() => {})
    return result
  }
  return { list: () => readEntries(path), add }
}

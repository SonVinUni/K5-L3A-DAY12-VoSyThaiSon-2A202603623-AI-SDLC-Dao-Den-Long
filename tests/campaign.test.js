import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nightResult } from '../src/campaign.js'

test('campaign keeps only won scores, advances through all islands, and ends at dawn', () => {
  const first = nightResult(1, 'won', 500, 0)
  assert.deepEqual(first, { total: 500, next: 2, label: 'Đêm tiếp theo' })
  const lost = nightResult(2, 'lost', 180, first.total)
  assert.deepEqual(lost, { total: 500, next: 2, label: 'Chơi lại Đêm' })
  const second = nightResult(2, 'won', 700, lost.total)
  assert.deepEqual(second, { total: 1200, next: 3, label: 'Đêm tiếp theo' })
  assert.deepEqual(nightResult(3, 'won', 900, second.total), { total: 2100, next: null, label: 'Xem Bình Minh' })
})

export function nightResult(night, state, score, previousTotal) {
  if (state !== 'won') return { total: previousTotal, next: night, label: 'Chơi lại Đêm' }
  const total = previousTotal + score
  if (night < 3) return { total, next: night + 1, label: 'Đêm tiếp theo' }
  return { total, next: null, label: 'Xem Bình Minh' }
}

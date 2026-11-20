const radians = Math.PI / 180

function ring(radius, count, angle = 0, x = 0, y = 0) {
  return Array.from({ length: count }, (_, index) => {
    const theta = (angle + 360 * index / count) * radians
    return [x + radius * Math.cos(theta), y, radius * Math.sin(theta)]
  })
}

export const ramps = [30, 150].map((degrees) => {
  const angle = degrees * radians
  return [Math.cos(angle), Math.sin(angle)]
})

export const maps = {
  1: {
    name: 'Đảo Bến',
    story: 'Ông Đăng: Hãy bắt đầu ở bến cũ, Mây à. Ánh đèn sẽ cho con một chỗ nghỉ giữa sương.',
    islands: [[0, 40]],
    lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
    motes: [...ring(12, 8), ...ring(33, 16)],
    mist: ring(37, 12, 15),
    shadePeriod: 480, shadeCap: 6, shadeSpeed: 4, pads: [], charms: [],
  },
  2: {
    name: 'Đảo Cau',
    story: 'Ông Đăng: Hai bờ có cầu tre và bục nhảy. Hãy giữ chặt ánh sáng khi gặp Gió Lạc.',
    islands: [[0, 28], [70, 28]],
    lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
    motes: [0, 70].flatMap((x) => [...ring(10, 4, 0, x), ...ring(22, 8, 0, x)]),
    mist: [0, 70].flatMap((x) => ring(26, 8, 22.5, x)),
    shadePeriod: 420, shadeCap: 8, shadeSpeed: 4,
    pads: [{ pos: [20, 0, 18], target: [70, 0], speed: 24, vertical: 14 },
      { pos: [50, 0, -18], target: [0, 0], speed: 24, vertical: 14 }],
    charms: [[35, 0, 0]],
  },
  3: {
    name: 'Đảo Chuông',
    story: 'Ông Đăng: Theo dốc lên tầng giữa rồi dùng bục nhảy lên tháp chuông. Khi lá bay, hãy coi chừng gió mạnh.',
    islands: [[0, 45]],
    lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
    motes: [...ring(34, 18), ...Array.from({ length: 8 }, (_, i) => {
      const angle = (20 + i * 20) * radians
      return [18 * Math.cos(angle), 3, 18 * Math.sin(angle)]
    }), ...ring(5, 4, 45, 0, 6)],
    mist: ring(43, 16),
    shadePeriod: 360, shadeCap: 10, shadeSpeed: 4.5,
    pads: [{ pos: [0, 3, 13], direction: [0, -1], speed: 8, vertical: 12 }],
    charms: [[30, 0, 25], [-30, 0, 25]],
  },
}

export function hasBridge(x, z) {
  return x >= 26 && x <= 44 && Math.abs(z) <= 2
}

export function rampHeight(x, z) {
  for (const [dx, dz] of ramps) {
    const along = x * dx + z * dz
    const across = x * -dz + z * dx
    if (along >= 23.85 && along <= 30 && Math.abs(across) <= 1.5) {
      return Math.min(3, (30 - along) / 2)
    }
  }
  return null
}

export function surface(night, x, z) {
  const radius = Math.hypot(x, z)
  if (night === 3) {
    if (radius <= 8) return 6
    const ramp = rampHeight(x, z)
    if (ramp !== null) return ramp
    if (z > 0 && radius >= 12 && radius <= 24) return 3
  }
  if (maps[night].islands.some(([center, boundary]) => Math.hypot(x - center, z) <= boundary) ||
      (night === 2 && hasBridge(x, z))) return 0
  return null
}

export function blocked(night, pos, x, z, verticalAllowance = 0.14) {
  if (night !== 3) return false
  const top = surface(night, x, z)
  const oldTop = surface(night, pos[0], pos[2])
  if (top !== null && top > pos[1] + verticalAllowance && (oldTop === null || top > oldTop + 1e-6)) return true
  return pos[1] >= 5.9 && pos[1] < 14 && Math.hypot(x, z) < 2
}

export const actions = [
  ['forward', 'Đi tới', 'KeyW'], ['left', 'Đi trái', 'KeyA'], ['backward', 'Đi lùi', 'KeyS'],
  ['right', 'Đi phải', 'KeyD'], ['jump', 'Nhảy', 'Space'], ['dash', 'Lướt', 'ShiftLeft'],
  ['interact', 'Nạp đèn', 'KeyE'], ['pulse', 'Tỏa Sáng', 'KeyF'], ['pause', 'Tạm dừng', 'Escape'],
  ['cameraLeft', 'Xoay camera trái', 'KeyQ'], ['cameraRight', 'Xoay camera phải', 'KeyR'],
]
export const defaults = Object.fromEntries(actions.map(([action, , code]) => [action, code]))
const legacy = { ArrowUp: 'forward', ArrowLeft: 'left', ArrowDown: 'backward', ArrowRight: 'right',
  ShiftRight: 'dash', KeyP: 'pause' }
const supported = (code) => typeof code === 'string' &&
  /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Right|Down|Left)|Space|Escape|Enter|Shift(Left|Right)|Control(Left|Right)|Numpad[0-9]|(Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash))$/.test(code)

export function readBindings(saved) {
  const result = {}
  for (const [action, , code] of actions) result[action] = supported(saved?.[action]) ? saved[action] : code
  if (new Set(Object.values(result)).size !== actions.length) return { ...defaults }
  return result
}

export function assignBinding(bindings, action, code) {
  if (!Object.hasOwn(defaults, action) || !supported(code)) return { error: 'Phím này không dùng được.' }
  const collision = actions.find(([other]) => other !== action && bindings[other] === code)
  if (collision) return { error: 'Phím ' + keyLabel(code) + ' đang dùng cho ' + collision[1] + '.' }
  return { bindings: { ...bindings, [action]: code } }
}

export function controlCode(bindings, physicalCode) {
  for (const [action, code] of Object.entries(bindings)) if (code === physicalCode) return defaults[action]
  const alias = legacy[physicalCode]
  return alias && bindings[alias] === defaults[alias] ? defaults[alias] : undefined
}

export function keyLabel(code) {
  return ({ ArrowUp: '↑', ArrowLeft: '←', ArrowDown: '↓', ArrowRight: '→', Escape: 'Esc',
    ShiftLeft: 'Shift', ShiftRight: 'Shift phải', ControlLeft: 'Ctrl', ControlRight: 'Ctrl phải' })[code]
    ?? code.replace(/^(Key|Digit)/, '')
}

import './style.css'
import { createWorld } from './world.js'
import { createSound } from './sound.js'
import { nightResult } from './campaign.js'
import { actions, assignBinding, controlCode, defaults, keyLabel, readBindings } from './key-bindings.js'
import { capacity, dawnTarget, ignitionCost, isWeakLantern, lanternFuel } from './lanterns.js'
import { distance, defaultInput, HZ, nearbyLantern, newGame, START_SEED, stepGame, tuning } from './simulation.js'

const ui = Object.fromEntries([...document.querySelectorAll('[id]')].map((node) => [node.id, node]))
const optionsKey = 'dao-den-long.settings.v1'
const clamp = (value, low, high) => Math.min(high, Math.max(low, value))

function readOptions() {
  try {
    const value = JSON.parse(localStorage.getItem(optionsKey)) ?? {}
    return { volume: clamp(Number(value.volume ?? .48) || 0, 0, 1),
      sensitivity: clamp(Number(value.sensitivity ?? 1) || 1, .25, 2),
      accessiblePalette: value.accessiblePalette === true,
      reducedMotion: value.reducedMotion === true, largeText: value.largeText === true,
      bindings: readBindings(value.bindings) }
  } catch {
    return { volume: .48, sensitivity: 1, accessiblePalette: false,
      reducedMotion: false, largeText: false, bindings: { ...defaults } }
  }
}

const parameters = new URLSearchParams(location.search)
let world
try {
  if (parameters.has('benchmark')) {
    ui.game.dataset.screen = 'bench'
    import('./benchmark.js').then(({ startBenchmark }) =>
      startBenchmark(ui.world, Number(parameters.get('seed')), Number(parameters.get('duration'))))
      .then((result) => { window.lanternBenchResult = result })
      .catch((error) => { window.lanternBenchError = error.message })
  } else world = createWorld(ui.world)
} catch (error) {
  console.error(error)
  ui['overlay-title'].textContent = 'Không mở được game 3D'
  ui['overlay-copy'].textContent = 'Hãy mở trò chơi trong trình duyệt hỗ trợ WebGL 2 rồi tải lại trang.'
  ui.play.hidden = ui.settings.hidden = true
}
if (world) runGame()

function runGame() {
  let game = newGame()
  let night = 1
  let mode = 'menu'
  let previousMenu
  let rebinding = null
  let scorePending
  let lastSpawn
  let totalScore = 0
  let result
  let yaw = 0
  let accumulator = 0
  let previousTime = performance.now() / 1000
  let noticeText = ''
  let noticeUntil = 0
  let previousHud = ''
  let previousSecond = null
  let windWarning = false
  let lastMap = 0
  let frameCount = 0
  let frameStart = previousTime
  const options = readOptions()
  const audio = createSound(options.volume)
  const keys = new Set()
  const touches = new Set()
  const queued = new Set()
  const actionKeys = new Set(['Space', 'KeyE', 'KeyF', 'ShiftLeft', 'ShiftRight'])
  const recognized = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft',
    'ArrowDown', 'ArrowRight', 'KeyQ', 'KeyR', ...actionKeys])
  const progress = Array.from({ length: tuning.capacity_max }, () => document.createElement('i'))
  const hearts = Array.from({ length: tuning.flames }, () => document.createElement('span'))
  ui['light-progress'].replaceChildren(...progress)
  ui.health.replaceChildren(...hearts)
  const isHeld = (...codes) => codes.some((code) => keys.has(code) || touches.has(code))
  const isPressed = (...codes) => codes.some((code) => queued.has(code) || isHeld(code))
  const clearControls = () => {
    keys.clear()
    touches.clear()
    queued.clear()
  }

  window.addEventListener('keydown', (event) => {
    if (mode === 'settings' && rebinding) {
      event.preventDefault()
      if (event.repeat) return
      const next = assignBinding(options.bindings, rebinding, event.code)
      if (next.error) {
        ui['binding-status'].textContent = next.error
        return
      }
      options.bindings = next.bindings
      rebinding = null
      ui['binding-status'].textContent = 'Đã lưu phím.'
      saveOptions()
      return
    }
    const code = controlCode(options.bindings, event.code)
    if (code === 'Escape' && !event.repeat && ['playing', 'paused'].includes(mode)) {
      event.preventDefault()
      togglePause()
    } else if (code && recognized.has(code) && mode === 'playing') {
      event.preventDefault()
      keys.add(code)
      if (actionKeys.has(code) && !event.repeat) queued.add(code)
    }
  })
  window.addEventListener('keyup', ({ code }) => keys.delete(controlCode(options.bindings, code)))
  window.addEventListener('blur', clearControls)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'playing') togglePause()
  })

  for (const button of document.querySelectorAll('[data-key]')) {
    const { key } = button.dataset
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      button.setPointerCapture(event.pointerId)
      touches.add(key)
      if (actionKeys.has(key)) queued.add(key)
    })
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(event, () => touches.delete(key))
    }
  }

  let dragStart
  world.canvas.addEventListener('pointerdown', (event) => {
    if (mode !== 'playing' || event.button !== 0) return
    dragStart = event.clientX
    world.canvas.setPointerCapture(event.pointerId)
  })
  world.canvas.addEventListener('pointermove', (event) => {
    if (dragStart === undefined || mode !== 'playing') return
    yaw -= (event.clientX - dragStart) * .007 * options.sensitivity
    dragStart = event.clientX
  })
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    world.canvas.addEventListener(event, () => { dragStart = undefined })
  }

  const bindingButtons = new Map()
  for (const [action, label] of actions) {
    const row = document.createElement('div')
    row.className = 'binding-row'
    const caption = document.createElement('span')
    caption.textContent = label
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'secondary-button'
    button.addEventListener('click', () => {
      rebinding = rebinding === action ? null : action
      ui['binding-status'].textContent = rebinding ? 'Bấm phím mới cho ' + label + '.' : ''
      displayBindings()
    })
    row.append(caption, button)
    ui.bindings.append(row)
    bindingButtons.set(action, { label, button })
  }

  function displayBindings() {
    for (const [action, { label, button }] of bindingButtons) {
      const key = keyLabel(options.bindings[action])
      button.textContent = rebinding === action ? 'Chọn…' : key
      button.setAttribute('aria-label', label + ' · ' + key)
    }
    for (const key of document.querySelectorAll('[data-binding]')) {
      key.textContent = keyLabel(options.bindings[key.dataset.binding])
    }
  }
  ui['reset-bindings'].addEventListener('click', () => {
    options.bindings = { ...defaults }
    rebinding = null
    ui['binding-status'].textContent = 'Đã khôi phục phím mặc định.'
    saveOptions()
  })

  async function requestEntries(entry) {
    const response = await fetch('/api/leaderboard', entry ? {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry),
    } : {})
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error ?? 'Không thể mở bảng xếp hạng.')
    return payload.entries
  }

  ui.leaderboard.addEventListener('click', async () => {
    showScreen('leaderboard', 'Top 10', 'Bảng xếp hạng', '', '')
    ui['leaderboard-back'].focus()
    ui['leaderboard-entries'].replaceChildren()
    ui['leaderboard-status'].textContent = 'Đang tải…'
    try {
      const entries = await requestEntries()
      for (const row of entries) {
        const item = document.createElement('li')
        item.textContent = row.name + ' · ' + row.nights_won + '/3 đêm'
        const points = document.createElement('span')
        points.textContent = row.score.toLocaleString('vi-VN')
        item.append(points)
        ui['leaderboard-entries'].append(item)
      }
      ui['leaderboard-status'].textContent = entries.length ? '' : 'Chưa có điểm đã lưu.'
    } catch {
      ui['leaderboard-status'].textContent = 'Không mở được bảng xếp hạng cục bộ.'
    }
  })

  ui['leaderboard-back'].addEventListener('click', showMenu)

  function offerScore(nightsWon) {
    scorePending = { score: totalScore, nights_won: nightsWon, seed: START_SEED }
    ui['score-form'].hidden = false
    ui['save-score'].disabled = false
    ui['player-name'].disabled = false
    ui['score-status'].textContent = ''
  }

  ui['score-form'].addEventListener('submit', async (event) => {
    event.preventDefault()
    const entry = scorePending
    if (!entry) return
    ui['save-score'].disabled = true
    try {
      await requestEntries({ ...entry, name: ui['player-name'].value.trim() })
      if (scorePending !== entry) return
      scorePending = null
      ui['player-name'].disabled = true
      ui['score-status'].textContent = 'Đã gửi điểm vào bảng xếp hạng.'
    } catch (error) {
      if (scorePending !== entry) return
      ui['save-score'].disabled = false
      ui['score-status'].textContent = error.message
    }
  })

  ui.play.addEventListener('click', () => {
    audio.enable()
    if (mode === 'paused') return togglePause()
    if (mode === 'menu') return introduce(1)
    if (mode === 'intro') return setScreen('playing')
    if (mode === 'dawn') return showMenu()
    if (mode === 'result') {
      if (result.next !== null) return introduce(result.next)
      showScreen('dawn', 'Ba hòn đảo đã sáng', 'Bình Minh',
        'Ông Đăng: Ngày mới đến rồi, Mây à. Tổng điểm của ba đêm: ' + totalScore + '.', 'Về menu')
      offerScore(3)
    }
  })
  ui.retry.addEventListener('click', () => introduce(night))
  ui.home.addEventListener('click', showMenu)
  ui.pause.addEventListener('click', togglePause)
  ui.settings.addEventListener('click', () => {
    previousMenu = mode
    showScreen('settings', 'Đảo Đèn Lồng', 'Cài đặt', '', '')
  })
  ui.back.addEventListener('click', () => { if (previousMenu === 'paused') showPaused(); else showMenu() })

  ui.volume.value = String(Math.round(options.volume * 100))
  ui.sensitivity.value = String(Math.round(options.sensitivity * 100))
  ui['accessible-palette'].checked = options.accessiblePalette
  ui['reduced-motion'].checked = options.reducedMotion
  ui['large-text'].checked = options.largeText
  const saveOptions = () => {
    options.volume = Number(ui.volume.value) / 100
    options.sensitivity = Number(ui.sensitivity.value) / 100
    ui['volume-value'].textContent = ui.volume.value + '%'
    ui['sensitivity-value'].textContent = ui.sensitivity.value + '%'
    const palette = ui['accessible-palette'].checked
    if (ui.game.dataset.accessiblePalette !== String(palette)) {
      options.accessiblePalette = palette
      ui.game.dataset.accessiblePalette = String(palette)
      world.setAccessiblePalette(palette)
      previousHud = ''
    }
    options.reducedMotion = ui['reduced-motion'].checked
    options.largeText = ui['large-text'].checked
    ui.game.dataset.reducedMotion = String(options.reducedMotion)
    ui.game.dataset.largeText = String(options.largeText)
    world.setReducedMotion(options.reducedMotion)
    displayBindings()
    audio.setVolume(options.volume)
    try { localStorage.setItem(optionsKey, JSON.stringify(options)) } catch {}
  }
  ui.volume.addEventListener('input', saveOptions)
  ui.sensitivity.addEventListener('input', saveOptions)
  ui['accessible-palette'].addEventListener('change', saveOptions)
  ui['reduced-motion'].addEventListener('change', saveOptions)
  ui['large-text'].addEventListener('change', saveOptions)
  saveOptions()

  function setScreen(next) {
    mode = next
    rebinding = null
    scorePending = null
    ui.game.dataset.screen = next
    ui.overlay.hidden = next === 'playing'
    ui.pause.disabled = next !== 'playing'
    ui['guide-arrow'].hidden = true
    accumulator = 0
    frameCount = 0
    frameStart = performance.now() / 1000
    clearControls()
    if (next === 'playing') ui.play.blur()
  }

  function showScreen(next, eyebrow, title, copy, primary) {
    setScreen(next)
    ui.eyebrow.textContent = eyebrow
    ui['overlay-title'].textContent = title
    ui['overlay-copy'].textContent = copy
    ui['overlay-copy'].hidden = !copy
    ui.play.textContent = primary
    ui.play.hidden = !primary
    ui.retry.hidden = next !== 'paused'
    ui.settings.hidden = !['menu', 'paused'].includes(next)
    ui.leaderboard.hidden = next !== 'menu'
    ui['leaderboard-panel'].hidden = next !== 'leaderboard'
    ui['score-form'].hidden = true
    ui.home.hidden = !['paused', 'result'].includes(next)
    ui['settings-panel'].hidden = next !== 'settings'
    if (next === 'settings') ui.volume.focus()
    else if (next !== 'menu' && primary) ui.play.focus()
  }

  function showMenu() {
    totalScore = 0
    prepare(1)
    ui.chapter.textContent = 'Ba hòn đảo'
    showScreen('menu', 'Ba hòn đảo', 'Đảo Đèn Lồng',
      'Cùng Mây mang ánh sáng trở lại Đảo Bến, Đảo Cau và Đảo Chuông trước bình minh.', 'Bắt đầu')
  }

  function prepare(number) {
    night = number
    game = newGame(START_SEED, {}, night)
    lastSpawn = null
    yaw = 0
    noticeUntil = 0
    previousSecond = null
    windWarning = false
    previousHud = ''
    ui.chapter.textContent = 'Đêm ' + night + ' · ' + game.map.name
    ui['map-label'].textContent = game.map.name
    world.resetEffects()
  }

  function introduce(number) {
    prepare(number)
    const target = dawnTarget(game.lanterns.length)
    showScreen('intro', 'Đêm ' + night, game.map.name,
      game.map.story + ' Giữ ít nhất ' + target + ' đèn sáng đến bình minh.', 'Chơi ngay')
  }

  function showPaused() {
    showScreen('paused', 'Đêm ' + night + ' · ' + game.map.name, 'Tạm dừng', '', 'Tiếp tục')
  }

  function togglePause() {
    if (mode === 'playing') {
      stepGame(game, { ...defaultInput, pause: true })
      if (game.state === 'playing') {
        stepGame(game, defaultInput)
        stepGame(game, { ...defaultInput, pause: true })
      }
      showPaused()
    } else if (mode === 'paused') {
      stepGame(game, defaultInput)
      const events = stepGame(game, { ...defaultInput, pause: true })
      setScreen('playing')
      for (const event of events) handleEvent(event, performance.now() / 1000)
    }
  }

  function handleEvent(event, now) {
    audio.play(event.name)
    world.recordEvent(event, now)
    switch (event.name) {
      case 'lantern_lit': noticeText = 'Đèn đã sáng. Vùng sáng che chở Mây khỏi Bóng Mực.'; break
      case 'deposit': noticeText = 'Đã nạp ' + event.data.amount + ' đom đóm.'; break
      case 'refuel': noticeText = 'Đã châm dầu cho ' + event.data.lantern_id + '.'; break
      case 'lantern_out': noticeText = 'Đèn ' + event.data.lantern_id + ' đã cạn dầu.'; break
      case 'fuel_drain': noticeText = 'Bóng Mực đang hút dầu ở ' + event.data.lantern_id + '.'; break
      case 'player_hit': noticeText = event.data.by === 'fall' ? 'Mây đã rơi xuống biển mây.' : 'Bóng Mực đã chạm vào Mây!'; break
      case 'pulse': noticeText = 'Mây đã Tỏa Sáng.'; break
      case 'shade_spawned':
        lastSpawn = { id: event.data.id, until: now + 4 }
        noticeText = 'Bóng Mực xuất hiện trong sương.'
        break
      case 'drifter_steal': noticeText = 'Gió Lạc vừa cướp ' + event.data.amount + ' đom đóm.'; break
      case 'charm_picked': noticeText = 'Bùa Gió đang có hiệu lực.'; break
      case 'game_over': showResult(event.data.reason); return
      default: return
    }
    noticeUntil = now + 2.3
  }

  function showResult(reason) {
    const won = game.state === 'won'
    result = nightResult(night, game.state, game.score, totalScore)
    totalScore = result.total
    audio.play(game.state)
    const title = won ? 'Đảo đã sáng!' : 'Ánh sáng đã tắt'
    const description = won ? 'Mây đã giữ đủ đèn sáng đến bình minh.'
      : reason === 'dawn' ? 'Khi bình minh đến, số đèn đang sáng chưa đủ.' : 'Mây đã mất hết Ngọn Lửa.'
    showScreen('result', 'Đêm ' + night + ' · ' + game.map.name, title,
      description + ' Điểm đêm này: ' + game.score + '. Tổng điểm các đêm đã thắng: ' + totalScore + '.', result.label)
    if (!won) offerScore(night - 1)
  }

  function updateHud(now) {
    const lit = game.lanterns.filter((lantern) => lantern.lit).length
    const { carried, flames, dashLeft, dashCd, pulseCd, charm, successful_lights } = game.player
    const slots = capacity(successful_lights)
    const seconds = Math.ceil(game.time_left_s)
    const cooldown = (ticks) => ticks ? (Math.ceil(ticks / 6) / 10).toFixed(1) + ' s' : 'Sẵn sàng'
    const signature = [night, lit, carried, slots, flames, seconds, game.score, dashLeft > 0, cooldown(dashCd),
      cooldown(pulseCd), Math.ceil(charm / HZ)].join('|')
    if (signature !== previousHud) {
      previousHud = signature
      ui['lantern-count'].textContent = lit + ' / ' + game.lanterns.length
      ui['dawn-target'].textContent = 'Cần ' + dawnTarget(game.lanterns.length) + ' đến bình minh'
      progress.forEach((bar, index) => {
        bar.hidden = index >= slots
        bar.classList.toggle('lit', index < carried)
      })
      ui.inventory.textContent = carried + ' / ' + slots
      ui.health.setAttribute('aria-label', flames + ' Ngọn Lửa')
      hearts.forEach((heart, index) => {
        heart.textContent = index < flames ? '♥ ' : '♡ '
        heart.classList.toggle('heart-empty', index >= flames)
      })
      const warning = seconds <= 30 && options.accessiblePalette ? '⚠ ' : ''
      ui.clock.textContent = warning + [Math.floor(seconds / 60), seconds % 60]
        .map((value) => String(value).padStart(2, '0')).join(':')
      ui.clock.classList.toggle('danger', seconds <= 30)
      ui.score.textContent = game.score.toLocaleString('vi-VN')
      ui['dash-cd'].textContent = dashLeft ? 'Đang lướt' : cooldown(dashCd)
      ui['pulse-cd'].textContent = cooldown(pulseCd)
      ui.charm.hidden = !charm
      if (charm) ui.charm.textContent = 'Bùa Gió · ' + Math.ceil(charm / HZ) + ' s'
    }

    if (mode === 'playing' && seconds !== previousSecond) {
      if (seconds > 0 && seconds <= 10) audio.play('countdown')
      previousSecond = seconds
    }
    if (game.wind.warning && !windWarning) {
      audio.play('wind')
      noticeText = 'Lá đang bay. Gió mạnh sắp tới.'
      noticeUntil = now + 2
    }
    windWarning = game.wind.warning
    const lantern = nearbyLantern(game)
    let prompt = ''
    if (mode === 'playing') {
      const low = game.lanterns.find(isWeakLantern)
      const warning = options.accessiblePalette ? '⚠ ' : ''
      if (lantern && !game.player.respawn) {
        const command = keyLabel(options.bindings.interact) + ' — '
        prompt = lantern.lit
          ? (isWeakLantern(lantern) ? warning : '') + command + 'Châm dầu (' + lanternFuel(lantern).toFixed(1) + '/100)'
          : command + 'Nạp ánh sáng (' + lantern.deposited + '/' + ignitionCost(lantern) + ')'
      } else if (now < noticeUntil) prompt = noticeText
      else if (low) prompt = warning + 'Đèn ' + low.id + ' đang ít dầu.'
    }
    if (ui.notice.textContent !== prompt) ui.notice.textContent = prompt
  }

  const mapContext = ui.map.getContext('2d')
  function drawMap() {
    const { width, height } = ui.map
    const centerX = night === 2 ? 35 : 0
    const maxRadius = game.map.islands[0][1]
    const scale = Math.min((width / 2 - 8) / (centerX + maxRadius), (height / 2 - 6) / maxRadius)
    const screenX = (x) => width / 2 - (x - centerX) * scale
    const screenY = (z) => height / 2 - z * scale
    function dot(x, z, radius, color) {
      mapContext.fillStyle = color
      mapContext.beginPath()
      mapContext.arc(screenX(x), screenY(z), radius, 0, Math.PI * 2)
      mapContext.fill()
    }
    mapContext.clearRect(0, 0, width, height)
    for (const [center, radius] of game.map.islands) dot(center, 0, radius * scale, '#2f5d50')
    if (night === 2) {
      mapContext.fillStyle = '#C9B48A'
      mapContext.fillRect(screenX(44), screenY(2), 18 * scale, 4 * scale)
    }
    if (night === 3) {
      dot(0, 0, 8 * scale, '#C9B48A')
      dot(0, 0, 2 * scale, '#6B4A2F')
    }
    for (const { pos } of game.motes.values()) dot(pos[0], pos[2], 1.7, '#FFE58A')
    for (const { pos, lit } of game.lanterns) dot(pos[0], pos[2], 4.4, lit ? '#FFB347' : '#a8b2c4')
    for (const { pos } of game.shades) dot(pos[0], pos[2], 3, options.accessiblePalette ? '#00B3FF' : '#7A3CFF')
    for (const { pos, state } of game.drifters) if (state !== 'removed') dot(pos[0], pos[2], 2.5, '#8FA3B8')
    for (const { pos, available } of game.charms) if (available) dot(pos[0], pos[2], 3, '#C8102E')
    dot(game.player.pos[0], game.player.pos[2], 4, '#F5F1E6')
  }

  function updateGuide() {
    if (mode !== 'playing') return
    let closest
    let meters = Infinity
    for (const lantern of game.lanterns) {
      const range = distance(game.player.pos, lantern.pos)
      if (!lantern.lit && range < meters) {
        closest = lantern
        meters = range
      }
    }
    const target = closest && world.projectTarget(closest.pos)
    ui['guide-arrow'].hidden = !target || target.visible
    if (!ui['guide-arrow'].hidden) {
      ui['guide-arrow'].firstElementChild.style.transform = 'rotate(' + target.angle + 'deg)'
      const label = closest.id + ' · ' + Math.round(meters) + ' m'
      if (ui['guide-text'].textContent !== label) ui['guide-text'].textContent = label
    }
  }

  function updateSubtitles(now) {
    const arrow = ui['shade-arrow']
    if (mode !== 'playing') {
      arrow.hidden = true
      ui.subtitles.textContent = ''
      return
    }
    const messages = []
    const shade = lastSpawn && now < lastSpawn.until ? game.shades.find(({ id }) => id === lastSpawn.id) : null
    arrow.hidden = !shade
    if (shade) {
      messages.push('Bóng Mực xuất hiện.')
      const marker = world.projectTarget(shade.pos)
      const angle = marker.angle * Math.PI / 180
      arrow.style.left = clamp(50 + 48 * Math.sin(angle), 9, 91) + '%'
      arrow.style.top = clamp(50 - 48 * Math.cos(angle), 9, 91) + '%'
      arrow.firstElementChild.style.transform = 'rotate(' + marker.angle + 'deg)'
    }
    if (game.wind.warning) messages.push('Gió mạnh sắp thổi.')
    const seconds = Math.ceil(game.time_left_s)
    if (seconds > 0 && seconds <= 10) messages.push('Còn ' + seconds + ' giây.')
    const weak = game.lanterns.filter(isWeakLantern)
    if (weak.length) messages.push((options.accessiblePalette ? '⚠ ' : '') +
      'Ít dầu · ' + weak.map(({ id }) => id).join(', ') + '.')
    const text = messages.join(' ')
    if (ui.subtitles.textContent !== text) ui.subtitles.textContent = text
  }

  function frame(timestamp) {
    const now = timestamp / 1000
    const elapsed = Math.max(0, Math.min(.15, now - previousTime))
    previousTime = now
    if (mode === 'playing') {
      frameCount += 1
      if (now - frameStart >= 3) {
        ui.game.dataset.fps = (frameCount / (now - frameStart)).toFixed(1)
        frameStart = now
        frameCount = 0
      }
      accumulator += elapsed
      while (accumulator >= 1 / HZ && mode === 'playing') {
        accumulator -= 1 / HZ
        yaw += (Number(isHeld('KeyQ')) - Number(isHeld('KeyR'))) * 1.8 / HZ
        const input = {
          ...defaultInput,
          move: [
            Number(isHeld('KeyA', 'ArrowLeft')) - Number(isHeld('KeyD', 'ArrowRight')),
            Number(isHeld('KeyW', 'ArrowUp')) - Number(isHeld('KeyS', 'ArrowDown')),
          ],
          cam_yaw_deg: yaw * 180 / Math.PI,
          jump: isPressed('Space'), interact: isPressed('KeyE'), pulse: isPressed('KeyF'),
          dash: isPressed('ShiftLeft', 'ShiftRight'),
        }
        queued.clear()
        if (input.pulse && !game.lastInput.pulse && game.player.carried < tuning.pulse_cost) {
          noticeText = 'Cần ' + tuning.pulse_cost + ' đom đóm để Tỏa Sáng.'
          noticeUntil = now + 1.8
        }
        for (const event of stepGame(game, input)) handleEvent(event, now)
        if (game.jumped) audio.play('jump')
      }
    }
    updateHud(now)
    if (mode === 'playing' && now - lastMap > .09) {
      drawMap()
      lastMap = now
    }
    world.draw(game, yaw, now, mode === 'settings' && previousMenu === 'menu' ? 'menu' : mode)
    updateGuide()
    updateSubtitles(now)
    requestAnimationFrame(frame)
  }

  showMenu()
  requestAnimationFrame(frame)
}

import './style.css'
import { createWorld } from './world.js'
import { createSound } from './sound.js'
import { nightResult } from './campaign.js'
import { distance, defaultInput, HZ, nearbyLantern, newGame, stepGame, tuning } from './simulation.js'

const ui = Object.fromEntries([...document.querySelectorAll('[id]')].map((node) => [node.id, node]))
const optionsKey = 'dao-den-long.settings.v1'
const clamp = (value, low, high) => Math.min(high, Math.max(low, value))

function readOptions() {
  try {
    const value = JSON.parse(localStorage.getItem(optionsKey)) ?? {}
    return { volume: clamp(Number(value.volume ?? .48) || 0, 0, 1),
      sensitivity: clamp(Number(value.sensitivity ?? 1) || 1, .25, 2) }
  } catch {
    return { volume: .48, sensitivity: 1 }
  }
}

let world
try {
  world = createWorld(ui.world)
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
  const progress = Array.from({ length: tuning.carry_capacity }, () => document.createElement('i'))
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
    if (['Escape', 'KeyP'].includes(event.code) && !event.repeat && ['playing', 'paused'].includes(mode)) {
      event.preventDefault()
      togglePause()
    } else if (recognized.has(event.code) && mode === 'playing') {
      event.preventDefault()
      keys.add(event.code)
      if (actionKeys.has(event.code) && !event.repeat) queued.add(event.code)
    }
  })
  window.addEventListener('keyup', ({ code }) => keys.delete(code))
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
  const saveOptions = () => {
    options.volume = Number(ui.volume.value) / 100
    options.sensitivity = Number(ui.sensitivity.value) / 100
    ui['volume-value'].textContent = ui.volume.value + '%'
    ui['sensitivity-value'].textContent = ui.sensitivity.value + '%'
    audio.setVolume(options.volume)
    try { localStorage.setItem(optionsKey, JSON.stringify(options)) } catch {}
  }
  ui.volume.addEventListener('input', saveOptions)
  ui.sensitivity.addEventListener('input', saveOptions)
  saveOptions()

  function setScreen(next) {
    mode = next
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
    game = newGame(42, {}, night)
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
    showScreen('intro', 'Đêm ' + night, game.map.name, game.map.story, 'Chơi ngay')
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
      case 'player_hit': noticeText = event.data.by === 'fall' ? 'Mây đã rơi xuống biển mây.' : 'Bóng Mực đã chạm vào Mây!'; break
      case 'pulse': noticeText = 'Mây đã Tỏa Sáng.'; break
      case 'shade_spawned': noticeText = 'Bóng Mực xuất hiện trong sương.'; break
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
    const description = won ? 'Mây đã thắp hết đèn.'
      : reason === 'dawn' ? 'Bình minh đã đến trước khi thắp hết đèn.' : 'Mây đã mất hết Ngọn Lửa.'
    showScreen('result', 'Đêm ' + night + ' · ' + game.map.name, title,
      description + ' Điểm đêm này: ' + game.score + '. Tổng điểm các đêm đã thắng: ' + totalScore + '.', result.label)
  }

  function updateHud(now) {
    const lit = game.lanterns.filter((lantern) => lantern.lit).length
    const { carried, flames, dashLeft, dashCd, pulseCd, charm } = game.player
    const seconds = Math.ceil(game.time_left_s)
    const cooldown = (ticks) => ticks ? (Math.ceil(ticks / 6) / 10).toFixed(1) + ' s' : 'Sẵn sàng'
    const signature = [night, lit, carried, flames, seconds, game.score, dashLeft > 0, cooldown(dashCd),
      cooldown(pulseCd), Math.ceil(charm / HZ)].join('|')
    if (signature !== previousHud) {
      previousHud = signature
      ui['lantern-count'].textContent = lit + ' / ' + game.lanterns.length
      progress.forEach((bar, index) => bar.classList.toggle('lit', index < carried))
      ui.inventory.textContent = carried + ' / ' + tuning.carry_capacity
      ui.health.setAttribute('aria-label', flames + ' Ngọn Lửa')
      hearts.forEach((heart, index) => {
        heart.textContent = index < flames ? '♥ ' : '♡ '
        heart.classList.toggle('heart-empty', index >= flames)
      })
      ui.clock.textContent = [Math.floor(seconds / 60), seconds % 60]
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
    const prompt = mode === 'playing' && lantern && !game.player.respawn
      ? 'E — Nạp ánh sáng (' + lantern.deposited + '/' + tuning.lantern_cost + ')'
      : mode === 'playing' && now < noticeUntil ? noticeText : ''
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
    for (const { pos } of game.shades) dot(pos[0], pos[2], 3, '#7A3CFF')
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
    requestAnimationFrame(frame)
  }

  showMenu()
  requestAnimationFrame(frame)
}

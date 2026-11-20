import './style.css'
import { createWorld } from './world.js'
import { defaultInput, HZ, ISLAND_RADIUS, nearbyLantern, newGame, stepGame, tuning } from './simulation.js'

const byId = (id) => document.getElementById(id)
const ui = Object.fromEntries([
  'game', 'world', 'overlay', 'eyebrow', 'overlay-title', 'overlay-copy', 'play',
  'pause', 'notice', 'lantern-count', 'lantern-progress', 'inventory', 'health',
  'clock', 'score', 'map',
].map((id) => [id, byId(id)]))
let world

try {
  world = createWorld(ui.world)
} catch (error) {
  console.error(error)
  ui['overlay-title'].textContent = 'Không mở được game 3D'
  ui['overlay-copy'].textContent = 'Hãy mở trò chơi trong trình duyệt hỗ trợ WebGL 2 rồi tải lại trang.'
  ui.play.hidden = true
}

if (world) runGame()

function runGame() {
  let game = newGame()
  let mode = 'intro'
  let yaw = 0
  let accumulator = 0
  let previousTime = performance.now() / 1000
  let noticeText = ''
  let noticeUntil = 0
  let previousHud = ''
  const keys = new Set()
  const touches = new Set()
  const queued = new Set()
  const recognized = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft',
    'ArrowDown', 'ArrowRight', 'KeyQ', 'KeyR', 'Space', 'KeyE', 'KeyF'])
  const actionKeys = new Set(['Space', 'KeyE', 'KeyF'])
  const progress = Array.from({ length: tuning.lantern_count_night1 }, () => document.createElement('i'))
  const hearts = Array.from({ length: tuning.flames }, () => document.createElement('span'))
  ui['lantern-progress'].replaceChildren(...progress)
  ui.health.replaceChildren(...hearts)
  ui.game.dataset.screen = mode

  const isHeld = (...codes) => codes.some((code) => keys.has(code) || touches.has(code))
  const isPressed = (code) => queued.has(code) || isHeld(code)
  const clearControls = () => {
    keys.clear()
    touches.clear()
    queued.clear()
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape' && !event.repeat && (mode === 'playing' || mode === 'paused')) {
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
    yaw -= (event.clientX - dragStart) * .007
    dragStart = event.clientX
  })
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    world.canvas.addEventListener(event, () => { dragStart = undefined })
  }

  ui.play.addEventListener('click', () => {
    if (mode === 'paused') {
      startPlaying()
      return
    }
    game = newGame()
    yaw = 0
    noticeUntil = 0
    world.resetEffects()
    startPlaying()
  })
  ui.pause.addEventListener('click', togglePause)

  function changeMode(next) {
    mode = next
    ui.game.dataset.screen = next
    ui.overlay.hidden = next === 'playing'
    ui.pause.disabled = next !== 'playing'
    accumulator = 0
    clearControls()
  }

  function startPlaying() {
    ui.play.blur()
    changeMode('playing')
  }

  function togglePause() {
    if (mode === 'paused') {
      startPlaying()
    } else if (mode === 'playing') {
      changeMode('paused')
      ui.eyebrow.textContent = 'Đêm 1 · Đảo Bến'
      ui['overlay-title'].textContent = 'Tạm dừng'
      ui['overlay-copy'].textContent = 'Hành trình thắp đèn sẽ tiếp tục khi bạn sẵn sàng.'
      ui.play.textContent = 'Tiếp tục'
      ui.play.focus()
    }
  }

  function handleEvent(event, now) {
    world.recordEvent(event, now)
    switch (event.name) {
      case 'lantern_lit': noticeText = 'Một ngọn đèn đã sáng. Đứng gần đèn để tránh Bóng Mực.'; break
      case 'deposit': noticeText = 'Đã nạp ' + event.data.amount + ' đom đóm.'; break
      case 'player_hit': noticeText = 'Bóng Mực đã chạm vào Mây!'; break
      case 'pulse': noticeText = 'Mây đã tỏa sáng.'; break
      case 'shade_spawned': noticeText = 'Bóng Mực đang xuất hiện trong sương.'; break
      case 'game_over': showResult(event.data.reason); return
      default: return
    }
    noticeUntil = now + 2.2
  }

  function showResult(reason) {
    changeMode('result')
    const won = game.state === 'won'
    ui.eyebrow.textContent = won ? 'Đêm 1 · Hoàn thành' : 'Đêm 1 · Kết thúc'
    ui['overlay-title'].textContent = won ? 'Đảo đã sáng!' : 'Ánh sáng đã tắt'
    const description = won ? 'Mây đã thắp sáng cả năm chiếc đèn.'
      : reason === 'dawn' ? 'Bình minh đã đến trước khi năm chiếc đèn sáng.' : 'Mây đã mất hết sinh lực.'
    ui['overlay-copy'].textContent = description + ' Điểm của bạn: ' + game.score + '.'
    ui.play.textContent = 'Chơi lại'
    ui.play.focus()
  }

  function updateHud(now) {
    const lit = game.lanterns.filter((lantern) => lantern.lit).length
    const { carried, flames } = game.player
    const seconds = Math.ceil(game.time_left_s)
    const signature = [lit, carried, flames, seconds, game.score].join('|')
    if (signature !== previousHud) {
      previousHud = signature
      ui['lantern-count'].textContent = lit + ' / ' + tuning.lantern_count_night1
      progress.forEach((bar, index) => bar.classList.toggle('lit', index < lit))
      ui.inventory.textContent = carried + ' / ' + tuning.carry_capacity
      ui.health.setAttribute('aria-label', flames + ' sinh lực')
      hearts.forEach((heart, index) => {
        heart.textContent = index < flames ? '♥ ' : '♡ '
        heart.classList.toggle('heart-empty', index >= flames)
      })
      ui.clock.textContent = [Math.floor(seconds / 60), seconds % 60]
        .map((value) => String(value).padStart(2, '0')).join(':')
      ui.score.textContent = game.score.toLocaleString('vi-VN')
    }

    const lantern = nearbyLantern(game)
    const prompt = mode === 'playing' && lantern
      ? (carried ? 'E · Nạp đèn' : 'Cần thêm đom đóm') + '  (' + lantern.deposited + '/' + tuning.lantern_cost + ')'
      : mode === 'playing' && now < noticeUntil ? noticeText : ''
    if (ui.notice.textContent !== prompt) ui.notice.textContent = prompt
  }

  function drawMap() {
    const context = ui.map.getContext('2d')
    const center = ui.map.width / 2
    const scale = (center - 9) / ISLAND_RADIUS
    function dot(x, z, radius, color) {
      context.fillStyle = color
      context.beginPath()
      context.arc(center - x * scale, center - z * scale, radius, 0, Math.PI * 2)
      context.fill()
    }

    context.clearRect(0, 0, center * 2, center * 2)
    dot(0, 0, center - 8, '#28243e')
    context.strokeStyle = '#747084'
    context.lineWidth = 1
    context.stroke()
    for (const pos of game.motes.values()) dot(pos[0], pos[2], 1.7, '#b99962')
    for (const { pos, lit } of game.lanterns) dot(pos[0], pos[2], 5, lit ? '#ffcf72' : '#e3a792')
    for (const { pos } of game.shades) dot(pos[0], pos[2], 3, '#b87aeb')
    const [x, , z] = game.player.pos
    dot(x, z, 4, '#fafff6')
  }

  function frame(timestamp) {
    const now = timestamp / 1000
    const elapsed = Math.max(0, Math.min(.12, now - previousTime))
    previousTime = now
    if (mode === 'playing') {
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
          jump: isPressed('Space'),
          interact: isPressed('KeyE'),
          pulse: isPressed('KeyF'),
        }
        queued.clear()
        if (input.pulse && !game.lastInput.pulse && game.player.carried < tuning.pulse_cost) {
          noticeText = 'Cần ' + tuning.pulse_cost + ' đom đóm để tỏa sáng.'
          noticeUntil = now + 1.8
        }
        for (const event of stepGame(game, input)) handleEvent(event, now)
      }
    }
    updateHud(now)
    if (mode !== 'intro') drawMap()
    world.draw(game, yaw, now, mode)
    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
}

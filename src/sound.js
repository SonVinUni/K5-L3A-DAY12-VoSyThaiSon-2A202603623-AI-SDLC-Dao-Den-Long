const cues = {
  mote_picked: [660, 880], lantern_lit: [523, 659, 784, 1047], pulse: [220, 370, 660],
  player_hit: [180, 135], jump: [275, 388], dash: [240, 510], won: [392, 523, 659, 784],
  lost: [330, 247, 165], shade_spawned: [155, 182], countdown: [740],
  charm_picked: [587, 784, 1175], drifter_steal: [340, 191],
  wind: [190, 270, 190],
}

export function createSound(volume) {
  let context, output, ambientTimer
  let nextNote = 0
  const scale = [130.81, 155.56, 174.61, 196, 233.08, 196, 155.56, 261.63]
  let level = volume

  function tone(frequency, when, duration, peak, wave = 'sine') {
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    oscillator.type = wave
    oscillator.frequency.value = frequency
    envelope.gain.setValueAtTime(.0001, when)
    envelope.gain.exponentialRampToValueAtTime(peak, when + .026)
    envelope.gain.exponentialRampToValueAtTime(.0001, when + duration)
    oscillator.connect(envelope).connect(output)
    oscillator.start(when)
    oscillator.stop(when + duration + .02)
  }

  function play(cue) {
    if (context?.state !== 'running' || !level) return
    const notes = cues[cue]
    if (!notes) return
    notes.forEach((frequency, index) =>
      tone(frequency, context.currentTime + index * .085, .24, .12, 'sine'))
  }

  function setVolume(value) {
    level = value
    if (output) output.gain.setTargetAtTime(value, context.currentTime, .08)
  }

  function enable() {
    const Audio = window.AudioContext ?? window.webkitAudioContext
    if (!Audio) return
    if (!context) {
      context = new Audio()
      output = context.createGain()
      output.gain.value = level
      output.connect(context.destination)
    }
    context.resume().catch(() => {})
    if (!ambientTimer) ambientTimer = window.setInterval(() => {
      if (context.state !== 'running' || !level || document.hidden) return
      const note = scale[nextNote % scale.length]
      nextNote += 1
      tone(note, context.currentTime, 2.8, .043)
      if (nextNote % 3 === 1) tone(note * 1.5, context.currentTime + .28, 2.4, .02)
    }, 1550)
  }

  return { enable, play, setVolume }
}

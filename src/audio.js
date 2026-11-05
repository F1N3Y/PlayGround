// Tiny procedural sound engine — no external assets required.
export class SoundEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.muted = false
    this.ambient = null
    this.night = false
  }

  init() {
    if (this.ctx) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.55
    this.master.connect(this.ctx.destination)
    this.noiseBuffer = this.makeNoise()
    this.startAmbient()
  }

  resume() { this.ctx?.resume?.() }

  makeNoise() {
    const len = this.ctx.sampleRate * 2
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  setMuted(muted) {
    this.muted = muted
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.08)
  }

  tone({ freq = 440, to = freq, dur = 0.15, type = 'sine', vol = 0.2, delay = 0, attack = 0.01 }) {
    if (!this.ctx || this.muted) return
    const t = this.ctx.currentTime + delay
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(vol, t + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(gain).connect(this.master)
    osc.start(t); osc.stop(t + dur + 0.03)
  }

  noise({ dur = 0.3, vol = 0.15, filter = 900, to = filter, delay = 0, q = 0.8 }) {
    if (!this.ctx || this.muted) return
    const t = this.ctx.currentTime + delay
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const f = this.ctx.createBiquadFilter()
    f.type = 'bandpass'; f.Q.value = q
    f.frequency.setValueAtTime(filter, t)
    f.frequency.exponentialRampToValueAtTime(Math.max(60, to), t + dur)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(gain).connect(this.master)
    src.start(t); src.stop(t + dur + 0.03)
  }

  startAmbient() {
    if (!this.ctx) return
    const c = this.ctx
    const out = c.createGain(); out.gain.value = 0.075; out.connect(this.master)
    const a = c.createOscillator(); a.type = 'sine'; a.frequency.value = 48
    const b = c.createOscillator(); b.type = 'triangle'; b.frequency.value = 55.7
    const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 180
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07
    const lfoGain = c.createGain(); lfoGain.gain.value = 18
    lfo.connect(lfoGain).connect(filter.frequency)
    a.connect(filter); b.connect(filter); filter.connect(out)
    a.start(); b.start(); lfo.start()
    this.ambient = { out, filter }
  }

  setNight(night) {
    if (!this.ambient || this.night === night) return
    this.night = night
    this.ambient.out.gain.setTargetAtTime(night ? 0.1 : 0.065, this.ctx.currentTime, 1.5)
    this.ambient.filter.frequency.setTargetAtTime(night ? 130 : 210, this.ctx.currentTime, 1.5)
  }

  play(name) {
    if (!this.ctx || this.muted) return
    switch (name) {
      case 'click': this.tone({ freq: 620, to: 520, dur: 0.06, type: 'triangle', vol: 0.07 }); break
      case 'cast':
        this.noise({ dur: 0.4, vol: 0.12, filter: 2400, to: 300, q: 1.2 })
        this.tone({ freq: 300, to: 700, dur: 0.25, type: 'sine', vol: 0.06 })
        break
      case 'splash':
        this.noise({ dur: 0.5, vol: 0.13, filter: 900, to: 120, q: 0.6 })
        this.tone({ freq: 120, to: 48, dur: 0.4, type: 'sine', vol: 0.16 })
        break
      case 'bite':
        this.tone({ freq: 880, to: 660, dur: 0.1, type: 'square', vol: 0.08 })
        this.tone({ freq: 1180, to: 980, dur: 0.14, type: 'triangle', vol: 0.09, delay: 0.11 })
        break
      case 'reel':
        this.tone({ freq: 220, to: 760, dur: 0.5, type: 'sawtooth', vol: 0.06 })
        this.noise({ dur: 0.4, vol: 0.08, filter: 1200, to: 400 })
        break
      case 'chest':
        [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.5, type: 'triangle', vol: 0.1, delay: i * 0.09 }))
        this.tone({ freq: 130, to: 260, dur: 0.3, type: 'sine', vol: 0.12 })
        break
      case 'pickup':
        this.tone({ freq: 720, to: 1080, dur: 0.12, type: 'sine', vol: 0.07 })
        break
      case 'chop':
        this.noise({ dur: 0.18, vol: 0.2, filter: 800, to: 180, q: 0.7 })
        this.tone({ freq: 160, to: 70, dur: 0.18, type: 'square', vol: 0.09 })
        break
      case 'hit':
        this.noise({ dur: 0.2, vol: 0.16, filter: 1500, to: 200 })
        this.tone({ freq: 190, to: 80, dur: 0.2, type: 'sawtooth', vol: 0.07 })
        break
      case 'swing':
        this.noise({ dur: 0.18, vol: 0.07, filter: 2200, to: 600, q: 1.4 })
        break
      case 'hurt':
        this.tone({ freq: 210, to: 90, dur: 0.35, type: 'sawtooth', vol: 0.12 })
        this.noise({ dur: 0.25, vol: 0.1, filter: 500, to: 150 })
        break
      case 'monster':
        this.tone({ freq: 90, to: 42, dur: 0.8, type: 'sawtooth', vol: 0.1 })
        this.noise({ dur: 0.7, vol: 0.07, filter: 260, to: 90 })
        break
      case 'boss':
        this.tone({ freq: 55, to: 28, dur: 2.2, type: 'sawtooth', vol: 0.2 })
        this.noise({ dur: 2, vol: 0.12, filter: 300, to: 60, q: 0.4 })
        break
      case 'craft':
        [392, 523, 659].forEach((f, i) => this.tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.07, delay: i * 0.07 }))
        break
      case 'place':
        this.tone({ freq: 150, to: 90, dur: 0.2, type: 'sine', vol: 0.12 })
        this.noise({ dur: 0.2, vol: 0.06, filter: 400 })
        break
      case 'eat': this.noise({ dur: 0.15, vol: 0.08, filter: 700, to: 300 }); break
      case 'drink': this.tone({ freq: 300, to: 500, dur: 0.18, type: 'sine', vol: 0.06 }); break
      case 'error': this.tone({ freq: 160, to: 120, dur: 0.16, type: 'square', vol: 0.05 }); break
      case 'night':
        this.tone({ freq: 220, to: 110, dur: 2.2, type: 'sine', vol: 0.07 })
        this.tone({ freq: 330, to: 165, dur: 2.6, type: 'triangle', vol: 0.04, delay: 0.3 })
        break
      case 'dawn':
        [330, 440, 550, 660].forEach((f, i) => this.tone({ freq: f, dur: 1.1, type: 'sine', vol: 0.05, delay: i * 0.18 }))
        break
      case 'level':
        [523, 659, 880, 1318].forEach((f, i) => this.tone({ freq: f, dur: 0.7, type: 'triangle', vol: 0.08, delay: i * 0.1 }))
        break
      case 'victory':
        [392, 523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 1.6, type: 'sine', vol: 0.1, delay: i * 0.18 }))
        break
      case 'trial':
        this.tone({ freq: 65, to: 55, dur: 3, type: 'sawtooth', vol: 0.16 })
        this.noise({ dur: 3, vol: 0.09, filter: 420, to: 80, q: 0.5 })
        break
    }
  }
}

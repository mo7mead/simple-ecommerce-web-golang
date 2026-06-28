// Tiny WebAudio chime — no asset file required.
// Two soft sine pings (E5 → A5) with a fast exponential decay.

type Ctor = typeof AudioContext
let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (ctx) return ctx
  const AC: Ctor | undefined =
    window.AudioContext || (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext
  if (!AC) return null
  try { ctx = new AC() } catch { return null }
  return ctx
}

// Browsers require a user gesture before audio can play; resume on the first
// interaction so subsequent server-triggered events can play freely.
if (typeof window !== 'undefined') {
  const unlock = () => {
    const c = getCtx()
    if (c && c.state === 'suspended') c.resume().catch(() => {})
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
}

function ping(c: AudioContext, freq: number, startAt: number, dur = 0.32, peak = 0.18) {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(peak, startAt + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur)
  osc.connect(gain).connect(c.destination)
  osc.start(startAt)
  osc.stop(startAt + dur + 0.02)
}

export function playNotifSound() {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') { c.resume().catch(() => {}); return }
  const now = c.currentTime
  ping(c, 659.25, now)          // E5
  ping(c, 880.00, now + 0.14)   // A5
}

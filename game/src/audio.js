// SHADOW PROTOCOL — procedural sound, WebAudio only, no audio files.
// Every sound is a short oscillator or filtered-noise envelope, built when
// the AudioContext is first needed (after a user gesture).

let ctx = null;
let muted = false;

function ensure() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      ctx = null;
    }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ensure();
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

export function isMuted() {
  return muted;
}

function tone(freq, dur, type = 'sine', gain = 0.12, slideTo = null, delay = 0) {
  if (muted) return;
  const ac = ensure();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBurst(dur, gain, freq = 800) {
  if (muted) return;
  const ac = ensure();
  if (!ac) return;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start();
}

export const sfx = {
  step(run) {
    noiseBurst(0.05, run ? 0.05 : 0.025, run ? 900 : 500);
  },
  guardStep(dist) {
    // Quieter the farther the guard is.
    const g = Math.max(0.01, 0.07 * (1 - dist / 260));
    noiseBurst(0.06, g, 420);
  },
  pickup() {
    tone(660, 0.09, 'sine', 0.12);
    tone(990, 0.14, 'sine', 0.1, null, 0.08);
  },
  coinThrow() {
    tone(1200, 0.12, 'sine', 0.08, 1800);
  },
  coinLand() {
    tone(2400, 0.05, 'triangle', 0.12);
    tone(1800, 0.08, 'triangle', 0.1, null, 0.09);
  },
  sonar() {
    tone(1400, 0.5, 'sine', 0.1, 320);
    tone(1400, 0.4, 'sine', 0.06, 320, 0.14);
  },
  suspicious() {
    tone(440, 0.16, 'triangle', 0.12, 520);
  },
  spotted() {
    tone(220, 0.22, 'sawtooth', 0.14, 440);
    tone(440, 0.22, 'sawtooth', 0.1, 660, 0.12);
  },
  cameraBeep() {
    tone(1500, 0.06, 'square', 0.05);
  },
  alarm() {
    tone(520, 0.3, 'sawtooth', 0.08, 380);
  },
  bark() {
    tone(180, 0.09, 'square', 0.14, 120);
    tone(180, 0.09, 'square', 0.12, 110, 0.12);
  },
  caught() {
    tone(160, 0.5, 'sawtooth', 0.16, 60);
  },
  hide() {
    noiseBurst(0.18, 0.06, 300);
  },
  success() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'sine', 0.12, null, i * 0.11));
  },
  click() {
    tone(800, 0.05, 'sine', 0.08);
  },
};

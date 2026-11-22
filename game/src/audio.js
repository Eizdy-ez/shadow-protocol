// SHADOW PROTOCOL — procedural WebAudio: every sound is synthesized, no files.
export class SoundFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.stepT = 0;
  }

  // Must be called from a user gesture at least once.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  tone(freq, dur, type = 'sine', vol = 0.5, slideTo = null, delay = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise(dur, vol = 0.4, freq = 1200, delay = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  step(sneaking) {
    if (!this.ctx) return;
    this.tone(sneaking ? 140 : 90, 0.07, 'triangle', sneaking ? 0.1 : 0.22, 60);
  }

  coin() {
    this.tone(2100, 0.09, 'square', 0.16, 2600);
    this.tone(2600, 0.12, 'square', 0.12, 3100, 0.05);
  }

  coinLand() {
    this.tone(1500, 0.08, 'triangle', 0.2, 900);
    this.noise(0.06, 0.15, 3000);
  }

  pickup() {
    this.tone(660, 0.1, 'sine', 0.3);
    this.tone(880, 0.12, 'sine', 0.3, null, 0.08);
    this.tone(1320, 0.18, 'sine', 0.25, null, 0.16);
  }

  sonar() {
    this.tone(1200, 0.5, 'sine', 0.3, 300);
    this.tone(600, 0.4, 'sine', 0.15, 200, 0.1);
  }

  alert() {
    this.tone(220, 0.25, 'sawtooth', 0.3, 440);
    this.tone(440, 0.25, 'sawtooth', 0.25, 220, 0.18);
  }

  bark() {
    this.noise(0.12, 0.5, 900);
    this.noise(0.12, 0.45, 800, 0.16);
  }

  caught() {
    this.tone(180, 0.5, 'sawtooth', 0.35, 60);
    this.noise(0.4, 0.3, 400);
  }

  complete() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.3, null, i * 0.12));
  }

  click() {
    this.tone(900, 0.05, 'square', 0.12);
  }
}

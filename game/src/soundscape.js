// Soundscape: every sound is synthesized in code — no audio files.
// One job: engine hum that follows road speed, the two-tone siren wail,
// gunfire and crashes, UI blips and stings, and a procedural radio with
// three stations that plays a bassline and pads while Dana drives.

const STATIONS = [
  {
    name: 'SUNSET 104.2', genre: 'Golden Hour FM',
    tracks: ['Palm Static — Coral Ghosts', 'Amber Light — The Marlin Club', 'Low Tide — Rosa Vega'],
    root: 110, tempo: 100, minor: true,
  },
  {
    name: 'PALM 91.7', genre: 'Coastal Nights',
    tracks: ['Neon Palms — DJ Solmar', 'Night Ferry — The Breakers', 'Salt Air — Marina Vale'],
    root: 98, tempo: 84, minor: true,
  },
  {
    name: 'REEF 97.5', genre: 'Dockside Rock',
    tracks: ['Harbor Lights — The Kings (no relation)', 'Full Throttle — V8 Veronica', 'Sunset Run — The Getaways'],
    root: 130.8, tempo: 124, minor: false,
  },
];

export class Soundscape {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineNodes = null;
    this.sirenNodes = null;
    this.stationIndex = 0;
    this.trackIndex = 0;
    this.radioOn = false;
    this.radioTimer = null;
    this.nextNoteTime = 0;
    this.step = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.startEngineLoop();
    this.startSirenLoop();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  }

  // ---- Engine: a saw + a sub-square through a lowpass, pitched by speed ----
  startEngineLoop() {
    const saw = this.ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = 55;
    const sub = this.ctx.createOscillator();
    sub.type = 'square';
    sub.frequency.value = 28;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    saw.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    saw.start();
    sub.start();
    this.engineNodes = { saw, sub, filter, gain };
  }

  setEngine(speedNorm, running) {
    if (!this.engineNodes) return;
    const t = this.ctx.currentTime;
    const target = running ? 0.05 + speedNorm * 0.06 : 0;
    this.engineNodes.gain.gain.setTargetAtTime(target, t, 0.1);
    const freq = 55 + speedNorm * 130;
    this.engineNodes.saw.frequency.setTargetAtTime(freq, t, 0.08);
    this.engineNodes.sub.frequency.setTargetAtTime(freq / 2, t, 0.08);
    this.engineNodes.filter.frequency.setTargetAtTime(300 + speedNorm * 900, t, 0.1);
  }

  // ---- Siren: a sine wailing between two tones on an LFO ----
  startSirenLoop() {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 720;
    const lfo = this.ctx.createOscillator();
    lfo.type = 'triangle';
    lfo.frequency.value = 0.55;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    lfo.start();
    this.sirenNodes = { gain };
  }

  setSiren(on) {
    if (!this.sirenNodes) return;
    this.sirenNodes.gain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.25);
  }

  // ---- One-shots ----
  noiseBuffer(duration) {
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * duration), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  gunshot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer(0.14);
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1400;
    band.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    source.connect(band);
    band.connect(gain);
    gain.connect(this.master);
    source.start(t);
    const thump = this.ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(120, t);
    thump.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    const thumpGain = this.ctx.createGain();
    thumpGain.gain.setValueAtTime(0.4, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    thump.connect(thumpGain);
    thumpGain.connect(this.master);
    thump.start(t);
    thump.stop(t + 0.13);
  }

  crash(strength) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer(0.3);
    const low = this.ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 500;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15 + strength * 0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    source.connect(low);
    low.connect(gain);
    gain.connect(this.master);
    source.start(t);
  }

  reload() {
    if (!this.ctx) return;
    this.blip(320, 0.05, 0.15);
    setTimeout(() => this.blip(520, 0.06, 0.15), 180);
    setTimeout(() => this.blip(660, 0.05, 0.12), 420);
  }

  blip(frequency = 880, duration = 0.07, volume = 0.12) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  missionComplete() {
    if (!this.ctx) return;
    [523, 659, 784, 1046].forEach((freq, i) => {
      setTimeout(() => this.blip(freq, 0.16, 0.14), i * 110);
    });
  }

  failSting() {
    if (!this.ctx) return;
    [392, 330, 262, 196].forEach((freq, i) => {
      setTimeout(() => this.blip(freq, 0.3, 0.13), i * 170);
    });
  }

  // ---- Radio: a lookahead scheduler playing bass + pads per station ----
  currentStation() {
    const station = STATIONS[this.stationIndex];
    return { name: station.name, genre: station.genre, track: station.tracks[this.trackIndex] };
  }

  nextStation() {
    this.stationIndex = (this.stationIndex + 1) % STATIONS.length;
    this.trackIndex = 0;
    this.step = 0;
    return this.currentStation();
  }

  startRadio() {
    if (!this.ctx || this.radioOn) return;
    this.radioOn = true;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.radioTimer = setInterval(() => this.scheduleRadio(), 90);
  }

  stopRadio() {
    this.radioOn = false;
    if (this.radioTimer) clearInterval(this.radioTimer);
    this.radioTimer = null;
  }

  scheduleRadio() {
    if (!this.ctx || !this.radioOn) return;
    const station = STATIONS[this.stationIndex];
    const stepDur = 60 / station.tempo / 2; // eighth notes
    const scale = station.minor ? [1, 1.189, 1.335, 1.498] : [1, 1.26, 1.335, 1.498];
    while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
      const bar = Math.floor(this.step / 8) % 4;
      const root = station.root * (bar === 3 ? 0.89 : bar === 2 ? 1.335 : 1);
      if (this.step % 2 === 0) {
        // Bass on the beat.
        this.pluck(root / 2, this.nextNoteTime, stepDur * 1.8, 'triangle', 0.055);
      }
      if (this.step % 8 === 0) {
        // A soft pad chord at the top of each bar.
        for (const ratio of [1, scale[1], scale[2]]) {
          this.pluck(root * ratio, this.nextNoteTime, stepDur * 7, 'sawtooth', 0.012);
        }
      }
      if (this.step % 8 === 3 || this.step % 8 === 6) {
        // Sparse lead plucks.
        this.pluck(root * 2 * scale[(this.step + bar) % scale.length], this.nextNoteTime, stepDur * 1.2, 'sine', 0.03);
      }
      this.nextNoteTime += stepDur;
      this.step += 1;
      // A new track every 32 bars.
      if (this.step % 256 === 0) this.trackIndex = (this.trackIndex + 1) % station.tracks.length;
    }
  }

  pluck(freq, time, duration, type, volume) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = type === 'sawtooth' ? 700 : 2400;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }
}

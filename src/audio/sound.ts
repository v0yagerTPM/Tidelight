// ── Sound ────────────────────────────────────────────────────────────────────
// Everything is synthesised with WebAudio: no audio files, nothing to load,
// works offline in the Steam build. A quiet sea plays underneath (filtered
// noise breathing on a slow swell), and small tuned sounds mark what the
// keeper does: a soft pluck for each flash, a chime for a purchase, a bell
// for a relit lighthouse.
//
// Browsers only allow audio after a user gesture, so nothing starts until the
// first click or key press. The on/off choice is a per-device preference kept
// in localStorage (not in the save), and defaults to on.

const PREF_KEY = "tidelight-sound";
/** A pentatonic scale (D major pentatonic, two octaves) for the flash plucks. */
const PENTATONIC = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25, 739.99, 880];

type Ctx = AudioContext;

export class Sound {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private sea: GainNode | null = null;
  private enabled: boolean;
  private lastFlash = 0;
  private lastBuy = 0;

  constructor() {
    let pref: string | null = null;
    try {
      pref = localStorage.getItem(PREF_KEY);
    } catch {
      pref = null;
    }
    this.enabled = pref !== "off";
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Call from any user gesture: creates the audio graph the first time. */
  unlock(): void {
    if (!this.enabled) return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
      this.startSea();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    try {
      localStorage.setItem(PREF_KEY, on ? "on" : "off");
    } catch {
      /* a preference that can't be saved still applies for this session */
    }
    if (!this.ctx || !this.master) {
      if (on) this.unlock();
      return;
    }
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(on ? 0.8 : 0, now, 0.15);
    if (on && this.ctx.state === "suspended") void this.ctx.resume();
  }

  /** The tab is hidden: let the sea go quiet; resume on return. */
  setHidden(hidden: boolean): void {
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend();
    else if (this.enabled) void this.ctx.resume();
  }

  // ── Cues ───────────────────────────────────────────────────────────────────

  /** Flash the Beam: a soft pluck on a random pentatonic note. */
  flash(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastFlash < 0.05) return;
    this.lastFlash = now;
    const f = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
    this.tone(f, now, 0.35, 0.06, "triangle");
    this.tone(f * 2, now, 0.2, 0.015, "sine");
  }

  /** A purchase: two quick rising notes. */
  buy(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastBuy < 0.08) return;
    this.lastBuy = now;
    this.tone(587.33, now, 0.25, 0.05, "sine");
    this.tone(880, now + 0.07, 0.35, 0.05, "sine");
  }

  /** Something learned, kept or found: a three-note arpeggio. */
  chime(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    [659.25, 880, 1174.66].forEach((f, i) => this.tone(f, now + i * 0.09, 0.9, 0.05, "sine"));
  }

  /** A story beat arrives: a low, warm two-note phrase. */
  story(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(392, now, 1.6, 0.06, "sine");
    this.tone(587.33, now + 0.25, 1.8, 0.05, "sine");
  }

  /** A lighthouse relit: a bell — inharmonic partials with a long decay. */
  bell(deep = false): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const root = deep ? 98 : 146.83;
    [[1, 0.16], [2.76, 0.07], [5.4, 0.035], [8.93, 0.015]].forEach(([ratio, gain]) =>
      this.tone(root * ratio, now, deep ? 7 : 4.5, gain, "sine"),
    );
  }

  /** Rekindle: the flame gutters (falling), then catches (rising). */
  rekindle(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 1.1);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.06, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    osc.connect(g).connect(this.master as GainNode);
    osc.start(now);
    osc.stop(now + 1.3);
    [293.66, 440, 587.33, 880].forEach((f, i) => this.tone(f, now + 1.5 + i * 0.12, 1.4, 0.05, "sine"));
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private ready(): Ctx | null {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== "running") return null;
    return this.ctx;
  }

  private tone(freq: number, at: number, decay: number, gain: number, type: OscillatorType): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(g).connect(this.master);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  }

  /** The sea: looped brown noise, low-passed, breathing on a slow swell. */
  private startSea(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const seconds = 4;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 520;
    this.sea = ctx.createGain();
    this.sea.gain.value = 0.05;
    // The swell: a very slow LFO on the sea's volume.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const depth = ctx.createGain();
    depth.gain.value = 0.03;
    lfo.connect(depth).connect(this.sea.gain);
    noise.connect(lowpass).connect(this.sea).connect(this.master);
    noise.start();
    lfo.start();
  }
}

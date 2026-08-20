/**
 * Shutter feedback: sound and vibration.
 *
 * Both are opt-out, both fail silently, and neither is ever required for the
 * photo to be taken. A camera that refuses to shoot because an AudioContext
 * didn't resume would be indefensible.
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) audioContext = new Ctor();
  return audioContext;
}

/**
 * iOS suspends audio until a user gesture. Called from the first tap on the
 * camera screen so the shutter isn't silent on the very first photo.
 */
export function primeAudio(): void {
  const ctx = getAudioContext();
  if (ctx?.state === "suspended") void ctx.resume();
}

/**
 * A synthesised leaf-shutter click: a filtered noise burst for the blades and
 * a short body thump underneath. Synthesised rather than sampled so the app
 * ships no audio assets and the sound works offline from the first load.
 */
export function playShutter(volume = 0.35): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);

  // Blades: 40ms of band-passed noise.
  const length = Math.floor(ctx.sampleRate * 0.04);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 2600;
  bandpass.Q.value = 1.1;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(1, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  noise.connect(bandpass).connect(noiseGain).connect(master);

  // Body: a fast low thump so the click has weight on phone speakers.
  const thump = ctx.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(180, now);
  thump.frequency.exponentialRampToValueAtTime(70, now + 0.06);
  const thumpGain = ctx.createGain();
  thumpGain.gain.setValueAtTime(0.5, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
  thump.connect(thumpGain).connect(master);

  noise.start(now);
  noise.stop(now + 0.06);
  thump.start(now);
  thump.stop(now + 0.08);
  setTimeout(() => master.disconnect(), 200);
}

/** A soft tick for each second of the booth countdown. */
export function playTick(volume = 0.18): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}

export type HapticPattern = "shutter" | "tick" | "confirm" | "error";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  shutter: 12,
  tick: 6,
  confirm: [10, 40, 18],
  error: [30, 60, 30],
};

export function vibrate(pattern: HapticPattern): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Blocked by a permissions policy on some embedded browsers.
  }
}

let context: AudioContext | null = null;
let muted = false;
export function setMuted(value: boolean) { muted = value }
export function sound(kind: 'select' | 'match' | 'attack' | 'shield' | 'break' | 'heal' | 'ready' | 'win' | 'lose') {
  if (muted) return;
  context ??= new AudioContext(); if (context.state === 'suspended') void context.resume();
  const oscillator = context.createOscillator(), gain = context.createGain(); const now = context.currentTime;
  const frequency = { select: 300, match: 520, attack: 170, shield: 720, break: 110, heal: 620, ready: 880, win: 920, lose: 130 }[kind];
  oscillator.frequency.setValueAtTime(frequency, now); oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, frequency * 1.35), now + 0.11);
  gain.gain.setValueAtTime(0.055, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
  oscillator.connect(gain).connect(context.destination); oscillator.start(now); oscillator.stop(now + 0.15);
}

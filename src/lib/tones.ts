let audioContext: AudioContext | null = null;
const activeNodes: OscillatorNode[] = [];

export function unlockAudio(): void {
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === "suspended") void audioContext.resume();
}

export function stopTones(): void {
  while (activeNodes.length > 0) {
    const node = activeNodes.pop();
    if (!node) continue;
    try {
      node.stop();
    } catch {
      // Oscillator may already have ended.
    }
    node.disconnect();
  }
}

function tone(frequency: number, when: number, duration: number, type: OscillatorType, gainValue: number) {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(gainValue, when + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(when);
  oscillator.stop(when + duration + 0.02);
  activeNodes.push(oscillator);
}

export function playStageCue(stage: number, enabled: boolean): void {
  if (!enabled || !audioContext) return;
  const now = audioContext.currentTime + 0.02;
  if (stage === 0) {
    tone(740, now, 0.12, "sine", 0.05);
    tone(880, now + 0.16, 0.12, "sine", 0.05);
    tone(494, now + 0.34, 0.18, "triangle", 0.04);
    return;
  }
  if (stage === 1) {
    tone(116, now, 0.1, "square", 0.028);
    tone(98, now + 0.18, 0.12, "square", 0.028);
    tone(82, now + 0.38, 0.16, "sawtooth", 0.02);
    return;
  }
  if (stage === 2) {
    for (let index = 0; index < 6; index += 1) {
      tone(1680, now + index * 0.09, 0.04, "square", 0.028);
    }
    return;
  }
  tone(620, now, 0.12, "sine", 0.05);
  tone(415, now + 0.14, 0.14, "sine", 0.045);
  tone(233, now + 0.3, 0.2, "triangle", 0.05);
  tone(523, now + 0.58, 0.4, "sine", 0.035);
  tone(659, now + 0.58, 0.4, "sine", 0.026);
  tone(784, now + 0.58, 0.4, "sine", 0.02);
}

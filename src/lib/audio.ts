export interface DecodedAudio {
  samples: Float32Array;
  sampleRate: number;
  buffer: AudioBuffer;
}

export async function decodeToMono(context: AudioContext, data: ArrayBuffer): Promise<DecodedAudio> {
  const buffer = await context.decodeAudioData(data.slice(0));
  const samples = new Float32Array(buffer.length);
  const channels = buffer.numberOfChannels;
  for (let channel = 0; channel < channels; channel += 1) {
    const dataChannel = buffer.getChannelData(channel);
    for (let index = 0; index < buffer.length; index += 1) {
      samples[index] += dataChannel[index] / channels;
    }
  }
  return { samples, sampleRate: buffer.sampleRate, buffer };
}

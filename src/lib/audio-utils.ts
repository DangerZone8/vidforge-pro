// AudioBuffer caching, waveform peak extraction, and shared AudioContext.

let ctx: AudioContext | null = null;
export function getAudioContext(): AudioContext {
  if (ctx) return ctx;
  const Cls = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
  ctx = new Cls();
  return ctx;
}

const bufferCache = new Map<string, Promise<AudioBuffer>>();

export async function decodeAudio(url: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(url);
  if (cached) return cached;
  const p = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load audio: ${res.status}`);
    const arr = await res.arrayBuffer();
    return await getAudioContext().decodeAudioData(arr);
  })();
  bufferCache.set(url, p);
  try {
    return await p;
  } catch (e) {
    bufferCache.delete(url);
    throw e;
  }
}

const peaksCache = new Map<string, Float32Array>();

export async function getPeaks(url: string, samples: number): Promise<Float32Array> {
  const key = `${url}|${samples}`;
  const cached = peaksCache.get(key);
  if (cached) return cached;
  const buf = await decodeAudio(url);
  const channel = buf.getChannelData(0);
  const step = Math.max(1, Math.floor(channel.length / samples));
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const start = i * step;
    const end = Math.min(channel.length, start + step);
    let peak = 0;
    for (let j = start; j < end; j++) {
      const v = Math.abs(channel[j]);
      if (v > peak) peak = v;
    }
    out[i] = peak;
  }
  peaksCache.set(key, out);
  return out;
}

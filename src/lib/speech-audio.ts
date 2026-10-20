// A canonical PCM container makes recording duration verifiable before paid API calls.
export function encodeSpeechWav(samples: Float32Array, sourceRate: number): Uint8Array {
  if (!Number.isFinite(sourceRate) || sourceRate <= 0 || samples.length / sourceRate > 120)
    throw new Error("Recording exceeds two minutes");
  const rate = 16000,
    count = Math.floor((samples.length * rate) / sourceRate);
  if (count < 1600) throw new Error("Recording is too short");
  const bytes = new Uint8Array(44 + count * 2),
    view = new DataView(bytes.buffer);
  const str = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i);
  };
  str(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const at = (i * sourceRate) / rate,
      j = Math.floor(at),
      fraction = at - j;
    const value = (samples[j] ?? 0) * (1 - fraction) + (samples[j + 1] ?? 0) * fraction;
    if (!Number.isFinite(value)) throw new Error("Invalid audio");
    const sample = Math.max(-1, Math.min(1, value));
    view.setInt16(44 + i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return bytes;
}
export function speechWavDuration(bytes: Uint8Array): number {
  if (bytes.length < 3244 || bytes.length > 3840044) throw new Error("Invalid recording length");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const str = (offset: number, len: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + len));
  if (
    str(0, 4) !== "RIFF" ||
    str(8, 4) !== "WAVE" ||
    str(12, 4) !== "fmt " ||
    str(36, 4) !== "data" ||
    view.getUint32(4, true) !== bytes.length - 8 ||
    view.getUint32(16, true) !== 16 ||
    view.getUint16(20, true) !== 1 ||
    view.getUint16(22, true) !== 1 ||
    view.getUint32(24, true) !== 16000 ||
    view.getUint32(28, true) !== 32000 ||
    view.getUint16(32, true) !== 2 ||
    view.getUint16(34, true) !== 16 ||
    view.getUint32(40, true) !== bytes.length - 44 ||
    (bytes.length - 44) % 2 !== 0
  )
    throw new Error("Invalid recording format");
  return (bytes.length - 44) / 32000;
}

class PCMCapture extends AudioWorkletProcessor {
  process(inputs) {
    const audio = inputs[0]?.[0];
    if (audio) this.port.postMessage(audio.slice());
    return true;
  }
}
registerProcessor("pcm-capture", PCMCapture);

import { useCallback, useEffect, useRef, useState } from "react";

export type LiveEvent = { type: string; error?: { message?: string }; [key: string]: unknown };
export function useLiveVoice(
  options: {
    getToken?: () => Promise<string | undefined>;
    workspaceId?: string | null;
    onEvent?: (event: LiveEvent) => void | Promise<void>;
  } = {},
) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const latest = useRef(options);
  latest.current = options;
  const closeRef = useRef<(() => void) | null>(null);
  const muteRef = useRef(false);
  const contextRef = useRef<AudioContext | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "stopping" | "closed">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [muted, setMutedState] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const stop = useCallback(() => closeRef.current?.(), []);
  const start = useCallback(async () => {
    if (closeRef.current) return;
    setStatus("connecting");
    setError(null);
    let socket: WebSocket | undefined,
      mic: MediaStream | undefined,
      context: AudioContext | undefined,
      worklet: AudioWorkletNode | undefined;
    let closed = false,
      ready = false,
      scheduled = 0;
    const sources = new Set<AudioBufferSourceNode>();
    const stopPlayback = () => {
      sources.forEach((source) => {
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
      });
      sources.clear();
      scheduled = 0;
    };
    const close = () => {
      if (closed) return;
      closed = true;
      ready = false;
      mic?.getTracks().forEach((track) => track.stop());
      worklet?.disconnect();
      stopPlayback();
      socket?.close();
      void context?.close();
      contextRef.current = null;
      closeRef.current = null;
      setStatus("closed");
      setMutedState(false);
      muteRef.current = false;
    };
    closeRef.current = close;
    try {
      // Create/resume in the user gesture before awaiting sign-in or permissions.
      context = new AudioContext({ sampleRate: 24000 });
      contextRef.current = context;
      await context.resume();
      const token = await latest.current.getToken?.();
      if (closed) return;
      if (!token) throw new Error("Please sign in to talk to Sera.");
      mic = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      if (closed) {
        mic.getTracks().forEach((track) => track.stop());
        return;
      }
      await context.audioWorklet.addModule("/pcm-capture.js");
      if (closed) return;
      const url = new URL("/api/live", window.location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      if (latest.current.workspaceId) url.searchParams.set("workspace", latest.current.workspaceId);
      socket = new WebSocket(url, ["matrixkeep", `auth.${token}`]);
      worklet = new AudioWorkletNode(context, "pcm-capture");
      context.createMediaStreamSource(mic).connect(worklet);
      const silent = context.createGain();
      silent.gain.value = 0;
      worklet.connect(silent).connect(context.destination);
      const pending: number[] = [];
      worklet.port.onmessage = ({ data }: MessageEvent<Float32Array>) => {
        if (!ready || closed || muteRef.current || !context || !socket || socket.readyState !== 1)
          return;
        // AudioContext is requested at 24 kHz; explicitly resample if a device overrides it.
        const ratio = context.sampleRate / 24000;
        for (let i = 0; i < data.length; i += ratio)
          pending.push(Math.max(-1, Math.min(1, data[Math.floor(i)] ?? 0)));
        if (pending.length < 2400) return;
        const pcm = new Int16Array(
          pending.splice(0, 2400).map((value) => Math.round(value * (value < 0 ? 32768 : 32767))),
        );
        const bytes = new Uint8Array(pcm.buffer);
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        if (socket.bufferedAmount > 128000) {
          setError("Connection too slow for voice.");
          close();
          return;
        }
        socket.send(JSON.stringify({ type: "audio", audio: btoa(binary) }));
      };
      socket.onmessage = ({ data }) => {
        try {
          const event = JSON.parse(data) as LiveEvent & { audio?: string };
          if (event.type === "app.connected") {
            ready = true;
            setStatus("connected");
          }
          if (event.type === "interrupt") stopPlayback();
          if (event.type === "app.error") {
            setError(event.error?.message ?? "Voice unavailable.");
            close();
          }
          if (event.type === "audio" && event.audio && context) {
            if (context.state === "suspended") setPlaybackBlocked(true);
            const bytes = Uint8Array.from(atob(event.audio), (c) => c.charCodeAt(0));
            const pcm = new Int16Array(bytes.buffer);
            const buffer = context.createBuffer(1, pcm.length, 24000);
            const floats = buffer.getChannelData(0);
            for (let i = 0; i < pcm.length; i++) floats[i] = pcm[i]! / 32768;
            if (scheduled > context.currentTime + 15) {
              setError("Voice playback is too far behind.");
              close();
              return;
            }
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);
            sources.add(source);
            source.onended = () => sources.delete(source);
            scheduled = Math.max(scheduled, context.currentTime);
            source.start(scheduled);
            scheduled += buffer.duration;
          }
          void latest.current.onEvent?.(event);
        } catch {
          setError("Voice connection failed.");
          close();
        }
      };
      socket.onerror = () => {
        setError("Voice unavailable. Check your plan allowance and try again.");
        close();
      };
      socket.onclose = close;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Voice unavailable.");
      close();
    }
  }, []);
  useEffect(() => () => closeRef.current?.(), []);
  const setMuted = useCallback((value: boolean) => {
    muteRef.current = value;
    setMutedState(value);
  }, []);
  const resumePlayback = useCallback(async () => {
    await contextRef.current?.resume();
    setPlaybackBlocked(false);
  }, []);
  return { audioRef, status, error, muted, playbackBlocked, start, stop, setMuted, resumePlayback };
}

import { useCallback, useEffect, useRef, useState } from "react";

export type LiveEvent = {
  type: string;
  reason?: string;
  error?: { message?: string };
  usage?: { seconds?: number };
  finalized?: boolean;
  transport?: { type?: string; sdp?: string };
  [key: string]: unknown;
};

type LiveState = {
  status: "idle" | "connecting" | "connected" | "stopping" | "closed";
  error: string | null;
  hasConnected: boolean;
  finalized: boolean | null;
  muted: boolean;
  playbackBlocked: boolean;
};

const initialState: LiveState = {
  status: "idle",
  error: null,
  hasConnected: false,
  finalized: null,
  muted: false,
  playbackBlocked: false,
};

export function useLiveVoice(
  options: {
    url?: string;
    startPayload?: () => Promise<Record<string, string>>;
    onEvent?: (event: LiveEvent) => void | Promise<void>;
  } = {},
) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const controller = useRef<ReturnType<typeof createLiveVoice> | null>(null);
  const mounted = useRef(false);
  const latest = useRef(options);
  const [call, setCall] = useState(initialState);

  useEffect(() => {
    latest.current = options;
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const voice = controller.current;
      controller.current = null;
      voice?.stop();
    };
  }, []);

  const start = useCallback(() => {
    if (!mounted.current || controller.current) return;
    const audio = audioRef.current;
    if (!audio) {
      setCall((previous) => ({ ...previous, error: "Pemutar suara belum siap." }));
      return;
    }
    let endpoint: URL;
    try {
      endpoint = new URL(latest.current.url ?? "/api/live", window.location.href);
      if (endpoint.protocol === "https:") endpoint.protocol = "wss:";
      if (endpoint.protocol === "http:") endpoint.protocol = "ws:";
    } catch {
      setCall((previous) => ({ ...previous, error: "Alamat layanan suara tidak valid." }));
      return;
    }
    const voice = createLiveVoice({
      url: endpoint.href,
      audio,
      startPayload: () => latest.current.startPayload?.() ?? Promise.resolve({}),
      onEvent(event) {
        if (!mounted.current || controller.current !== voice) return;
        if (event.type === "app.connected") {
          setCall((previous) => ({ ...previous, status: "connected", hasConnected: true }));
        } else if (event.type === "app.stopping") {
          setCall((previous) => ({ ...previous, status: "stopping", playbackBlocked: false }));
        } else if (event.type === "app.closed") {
          controller.current = null;
          setCall((previous) => ({
            ...previous,
            status: "closed",
            muted: false,
            playbackBlocked: false,
            finalized: event.finalized === true,
          }));
        } else if (event.type === "app.playback.blocked" || event.type === "app.playback.resumed") {
          setCall((previous) => ({ ...previous, playbackBlocked: event.type === "app.playback.blocked" }));
        } else if (["app.error", "gateway.error", "error"].includes(event.type)) {
          setCall((previous) => ({ ...previous, error: event.error?.message ?? "Percakapan suara gagal tersambung." }));
        }
        try {
          void Promise.resolve(latest.current.onEvent?.(event)).catch((error) => {
            console.error("Live UI event handler failed", error);
          });
        } catch (error) {
          console.error("Live UI event handler failed", error);
        }
      },
    });
    controller.current = voice;
    setCall({ ...initialState, status: "connecting" });
    void voice.start();
  }, []);

  const stop = useCallback(() => {
    controller.current?.stop();
  }, []);
  const setMuted = useCallback((muted: boolean) => {
    if (controller.current?.setMuted(muted)) setCall((previous) => ({ ...previous, muted }));
  }, []);
  const resumePlayback = useCallback(() => {
    void controller.current?.resumePlayback();
  }, []);

  return { ...call, audioRef, start, stop, setMuted, resumePlayback };
}

type LiveOptions = {
  url: string;
  audio: HTMLAudioElement;
  startPayload: () => Promise<Record<string, string>>;
  onEvent: (event: LiveEvent) => void;
};

function createLiveVoice(options: LiveOptions) {
  let state: "idle" | "starting" | "active" | "stopping" | "closed" = "idle";
  let socket: WebSocket | undefined;
  let peer: RTCPeerConnection | undefined;
  let channel: RTCDataChannel | undefined;
  let microphone: MediaStream | undefined;
  let playback: MediaStream | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let cancelGathering: (() => void) | undefined;
  let lastAck = 0;
  let lastHeartbeat = 0;
  let answerReceived = false;
  let finalized = false;
  let muted = false;

  function starting() {
    return state === "starting";
  }

  function send(event: object) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
  }

  function stopAudio() {
    microphone?.getTracks().forEach((track) => track.stop());
    if (playback && options.audio.srcObject === playback) {
      options.audio.pause();
      options.audio.srcObject = null;
    }
  }

  function release() {
    if (state === "closed") return;
    state = "closed";
    clearInterval(heartbeat);
    clearTimeout(deadline);
    cancelGathering?.();
    window.removeEventListener("pagehide", stop);
    stopAudio();
    channel?.close();
    peer?.close();
    socket?.close();
    options.onEvent({ type: "app.closed", finalized });
  }

  function stop() {
    if (state === "stopping" || state === "closed") return;
    state = "stopping";
    try {
      send({ type: "session.close" });
    } catch {
      return release();
    }
    stopAudio();
    cancelGathering?.();
    clearInterval(heartbeat);
    clearTimeout(deadline);
    deadline = setTimeout(release, 15_000);
    options.onEvent({ type: "app.stopping" });
    if (!socket || socket.readyState !== WebSocket.OPEN) release();
  }

  function setMuted(value: boolean) {
    if (state !== "starting" && state !== "active") return false;
    muted = value;
    microphone?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    return true;
  }

  async function resumePlayback() {
    if ((state !== "starting" && state !== "active") || !options.audio.srcObject) return;
    try {
      await options.audio.play();
      if (state === "starting" || state === "active") options.onEvent({ type: "app.playback.resumed" });
    } catch {
      if (state === "starting" || state === "active") options.onEvent({ type: "app.playback.blocked" });
    }
  }

  function fail(message: string) {
    if (state === "stopping" || state === "closed") return;
    options.onEvent({ type: "app.error", error: { message } });
    stop();
  }

  function reportUnexpectedClosure(reason?: string) {
    if (state === "stopping" || state === "closed") return;
    const messages: Record<string, string> = {
      startup_timeout: "Suara belum tersambung. Coba sambungkan lagi nanti.",
      initial_heartbeat_timeout: "Audio belum tersambung. Periksa jaringan lalu coba lagi.",
      heartbeat_timeout: "Sambungan suara terputus. Coba sambungkan lagi nanti.",
      gateway_shutdown: "Layanan suara sedang dimulai ulang. Coba lagi nanti.",
      inactivity_timeout: "Percakapan suara berakhir karena tidak ada aktivitas.",
      duration_limit: "Batas durasi percakapan tercapai. Mulai lagi untuk melanjutkan.",
    };
    options.onEvent({
      type: "app.error",
      error: { message: messages[reason ?? ""] ?? "Sambungan suara berakhir. Coba sambungkan lagi nanti." },
    });
  }

  function mediaReady() {
    return peer?.connectionState === "connected" && channel?.readyState === "open";
  }

  function pulse() {
    if (state !== "active") return;
    if (Date.now() - lastAck >= 5000) return fail("Sambungan suara terputus. Coba lagi nanti.");
    if (Date.now() - lastHeartbeat >= 5000) return fail("Sambungan audio terputus. Coba lagi nanti.");
    if (!mediaReady()) return;
    try {
      send({ type: "gateway.heartbeat" });
      lastHeartbeat = Date.now();
    } catch {
      fail("Sambungan suara gagal. Coba lagi nanti.");
    }
  }

  function activate() {
    if (!answerReceived || !mediaReady()) return;
    if (starting()) {
      state = "active";
      clearTimeout(deadline);
      lastAck = Date.now();
      lastHeartbeat = Date.now();
      heartbeat = setInterval(pulse, 1000);
      pulse();
      if (state !== "active") return;
      send({ type: "app.ready" });
      options.onEvent({ type: "app.connected" });
    } else pulse();
  }

  async function applyAnswer(event: LiveEvent) {
    if (!starting() || !peer) return;
    if (answerReceived || event.transport?.type !== "webrtc" || !event.transport.sdp) {
      throw new Error("Layanan suara mengirim jawaban sambungan yang tidak valid.");
    }
    answerReceived = true;
    clearTimeout(deadline);
    deadline = setTimeout(
      () => fail("Audio belum tersambung. Periksa jaringan lalu coba lagi."),
      12_000,
    );
    await peer.setRemoteDescription({ type: "answer", sdp: event.transport.sdp });
    activate();
  }

  async function gatherCandidates(connection: RTCPeerConnection) {
    if (connection.iceGatheringState === "complete") return;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error("Jaringan audio belum siap. Periksa sambungan internet lalu coba lagi.")), 10_000);
      function finish(error?: Error) {
        clearTimeout(timeout);
        connection.removeEventListener("icegatheringstatechange", changed);
        cancelGathering = undefined;
        if (error) reject(error);
        else resolve();
      }
      function changed() {
        if (connection.iceGatheringState === "complete") finish();
      }
      cancelGathering = () => finish(new Error("Percakapan diakhiri."));
      connection.addEventListener("icegatheringstatechange", changed);
      changed();
    });
  }

  async function start() {
    if (state !== "idle") return;
    state = "starting";
    window.addEventListener("pagehide", stop);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      microphone = stream;
      if (!starting()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const connection = new RTCPeerConnection();
      peer = connection;
      for (const track of stream.getAudioTracks()) {
        track.enabled = !muted;
        track.addEventListener("ended", stop);
        connection.addTrack(track, stream);
      }
      connection.addEventListener("track", ({ track }) => {
        if (state === "stopping" || state === "closed") return;
        playback = new MediaStream([track]);
        options.audio.srcObject = playback;
        void resumePlayback();
      });
      connection.addEventListener("connectionstatechange", () => {
        if (connection.connectionState === "failed") fail("Audio gagal tersambung. Periksa jaringan lalu coba lagi.");
        else if (connection.connectionState === "closed") fail("Sambungan audio ditutup.");
        else activate();
      });
      channel = connection.createDataChannel("oai-events");
      channel.addEventListener("open", activate);
      channel.addEventListener("message", ({ data }) => {
        try {
          const event: LiveEvent = JSON.parse(data);
          if (event.type === "session.started") {
            activate();
          }
        } catch {
          fail("Layanan suara mengirim pesan yang tidak valid.");
        }
      });
      channel.addEventListener("error", () => fail("Sambungan audio gagal."));
      channel.addEventListener("close", stop);
      await connection.setLocalDescription(await connection.createOffer());
      if (!starting()) return;
      await gatherCandidates(connection);
      if (!starting()) return;
      const sdp = connection.localDescription?.sdp;
      if (!sdp) throw new Error("Audio belum siap untuk disambungkan.");
      const payload = await options.startPayload();
      if (!starting()) return;
      socket = new WebSocket(options.url);
      deadline = setTimeout(() => fail("Percakapan suara belum dimulai. Coba lagi nanti."), 50_000);
      socket.onopen = () => {
        if (!starting()) return release();
        send({ ...payload, type: "app.start", sdp });
      };
      socket.onmessage = ({ data }) => {
        try {
          const event: LiveEvent = JSON.parse(data);
          if (event.type === "gateway.session.created") {
            void applyAnswer(event).catch(() => fail("Audio gagal tersambung. Coba lagi nanti."));
          } else if (event.type === "session.started") {
            activate();
          } else if (event.type === "gateway.heartbeat.ack") {
            lastAck = Date.now();
          } else if (event.type === "session.closed") {
            finalized =
              typeof event.usage?.seconds === "number" &&
              Number.isFinite(event.usage.seconds) &&
              event.usage.seconds >= 0;
            reportUnexpectedClosure(event.reason);
            options.onEvent(event);
            return release();
          } else if (
            event.type === "gateway.session.closing" ||
            event.type === "gateway.error" ||
            event.type === "app.error"
          ) {
            if (event.type === "gateway.session.closing") reportUnexpectedClosure(event.reason);
            options.onEvent(event);
            return stop();
          }
          options.onEvent(event);
        } catch {
          fail("Layanan suara mengirim pesan yang tidak valid.");
        }
      };
      socket.onerror = () => fail("Sambungan suara gagal. Coba lagi nanti.");
      socket.onclose = () => {
        if (state !== "stopping" && state !== "closed") {
          options.onEvent({ type: "app.error", error: { message: "Sambungan suara ditutup. Coba lagi nanti." } });
        }
        release();
      };
    } catch (error) {
      fail(error instanceof DOMException && error.name === "NotAllowedError" ? "Izin mikrofon belum diberikan. Izinkan mikrofon untuk mengobrol." : error instanceof Error ? error.message : "Mikrofon tidak dapat dibuka.");
    }
  }

  return { start, stop, setMuted, resumePlayback };
}

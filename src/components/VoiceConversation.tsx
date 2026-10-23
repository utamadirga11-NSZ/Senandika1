import { useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiveVoice, type LiveEvent } from "@/hooks/use-live-voice";
import { supabase } from "@/integrations/supabase/client";
import mark from "@/assets/senandika-mark.png";
import { cn } from "@/lib/utils";

export function VoiceConversation({ threadId }: { threadId: string }) {
  const [captions, setCaptions] = useState<{ role: string; text: string }[]>([]);
  const [seconds, setSeconds] = useState<number | null>(null);
  const call = useLiveVoice({
    startPayload: async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Silakan masuk lagi untuk mengobrol.");
      return { accessToken: data.session.access_token, threadId };
    },
    onEvent(event: LiveEvent) {
      if ((event.type === "session.usage.updated" || event.type === "session.closed") && typeof event.usage?.seconds === "number") {
        setSeconds(Math.max(15, event.usage.seconds));
      }
      if (!event.type.endsWith("_transcript.delta") || typeof event['delta'] !== "string") return;
      const text = event['delta'];
      const role = event.type === "session.input_transcript.delta" ? "Kamu" : "Senandika";
      setCaptions((previous) => {
        const last = previous.at(-1);
        if (last?.role === role) return [...previous.slice(0, -1), { role, text: last.text + text }];
        return [...previous, { role, text }];
      });
    },
  });
  const canStart = call.status === "idle" || call.status === "closed";
  const labels = { idle: "Aku di sini.", connecting: "Menyiapkan suara…", connected: "Aku mendengarkan.", stopping: "Mengakhiri percakapan…", closed: "Terima kasih sudah bercerita." };

  return (
    <section className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-5 pb-8 text-center" aria-label="Percakapan suara">
      <div className="my-auto w-full max-w-xl py-8">
        <img src={mark} alt="Senandika" width={816} height={816} className={cn("mx-auto h-28 w-28 object-contain", !canStart && "animate-float")} />
        <h2 className="mt-6 font-serif text-3xl font-light">Senandika</h2>
        <p role="status" className="mt-2 text-muted-foreground">{call.error ? "Percakapan suara belum tersambung." : call.status === "closed" && !call.hasConnected ? "Aku di sini." : labels[call.status]}</p>
        <audio ref={call.audioRef} controls className="mx-auto mt-6 max-w-full" aria-label="Suara Senandika" />
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {canStart ? (
            <Button onClick={() => { setCaptions([]); setSeconds(null); call.start(); }} className="gap-2 rounded-full"><Phone className="h-4 w-4" />{call.error ? "Coba sambungkan lagi" : "Mulai mengobrol"}</Button>
          ) : (
            <>
              <Button variant="outline" size="icon" title={call.muted ? "Aktifkan mikrofon" : "Matikan mikrofon"} aria-label={call.muted ? "Aktifkan mikrofon" : "Matikan mikrofon"} disabled={call.status !== "connected"} onClick={() => call.setMuted(!call.muted)}>{call.muted ? <MicOff /> : <Mic />}</Button>
              <Button variant="destructive" className="gap-2 rounded-full" onClick={call.stop} disabled={call.status === "stopping"}><PhoneOff className="h-4 w-4" />Akhiri</Button>
            </>
          )}
          {call.playbackBlocked && <Button variant="outline" onClick={call.resumePlayback} className="gap-2"><Play className="h-4 w-4" />Putar suara</Button>}
        </div>
        {call.error && <p role="alert" className="mt-4 text-sm text-destructive">{call.error}</p>}
        {seconds !== null && <p className="mt-3 text-xs text-muted-foreground">Pemakaian suara: {Math.ceil(seconds)} detik{call.finalized === false ? " · total akhir belum terkonfirmasi" : ""}</p>}
        {captions.length > 0 && <div className="mt-8 space-y-4 text-left" aria-live="polite">{captions.map((caption, index) => <div key={index}><p className="text-xs text-muted-foreground">{caption.role}</p><p className="mt-1 whitespace-pre-wrap leading-relaxed">{caption.text}</p></div>)}</div>}
      </div>
      <p className="max-w-md text-xs text-muted-foreground">Senandika adalah AI pendamping, bukan pengganti psikolog. Percakapan suara tidak disimpan sebagai riwayat chat.</p>
    </section>
  );
}
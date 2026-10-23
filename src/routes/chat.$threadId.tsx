import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { toast } from "sonner";
import { LogOut, Menu, MessageCircle, Mic, PenLine, Sparkles, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { FloatLoader } from "@/components/FloatLoader";
import mark from "@/assets/senandika-mark.png";
import { cn } from "@/lib/utils";
import { CrisisHelp } from "@/components/CrisisHelp";
import { AgeGate } from "@/components/AgeGate";
import { VoiceConversation } from "@/components/VoiceConversation";
import { visibleChatMessages } from "@/lib/chat-messages";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Percakapan — Senandika" },
      { name: "description", content: "Ruang percakapan refleksi pribadimu bersama Senandika." },
      { property: "og:title", content: "Percakapan — Senandika" },
      { property: "og:description", content: "Ruang percakapan refleksi pribadimu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

type Thread = { id: string; title: string; updated_at: string };

const STARTERS = [
  { label: "Beban keluarga & ekspektasi orang tua", text: "Aku lagi merasa berat dengan keadaan di keluargaku dan ekspektasi orang tuaku." },
  { label: "Lelah tugas & takut gagal", text: "Aku capek dengan tugas sekolah/kuliah dan takut gagal." },
  { label: "Cemas & overthinking", text: "Pikiranku terus berputar dan aku merasa cemas terus." },
  { label: "Kesepian & pertemanan", text: "Aku merasa kesepian dan sulit merasa diterima di pertemanan." },
  { label: "Media sosial & membandingkan diri", text: "Aku sering membandingkan diriku dengan orang lain di media sosial." },
  { label: "Sulit menerima diri sendiri", text: "Aku sulit menerima dan menyukai diriku sendiri." },
];

function ChatPage() {
  const { threadId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  const [open, setOpen] = useState(false);
  const [age, setAge] = useState<number | null | undefined>(undefined);
  const [mode, setMode] = useState("chat");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("age")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setAge(data?.age ?? null));
  }, [user]);

  const loadThreads = useCallback(async () => {
    const { data, error } = await supabase
      .from("threads")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false });
    if (error) toast.error("Gagal memuat daftar percakapan.");
    else setThreads(data);
  }, []);

  useEffect(() => {
    if (!user) return;
    loadThreads();
  }, [user, loadThreads]);

  useEffect(() => {
    if (!user) return;
    setInitial(null);
    setOpen(false);
    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("message_id,role,parts")
        .eq("thread_id", threadId)
        .order("created_at");
      if (error) {
        toast.error("Gagal memuat percakapan.");
        setInitial([]);
        return;
      }
      setInitial(
        data.map((m) => ({
          id: m.message_id,
          role: m.role as UIMessage["role"],
          parts: m.parts as UIMessage["parts"],
        })),
      );
    })();
  }, [user, threadId]);

  async function newThread() {
    const { data, error } = await supabase.from("threads").insert({}).select("id").single();
    if (error) { toast.error("Gagal membuat percakapan baru."); return; }
    await loadThreads();
    navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
  }

  async function deleteThread(id: string) {
    const { error } = await supabase.from("threads").delete().eq("id", id);
    if (error) { toast.error("Gagal menghapus."); return; }
    const rest = threads.filter((t) => t.id !== id);
    setThreads(rest);
    if (id === threadId) {
      if (rest[0]) navigate({ to: "/chat/$threadId", params: { threadId: rest[0].id } });
      else newThread();
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-72 shrink-0 flex-col border-r bg-sidebar transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <Link to="/" className="flex items-center gap-2">
            <img src={mark} alt="" width={816} height={816} className="h-8 w-8 object-contain" />
            <span className="font-serif text-xl">Senandika</span>
          </Link>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(false)} aria-label="Tutup">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="px-4 pt-5">
          <Button onClick={newThread} variant="outline" className="w-full justify-start gap-2 rounded-full bg-card">
            <PenLine className="h-4 w-4" /> Percakapan baru
          </Button>
          <Button asChild variant="outline" className="mt-2 w-full justify-start gap-2 rounded-full bg-card">
            <Link to="/kreasi">
              <Sparkles className="h-4 w-4" /> Ruang Kreasi
            </Link>
          </Button>
        </div>
        <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {threads.map((t) => (
            <div
              key={t.id}
              className={cn(
                "group flex items-center rounded-xl pr-1 text-sm",
                t.id === threadId ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60",
              )}
            >
              <Link to="/chat/$threadId" params={{ threadId: t.id }} className="min-w-0 flex-1 truncate px-3 py-2.5">
                {t.title}
              </Link>
              <button
                type="button"
                onClick={() => deleteThread(t.id)}
                aria-label="Hapus percakapan"
                className="rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </nav>
        <div className="border-t p-3">
          <p className="truncate px-2 pb-2 text-xs text-muted-foreground">{user?.email}</p>
          {typeof age === "number" && (
            <button
              type="button"
              onClick={() => { setAge(null); setOpen(false); }}
              className="mb-1 w-full rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:text-primary"
            >
              Usia: {age} tahun · Ubah
            </button>
          )}
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Keluar
          </Button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-20 bg-foreground/20 md:hidden" onClick={() => setOpen(false)} />}

      <main className="bg-dusk flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Menu">
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-serif text-lg md:hidden">Senandika</span>
          <Tabs value={mode} onValueChange={setMode} aria-label="Pilih percakapan">
            <TabsList>
              <TabsTrigger value="chat" className="gap-1.5"><MessageCircle className="h-4 w-4" />Chat</TabsTrigger>
              <TabsTrigger value="suara" className="gap-1.5"><Mic className="h-4 w-4" />Suara</TabsTrigger>
            </TabsList>
          </Tabs>
          <CrisisHelp className="ml-auto gap-2 text-primary" />
        </header>
        {initial === null || age === undefined ? (
          <div className="flex flex-1 items-center justify-center">
            <FloatLoader text="Membuka percakapan…" />
          </div>
        ) : age === null && user ? (
          <AgeGate userId={user.id} onDone={(a) => setAge(a)} />
        ) : (
          <>
            <div className={cn("min-h-0 flex-1 flex-col", mode === "chat" ? "flex" : "hidden")}>
              <ChatWindow key={threadId} threadId={threadId} initialMessages={initial} onActivity={loadThreads} />
            </div>
            {mode === "suara" && <VoiceConversation key={threadId} threadId={threadId} />}
          </>
        )}
      </main>
    </div>
  );
}

function ChatWindow({
  threadId,
  initialMessages,
  onActivity,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  onActivity: () => void;
}) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialMessageIds = useRef(new Set(initialMessages.map((message) => message.id)));

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { threadId },
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
        },
      }),
    [threadId],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => {
      let msg = e.message;
      try {
        msg = JSON.parse(e.message).error ?? msg;
      } catch {
        /* plain text */
      }
      toast.error(msg || "Maaf, ada gangguan. Coba kirim lagi.");
    },
    onFinish: () => onActivity(),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!busy) textareaRef.current?.focus();
  }, [busy]);

  function submit(msg: { text: string }) {
    const text = msg.text.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
    if (messages.length === 0) setTimeout(onActivity, 1500);
  }

  // Show messages strictly in order, once each, hiding empty (not-yet-written) replies.
  const visible = useMemo(() => visibleChatMessages(messages), [messages]);
  const last = visible[visible.length - 1];
  const waiting = busy && last?.role === "user";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-2xl gap-6 px-5 py-8">
          {visible.length === 0 && !busy ? (
            <ConversationEmptyState
              className="animate-gentle-arrival pt-16"
            >
              <img src={mark} alt="" width={816} height={816} className="animate-breathe h-20 w-20 object-contain" />
              <h2 className="animate-gentle-arrival-delayed mt-4 text-3xl font-light">Hai.</h2>
              <p className="animate-gentle-arrival-delayed mt-2 text-muted-foreground">Apa yang sedang ada di pikiranmu hari ini?</p>
              <div className="mt-8 flex max-w-xl flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => submit({ text: s.text })}
                    className="rounded-full border bg-card px-4 py-2 text-sm text-foreground transition hover:border-primary hover:bg-accent"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            visible.map((m) => (
              <Message key={m.id} from={m.role} className={cn(!initialMessageIds.current.has(m.id) && "animate-message-arrival")}>
                <MessageContent
                  className={cn(
                    "text-[1.02rem] leading-relaxed",
                    m.role === "user"
                      ? "rounded-2xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground"
                      : "bg-transparent px-0 text-foreground",
                  )}
                >
                  {m.parts.map((p, i) =>
                    p.type === "text" ? (
                      m.role === "user" ? (
                        <p key={i} className="whitespace-pre-wrap">{p.text}</p>
                      ) : (
                        <MessageResponse key={i}>{p.text}</MessageResponse>
                      )
                    ) : null,
                  )}
                </MessageContent>
              </Message>
            ))
          )}
          {waiting && <FloatLoader text="Senandika sedang mendengarkan…" />}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-2xl px-4 pb-5">
        <PromptInput onSubmit={submit} className="rounded-2xl bg-card shadow-soft">
          <PromptInputTextarea
            ref={textareaRef}
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tulis apa saja yang kamu rasakan…"
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !input.trim()} />
          </PromptInputFooter>
        </PromptInput>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Senandika bukan terapis. Dalam keadaan darurat, hubungi orang tepercaya atau layanan darurat setempat.
        </p>
      </div>
    </div>
  );
}

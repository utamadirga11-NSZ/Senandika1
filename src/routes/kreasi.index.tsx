import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Heart, MessageCircle, Plus, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FloatLoader } from "@/components/FloatLoader";
import mark from "@/assets/senandika-mark.png";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/kreasi/")({
  head: () => ({
    meta: [
      { title: "Ruang Kreasi — Senandika" },
      { name: "description", content: "Galeri karya para pengguna Senandika: gambar, video, tulisan, dan audio." },
      { property: "og:title", content: "Ruang Kreasi — Senandika" },
      { property: "og:description", content: "Galeri karya para pengguna Senandika." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KreasiPage,
});

type Creation = {
  id: string;
  user_id: string;
  type: "gambar" | "video" | "tulisan" | "audio";
  title: string;
  description: string;
  content_text: string | null;
  file_path: string | null;
  is_public: boolean;
  created_at: string;
};

const TYPE_TABS = [
  { value: "semua", label: "Semua" },
  { value: "gambar", label: "Gambar & Poster" },
  { value: "video", label: "Video" },
  { value: "tulisan", label: "Tulisan & Puisi" },
  { value: "audio", label: "Audio" },
] as const;

const TYPE_BADGE: Record<Creation["type"], string> = {
  gambar: "Gambar",
  video: "Video",
  tulisan: "Tulisan",
  audio: "Audio",
};

function KreasiPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<string>("semua");
  const [items, setItems] = useState<Creation[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [likes, setLikes] = useState<Record<string, { count: number; mine: boolean }>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [openComments, setOpenComments] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("creations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Gagal memuat karya.");
      setItems([]);
      return;
    }
    setItems(data as Creation[]);

    // Signed URLs for files (private bucket)
    const paths = data.filter((d) => d.file_path).map((d) => d.file_path as string);
    if (paths.length) {
      const { data: signed } = await supabase.storage
        .from("creations")
        .createSignedUrls(paths, 60 * 60);
      const map: Record<string, string> = {};
      signed?.forEach((s) => {
        if (s.path && s.signedUrl) map[s.path] = s.signedUrl;
      });
      setUrls(map);
    }

    const ids = data.map((d) => d.id);
    if (!ids.length) return;
    const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
      supabase.from("creation_likes").select("creation_id,user_id").in("creation_id", ids),
      supabase.from("creation_comments").select("creation_id").in("creation_id", ids),
    ]);
    const likeMap: Record<string, { count: number; mine: boolean }> = {};
    likeRows?.forEach((l) => {
      const entry = (likeMap[l.creation_id] ??= { count: 0, mine: false });
      entry.count += 1;
      if (l.user_id === user?.id) entry.mine = true;
    });
    setLikes(likeMap);
    const cc: Record<string, number> = {};
    commentRows?.forEach((c) => {
      cc[c.creation_id] = (cc[c.creation_id] ?? 0) + 1;
    });
    setCommentCounts(cc);
  }, [user?.id]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const visible = useMemo(
    () => (items ?? []).filter((c) => tab === "semua" || c.type === tab),
    [items, tab],
  );

  async function toggleLike(c: Creation) {
    const cur = likes[c.id] ?? { count: 0, mine: false };
    if (cur.mine) {
      const { error } = await supabase
        .from("creation_likes")
        .delete()
        .eq("creation_id", c.id)
        .eq("user_id", user!.id);
      if (error) {
        toast.error("Gagal membatalkan apresiasi.");
        return;
      }
      setLikes((p) => ({ ...p, [c.id]: { count: cur.count - 1, mine: false } }));
    } else {
      const { error } = await supabase
        .from("creation_likes")
        .insert({ creation_id: c.id });
      if (error) {
        toast.error("Gagal memberi apresiasi.");
        return;
      }
      setLikes((p) => ({ ...p, [c.id]: { count: cur.count + 1, mine: true } }));
    }
  }

  async function remove(c: Creation) {
    const { error } = await supabase.from("creations").delete().eq("id", c.id);
    if (error) {
      toast.error("Gagal menghapus karya.");
      return;
    }
    if (c.file_path) await supabase.storage.from("creations").remove([c.file_path]);
    setItems((p) => (p ?? []).filter((i) => i.id !== c.id));
    toast.success("Karya dihapus.");
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <FloatLoader text="Menyiapkan Ruang Kreasi…" />
      </div>
    );
  }

  return (
    <main className="bg-dusk min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center gap-3 px-5 pt-6">
        <Link to="/" className="flex items-center gap-2">
          <img src={mark} alt="" width={816} height={816} className="h-8 w-8 object-contain" />
          <span className="font-serif text-xl">Senandika</span>
        </Link>
        <Button asChild className="ml-auto gap-2 rounded-full shadow-soft">
          <Link to="/kreasi/baru">
            <Plus className="h-4 w-4" /> Bagikan karya
          </Link>
        </Button>
      </header>

      <section className="mx-auto max-w-3xl px-5 pb-16 pt-6">
        <div className="animate-gentle-arrival">
          <h1 className="flex items-center gap-2 text-3xl font-light">
            <Sparkles className="h-6 w-6 text-primary" /> Ruang Kreasi
          </h1>
          <p className="mt-2 text-muted-foreground">
            Tempat karya-karya kecil bersemi. Lihat, apresiasi, dan semangati satu sama lain.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mt-6">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            {TYPE_TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="rounded-full border bg-card px-4 py-1.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {items === null ? (
          <div className="flex justify-center py-20">
            <FloatLoader text="Memuat karya…" />
          </div>
        ) : visible.length === 0 ? (
          <div className="animate-gentle-arrival py-20 text-center">
            <p className="text-lg text-muted-foreground">
              Belum ada karya di sini. Jadilah yang pertama berbagi!
            </p>
            <Button asChild variant="outline" className="mt-4 rounded-full">
              <Link to="/kreasi/baru">Bagikan karyamu</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {visible.map((c) => {
              const like = likes[c.id] ?? { count: 0, mine: false };
              const fileUrl = c.file_path ? urls[c.file_path] : null;
              return (
                <article
                  key={c.id}
                  className="animate-message-arrival overflow-hidden rounded-3xl border bg-card shadow-soft"
                >
                  <div className="flex items-center gap-2 px-5 pt-4">
                    <span className="rounded-full bg-secondary px-3 py-0.5 text-xs text-secondary-foreground">
                      {TYPE_BADGE[c.type]}
                    </span>
                    {!c.is_public && (
                      <span className="rounded-full border px-3 py-0.5 text-xs text-muted-foreground">
                        Pribadi
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    {c.user_id === user.id && (
                      <button
                        type="button"
                        onClick={() => remove(c)}
                        aria-label="Hapus karya"
                        className="rounded-md p-1.5 text-muted-foreground transition hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="px-5 pb-4 pt-2">
                    <h2 className="text-xl">{c.title}</h2>
                    {c.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                    )}
                  </div>

                  {c.type === "gambar" && fileUrl && (
                    <img src={fileUrl} alt={c.title} className="max-h-[480px] w-full object-cover" />
                  )}
                  {c.type === "video" && fileUrl && (
                    <video src={fileUrl} controls className="max-h-[480px] w-full bg-foreground/5" />
                  )}
                  {c.type === "audio" && fileUrl && (
                    <div className="px-5 pb-4">
                      <audio src={fileUrl} controls className="w-full" />
                    </div>
                  )}
                  {c.type === "tulisan" && c.content_text && (
                    <p className="whitespace-pre-wrap px-5 pb-4 leading-relaxed">{c.content_text}</p>
                  )}

                  <div className="flex items-center gap-1 border-t px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleLike(c)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition",
                        like.mine
                          ? "text-primary"
                          : "text-muted-foreground hover:text-primary",
                      )}
                    >
                      <Heart className={cn("h-4 w-4", like.mine && "fill-primary")} />
                      {like.count > 0 ? like.count : "Apresiasi"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenComments(openComments === c.id ? null : c.id)}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:text-primary"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {commentCounts[c.id] ? `${commentCounts[c.id]} komentar` : "Komentar"}
                    </button>
                  </div>

                  {openComments === c.id && (
                    <CommentSection
                      creationId={c.id}
                      userId={user.id}
                      onCountChange={(n) =>
                        setCommentCounts((p) => ({ ...p, [c.id]: n }))
                      }
                    />
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

type CommentRow = { id: string; user_id: string; body: string; created_at: string };

function CommentSection({
  creationId,
  userId,
  onCountChange,
}: {
  creationId: string;
  userId: string;
  onCountChange: (n: number) => void;
}) {
  const [comments, setComments] = useState<CommentRow[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("creation_comments")
      .select("id,user_id,body,created_at")
      .eq("creation_id", creationId)
      .order("created_at");
    setComments(data ?? []);
    onCountChange(data?.length ?? 0);
  }, [creationId, onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  async function send(): Promise<void> {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const { error } = await supabase
      .from("creation_comments")
      .insert({ creation_id: creationId, body });
    setSending(false);
    if (error) {
      toast.error("Gagal mengirim komentar.");
      return;
    }
    setText("");
    load();
  }

  async function remove(id: string): Promise<void> {
    const { error } = await supabase.from("creation_comments").delete().eq("id", id);
    if (error) {
      toast.error("Gagal menghapus komentar.");
      return;
    }
    load();
  }

  return (
    <div className="border-t bg-secondary/40 px-5 py-4">
      {comments === null ? (
        <p className="text-sm text-muted-foreground">Memuat komentar…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada komentar. Kirim semangat pertamamu!
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((cm) => (
            <li key={cm.id} className="group flex items-start gap-2 text-sm">
              <p className="flex-1 whitespace-pre-wrap rounded-2xl bg-card px-3 py-2">{cm.body}</p>
              {cm.user_id === userId && (
                <button
                  type="button"
                  onClick={() => remove(cm.id)}
                  aria-label="Hapus komentar"
                  className="mt-2 rounded-md p-1 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Tulis kata penyemangat…"
          className="flex-1 rounded-full border bg-card px-4 py-2 text-sm outline-none focus:border-primary"
        />
        <Button onClick={send} disabled={!text.trim() || sending} className="rounded-full">
          Kirim
        </Button>
      </div>
    </div>
  );
}

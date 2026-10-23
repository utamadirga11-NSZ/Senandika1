import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FloatLoader } from "@/components/FloatLoader";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/kreasi/baru")({
  head: () => ({
    meta: [
      { title: "Bagikan Karya — Senandika" },
      { name: "description", content: "Bagikan karyamu di Ruang Kreasi Senandika." },
      { property: "og:title", content: "Bagikan Karya — Senandika" },
      { property: "og:description", content: "Bagikan karyamu di Ruang Kreasi Senandika." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewCreationPage,
});

const TYPES = [
  { value: "gambar", label: "Gambar / Poster", accept: "image/*", hint: "PNG, JPG, atau WebP" },
  { value: "video", label: "Video", accept: "video/*", hint: "MP4 atau WebM, maks. 200 MB" },
  { value: "tulisan", label: "Tulisan / Puisi", accept: null, hint: "" },
  { value: "audio", label: "Audio", accept: "audio/*", hint: "MP3, M4A, atau WAV" },
] as const;

type CreationType = (typeof TYPES)[number]["value"];

function NewCreationPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<CreationType>("gambar");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contentText, setContentText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  const current = TYPES.find((t) => t.value === type)!;
  const needsFile = type !== "tulisan";
  const valid =
    title.trim().length > 0 &&
    (needsFile ? file !== null : contentText.trim().length > 0);

  async function submit() {
    if (!valid || saving || !user) return;
    setSaving(true);
    try {
      let filePath: string | null = null;
      if (needsFile && file) {
        const ext = file.name.split(".").pop() ?? "bin";
        filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("creations")
          .upload(filePath, file, { contentType: file.type });
        if (upErr) throw upErr;
      }
      const { error } = await supabase.from("creations").insert({
        type,
        title: title.trim(),
        description: description.trim(),
        content_text: type === "tulisan" ? contentText.trim() : null,
        file_path: filePath,
        is_public: isPublic,
      });
      if (error) throw error;
      toast.success("Karyamu sudah tampil di Ruang Kreasi!");
      navigate({ to: "/kreasi" });
    } catch {
      toast.error("Gagal menyimpan karya. Coba lagi, ya.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <FloatLoader text="Menyiapkan…" />
      </div>
    );
  }

  return (
    <main className="bg-dusk min-h-screen">
      <div className="mx-auto max-w-xl px-5 py-8">
        <Button asChild variant="ghost" className="gap-2">
          <Link to="/kreasi">
            <ArrowLeft className="h-4 w-4" /> Kembali ke Ruang Kreasi
          </Link>
        </Button>

        <h1 className="animate-gentle-arrival mt-6 text-3xl font-light">Bagikan karyamu</h1>
        <p className="mt-2 text-muted-foreground">
          Setiap karya kecil berarti. Pilih jenisnya, lalu ceritakan sedikit tentangnya.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setType(t.value);
                setFile(null);
              }}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left text-sm transition",
                type === t.value
                  ? "border-primary bg-accent text-accent-foreground"
                  : "bg-card hover:border-primary/50",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-4 rounded-3xl border bg-card p-5 shadow-soft">
          <div className="space-y-2">
            <Label htmlFor="title">Judul karya</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Misal: Matahari di Kamarku"
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">Cerita singkat (boleh dikosongkan)</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Apa yang ingin kamu sampaikan lewat karya ini?"
              rows={2}
              maxLength={500}
            />
          </div>

          {type === "tulisan" ? (
            <div className="space-y-2">
              <Label htmlFor="content">Tulisanmu</Label>
              <Textarea
                id="content"
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                placeholder="Tulis puisi, cerpen, atau curahanmu di sini…"
                rows={10}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Berkas {current.label.toLowerCase()}</Label>
              <input
                ref={fileRef}
                type="file"
                accept={current.accept ?? undefined}
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-sm text-muted-foreground transition hover:border-primary hover:text-foreground"
              >
                <Upload className="h-6 w-6" />
                {file ? file.name : "Pilih berkas dari perangkatmu"}
                {current.hint && <span className="text-xs">{current.hint}</span>}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between rounded-2xl bg-secondary/60 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Tampilkan ke semua orang</p>
              <p className="text-xs text-muted-foreground">
                {isPublic
                  ? "Pengguna lain bisa melihat, mengapresiasi, dan berkomentar."
                  : "Hanya kamu yang bisa melihat karya ini."}
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          <Button
            onClick={submit}
            disabled={!valid || saving}
            className="w-full rounded-full shadow-soft"
            size="lg"
          >
            {saving ? "Menyimpan…" : "Bagikan karya"}
          </Button>
        </div>
      </div>
    </main>
  );
}

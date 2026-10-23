import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import mark from "@/assets/senandika-mark.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Masuk — Senandika" },
      { name: "description", content: "Masuk atau daftar untuk menyimpan percakapan refleksimu di Senandika." },
      { property: "og:title", content: "Masuk — Senandika" },
      { property: "og:description", content: "Masuk untuk melanjutkan percakapanmu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/", replace: true });
  }, [user, navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error("Email atau kata sandi belum cocok.");
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) toast.error(error.message);
      else if (!data.session) toast.success("Cek emailmu untuk konfirmasi, lalu masuk.");
    }
    setBusy(false);
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error("Gagal masuk dengan Google.");
  }

  return (
    <main className="bg-dusk flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-3xl border bg-card/80 p-8 shadow-soft backdrop-blur">
        <Link to="/" className="mx-auto block w-fit">
          <img src={mark} alt="Senandika" width={816} height={816} className="h-14 w-14 object-contain" />
        </Link>
        <h1 className="mt-4 text-center text-3xl font-light">{mode === "in" ? "Selamat datang lagi" : "Buat ruangmu"}</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">Percakapanmu tersimpan privat di akunmu.</p>

        <Button variant="outline" className="mt-6 w-full rounded-full" onClick={google}>
          Lanjut dengan Google
        </Button>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />atau<span className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Kata sandi</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy} className="w-full rounded-full">
            {mode === "in" ? "Masuk" : "Daftar"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
          className="mt-5 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "in" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
        </button>
      </div>
    </main>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import mark from "@/assets/senandika-mark.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Senandika — ruang tenang untuk bercakap dengan diri sendiri" },
      { name: "description", content: "Teman refleksi yang hangat untuk mengurai pikiran dan perasaanmu, tanpa dihakimi." },
      { property: "og:title", content: "Senandika" },
      { property: "og:description", content: "Ruang tenang untuk bercakap dengan diri sendiri." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const routed = useRef(false);

  useEffect(() => {
    if (!user || routed.current) return;
    routed.current = true;
    (async () => {
      const { data } = await supabase
        .from("threads")
        .select("id")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let id = data?.id;
      if (!id) {
        const { data: created } = await supabase.from("threads").insert({}).select("id").single();
        id = created?.id;
      }
      if (id) navigate({ to: "/chat/$threadId", params: { threadId: id }, replace: true });
    })();
  }, [user, navigate]);

  return (
    <main className="bg-dusk flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <img src={mark} alt="Senandika" width={816} height={816} className="animate-breathe h-28 w-28 object-contain" />
      <h1 className="mt-6 text-5xl font-light text-foreground md:text-6xl">Senandika</h1>
      <p className="mt-4 max-w-md text-lg text-muted-foreground">
        Ruang tenang untuk bercakap dengan diri sendiri. Tidak menghakimi, tidak terburu-buru.
      </p>
      <div className="mt-10 h-12">
        {loading || user ? (
          <p className="text-sm text-muted-foreground">Menyiapkan ruangmu…</p>
        ) : (
          <Button asChild size="lg" className="rounded-full px-8 shadow-soft">
            <Link to="/auth">Mulai bercerita</Link>
          </Button>
        )}
      </div>
      <p className="mt-16 max-w-sm text-xs text-muted-foreground">
        Senandika bukan pengganti tenaga profesional. Jika kamu dalam bahaya, hubungi layanan darurat setempat.
      </p>
    </main>
  );
}

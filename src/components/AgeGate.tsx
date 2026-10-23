import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import mark from "@/assets/senandika-mark.png";

export function AgeGate({ userId, onDone }: { userId: string; onDone: (age: number) => void }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const age = Number(value);
  const valid = Number.isInteger(age) && age >= 2 && age <= 100;

  async function save() {
    if (!valid) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({ user_id: userId, age, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) { toast.error("Gagal menyimpan usia. Coba lagi."); return; }
    onDone(age);
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="animate-gentle-arrival w-full max-w-sm text-center">
        <img src={mark} alt="" width={816} height={816} className="animate-breathe mx-auto h-16 w-16 object-contain" />
        <h2 className="mt-4 font-serif text-3xl font-light">Kenalan dulu, yuk.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Berapa usiamu? Senandika akan menyesuaikan cara bicaranya untukmu. Kalau kamu orang tua yang menemani si kecil, isi usia anaknya.
        </p>
        <form
          className="mt-6 flex gap-2"
          onSubmit={(e) => { e.preventDefault(); save(); }}
        >
          <input
            type="number"
            inputMode="numeric"
            min={2}
            max={100}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Usia (tahun)"
            className="h-11 flex-1 rounded-full border bg-card px-4 text-center text-lg outline-none focus:border-primary"
          />
          <Button type="submit" disabled={!valid || saving} className="h-11 rounded-full px-6">
            Lanjut
          </Button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">Usia hanya dipakai untuk menyesuaikan percakapan dan bisa diubah kapan saja.</p>
      </div>
    </div>
  );
}

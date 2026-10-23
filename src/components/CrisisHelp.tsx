import { LifeBuoy, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const CONTACTS = [
  { name: "Layanan SEJIWA (Kemenkes)", desc: "Konsultasi kesehatan jiwa", call: "119 ext. 8", href: "tel:119" },
  { name: "Darurat nasional", desc: "Polisi, ambulans, dalam bahaya langsung", call: "112", href: "tel:112" },
  { name: "SAPA 129 (KemenPPPA)", desc: "Kekerasan pada perempuan & anak", call: "129", href: "tel:129" },
  { name: "SAPA 129 via WhatsApp", desc: "Bisa lewat pesan", call: "08111-129-129", href: "https://wa.me/628111129129" },
];

export function CrisisHelp({ className }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className={className}>
          <LifeBuoy className="h-4 w-4" /> Bantuan darurat
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-normal">Kamu tidak harus sendirian</DialogTitle>
          <DialogDescription>
            Jika kamu berpikir untuk menyakiti diri atau sedang dalam bahaya, hubungi salah satu layanan ini atau
            orang yang kamu percaya sekarang.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {CONTACTS.map((c) => (
            <li key={c.name}>
              <a
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl border bg-card p-3 transition hover:bg-accent"
              >
                <Phone className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">{c.desc}</span>
                </span>
                <span className="text-sm font-semibold text-primary">{c.call}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Atau datangi IGD rumah sakit terdekat.</p>
      </DialogContent>
    </Dialog>
  );
}

import { cn } from "@/lib/utils";
import { Shimmer } from "@/components/ai-elements/shimmer";
import mark from "@/assets/senandika-mark.png";

type FloatLoaderProps = {
  text: string;
  className?: string;
};

// Logo Senandika melayang naik-turun perlahan dengan halo lembut,
// seperti berdenyut tenang — sementara menunggu jawaban.
export function FloatLoader({ text, className }: FloatLoaderProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 py-2", className)}>
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="animate-float-glow absolute inset-1 rounded-full bg-primary/25 blur-xl" aria-hidden />
        <img
          src={mark}
          alt=""
          width={816}
          height={816}
          className="animate-float h-11 w-11 object-contain"
        />
        <span className="animate-float-shadow absolute -bottom-1 h-2 w-10 rounded-[50%] bg-foreground/15" aria-hidden />
      </div>
      <Shimmer className="text-sm text-muted-foreground">{text}</Shimmer>
    </div>
  );
}

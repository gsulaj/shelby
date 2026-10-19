import { cn } from "@/lib/cn";

export type LabelOffset = { bottom?: number; right?: number };

type MediaPlaceholderProps = {
  /** Raw filename expected in /assets-raw, shown in the corner tag. */
  raw: string;
  aspect?: string;
  className?: string;
  /** Absolutely fill the parent instead of reserving an aspect-ratio box. */
  fill?: boolean;
  /** Pixel offsets for the corner tag so it never sits under overlaid text or bars. */
  labelOffset?: LabelOffset;
};

export function MediaPlaceholder({
  raw,
  aspect = "16 / 9",
  className,
  fill,
  labelOffset,
}: MediaPlaceholderProps) {
  return (
    <div
      role="img"
      aria-label={`Placeholder for ${raw}`}
      className={cn("blueprint overflow-hidden", fill ? "absolute inset-0" : "relative w-full", className)}
      style={{
        backgroundImage: "linear-gradient(135deg, var(--slate-raised) 0%, var(--slate) 55%, var(--ink) 100%)",
        ...(fill ? {} : { aspectRatio: aspect }),
      }}
    >
      <span
        className="absolute inline-flex items-center gap-2 border border-white/10 bg-ink/70 px-2.5 py-1.5 font-mono text-[10px] tracking-[0.04em] text-muted-on-dark"
        style={{ bottom: labelOffset?.bottom ?? 16, right: labelOffset?.right ?? 16 }}
      >
        <span className="eyebrow text-[9px] leading-none text-muted-on-dark/70">placeholder</span>
        assets-raw/{raw}
      </span>
    </div>
  );
}

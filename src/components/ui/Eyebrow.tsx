import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type EyebrowProps = {
  tone?: "dark" | "light";
  className?: string;
  children: ReactNode;
};

export function Eyebrow({ tone = "dark", className, children }: EyebrowProps) {
  return (
    <p
      className={cn(
        "eyebrow flex items-start gap-3",
        tone === "dark" ? "text-muted-on-dark" : "text-muted-on-light",
        className,
      )}
    >
      <span aria-hidden className="mt-[9px] h-px w-6 shrink-0 bg-accent" />
      <span>{children}</span>
    </p>
  );
}

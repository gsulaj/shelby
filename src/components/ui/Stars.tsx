import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

type StarsProps = { value: number; size?: "sm" | "lg"; className?: string };

/** Five stars with fractional fill (4.7 fills the fifth star 70%). */
export function Stars({ value, size = "lg", className }: StarsProps) {
  const dimension = size === "lg" ? "size-5" : "size-4";
  return (
    <span className={cn("inline-flex items-center gap-1", className)} role="img" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.min(1, Math.max(0, value - index));
        return (
          <span key={index} className={cn("relative inline-block", dimension)}>
            <Star aria-hidden className={cn("absolute inset-0 text-current opacity-35", dimension)} strokeWidth={1.75} />
            <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star aria-hidden className={cn("text-current", dimension)} fill="currentColor" strokeWidth={1.75} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

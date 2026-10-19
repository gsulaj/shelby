import { ArrowRight } from "lucide-react";
import type { MouseEventHandler, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "dark";
type Size = "lg" | "md";

type ButtonProps = {
  variant?: Variant;
  size?: Size;
  /** Show the arrow that nudges 4px on hover. */
  arrow?: boolean;
  className?: string;
  children: ReactNode;
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  type?: "button" | "submit";
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
};

const base =
  "group inline-flex select-none items-center justify-center gap-3 whitespace-nowrap font-display font-semibold uppercase tracking-[0.08em] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-ink hover:bg-accent-hover",
  ghost:
    "border border-accent bg-transparent text-on-dark hover:bg-accent hover:text-ink focus-visible:bg-accent focus-visible:text-ink",
  dark: "bg-ink text-bone hover:bg-slate-raised",
};

const sizes: Record<Size, string> = {
  lg: "h-14 px-7 text-[15px]",
  md: "h-11 px-4 text-[13px] md:h-12 md:px-5 md:text-[14px]",
};

export function Button({
  variant = "primary",
  size = "lg",
  arrow = true,
  className,
  children,
  href,
  onClick,
  type = "button",
  disabled,
  id,
  "aria-label": ariaLabel,
}: ButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], className);
  const content = (
    <>
      {children}
      {arrow && (
        <ArrowRight
          aria-hidden
          strokeWidth={2.25}
          className="size-4 shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-1"
        />
      )}
    </>
  );

  if (href) {
    return (
      <a id={id} href={href} className={classes} onClick={onClick} aria-label={ariaLabel}>
        {content}
      </a>
    );
  }

  return (
    <button id={id} type={type} className={classes} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {content}
    </button>
  );
}

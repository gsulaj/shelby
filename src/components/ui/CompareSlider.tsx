"use client";

import { ChevronsLeftRight } from "lucide-react";
import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import type { ResolvedImage } from "@/lib/media/types";
import { MediaPlaceholder } from "./MediaPlaceholder";

type CompareSliderProps = {
  before: ResolvedImage;
  after: ResolvedImage;
  labels?: { before: string; after: string };
  className?: string;
};

function Layer({ image, labelOffset }: { image: ResolvedImage; labelOffset?: { bottom?: number; right?: number } }) {
  if (!image.available) return <MediaPlaceholder raw={image.raw} fill labelOffset={labelOffset} />;
  return (
    <picture>
      <source srcSet={image.webp} type="image/webp" />
      <img src={image.jpg} alt={image.label} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
    </picture>
  );
}

const clamp = (value: number) => Math.min(100, Math.max(0, value));

/** Draggable before/after comparison. Left of the handle shows "before", right shows "after". */
export function CompareSlider({ before, after, labels = { before: "Before", after: "After" }, className }: CompareSliderProps) {
  const [position, setPosition] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromPointer = useCallback((clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    setPosition(clamp(((clientX - rect.left) / rect.width) * 100));
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event.clientX);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) updateFromPointer(event.clientX);
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 10 : 2;
    if (event.key === "ArrowLeft") setPosition((p) => clamp(p - step));
    else if (event.key === "ArrowRight") setPosition((p) => clamp(p + step));
    else if (event.key === "Home") setPosition(0);
    else if (event.key === "End") setPosition(100);
    else return;
    event.preventDefault();
  };

  const label = "absolute top-4 bg-ink/70 px-2.5 py-1.5 font-display text-[12px] font-semibold tracking-[0.14em] text-on-dark uppercase";

  return (
    <div
      ref={box}
      className={cn("relative aspect-video w-full touch-none overflow-hidden bg-slate select-none", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <Layer image={after} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <Layer image={before} labelOffset={{ bottom: 16, right: undefined }} />
      </div>

      <span className={cn(label, "left-4")}>{labels.before}</span>
      <span className={cn(label, "right-4")}>{labels.after}</span>

      <div aria-hidden className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-accent" style={{ left: `${position}%` }} />
      <button
        type="button"
        role="slider"
        aria-label="Compare before and after"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        onKeyDown={onKeyDown}
        className="absolute top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-accent text-ink"
        style={{ left: `${position}%` }}
      >
        <ChevronsLeftRight aria-hidden className="size-5" strokeWidth={2.25} />
      </button>
    </div>
  );
}

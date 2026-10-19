"use client";

import { AlignJustify, ArrowRight, ChevronDown, Grid2x2, House, MapPin, Search, Wrench } from "lucide-react";
import { useEffect, useId, useRef, useState, type ComponentType, type ReactNode, type Ref } from "react";
import { nav, type ServiceIconKey } from "@/content/nav";
import { cn } from "@/lib/cn";
import { openChatlingWidget } from "./chatling-widget";
import "./nav-glass.css";

type MenuKey = "services" | "areas";
type IconProps = { className?: string; strokeWidth?: number; "aria-hidden"?: boolean };

/** Same type as the header phone link: font, size, weight, case and tracking. */
export const navItemType = "font-display text-[15px] font-semibold uppercase tracking-[0.08em]";

/** A gutter trough with a downspout, drawn on lucide's 24px grid so it matches the other icons. */
function GutterIcon({ className, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      <path d="M2 6h20" />
      <path d="M3 6v2a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6" />
      <path d="M16 11v6a3 3 0 0 0 3 3h2" />
      <path d="M8 15v1.5" />
      <path d="M11 18v1.5" />
    </svg>
  );
}

const SERVICE_ICONS: Record<ServiceIconKey, ComponentType<IconProps>> = {
  house: House,
  wrench: Wrench,
  search: Search,
  siding: AlignJustify,
  window: Grid2x2,
  gutter: GutterIcon,
};

/** Display-only nav entry: a placeholder link (no href, so no navigation) that Tab still reaches. */
export function NavPlaceholder({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <a tabIndex={0} className={className}>
      {children}
    </a>
  );
}

/** Desktop navigation (>= 1200px): Services and Service Areas dropdowns, then Specials and FAQ. */
export function HeaderNav({ className }: { className?: string }) {
  const [open, setOpen] = useState<MenuKey | null>(null);
  const root = useRef<HTMLElement>(null);
  const servicesTrigger = useRef<HTMLButtonElement>(null);
  const areasTrigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const trigger = open === "services" ? servicesTrigger : areasTrigger;
      if (root.current?.contains(document.activeElement)) trigger.current?.focus();
      setOpen(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const controls = (key: MenuKey) => ({
    isOpen: open === key,
    onOpen: () => setOpen(key),
    onClose: () => setOpen((current) => (current === key ? null : current)),
    onToggle: () => setOpen((current) => (current === key ? null : key)),
  });

  return (
    <nav ref={root} aria-label="Main" className={cn("h-full", className)}>
      <ul className="flex h-full items-stretch gap-11">
        <Dropdown label={nav.services.label} triggerRef={servicesTrigger} {...controls("services")}>
          <div className="w-max">
            <ul className="grid grid-cols-[max-content_max-content] gap-x-9 gap-y-1.5">
              {nav.services.items.map((item) => {
                const Icon = SERVICE_ICONS[item.icon];
                return (
                  <li key={item.title}>
                    <NavPlaceholder className="group/item flex items-start gap-3.5 py-2.5">
                      <Icon aria-hidden strokeWidth={1.75} className="size-[22px] shrink-0 text-accent" />
                      <span>
                        <span className="block font-display text-[17px] leading-tight font-semibold tracking-[0.08em] text-on-dark uppercase transition-colors group-hover/item:text-accent-hover">
                          {item.title}
                        </span>
                        <span className="mt-1 block text-[14px] leading-snug whitespace-nowrap text-[#D7DCE1]">
                          {item.description}
                        </span>
                      </span>
                    </NavPlaceholder>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex items-center justify-between gap-8 border-t border-white/14 pt-4">
              <p className="text-[14px] text-[#D7DCE1]">{nav.services.prompt}</p>
              <button
                type="button"
                onClick={() => {
                  setOpen(null);
                  openChatlingWidget();
                }}
                className={cn(navItemType, "group/cta inline-flex items-center gap-2 text-accent transition-colors hover:text-accent-hover")}
              >
                {nav.services.cta}
                <ArrowRight
                  aria-hidden
                  strokeWidth={2.25}
                  className="size-4 transition-transform duration-200 group-hover/cta:translate-x-1"
                />
              </button>
            </div>
          </div>
        </Dropdown>

        <Dropdown label={nav.areas.label} triggerRef={areasTrigger} panelClassName="w-[320px]" {...controls("areas")}>
          <ul>
            {nav.areas.items.map((area) => (
              <li key={area}>
                <NavPlaceholder className="group/item flex items-center gap-3 py-2.5">
                  <MapPin aria-hidden strokeWidth={1.75} className="size-[18px] shrink-0 text-accent" />
                  <span className="font-display text-[17px] leading-tight font-semibold tracking-[0.08em] text-on-dark uppercase transition-colors group-hover/item:text-accent-hover">
                    {area}
                  </span>
                </NavPlaceholder>
              </li>
            ))}
          </ul>
        </Dropdown>

        {nav.links.map((label) => (
          <li key={label} className="flex">
            <NavPlaceholder className={cn(navItemType, "flex h-full items-center text-on-dark transition-colors hover:text-accent-hover")}>
              {label}
            </NavPlaceholder>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Dropdown({
  label,
  isOpen,
  onOpen,
  onClose,
  onToggle,
  triggerRef,
  panelClassName,
  children,
}: {
  label: string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: () => void;
  triggerRef: Ref<HTMLButtonElement>;
  panelClassName?: string;
  children: ReactNode;
}) {
  const panelId = useId();
  const pointerType = useRef("");

  return (
    <li
      className="relative flex"
      onPointerEnter={(event) => event.pointerType === "mouse" && onOpen()}
      onPointerLeave={(event) => event.pointerType === "mouse" && onClose()}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onClose();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onPointerDown={(event) => {
          pointerType.current = event.pointerType;
        }}
        onClick={(event) => {
          // A mouse already opened it on hover, so its click keeps it open; keyboard and touch toggle.
          if (event.detail > 0 && pointerType.current === "mouse") onOpen();
          else onToggle();
          pointerType.current = "";
        }}
        className={cn(
          navItemType,
          "relative flex h-full items-center gap-1.5 transition-colors duration-150",
          isOpen ? "text-accent" : "text-on-dark hover:text-accent-hover",
        )}
      >
        {label}
        <ChevronDown
          aria-hidden
          strokeWidth={2.25}
          className={cn("size-4 transition-transform duration-150 motion-reduce:transition-none", isOpen && "-rotate-180")}
        />
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 bottom-0 h-0.5 bg-accent transition-opacity duration-150",
            isOpen ? "opacity-100" : "opacity-0",
          )}
        />
      </button>
      <div
        id={panelId}
        // Focusable so a click on the panel's padding keeps focus inside the dropdown instead of closing it.
        tabIndex={-1}
        className={cn(
          "nav-glass-panel",
          "absolute top-full -left-8 outline-none transition duration-150 ease-out motion-reduce:transition-none",
          isOpen ? "visible translate-y-0 opacity-100" : "pointer-events-none invisible -translate-y-1.5 opacity-0",
          panelClassName,
        )}
      >
        {children}
      </div>
    </li>
  );
}

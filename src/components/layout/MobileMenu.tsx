"use client";

import { Menu, Minus, Phone, Plus, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { nav } from "@/content/nav";
import { site } from "@/content/site";
import { cn } from "@/lib/cn";
import { getLenis } from "@/lib/scroll";
import { openChatlingWidget, setChatlingIconVisible } from "./chatling-widget";
import { NavPlaceholder } from "./HeaderNav";
import "./nav-glass.css";

type Section = "services" | "areas";

/** At this width the desktop nav takes over, so an open menu closes. */
const DESKTOP_QUERY = "(min-width: 1200px)";
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
const rowType = "font-display text-[28px] font-bold uppercase tracking-[0.02em]";

/** Hamburger (< 1200px) and the full-screen frosted menu it opens. */
export function MobileMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<Section | null>(null);
  const menuId = useId();
  const hamburger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(true);
  const chatAfterClose = useRef(false);

  const close = useCallback((options: { focusHamburger?: boolean; openChat?: boolean } = {}) => {
    restoreFocus.current = options.focusHamburger ?? true;
    chatAfterClose.current = options.openChat ?? false;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    const lenis = getLenis();
    const trigger = hamburger.current;
    html.style.overflow = "hidden";
    lenis?.stop();
    // The bubble sits at the maximum z-index; hide it so it never floats over the open menu.
    setChatlingIconVisible(false);
    closeButton.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !dialog.current) return;
      const focusables = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.getClientRects().length > 0,
      );
      if (!focusables.length) return;
      // Move focus ourselves on every Tab: Safari's native Tab skips buttons and links and would leave the menu.
      event.preventDefault();
      const index = focusables.indexOf(document.activeElement as HTMLElement);
      const step = event.shiftKey ? -1 : 1;
      const next = index === -1 ? (event.shiftKey ? focusables.length - 1 : 0) : (index + step + focusables.length) % focusables.length;
      focusables[next].focus();
    };
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const onBreakpoint = () => desktop.matches && close({ focusHamburger: false });

    document.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onBreakpoint);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onBreakpoint);
      html.style.overflow = previousOverflow;
      lenis?.start();
      setChatlingIconVisible(true);
      if (restoreFocus.current) trigger?.focus();
      if (chatAfterClose.current) openChatlingWidget();
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={hamburger}
        type="button"
        aria-label={nav.menu.open}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setSection(null);
          setOpen(true);
        }}
        className={cn(
          "flex size-11 items-center justify-center text-on-dark transition-colors hover:text-accent-hover",
          className,
        )}
      >
        <Menu aria-hidden className="size-6" strokeWidth={2} />
      </button>

      {open &&
        createPortal(
          <div
            ref={dialog}
            id={menuId}
            role="dialog"
            aria-modal="true"
            aria-label={nav.menu.dialog}
            // Lenis is stopped while the menu is open; this lets the menu's own list scroll natively.
            data-lenis-prevent
            className="nav-glass-overlay fixed inset-0 z-[2147483647] flex flex-col text-on-dark"
          >
            <div className="border-b border-white/8">
              <div className="wrap flex h-[68px] items-center justify-between">
                <Image src="/brand/logo-light.png" alt={site.name} width={116} height={40} className="h-8 w-auto md:h-10" />
                <button
                  ref={closeButton}
                  type="button"
                  aria-label={nav.menu.close}
                  onClick={() => close()}
                  className="flex size-11 items-center justify-center text-on-dark transition-colors hover:text-accent-hover"
                >
                  <X aria-hidden className="size-6" strokeWidth={2} />
                </button>
              </div>
            </div>

            <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <ul className="wrap">
                {(["services", "areas"] as const).map((key) => {
                  const isOpen = section === key;
                  const listId = `${menuId}-${key}`;
                  const items = key === "services" ? nav.services.items.map((item) => item.title) : nav.areas.items;
                  return (
                    <li key={key} className="border-b border-white/8">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={listId}
                        onClick={() => setSection(isOpen ? null : key)}
                        className={cn(
                          rowType,
                          "flex h-16 w-full items-center justify-between text-left transition-colors",
                          isOpen ? "text-accent" : "text-on-dark",
                        )}
                      >
                        {nav[key].label}
                        {isOpen ? (
                          <Minus aria-hidden className="size-6" strokeWidth={2} />
                        ) : (
                          <Plus aria-hidden className="size-6" strokeWidth={2} />
                        )}
                      </button>
                      <ul id={listId} hidden={!isOpen} className="pb-3">
                        {items.map((item) => (
                          <li key={item}>
                            <NavPlaceholder className="flex h-11 items-center text-[17px] text-[#E1E5E9]">{item}</NavPlaceholder>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
                {nav.links.map((label) => (
                  <li key={label} className="border-b border-white/8">
                    <NavPlaceholder className={cn(rowType, "flex h-16 items-center text-on-dark")}>{label}</NavPlaceholder>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="nav-glass-footer">
              <div className="wrap flex flex-col gap-3 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                <Button className="w-full" onClick={() => close({ openChat: true })}>
                  {nav.menu.estimate}
                </Button>
                <Button variant="ghost" href={site.phone.href} arrow={false} className="w-full">
                  <Phone aria-hidden className="size-4" strokeWidth={2.25} />
                  {nav.menu.call}
                </Button>
                <p className="mt-1 text-center text-[14px] text-[#D7DCE1]">{site.hours.display}</p>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

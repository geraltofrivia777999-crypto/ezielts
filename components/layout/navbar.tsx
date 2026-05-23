"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const scrolledRef = useRef(false);

  useEffect(() => {
    let frame = 0;

    function onScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const next = window.scrollY > 40;
        if (next !== scrolledRef.current) {
          scrolledRef.current = next;
          setScrolled(next);
        }
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out",
        scrolled
          ? "bg-white/92 backdrop-blur-md border-b border-[rgb(var(--border))] shadow-sm"
          : "bg-transparent"
      )}
    >
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transition-[background-color,backdrop-filter] duration-300 ease-out",
            scrolled ? "bg-[rgb(var(--primary))]" : "bg-white/20 backdrop-blur-sm"
          )}>
            <span className="text-white font-bold text-sm">EZ</span>
          </div>
          <span className={cn(
            "font-semibold text-lg tracking-tight transition-colors duration-300 ease-out",
            scrolled ? "text-[rgb(var(--foreground))]" : "text-white"
          )}>
            ielts
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-5 lg:gap-6">
          {["Speaking", "Writing", "Listening", "Reading"].map((skill) => (
            <Link
              key={skill}
              href={`/skills/${skill.toLowerCase()}`}
              className={cn(
                "text-sm transition-colors duration-200 ease-out hover:opacity-100",
                scrolled
                  ? "text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
                  : "text-white/70 hover:text-white"
              )}
            >
              {skill}
            </Link>
          ))}
          <span className={cn(
            "w-px h-4 transition-colors duration-300 ease-out",
            scrolled ? "bg-[rgb(var(--border))]" : "bg-white/20"
          )} aria-hidden />
          <Link
            href="/pricing"
            className={cn(
              "text-sm transition-colors duration-200 ease-out",
              scrolled
                ? "text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
                : "text-white/70 hover:text-white"
            )}
          >
            Тарифы
          </Link>
        </div>

        {/* Auth buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className={cn(
              "transition-colors duration-200 ease-out",
              !scrolled && "text-white/90 hover:text-white hover:bg-white/10"
            )}
          >
            <Link href="/login">Войти</Link>
          </Button>
          <Button
            size="sm"
            asChild
            className={cn(
              "transition-[background-color,color,box-shadow,transform] duration-200 ease-out",
              !scrolled && "bg-white text-[#3B1E91] hover:bg-white/90 shadow-lg shadow-black/10"
            )}
          >
            <Link href="/diagnostic">Начать бесплатно</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}

"use client";

import { Suspense, useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";

function AppSidebarFallback() {
  return (
    <aside className="h-full min-h-0 w-60 border-r border-[rgb(var(--border))] bg-[rgb(var(--surface))/0.94]" />
  );
}

/** Wraps any authenticated page with sidebar + topbar layout. */
export function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[linear-gradient(180deg,rgb(var(--background))_0%,rgb(var(--surface-elevated)/0.48)_100%)]">
      {/* Desktop sidebar */}
      <div className="hidden h-full min-h-0 shrink-0 md:block">
        <Suspense fallback={<AppSidebarFallback />}>
          <AppSidebar />
        </Suspense>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 md:hidden animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden" style={{ animation: "slide-in-left 0.25s ease-out" }}>
            <Suspense fallback={<AppSidebarFallback />}>
              <AppSidebar onNavigate={() => setMobileOpen(false)} />
            </Suspense>
          </div>
        </>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppTopbar title={title} onMenuClick={() => setMobileOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 lg:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}

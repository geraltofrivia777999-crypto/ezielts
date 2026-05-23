"use client";

import { Suspense, useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";

function AppSidebarFallback() {
  return (
    <aside className="w-60 bg-[rgb(var(--surface))/0.94] border-r border-[rgb(var(--border))] h-screen sticky top-0" />
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
    <div className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,rgb(var(--background))_0%,rgb(var(--surface-elevated)/0.48)_100%)] flex">
      {/* Desktop sidebar */}
      <div className="hidden md:block shrink-0">
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
      <div className="flex-1 min-w-0 flex flex-col">
        <AppTopbar title={title} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}

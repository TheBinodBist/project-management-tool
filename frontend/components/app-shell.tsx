"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { AppProvider, useApp } from "@/lib/app-context";

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useApp();
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (isAuthPage) return <>{children}</>;

  if (loading || !user) {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center bg-muted/20">
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </main>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar />
        <main className="min-h-0 flex-1 overflow-y-auto bg-muted/20">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-muted/20">
          <p className="text-sm text-muted-foreground">Loading your workspace…</p>
        </main>
      }
    >
      <AppProvider>
        <ShellContent>{children}</ShellContent>
      </AppProvider>
    </React.Suspense>
  );
}

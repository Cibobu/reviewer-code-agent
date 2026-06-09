"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Logo } from "./Logo";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    apiFetch("/auth/me")
      .then((r) => {
        if (!r.ok) {
          window.location.href = "/login";
          return null;
        }
        return r.json();
      })
      .then((user) => {
        if (user) setReady(true);
      })
      .catch(() => {
        window.location.href = "/login";
      });
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-violet-300/50 text-sm">
        <Logo size="md" showText={false} />
        <p className="animate-pulse">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 sm:p-8 overflow-auto">{children}</main>
    </div>
  );
}

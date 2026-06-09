"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Logo } from "./Logo";
import { NavIcon, type NavIconName } from "./NavIcons";
import { NotificationBadge } from "./NotificationBadge";
import { IconLogout } from "./NavIcons";

const links: { href: string; label: string; icon: NavIconName; badgeKey: "reviews" | null }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", badgeKey: null },
  { href: "/dashboard/repositories", label: "Repositories", icon: "repositories", badgeKey: null },
  { href: "/reviews", label: "Reviews", icon: "reviews", badgeKey: "reviews" },
  { href: "/settings/integrations/telegram", label: "Telegram", icon: "telegram", badgeKey: null },
];

type User = {
  username: string;
  avatarUrl: string | null;
};

function isLinkActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/dashboard") return false;
  if (href === "/reviews") return pathname.includes("/reviews");
  return pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [unreadReviews, setUnreadReviews] = useState(0);

  const loadUnread = () => {
    apiFetch("/notifications/unread-count")
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((data: { count?: number }) => setUnreadReviews(data.count ?? 0))
      .catch(() => setUnreadReviews(0));
  };

  useEffect(() => {
    apiFetch("/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .catch(() => setUser(null));
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, [pathname]);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <aside className="w-64 min-h-screen bg-card/80 backdrop-blur-md border-r border-violet-500/10 p-4 flex flex-col">
      <Link href="/dashboard" className="px-2 py-4 mb-4 block hover:opacity-90 transition-opacity">
        <Logo size="sm" />
      </Link>

      <nav className="space-y-1.5 flex-1">
        {links.map((l) => {
          const active = isLinkActive(pathname, l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`nav-link ${active ? "nav-link-active" : "nav-link-idle"}`}
            >
              <NavIcon name={l.icon} active={active} />
              <span className="flex-1">{l.label}</span>
              {l.badgeKey === "reviews" && unreadReviews > 0 && (
                <NotificationBadge count={unreadReviews} size="md" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-violet-500/10 pt-4 mt-4 space-y-3">
        {user && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-2xl bg-violet-500/5 border border-violet-500/10">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt=""
                className="w-9 h-9 rounded-full ring-2 ring-violet-400/30"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500/40 to-fuchsia-500/40 flex items-center justify-center text-xs font-bold text-violet-100">
                {user.username.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate text-violet-100">@{user.username}</p>
              <p className="text-xs text-violet-300/50">Signed in ✨</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className="w-full nav-link nav-link-idle hover:!text-fuchsia-300 hover:!bg-fuchsia-500/10 disabled:opacity-50"
        >
          <IconLogout className="text-slate-400" />
          {loggingOut ? "Signing out…" : "Logout"}
        </button>
      </div>
    </aside>
  );
}

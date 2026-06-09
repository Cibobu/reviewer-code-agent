"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { NotificationBadge } from "@/components/NotificationBadge";

type Repo = {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  visibility: string;
  stars: number;
  forks: number;
  agentStatus: string;
  lastScanAt: string | null;
  totalPrReviewed: number;
  securityScore: number;
  unreadReviewCount?: number;
};

function matchesSearch(repo: Repo, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    repo.name,
    repo.fullName,
    repo.description ?? "",
    repo.language ?? "",
    repo.visibility,
    repo.agentStatus,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredRepos = useMemo(
    () => repos.filter((repo) => matchesSearch(repo, search)),
    [repos, search],
  );

  const load = () => {
    apiFetch("/repositories")
      .then((r) => r.json())
      .then(setRepos)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const sync = async () => {
    setLoading(true);
    await apiFetch("/repositories/sync", { method: "POST" });
    load();
  };

  const connect = async (id: string) => {
    setError(null);
    setNotice(null);
    const res = await apiFetch(`/repositories/${id}/connect`, { method: "POST" });
    const data = (await res.json()) as { warning?: string; message?: string | string[] };
    if (!res.ok) {
      const msg = Array.isArray(data.message) ? data.message.join(", ") : data.message;
      setError(msg ?? "Failed to connect agent");
      return;
    }
    if (data.warning) setNotice(data.warning);
    load();
  };

  const disconnect = async (id: string) => {
    await apiFetch(`/repositories/${id}/disconnect`, { method: "POST" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Repositories</h1>
          <p className="text-slate-400 text-sm mt-1">Connect AI agents to monitor your GitHub repos</p>
        </div>
        <button
          onClick={sync}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-indigo-500 text-sm font-medium transition shrink-0"
        >
          Sync from GitHub
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          {notice}
        </div>
      )}

      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
          />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, language, visibility, status…"
          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-card border border-slate-700/50 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {!loading && repos.length > 0 && (
        <p className="text-xs text-slate-500">
          {search
            ? `${filteredRepos.length} of ${repos.length} repositories`
            : `${repos.length} repositories`}
        </p>
      )}

      {loading && <p className="text-slate-500 animate-pulse">Loading repositories…</p>}

      {!loading && repos.length === 0 && (
        <div className="bg-card border border-slate-700/50 rounded-xl p-8 text-center text-slate-400 text-sm">
          No repositories yet. Click <strong className="text-slate-200">Sync from GitHub</strong> to import your repos.
        </div>
      )}

      {!loading && repos.length > 0 && filteredRepos.length === 0 && (
        <div className="bg-card border border-slate-700/50 rounded-xl p-8 text-center text-slate-400 text-sm">
          No repositories match &ldquo;{search}&rdquo;.{" "}
          <button type="button" onClick={() => setSearch("")} className="text-primary hover:underline">
            Clear search
          </button>
        </div>
      )}

      <div className="grid gap-4">
        {filteredRepos.map((repo, i) => (
          <motion.div
            key={repo.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="bg-card border border-slate-700/50 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{repo.fullName}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    repo.agentStatus === "ACTIVE"
                      ? "bg-success/20 text-success"
                      : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {repo.agentStatus}
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-1">{repo.description ?? "No description"}</p>
              <div className="flex gap-4 mt-2 text-xs text-slate-500">
                {repo.language && <span>{repo.language}</span>}
                <span>⭐ {repo.stars}</span>
                <span>🍴 {repo.forks}</span>
                <span>Score: {repo.securityScore}/100</span>
                <span>Reviews: {repo.totalPrReviewed}</span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {repo.agentStatus === "ACTIVE" ? (
                <>
                  <Link
                    href={`/dashboard/repositories/${repo.id}/reviews`}
                    className="relative px-4 py-2 rounded-2xl border border-violet-400/30 text-violet-200 text-sm hover:bg-violet-500/10 inline-flex items-center gap-2 transition-all"
                  >
                    Reviews
                    {(repo.unreadReviewCount ?? 0) > 0 && (
                      <NotificationBadge count={repo.unreadReviewCount} size="md" pulse={false} />
                    )}
                  </Link>
                  <button
                    onClick={() => disconnect(repo.id)}
                    className="px-4 py-2 rounded-lg border border-slate-600 text-sm hover:bg-slate-800"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  onClick={() => connect(repo.id)}
                  className="px-4 py-2 rounded-lg bg-success/90 hover:bg-success text-sm font-medium text-white"
                >
                  Connect Agent
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

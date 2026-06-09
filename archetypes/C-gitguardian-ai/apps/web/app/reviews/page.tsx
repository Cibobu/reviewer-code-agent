"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { NotificationBadge } from "@/components/NotificationBadge";

type RepoSummary = {
  id: string;
  fullName: string;
  agentStatus: string;
  unreadReviewCount: number;
  totalPrReviewed: number;
};

export default function ReviewsIndexPage() {
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/repositories")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: RepoSummary[]) => setRepos(data.filter((r) => r.agentStatus === "ACTIVE")))
      .finally(() => setLoading(false));
  }, []);

  const totalUnread = repos.reduce((sum, r) => sum + (r.unreadReviewCount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-200 to-fuchsia-200 bg-clip-text text-transparent">
          Reviews
        </h1>
        <p className="text-violet-300/60 mt-1">
          Repository dengan agent aktif — pilih untuk melihat aktivitas GitHub
          {totalUnread > 0 && (
            <span className="ml-2 text-fuchsia-300">· {totalUnread} baru ✨</span>
          )}
        </p>
      </div>

      {loading ? (
        <div className="animate-pulse h-32 card-soft" />
      ) : repos.length === 0 ? (
        <div className="card-soft p-8 text-center text-violet-300/60 text-sm">
          Belum ada repository yang terhubung.{" "}
          <Link href="/dashboard/repositories" className="text-fuchsia-300 hover:underline">
            Connect Agent di Repositories
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {repos.map((repo) => (
            <Link
              key={repo.id}
              href={`/dashboard/repositories/${repo.id}/reviews`}
              className="flex items-center justify-between card-soft p-5 hover:border-violet-400/30 hover:shadow-glow-sm transition-all duration-200"
            >
              <div>
                <p className="font-semibold text-violet-100">{repo.fullName}</p>
                <p className="text-xs text-violet-400/50 mt-1">
                  {repo.totalPrReviewed} PR reviewed
                </p>
              </div>
              <div className="flex items-center gap-3">
                {(repo.unreadReviewCount ?? 0) > 0 && (
                  <NotificationBadge count={repo.unreadReviewCount} size="md" />
                )}
                <span className="text-violet-400/40">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

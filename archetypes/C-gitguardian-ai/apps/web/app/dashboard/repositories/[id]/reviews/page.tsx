"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Review = {
  id: string;
  changeSummary: string;
  securityScore: number;
  securitySeverity: string;
  createdAt: string;
  unread?: boolean;
  repository: { fullName: string; id: string };
  findings: { id: string; severity: string; title: string; category: string }[];
};

const severityColor: Record<string, string> = {
  CRITICAL: "bg-danger/20 text-danger border-danger/30",
  HIGH: "bg-warning/20 text-warning border-warning/30",
  MEDIUM: "bg-primary/20 text-primary border-primary/30",
  LOW: "bg-slate-600/30 text-slate-300 border-slate-600/30",
};

export default function RepoReviewsPage() {
  const { id: repositoryId } = useParams<{ id: string }>();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [repoName, setRepoName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!repositoryId) return;

    apiFetch(`/reviews?repositoryId=${repositoryId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Review[]) => {
        setReviews(data);
        if (data[0]?.repository.fullName) setRepoName(data[0].repository.fullName);
      })
      .finally(() => setLoading(false));

    apiFetch("/notifications/mark-read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repositoryId }),
    }).catch(() => undefined);
  }, [repositoryId]);

  useEffect(() => {
    if (!repositoryId || repoName) return;
    apiFetch("/repositories")
      .then((r) => (r.ok ? r.json() : []))
      .then((repos: { id: string; fullName: string }[]) => {
        const match = repos.find((r) => r.id === repositoryId);
        if (match) setRepoName(match.fullName);
      });
  }, [repositoryId, repoName]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/reviews" className="text-sm text-primary hover:underline">
          ← Semua repository
        </Link>
        <h1 className="text-3xl font-bold mt-2">{repoName || "Reviews"}</h1>
        <p className="text-slate-400 text-sm mt-1">Aktivitas GitHub & analisis keamanan untuk repo ini</p>
      </div>

      {loading ? (
        <div className="animate-pulse h-32 bg-card rounded-xl" />
      ) : reviews.length === 0 ? (
        <div className="bg-card border border-slate-700/50 rounded-xl p-8 text-center text-slate-400 text-sm">
          Belum ada review untuk repository ini. Push code atau buka PR di GitHub.
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/repositories/${repositoryId}/reviews/${r.id}`}
              className={`block bg-card border rounded-xl p-5 hover:border-primary/40 transition ${
                r.unread ? "border-primary/50 ring-1 ring-primary/20" : "border-slate-700/50"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {r.unread && (
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full border ${severityColor[r.securitySeverity] ?? ""}`}>
                  {r.securitySeverity}
                </span>
                <span className="text-xs text-slate-500 ml-auto">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-slate-300 line-clamp-2">{r.changeSummary}</p>
              <div className="flex gap-4 mt-3 text-xs text-slate-500">
                <span>Score: {r.securityScore}/100</span>
                <span>{r.findings.length} finding(s)</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

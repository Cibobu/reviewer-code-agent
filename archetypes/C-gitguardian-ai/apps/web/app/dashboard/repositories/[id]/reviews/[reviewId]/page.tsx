"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Finding = {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  filePath: string | null;
  lineHint: string | null;
};

type ReviewDetail = {
  id: string;
  changeSummary: string;
  securityScore: number;
  securitySeverity: string;
  impactAnalysis: { affected: string[]; potentialImpact: string[] };
  codeQuality: { maintainability: string; recommendations: string[] };
  contributors: { username: string; role: string }[];
  recommendations: { mustFix: string[]; recommended: string[]; optional: string[] };
  createdAt: string;
  repository: { fullName: string; name: string; id?: string };
  repositoryId?: string;
  findings: Finding[];
};

const severityColor: Record<string, string> = {
  CRITICAL: "text-danger",
  HIGH: "text-warning",
  MEDIUM: "text-primary",
  LOW: "text-slate-400",
};

export default function RepoReviewDetailPage() {
  const { id: repositoryId, reviewId } = useParams<{ id: string; reviewId: string }>();
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reviewId) return;
    apiFetch(`/reviews/${reviewId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Review not found");
        return r.json();
      })
      .then(setReview)
      .catch((e) => setError(e.message));
  }, [reviewId]);

  const backHref = `/dashboard/repositories/${repositoryId}/reviews`;

  if (error) {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/10 p-6">
        <p className="text-danger">{error}</p>
        <Link href={backHref} className="text-primary text-sm mt-4 inline-block hover:underline">
          ← Kembali ke reviews repo
        </Link>
      </div>
    );
  }

  if (!review) {
    return <div className="animate-pulse h-64 bg-card rounded-xl" />;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href={backHref} className="text-sm text-primary hover:underline">
          ← {review.repository.fullName}
        </Link>
        <h1 className="text-2xl font-bold mt-2">Review Detail</h1>
        <p className="text-slate-400 text-sm mt-1">{new Date(review.createdAt).toLocaleString()}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-500">Severity</p>
          <p className={`text-xl font-bold ${severityColor[review.securitySeverity] ?? ""}`}>
            {review.securitySeverity}
          </p>
        </div>
        <div className="bg-card border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-500">Security Score</p>
          <p className="text-xl font-bold">{review.securityScore}/100</p>
        </div>
        <div className="bg-card border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-500">Findings</p>
          <p className="text-xl font-bold">{review.findings.length}</p>
        </div>
      </div>

      <section className="bg-card border border-slate-700/50 rounded-xl p-6">
        <h2 className="font-semibold mb-2">Summary</h2>
        <p className="text-slate-300 text-sm leading-relaxed">{review.changeSummary}</p>
      </section>

      {review.findings.length > 0 && (
        <section className="bg-card border border-slate-700/50 rounded-xl p-6">
          <h2 className="font-semibold mb-4">Security Findings</h2>
          <ul className="space-y-3">
            {review.findings.map((f) => (
              <li key={f.id} className="border border-slate-700/40 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium ${severityColor[f.severity] ?? ""}`}>{f.severity}</span>
                  <span className="text-xs text-slate-500">{f.category}</span>
                </div>
                <p className="font-medium text-sm">{f.title}</p>
                {f.filePath && (
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    {f.filePath}
                    {f.lineHint ? `:${f.lineHint}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {review.recommendations.mustFix.length > 0 && (
        <section className="bg-card border border-slate-700/50 rounded-xl p-6">
          <h2 className="font-semibold mb-2 text-danger">Must Fix</h2>
          <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
            {review.recommendations.mustFix.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {review.recommendations.recommended.length > 0 && (
        <section className="bg-card border border-slate-700/50 rounded-xl p-6">
          <h2 className="font-semibold mb-2">Recommended</h2>
          <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
            {review.recommendations.recommended.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiFetch } from "@/lib/api";

type Insights = {
  repositories: number;
  activeAgents: number;
  totalReviews: number;
  securityAlerts: number;
  unreadNotifications: number;
  avgSecurityScore: number;
  codeQualityTrend: number[];
};

type ActivityEvent = {
  id: string;
  repository: string;
  eventType: string;
  action: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
};

type ActivityReview = {
  id: string;
  repositoryId: string;
  changeSummary: string;
  securityScore: number;
  securitySeverity: string;
  createdAt: string;
  repository: { fullName: string };
};

const statusColor: Record<string, string> = {
  COMPLETED: "text-success",
  PENDING: "text-warning",
  PROCESSING: "text-primary",
  FAILED: "text-danger",
  DEAD_LETTER: "text-danger",
};

const severityColor: Record<string, string> = {
  CRITICAL: "bg-danger/20 text-danger",
  HIGH: "bg-warning/20 text-warning",
  MEDIUM: "bg-primary/20 text-primary",
  LOW: "bg-slate-600/30 text-slate-300",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function DashboardPage() {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [reviews, setReviews] = useState<ActivityReview[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch("/dashboard/insights").then(async (r) => {
        if (!r.ok) throw new Error("Unable to load dashboard");
        return r.json();
      }),
      apiFetch("/dashboard/activity").then(async (r) => (r.ok ? r.json() : { events: [], reviews: [] })),
    ])
      .then(([ins, act]) => {
        setInsights(ins);
        setEvents(act.events ?? []);
        setReviews(act.reviews ?? []);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/10 p-6">
        <h2 className="font-semibold text-danger mb-2">Connection Error</h2>
        <p className="text-slate-400 text-sm">{error}</p>
        <a href="/login" className="inline-block mt-4 text-primary hover:underline text-sm">
          Reconnect GitHub
        </a>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-card rounded-xl" />
        ))}
      </div>
    );
  }

  const chartData = insights.codeQualityTrend.map((v, i) => ({ week: `W${i + 1}`, score: v }));

  const cards = [
    { label: "Repositories", value: insights.repositories, color: "text-primary" },
    { label: "Active Agents", value: insights.activeAgents, color: "text-success" },
    { label: "PR Reviews", value: insights.totalReviews, color: "text-secondary" },
    { label: "Security Alerts", value: insights.securityAlerts, color: "text-danger" },
    { label: "Security Score", value: `${insights.avgSecurityScore}/100`, color: "text-warning" },
    { label: "Unread", value: insights.unreadNotifications, color: "text-slate-300" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-slate-400 mt-1">AI-powered repository monitoring overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-slate-700/50 rounded-xl p-5"
          >
            <p className="text-slate-400 text-sm">{c.label}</p>
            <p className={`text-3xl font-bold mt-1 ${c.color}`}>{c.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent GitHub Events</h2>
            <Link href="/reviews" className="text-sm text-primary hover:underline">
              All reviews →
            </Link>
          </div>
          {events.length === 0 ? (
            <p className="text-slate-500 text-sm">No webhook events yet. Push code or open a PR on a connected repo.</p>
          ) : (
            <ul className="space-y-3 max-h-80 overflow-y-auto">
              {events.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 text-sm border-b border-slate-700/40 pb-3 last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{e.repository}</p>
                    <p className="text-slate-400">
                      {e.eventType}
                      {e.action ? `.${e.action}` : ""}
                    </p>
                    {e.errorMessage && (
                      <p className="text-danger text-xs mt-1 truncate" title={e.errorMessage}>
                        {e.errorMessage.slice(0, 80)}…
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs font-medium ${statusColor[e.status] ?? "text-slate-400"}`}>
                      {e.status}
                    </span>
                    <p className="text-xs text-slate-500 mt-1">{formatTime(e.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-card border border-slate-700/50 rounded-xl p-6">
          <h2 className="font-semibold mb-4">AI Reviews</h2>
          {reviews.length === 0 ? (
            <p className="text-slate-500 text-sm">Reviews appear after push/PR events are processed by the worker.</p>
          ) : (
            <ul className="space-y-3 max-h-80 overflow-y-auto">
              {reviews.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/dashboard/repositories/${r.repositoryId}/reviews/${r.id}`}
                    className="block rounded-lg border border-slate-700/40 p-3 hover:border-primary/40 transition"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium truncate">{r.repository.fullName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${severityColor[r.securitySeverity] ?? ""}`}>
                        {r.securitySeverity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">{r.changeSummary}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Score {r.securityScore}/100 · {formatTime(r.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-card border border-slate-700/50 rounded-xl p-6">
        <h2 className="font-semibold mb-4">Code Quality Trend</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="week" stroke="#64748b" />
              <YAxis stroke="#64748b" domain={[60, 100]} />
              <Tooltip contentStyle={{ background: "#1E293B", border: "none" }} />
              <Line type="monotone" dataKey="score" stroke="#6366F1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

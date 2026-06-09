"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface TelegramStatus {
  connected?: boolean;
  isActive?: boolean;
  botUsername?: string;
  chatId?: string;
  tokenMasked?: string;
  notificationPreference?: string;
  lastDeliveryStatus?: string;
}

const PREFS = [
  { value: "CRITICAL_ONLY", label: "Critical security issues only" },
  { value: "SECURITY_ONLY", label: "All security issues" },
  { value: "PR_REVIEWS", label: "Pull request reviews" },
  { value: "MERGE_SUMMARIES", label: "Merge summaries" },
  { value: "DEPLOYMENT_RISKS", label: "Deployment risks" },
  { value: "ALL_ACTIVITIES", label: "All repository activities" },
];

export default function TelegramSettingsPage() {
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = () => {
    apiFetch("/integrations/telegram/status")
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = "/login";
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setStatus(data);
          if (data.chatId) setChatId(String(data.chatId));
        }
      });
  };

  useEffect(loadStatus, []);

  const connect = async () => {
    setError(null);
    const res = await apiFetch("/integrations/telegram/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botToken }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? "Failed to connect bot");
      return;
    }
    if (data.error) setError(data.error);
    else {
      setMessage("Bot connected!");
      loadStatus();
    }
  };

  const discover = async () => {
    setError(null);
    setMessage(null);
    const res = await apiFetch("/integrations/telegram/discover-chats");
    const data = (await res.json()) as {
      chats?: Array<{ id: string; label: string; type: string }>;
      hint?: string;
    };
    if (!res.ok) {
      setError(data.hint ?? "Could not discover chats");
      return;
    }
    if (!data.chats?.length) {
      setError(
        data.hint ??
          `Open @${status?.botUsername ?? "your_bot"} on Telegram, tap Start, then click Discover again.`,
      );
      return;
    }
    setChatId(data.chats[0].id);
    setMessage(`Found chat: ${data.chats[0].label} (${data.chats[0].id}). Click Save Chat ID.`);
  };

  const verify = async () => {
    setError(null);
    setMessage(null);
    const res = await apiFetch("/integrations/telegram/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? data.message ?? "Failed to save chat ID");
      return;
    }
    setMessage("Chat ID saved!");
    loadStatus();
  };

  const test = async () => {
    setError(null);
    setMessage(null);
    const res = await apiFetch("/integrations/telegram/test-message", { method: "POST" });
    const data = await res.json();
    if (!res.ok && !data.error) {
      setError(data.message ?? "Test message failed");
      return;
    }
    if (data.error) setError(data.detail ? `${data.error} (${data.detail})` : data.error);
    else setMessage("Test message sent!");
  };

  const setPref = async (pref: string) => {
    await apiFetch("/integrations/telegram/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationPreference: pref }),
    });
    loadStatus();
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Telegram Integration</h1>
        <p className="text-slate-400 text-sm mt-1">Settings → Integrations → Telegram</p>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-success/40 bg-success/10 p-4 text-sm text-success">
          {message}
        </div>
      )}

      <div className="bg-card border border-slate-700/50 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Connect Bot</h2>
        <input
          type="password"
          placeholder="Telegram Bot Token (from @BotFather)"
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm"
        />
        <button onClick={connect} className="px-4 py-2 rounded-lg bg-primary text-sm font-medium">
          Verify Bot Token
        </button>
        {status?.connected && (
          <p className="text-xs text-slate-500">
            Connected: @{String(status.botUsername)} · Token: {String(status.tokenMasked)}
          </p>
        )}
      </div>

      <div className="bg-card border border-slate-700/50 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Chat ID</h2>
        <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
          <li>Open your bot{status?.botUsername ? ` @${status.botUsername}` : ""} on Telegram</li>
          <li>Tap <strong className="text-slate-300">Start</strong> (required — not @userinfobot ID)</li>
          <li>Click Discover Chat ID, then Save</li>
        </ol>
        <input
          placeholder="Telegram Chat ID (e.g. 123456789)"
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={discover}
            disabled={!status?.connected}
            className="px-4 py-2 rounded-lg border border-primary/50 text-primary text-sm disabled:opacity-40"
          >
            Discover Chat ID
          </button>
          <button onClick={verify} className="px-4 py-2 rounded-lg border border-slate-600 text-sm">
            Save Chat ID
          </button>
          <button onClick={test} className="px-4 py-2 rounded-lg bg-success text-sm font-medium text-white">
            Send Test Message
          </button>
        </div>
      </div>

      <div className="bg-card border border-slate-700/50 rounded-xl p-6 space-y-3">
        <h2 className="font-semibold">Notification Type</h2>
        {PREFS.map((p) => (
          <label key={p.value} className="flex items-center gap-3 text-sm cursor-pointer">
            <input
              type="radio"
              name="pref"
              checked={status?.notificationPreference === p.value}
              onChange={() => setPref(p.value)}
            />
            {p.label}
          </label>
        ))}
        {status?.notificationPreference === "CRITICAL_ONLY" && (
          <p className="text-xs text-warning mt-2">
            Mode ini hanya mengirim push/PR dengan severity CRITICAL. Untuk semua aktivitas Git, pilih
            &ldquo;All repository activities&rdquo;.
          </p>
        )}
      </div>
    </div>
  );
}

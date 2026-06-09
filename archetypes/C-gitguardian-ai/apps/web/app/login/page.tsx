"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

const ERROR_MESSAGES: Record<string, string> = {
  no_code: "GitHub did not return an authorization code.",
  oauth_failed: "GitHub sign-in failed. Please try again.",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const errorKey = searchParams.get("error");
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] : null;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Soft decorative blobs */}
      <div className="pointer-events-none absolute top-1/4 -left-32 w-64 h-64 rounded-full bg-violet-600/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 -right-32 w-72 h-72 rounded-full bg-fuchsia-600/15 blur-3xl" />

      <div className="w-full max-w-md card-soft p-8 sm:p-10 relative">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo size="xl" showText={false} className="mb-5" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-200 via-fuchsia-200 to-purple-300 bg-clip-text text-transparent">
            Welcome back
          </h1>
          <p className="text-violet-300/60 mt-2 text-sm leading-relaxed max-w-xs">
            Sign in with GitHub to connect repositories and enable AI monitoring ✨
          </p>
        </div>

        {errorMessage && (
          <div className="mb-5 rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-3 text-sm text-fuchsia-200">
            {errorMessage}
          </div>
        )}

        <a
          href={`${API}/auth/github`}
          className="btn-soft flex items-center justify-center gap-3 w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold shadow-glow-md hover:shadow-glow-sm hover:from-violet-400 hover:to-fuchsia-400"
        >
          <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.18.82.63-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.51-1.04 2.18-.82 2.18-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Continue with GitHub
        </a>

        <p className="text-center text-xs text-violet-400/40 mt-6">
          Protected by GitGuardian AI · cute & secure 🐾
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Logo size="lg" showText={false} />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

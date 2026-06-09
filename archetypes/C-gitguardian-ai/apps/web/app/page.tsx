import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-br from-background via-slate-900 to-indigo-950">
      <div className="max-w-2xl text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium">
          GitGuardian AI Agent
        </div>
        <h1 className="text-5xl font-bold tracking-tight">
          Monitor. Review. Secure.
        </h1>
        <p className="text-slate-400 text-lg">
          Connect GitHub, enable AI agents on your repositories, and get instant
          security reviews on every PR, push, and branch merge.
        </p>
        <Link
          href="/login"
          className="inline-block px-8 py-3 rounded-xl bg-primary hover:bg-indigo-500 font-semibold transition shadow-lg shadow-primary/30"
        >
          Sign in with GitHub
        </Link>
      </div>
    </main>
  );
}

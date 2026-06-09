export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const res = await fetch(`${API}/auth/refresh`, { method: "POST", credentials: "include" });
  return res.ok;
}

/** Fetch API with credentials; auto-refreshes access token on 401. */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${API}${path.startsWith("/") ? path : `/${path}`}`;
  let res = await fetch(url, { credentials: "include", ...init });

  if (res.status === 401) {
    if (!refreshPromise) {
      refreshPromise = refreshSession().finally(() => {
        refreshPromise = null;
      });
    }
    const refreshed = await refreshPromise;
    if (refreshed) {
      res = await fetch(url, { credentials: "include", ...init });
    }
  }

  return res;
}

/** Base public API URL without trailing slash (e.g. https://xxx.ngrok-free.app). */
export function publicApiBase(): string {
  const raw = process.env.PUBLIC_API_URL?.trim() ?? "http://localhost:4000";
  return raw.replace(/\/+$/, "");
}

export function webhookUrlForRepository(repositoryId: string): string {
  return `${publicApiBase()}/api/webhooks/github/${repositoryId}`;
}

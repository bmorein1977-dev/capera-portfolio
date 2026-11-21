import type { QueryClient, QueryKey } from "@tanstack/react-query";

// Which data calls is the page on screen showing? The ones its components are watching right now. We pass the server only the addresses; it reads the
// data itself, as the same signed-in person, so what is exported can never differ from what that person is allowed to see.

// The address a query key stands for. This mirrors getQueryFn in queryClient.ts exactly.
export function urlForKey(queryKey: QueryKey): string | null {
  const first = queryKey[0];
  if (typeof first !== "string" || !first.startsWith("/api/")) return null;
  let url = first;
  if (queryKey.length > 1 && typeof queryKey[1] === "object" && queryKey[1] !== null) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(queryKey[1] as Record<string, unknown>)) if (v !== null && v !== undefined && v !== "") params.append(k, String(v));
    if (params.toString()) url += "?" + params.toString();
  } else if (queryKey.length > 1) {
    if (!queryKey.every(p => typeof p === "string" || typeof p === "number")) return null;
    url = queryKey.join("/");
  }
  return url;
}

// calls the page frame makes for itself (who you are, the banner, the language menu): never the page's own data
const FRAME = /^\/api\/(auth|announcements\/mine|translation|training-permissions\/mine|export|licence)(\/|\?|$)/;

export function collectPageUrls(qc: QueryClient): string[] {
  const urls: string[] = [];
  for (const q of qc.getQueryCache().findAll({ type: "active" })) {
    if (q.state.status !== "success" || q.state.data === undefined || q.state.data === null) continue;
    const u = urlForKey(q.queryKey);
    if (u && !FRAME.test(u) && !urls.includes(u)) urls.push(u);
  }
  return urls;
}

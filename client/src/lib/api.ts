// A small wrapper for screens that need the server's own message when something is refused.
export async function api<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  const form = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(url, {
    method, credentials: "include",
    headers: body === undefined || form ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : form ? (body as FormData) : JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = text;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) throw new Error((data && typeof data === "object" && (data.error || data.message)) || `The request failed (${res.status})`);
  return data as T;
}

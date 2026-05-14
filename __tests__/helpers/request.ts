// ============================================================================
// Tiny helpers for constructing Request objects in route tests.
// ============================================================================

/** JSON POST request. */
export function jsonRequest<T extends object>(
  body: T,
  opts: { url?: string; headers?: Record<string, string> } = {}
): Request {
  return new Request(opts.url ?? "https://example.test/api", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
}

/** Multipart form-data POST request (for audio upload routes). */
export function formDataRequest(
  fields: Record<string, string | Blob | File | null | undefined>,
  opts: { url?: string; filename?: string } = {}
): Request {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    if (value instanceof Blob) {
      fd.append(key, value, opts.filename ?? `${key}.bin`);
    } else {
      fd.append(key, value);
    }
  }
  return new Request(opts.url ?? "https://example.test/api", {
    method: "POST",
    body: fd,
  });
}

/** GET request with arbitrary headers and query string. */
export function getRequest(
  url: string,
  headers: Record<string, string> = {}
): Request {
  return new Request(url, { method: "GET", headers });
}

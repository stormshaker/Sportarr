/**
 * Pull a human-readable message out of a caught value.
 *
 * A catch clause hands you `unknown`, and the two shapes that actually reach
 * these handlers are a plain Error and an axios rejection carrying the
 * server's own text in `response.data`. The server's message is the more
 * useful of the two when both are present — "League not found" beats
 * "Request failed with status code 404" — so it is preferred.
 *
 * Anything else falls back to the caller's own wording rather than surfacing
 * "[object Object]" in a toast.
 */
export function errorMessage(err: unknown, fallback = 'An unexpected error occurred'): string {
  if (typeof err === 'string' && err) {
    return err;
  }

  if (err && typeof err === 'object') {
    const data = (err as {
      response?: { data?: { error?: unknown; detail?: unknown; message?: unknown } };
    }).response?.data;
    for (const candidate of [data?.error, data?.detail, data?.message]) {
      if (typeof candidate === 'string' && candidate) {
        return candidate;
      }
    }

    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message) {
      return message;
    }
  }

  return fallback;
}

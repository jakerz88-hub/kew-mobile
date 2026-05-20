// Translates raw exception messages into user-facing copy. The most common
// case this guards against is the literal "Network request failed" string
// that fetch throws on airplane mode / offline — which used to land verbatim
// in ErrorBanner across the app.
//
// Backend-structured errors (e.g. "Daily limit reached" or "queue_limit_reached")
// are passed through unchanged — those are already written for users. Only the
// network-layer technical strings get rewritten.
//
// Pair with `error.code` checks at the call site if you need to branch on a
// specific error type — this helper only rewrites the user-visible `message`,
// it doesn't touch the error object itself.

const NETWORK_PATTERNS = [
  /Network request failed/i,
  /Failed to fetch/i,
  /NetworkError/i,
  /The Internet connection appears to be offline/i,
  /Could not connect to the server/i,
];

export function friendlyError(e: unknown, fallback = "Something went wrong. Please try again."): string {
  const msg = (e as { message?: unknown })?.message;
  if (typeof msg !== "string" || msg.length === 0) return fallback;
  if (NETWORK_PATTERNS.some((re) => re.test(msg))) {
    return "Connection issue. Please check your internet.";
  }
  return msg;
}

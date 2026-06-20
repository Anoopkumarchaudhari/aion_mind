/**
 * Allow-list link hrefs before they are rendered into the DOM.
 *
 * Markdown content can come from the AI or from other users, so a link like
 * `[click me](javascript:fetch('/api/...'))` must never reach an <a href>.
 * Only http(s), mailto, tel, and relative/anchor links are permitted; anything
 * else (javascript:, data:, vbscript:, file:, …) is dropped to `undefined`.
 */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

export function safeHref(href: string | null | undefined): string | undefined {
  if (typeof href !== "string") {
    return undefined;
  }

  const trimmed = href.trim();

  if (!trimmed) {
    return undefined;
  }

  // Relative paths and in-page anchors are always safe.
  if (/^(#|\/|\.{1,2}\/)/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    return ALLOWED_PROTOCOLS.has(url.protocol) ? trimmed : undefined;
  } catch {
    // Not an absolute URL (e.g. "docs/page") — treat as a relative link.
    return trimmed;
  }
}

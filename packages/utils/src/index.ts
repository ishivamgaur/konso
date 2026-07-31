/**
 * @konso/utils — URL & text utility functions
 */
import { URL } from "url";

/**
 * Check if the input looks like a URL (has protocol or domain-like pattern).
 */
export function isUrl(input: string): boolean {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}(\/.*)?$/.test(trimmed)) return true;
  if (trimmed.startsWith("localhost")) return true;
  return false;
}

/**
 * Normalize a URL by adding https:// if no protocol is present.
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Build primary search URL (Google Search).
 */
export function buildSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`;
}

/**
 * Resolve a relative URL against a base URL.
 */
export function resolveUrl(base: string, relative: string): string {
  try {
    if (relative.startsWith("/url?") || relative.startsWith("https://www.google.com/url?")) {
      const fullUrl = relative.startsWith("http") ? relative : `https://www.google.com${relative}`;
      const parsed = new URL(fullUrl);
      const target = parsed.searchParams.get("q");
      if (target) return decodeURIComponent(target);
    }
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

/**
 * Extract hostname from a URL.
 */
export function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Strip ANSI escape codes from a string.
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

/**
 * Truncate a string to a maximum width, adding ellipsis if needed.
 */
export function truncate(str: string, maxWidth: number): string {
  const clean = stripAnsi(str);
  if (clean.length <= maxWidth) return str;
  return clean.slice(0, maxWidth - 1) + "…";
}

/**
 * Word-wrap text to fit within a given width.
 */
export function wordWrap(text: string, width: number): string {
  const lines: string[] = [];
  const paragraphs = text.split("\n");

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }

    const words = paragraph.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      if (currentLine.length === 0) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= width) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
  }

  return lines.join("\n");
}

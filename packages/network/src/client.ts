/**
 * @konso/network — HTTP client for fetching web pages
 */
import { logger } from "@konso/core";

export interface HttpResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  url: string;
  redirected: boolean;
}

export class HttpClient {
  private userAgent: string;
  private timeout: number;
  private maxRedirects: number;

  constructor(options?: { userAgent?: string; timeout?: number; maxRedirects?: number }) {
    this.userAgent =
      options?.userAgent ??
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
    this.timeout = options?.timeout ?? 30_000;
    this.maxRedirects = options?.maxRedirects ?? 10;
  }

  async get(url: string): Promise<HttpResponse> {
    logger.info({ url }, "GET request");

    let currentUrl = url;
    let redirectCount = 0;
    let wasRedirected = false;

    while (redirectCount < this.maxRedirects) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(currentUrl, {
          method: "GET",
          headers: {
            "User-Agent": this.userAgent,
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Sec-Ch-Ua": '"Chromium";v="125", "Google Chrome";v="125"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
          },
          redirect: "manual",
          signal: controller.signal,
        });

        clearTimeout(timer);

        // Handle redirects
        if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
          const location = response.headers.get("location")!;
          currentUrl = new URL(location, currentUrl).href;
          redirectCount++;
          wasRedirected = true;
          logger.info({ from: url, to: currentUrl, count: redirectCount }, "Following redirect");
          continue;
        }

        const text = await response.text();
        const headers: Record<string, string | string[] | undefined> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        return {
          status: response.status,
          headers,
          body: text,
          url: currentUrl,
          redirected: wasRedirected,
        };
      } catch (error) {
        clearTimeout(timer);
        if ((error as Error).name === "AbortError") {
          throw new Error(`Request timed out after ${this.timeout}ms: ${url}`);
        }
        throw error;
      }
    }

    throw new Error(`Too many redirects (${this.maxRedirects}) for URL: ${url}`);
  }
}

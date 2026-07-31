/**
 * @konso/browser — Playwright-Powered Browser Controller
 */
import { HttpClient } from "@konso/network";
import { renderToText } from "@konso/renderer";
import { isUrl, normalizeUrl, buildSearchUrl, resolveUrl } from "@konso/utils";
import type { ExtractedLink } from "@konso/html";
import { chromium, type Browser as PwBrowser } from "playwright";

export interface PageState {
  url: string;
  title: string;
  text: string;
  links: ExtractedLink[];
  description: string;
  status: number;
}

export class BrowserController {
  private client: HttpClient;
  private history: string[] = [];
  private historyIndex = -1;
  private currentState: PageState | null = null;
  private pwBrowser: PwBrowser | null = null;

  constructor(options?: { userAgent?: string; timeout?: number }) {
    this.client = new HttpClient(options);
  }

  /**
   * Stealth Playwright page fetch (forces Google to treat request as real desktop Chrome).
   */
  async fetchWithPlaywright(url: string): Promise<{ body: string; url: string }> {
    if (!this.pwBrowser) {
      try {
        this.pwBrowser = await chromium.launch({
          channel: "chrome",
          headless: true,
          args: [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-setuid-sandbox",
          ],
        });
      } catch {
        this.pwBrowser = await chromium.launch({
          headless: true,
          args: [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-setuid-sandbox",
          ],
        });
      }
    }
    const context = await this.pwBrowser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
    });

    const page = await context.newPage();
    // Inject stealth flags into window object to mask automation from Google
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      (window as any).chrome = { runtime: {} };
    });

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
      await page.waitForTimeout(800);
      const body = await page.content();
      const finalUrl = page.url();
      await context.close();
      return { body, url: finalUrl };
    } catch (err) {
      await context.close();
      throw err;
    }
  }

  /**
   * Check if page content contains valid search results.
   */
  private isValidSearchResult(body: string, text: string): boolean {
    if (body.includes("unusual traffic") || body.includes("google.com/sorry")) {
      return false;
    }
    if (body.includes("trouble accessing Google Search")) {
      return false;
    }
    if (text.trim().length < 150) {
      return false;
    }
    return true;
  }

  /**
   * Playwright-First Navigation Engine.
   */
  async navigate(input: string, width: number = 80): Promise<PageState> {
    if (isUrl(input)) {
      const targetUrl = normalizeUrl(input);
      let body: string;
      let finalUrl = targetUrl;
      let status = 200;

      try {
        const response = await this.client.get(targetUrl);
        body = response.body;
        finalUrl = response.url;
        status = response.status;

        if (body.length < 500 && body.includes("<script")) {
          const pwResult = await this.fetchWithPlaywright(targetUrl);
          body = pwResult.body;
          finalUrl = pwResult.url;
        }
      } catch {
        const pwResult = await this.fetchWithPlaywright(targetUrl);
        body = pwResult.body;
        finalUrl = pwResult.url;
      }

      const renderResult = renderToText(body, width);
      const resolvedLinks = renderResult.links.map((link) => ({
        ...link,
        href: resolveUrl(finalUrl, link.href),
      }));

      const state: PageState = {
        url: finalUrl,
        title: renderResult.title || input,
        text: renderResult.text,
        links: resolvedLinks,
        description: renderResult.description,
        status,
      };

      if (this.historyIndex === -1 || this.history[this.historyIndex] !== finalUrl) {
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(finalUrl);
        this.historyIndex = this.history.length - 1;
      }

      this.currentState = state;
      return state;
    }

    // Input is a Search Query: Run Playwright Google Search First
    const encodedQuery = encodeURIComponent(input.trim());
    const googleSearchUrl = `https://www.google.com/search?q=${encodedQuery}`;

    let body = "";
    let finalUrl = googleSearchUrl;
    let status = 200;

    // 1. First try Stealth Playwright directly on Google Search
    try {
      const pwResult = await this.fetchWithPlaywright(googleSearchUrl);
      const renderResult = renderToText(pwResult.body, width);

      if (this.isValidSearchResult(pwResult.body, renderResult.text)) {
        body = pwResult.body;
        finalUrl = pwResult.url;
      }
    } catch {
      // Continue fallback
    }

    // 2. Fallback search engine sequence if Google Search blocked IP
    if (!body) {
      const searchEngines = [
        `https://html.duckduckgo.com/html/?q=${encodedQuery}`,
        `https://www.startpage.com/sp/search?query=${encodedQuery}`,
        `https://www.bing.com/search?q=${encodedQuery}`,
      ];

      for (const engineUrl of searchEngines) {
        try {
          const response = await this.client.get(engineUrl);
          const renderResult = renderToText(response.body, width);

          if (this.isValidSearchResult(response.body, renderResult.text)) {
            body = response.body;
            finalUrl = response.url;
            status = response.status;
            break;
          }
        } catch {
          // Continue
        }

        try {
          const pwResult = await this.fetchWithPlaywright(engineUrl);
          const renderResult = renderToText(pwResult.body, width);

          if (this.isValidSearchResult(pwResult.body, renderResult.text)) {
            body = pwResult.body;
            finalUrl = pwResult.url;
            break;
          }
        } catch {
          // Continue
        }
      }
    }

    const renderResult = renderToText(body, width);
    const resolvedLinks = renderResult.links.map((link) => ({
      ...link,
      href: resolveUrl(finalUrl, link.href),
    }));

    const state: PageState = {
      url: finalUrl,
      title: `${input} - Search`,
      text: renderResult.text,
      links: resolvedLinks,
      description: renderResult.description,
      status,
    };

    if (this.historyIndex === -1 || this.history[this.historyIndex] !== finalUrl) {
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(finalUrl);
      this.historyIndex = this.history.length - 1;
    }

    this.currentState = state;
    return state;
  }

  /**
   * Navigate to a link index from the current page.
   */
  async followLink(index: number, width: number = 80): Promise<PageState> {
    if (!this.currentState) {
      throw new Error("No page loaded");
    }

    const link = this.currentState.links.find((l) => l.index === index);
    if (!link) {
      throw new Error(`Link [${index}] not found on current page`);
    }

    return this.navigate(link.href, width);
  }

  /**
   * Go back in history.
   */
  async back(width: number = 80): Promise<PageState | null> {
    if (this.canGoBack()) {
      this.historyIndex--;
      const url = this.history[this.historyIndex]!;
      return this.fetchWithoutHistory(url, width);
    }
    return null;
  }

  /**
   * Go forward in history.
   */
  async forward(width: number = 80): Promise<PageState | null> {
    if (this.canGoForward()) {
      this.historyIndex++;
      const url = this.history[this.historyIndex]!;
      return this.fetchWithoutHistory(url, width);
    }
    return null;
  }

  canGoBack(): boolean {
    return this.historyIndex > 0;
  }

  canGoForward(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  getCurrentState(): PageState | null {
    return this.currentState;
  }

  getHistory(): string[] {
    return [...this.history];
  }

  async close(): Promise<void> {
    if (this.pwBrowser) {
      await this.pwBrowser.close();
      this.pwBrowser = null;
    }
  }

  private async fetchWithoutHistory(url: string, width: number): Promise<PageState> {
    const response = await this.client.get(url);
    const renderResult = renderToText(response.body, width);

    const resolvedLinks = renderResult.links.map((link) => ({
      ...link,
      href: resolveUrl(response.url, link.href),
    }));

    const state: PageState = {
      url: response.url,
      title: renderResult.title || url,
      text: renderResult.text,
      links: resolvedLinks,
      description: renderResult.description,
      status: response.status,
    };

    this.currentState = state;
    return state;
  }
}

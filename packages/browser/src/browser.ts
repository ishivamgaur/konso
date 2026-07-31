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
  async fetchWithPlaywright(
    url: string,
    onBodyUpdate?: (body: string, url: string) => void,
  ): Promise<{ body: string; url: string }> {
    if (!this.pwBrowser) {
      const launchArgs = [
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        "--window-position=0,0",
        "--ignore-certificate-errors",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
      ];
      try {
        this.pwBrowser = await chromium.launch({
          channel: "chrome",
          headless: true,
          args: launchArgs,
        });
      } catch {
        this.pwBrowser = await chromium.launch({
          headless: true,
          args: launchArgs,
        });
      }
    }

    // Align User-Agent dynamically with the browser engine version to avoid TLS/UA mismatch detection
    const version = this.pwBrowser.version();
    const cleanUa = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;

    const context = await this.pwBrowser.newContext({
      userAgent:
        cleanUa ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1366, height: 768 },
      locale: "en-US",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      },
    });

    const page = await context.newPage();

    // Comprehensive advanced stealth init scripts to bypass Google automation checks
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      delete (navigator as any).__proto__.webdriver;

      (window as any).chrome = {
        runtime: {},
        loadTimes: function () {},
        csi: function () {},
        app: {},
      };

      Object.defineProperty(navigator, "plugins", {
        get: () => [
          {
            name: "Chrome PDF Plugin",
            filename: "internal-pdf-viewer",
            description: "Portable Document Format",
          },
          {
            name: "Chrome PDF Viewer",
            filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
            description: "",
          },
          { name: "Native Client", filename: "internal-nacl-plugin", description: "" },
        ],
      });

      Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });

      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (parameter: number) {
        if (parameter === 37445) return "Intel Inc.";
        if (parameter === 37446) return "Intel Iris OpenGL Engine";
        return getParameter.apply(this, [parameter]);
      };
      if (typeof WebGL2RenderingContext !== "undefined") {
        const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function (parameter: number) {
          if (parameter === 37445) return "Intel Inc.";
          if (parameter === 37446) return "Intel Iris OpenGL Engine";
          return getParameter2.apply(this, [parameter]);
        };
      }

      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
          : originalQuery(parameters);
    });

    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
        referer: "https://www.google.com/",
      });
      await page.waitForTimeout(300); // Ultra-fast initial render so terminal display is immediate
      const initialBody = await page.content();
      const finalUrl = page.url();

      if (onBodyUpdate) {
        // Keep Playwright active in background to stream live real-time updates as client APIs finish loading
        (async () => {
          try {
            let lastBody = initialBody;
            for (let i = 0; i < 6; i++) {
              await page.waitForTimeout(1000);
              const latestBody = await page.content().catch(() => "");
              if (
                latestBody &&
                latestBody !== lastBody &&
                latestBody.length > lastBody.length - 200
              ) {
                lastBody = latestBody;
                onBodyUpdate(latestBody, page.url());
              }
            }
          } catch {
            // Ignore background polling errors
          } finally {
            await context.close().catch(() => {});
          }
        })();
      } else {
        await context.close().catch(() => {});
      }

      return { body: initialBody, url: finalUrl };
    } catch (err) {
      await context.close().catch(() => {});
      throw err;
    }
  }

  /**
   * Check if page content contains valid search results.
   */
  private isValidSearchResult(body: string, text: string): boolean {
    if (
      body.includes("unusual traffic") ||
      body.includes("google.com/sorry") ||
      body.includes("trouble accessing Google Search") ||
      body.includes("about this traffic") ||
      body.includes("To continue, please type the characters below")
    ) {
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
  async navigate(
    input: string,
    width: number = 80,
    onUpdate?: (state: PageState) => void,
  ): Promise<PageState> {
    if (isUrl(input)) {
      const targetUrl = normalizeUrl(input);
      let body: string;
      let finalUrl = targetUrl;
      let status = 200;

      const handleBodyUpdate = (newBody: string, newUrl: string) => {
        const uRender = renderToText(newBody, width);
        const uLinks = uRender.links.map((link) => ({
          ...link,
          href: resolveUrl(newUrl, link.href),
        }));
        const uState: PageState = {
          url: newUrl,
          title: uRender.title || input,
          text: uRender.text,
          links: uLinks,
          description: uRender.description,
          status: 200,
        };
        this.currentState = uState;
        if (onUpdate) onUpdate(uState);
      };

      try {
        // Always execute Playwright first and connect background live streaming callback
        const pwResult = await this.fetchWithPlaywright(targetUrl, handleBodyUpdate);
        body = pwResult.body;
        finalUrl = pwResult.url;
      } catch {
        // Fallback to basic HTTP request if browser automation fails
        const response = await this.client.get(targetUrl);
        body = response.body;
        finalUrl = response.url;
        status = response.status;
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

    // 2. Fallback sequence using varied genuine Google Search endpoints and regional TLDs (No DuckDuckGo/Bing)
    if (!body) {
      const googleEndpoints = [
        `https://www.google.co.in/search?q=${encodedQuery}&hl=en`,
        `https://www.google.co.uk/search?q=${encodedQuery}&hl=en`,
        `https://www.google.ca/search?q=${encodedQuery}&hl=en`,
        `https://www.google.de/search?q=${encodedQuery}&hl=en`,
        `https://www.google.com.au/search?q=${encodedQuery}&hl=en`,
        `https://www.google.com/search?q=${encodedQuery}&gbv=1`,
        `https://www.google.co.in/search?q=${encodedQuery}&gbv=1`,
      ];

      for (const engineUrl of googleEndpoints) {
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
  async followLink(
    index: number,
    width: number = 80,
    onUpdate?: (state: PageState) => void,
  ): Promise<PageState> {
    if (!this.currentState) {
      throw new Error("No page loaded");
    }

    const link = this.currentState.links.find((l) => l.index === index);
    if (!link) {
      throw new Error(`Link [${index}] not found on current page`);
    }

    return this.navigate(link.href, width, onUpdate);
  }

  /**
   * Go back in history.
   */
  async back(width: number = 80, onUpdate?: (state: PageState) => void): Promise<PageState | null> {
    if (this.canGoBack()) {
      this.historyIndex--;
      const url = this.history[this.historyIndex]!;
      return this.navigate(url, width, onUpdate);
    }
    return null;
  }

  /**
   * Go forward in history.
   */
  async forward(
    width: number = 80,
    onUpdate?: (state: PageState) => void,
  ): Promise<PageState | null> {
    if (this.canGoForward()) {
      this.historyIndex++;
      const url = this.history[this.historyIndex]!;
      return this.navigate(url, width, onUpdate);
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

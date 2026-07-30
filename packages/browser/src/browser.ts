import { chromium, type Browser as PwBrowser, type Page } from "playwright";
import { logger } from "@konso/core";

export class Browser {
  private browser: PwBrowser | null = null;
  private page: Page | null = null;

  async launch(): Promise<void> {
    logger.info("Launching browser engine...");
    this.browser = await chromium.launch({ headless: true });
    const context = await this.browser.newContext();
    this.page = await context.newPage();
  }

  async navigate(url: string): Promise<string> {
    if (!this.page) throw new Error("Browser not launched");
    logger.info({ url }, "Navigating");
    await this.page.goto(url);
    return this.page.content();
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
    this.page = null;
  }
}

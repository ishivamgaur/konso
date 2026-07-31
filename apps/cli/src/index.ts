/**
 * @konso/cli — Main CLI entry point for Konso Browser
 */
import { cac } from "cac";
import { TerminalApp } from "@konso/terminal";
import { BrowserController } from "@konso/browser";

const cli = cac("konso");

cli
  .command("[urlOrQuery]", "Open a URL or search Google in the terminal browser")
  .option("--headless", "Run in headless mode and print rendered text to stdout")
  .option("--source", "Print raw HTML source code to stdout")
  .action(async (input: string | undefined, options: { headless?: boolean; source?: boolean }) => {
    // Headless / Source dump mode
    if (options.headless || options.source) {
      if (!input) {
        console.error("Error: URL or search query required in headless mode.");
        process.exit(1);
      }
      try {
        const browser = new BrowserController();
        const state = await browser.navigate(input, process.stdout.columns || 80);
        if (options.source) {
          console.log(state.text);
        } else {
          console.log(`\n--- ${state.title} (${state.url}) ---\n`);
          console.log(state.text);
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
      return;
    }

    // Default: Full Interactive Terminal Browser UI
    try {
      const app = new TerminalApp(input);
      app.start();
    } catch (err) {
      console.error(`Failed to launch Konso browser UI: ${(err as Error).message}`);
      process.exit(1);
    }
  });

cli.help();
cli.version("0.0.1");
cli.parse();

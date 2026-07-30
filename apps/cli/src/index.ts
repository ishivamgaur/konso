/**
 * @konso/cli — Main CLI entry point
 */
import { cac } from "cac";

const cli = cac("konso");

cli
  .command("[url]", "Open a URL in the terminal browser")
  .option("--headless", "Run in headless mode")
  .action((url: string | undefined, options: { headless?: boolean }) => {
    console.log("konso — terminal browser");
    if (url) {
      console.log(`Navigating to: ${url}`);
    }
  });

cli.help();
cli.version("0.0.1");
cli.parse();

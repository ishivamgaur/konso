/**
 * @konso/terminal — Modern Minimalist OpenCode-Style Terminal Browser UI
 */
import blessed from "blessed";
import chalk from "chalk";
import { BrowserController, type PageState } from "@konso/browser";

export class TerminalApp {
  private browser: BrowserController;
  private screen: blessed.Widgets.Screen;
  private headerBox: blessed.Widgets.BoxElement;
  private addressBox: blessed.Widgets.TextboxElement;
  private contentBox: blessed.Widgets.BoxElement;
  private statusBar: blessed.Widgets.BoxElement;
  private helpBox: blessed.Widgets.BoxElement;
  private linkPromptBox: blessed.Widgets.TextboxElement;
  private isPromptActive = false;

  constructor(initialUrl?: string) {
    this.browser = new BrowserController();

    // Disable X11 mouse trap so native mouse text selection works seamlessly
    this.screen = blessed.screen({
      smartCSR: true,
      title: "Konso Terminal Browser",
      fullUnicode: true,
      dockBorders: true,
      mouse: false,
    });

    // 1. Top Bar: Sleek Dark Blue Status Banner
    this.headerBox = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: "100%",
      height: 1,
      style: {
        bg: "blue",
        fg: "white",
        bold: true,
      },
      content: "  ⚡ KONSO  │  Press 'o' to Search or Enter URL  │  [?] Help",
      tags: true,
    });

    // 2. Address / Search Input Box
    this.addressBox = blessed.textbox({
      parent: this.screen,
      top: 1,
      left: 0,
      width: "100%",
      height: 3,
      border: { type: "line" },
      style: {
        border: { fg: "cyan" },
        focus: { border: { fg: "green" }, bg: "black" },
        fg: "white",
        bg: "black",
      },
      label: " 🔍 SEARCH / ADDRESS BAR ",
      inputOnFocus: false,
    });

    // 3. Full-Width Main Web Viewport
    this.contentBox = blessed.box({
      parent: this.screen,
      top: 4,
      left: 0,
      width: "100%",
      height: "100%-5",
      border: { type: "line" },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: "█",
        style: { fg: "cyan" },
      },
      keys: true,
      vi: true,
      style: {
        border: { fg: "grey" },
        fg: "white",
        bg: "black",
      },
      label: " 📄 WEB CONTENT (Selectable Text) ",
      tags: true,
    });

    // 4. Bottom 1-Line Status & Command Bar
    this.statusBar = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: "100%",
      height: 1,
      style: {
        fg: "black",
        bg: "cyan",
      },
      content:
        "  [o] Search / URL  │  [g] Open Link  │  [b] Back  │  [f] Forward  │  [?] Help  │  [q] Quit",
      tags: true,
    });

    // 5. Help Overlay Modal
    this.helpBox = blessed.box({
      parent: this.screen,
      top: "center",
      left: "center",
      width: 70,
      height: 20,
      border: { type: "line" },
      hidden: true,
      style: {
        border: { fg: "yellow" },
        fg: "white",
        bg: "black",
      },
      label: " ⚡ KONSO KEYBOARD GUIDE ",
      tags: true,
    });
    this.helpBox.setContent(
      [
        "",
        `  ${chalk.bold.yellow("SEARCH & NAVIGATION:")}`,
        `    • Press ${chalk.green.bold("o")} or ${chalk.green.bold("/")} to Search Google/DuckDuckGo or Enter URL`,
        `    • Press ${chalk.cyan.bold("g")} or ${chalk.cyan.bold("l")} to navigate to a link by number ${chalk.yellow("[N]")}`,
        `    • Press ${chalk.cyan.bold("b")} to go Back  │  ${chalk.cyan.bold("f")} to go Forward`,
        "",
        `  ${chalk.bold.yellow("SELECTABLE TEXT & SCROLLING:")}`,
        `    • ${chalk.white.bold("Text Selection:")} Highlight & copy text natively with your mouse!`,
        `    • Scroll: ${chalk.cyan.bold("j / k")} or ${chalk.cyan.bold("Up / Down Arrow Keys")}`,
        `    • Page Down: ${chalk.cyan.bold("PageDown")} or ${chalk.cyan.bold("Space")}  │  Page Up: ${chalk.cyan.bold("PageUp")}`,
        `    • Top: ${chalk.cyan.bold("gg")}  │  Bottom: ${chalk.cyan.bold("G")}`,
        "",
        `  ${chalk.bold.yellow("SYSTEM:")}`,
        `    • Press ${chalk.cyan.bold("?")} or ${chalk.cyan.bold("h")} to toggle Help menu`,
        `    • Press ${chalk.cyan.bold("q")} to Quit`,
        "",
        `  ${chalk.dim("Press Esc or ? to close this menu")}`,
      ].join("\n"),
    );

    // 6. Link Selector Modal Box
    this.linkPromptBox = blessed.textbox({
      parent: this.screen,
      top: "center",
      left: "center",
      width: 48,
      height: 3,
      border: { type: "line" },
      hidden: true,
      style: {
        border: { fg: "magenta" },
        focus: { border: { fg: "green" } },
        fg: "white",
        bg: "black",
      },
      label: " 🔗 ENTER LINK NUMBER [N] ",
      inputOnFocus: false,
    });

    this.setupKeybindings();

    if (initialUrl) {
      this.navigate(initialUrl);
    } else {
      this.renderHomeScreen();
    }
  }

  private setupKeybindings() {
    // Exit application
    this.screen.key(["q", "C-c"], () => {
      if (!this.isPromptActive) {
        process.exit(0);
      }
    });

    // Toggle Help Modal
    this.screen.key(["?", "h"], () => {
      if (!this.isPromptActive) {
        this.helpBox.toggle();
        this.screen.render();
      }
    });

    // Escape cancels prompts / closes modal
    this.screen.key(["escape"], () => {
      if (!this.helpBox.hidden) {
        this.helpBox.hide();
        this.screen.render();
      }
    });

    // Focus Address / Search box with 'o' or '/'
    this.screen.key(["o", "/"], () => {
      if (!this.isPromptActive && this.helpBox.hidden) {
        this.focusAddressBar();
      }
    });

    // Follow Link prompt ('g' or 'l')
    this.screen.key(["g", "l"], () => {
      if (!this.isPromptActive && this.helpBox.hidden) {
        this.promptLink();
      }
    });

    // Direct number keys (0-9) trigger link jump prompt
    for (let i = 0; i <= 9; i++) {
      this.screen.key([String(i)], () => {
        if (!this.isPromptActive && this.helpBox.hidden) {
          const state = this.browser.getCurrentState();
          if (state && state.links.length > 0) {
            this.promptLink(String(i));
          }
        }
      });
    }

    // History Back ('b')
    this.screen.key(["b"], async () => {
      if (!this.isPromptActive && this.helpBox.hidden) {
        this.setStatus(" ⏳ Going back...");
        try {
          const state = await this.browser.back((this.contentBox.width as number) || 80);
          if (state) {
            this.displayPage(state);
          } else {
            this.setStatus(" ⚠️ No back history.");
          }
        } catch (err) {
          this.setStatus(` ❌ Error: ${(err as Error).message}`);
        }
      }
    });

    // History Forward ('f')
    this.screen.key(["f"], async () => {
      if (!this.isPromptActive && this.helpBox.hidden) {
        this.setStatus(" ⏳ Going forward...");
        try {
          const state = await this.browser.forward((this.contentBox.width as number) || 80);
          if (state) {
            this.displayPage(state);
          } else {
            this.setStatus(" ⚠️ No forward history.");
          }
        } catch (err) {
          this.setStatus(` ❌ Error: ${(err as Error).message}`);
        }
      }
    });
  }

  public focusAddressBar() {
    this.isPromptActive = true;
    this.addressBox.setValue("");
    this.addressBox.focus();
    this.screen.render();

    this.addressBox.readInput((_err, value) => {
      this.isPromptActive = false;
      this.contentBox.focus();
      if (value && value.trim()) {
        this.navigate(value.trim());
      } else {
        this.screen.render();
      }
    });
  }

  public promptLink(initialVal: string = "") {
    const state = this.browser.getCurrentState();
    if (!state || state.links.length === 0) {
      this.setStatus(" ⚠️ No links available on page.");
      return;
    }
    this.isPromptActive = true;
    this.linkPromptBox.show();
    this.linkPromptBox.setValue(initialVal);
    this.linkPromptBox.focus();
    this.screen.render();

    this.linkPromptBox.readInput(async (_err, value) => {
      this.linkPromptBox.hide();
      this.isPromptActive = false;
      this.contentBox.focus();

      const num = parseInt(value?.trim() || "", 10);
      if (!isNaN(num)) {
        this.setStatus(` ⏳ Opening Link [${num}]...`);
        try {
          const newState = await this.browser.followLink(
            num,
            (this.contentBox.width as number) || 80,
          );
          this.displayPage(newState);
        } catch (err) {
          this.setStatus(` ❌ Error: ${(err as Error).message}`);
        }
      } else {
        this.screen.render();
      }
    });
  }

  public async navigate(query: string) {
    this.setStatus(` ⏳ Loading: ${query}...`);
    this.addressBox.setValue(query);
    this.screen.render();

    try {
      const width = (this.contentBox.width as number) || 80;
      const state = await this.browser.navigate(query, width);
      this.displayPage(state);
    } catch (err) {
      this.setStatus(` ❌ Fetch failed: ${(err as Error).message}`);
    }
  }

  private displayPage(state: PageState) {
    this.addressBox.setValue(state.url);
    this.headerBox.setContent(
      `  ⚡ KONSO  │  ${state.title.slice(0, 45)}  │  ${state.url.slice(0, 50)}`,
    );
    this.contentBox.setContent(state.text);
    this.contentBox.scrollTo(0);
    this.setStatus(
      `  [o] Search / URL  │  Links: ${state.links.length} (Press 'g' to open)  │  [b] Back  │  [f] Forward  │  [?] Help`,
    );
    this.contentBox.focus();
    this.screen.render();
  }

  private setStatus(text: string) {
    this.statusBar.setContent(`  ${text}`);
    this.screen.render();
  }

  private renderHomeScreen() {
    const homeText = [
      "",
      chalk.bold.cyan("   ██╗  ██╗ ██████╗ ███╗   ██╗███████╗██████╗ "),
      chalk.bold.cyan("   ██║ ██╔╝██╔═══██╗████╗  ██║██╔════╝██╔══██╗"),
      chalk.bold.cyan("   █████═╝ ██║   ██║██╔██╗ ██║███████╗██║  ██║"),
      chalk.bold.cyan("   ██╔═██╗ ██║   ██║██║╚██╗██║╚════██║██║  ██║"),
      chalk.bold.cyan("   ██║  ██╗╚██████╔╝██║ ╚████║███████║██████╔╝"),
      chalk.bold.cyan("   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝╚═════╝ "),
      "",
      chalk.dim("  ─────────────────────────────────────────────────────────────"),
      `  ${chalk.bold.white("Welcome to Konso")} — Minimalist Terminal Browser & Search`,
      chalk.dim("  ─────────────────────────────────────────────────────────────"),
      "",
      `  ${chalk.green.bold("HOW TO SEARCH & USE:")}`,
      "",
      `  1. ${chalk.cyan.bold("SEARCH ANYTHING:")}`,
      `     Press ${chalk.yellow.bold("o")} or ${chalk.yellow.bold("/")}, then type e.g.`,
      `     ${chalk.green("developer shivam gaur")}, ${chalk.green("latest tech news")}, or ${chalk.green("weather Tokyo")}`,
      "",
      `  2. ${chalk.cyan.bold("SELECT & COPY TEXT WITH MOUSE:")}`,
      `     Highlight & copy any text natively with your mouse!`,
      "",
      `  3. ${chalk.cyan.bold("CLICK LINKS:")}`,
      `     Press ${chalk.yellow.bold("g")} or type a link number e.g. ${chalk.yellow("1")} to open.`,
      "",
      chalk.dim("  ─────────────────────────────────────────────────────────────"),
      `  ${chalk.yellow.bold("Ready.")} Press ${chalk.green.bold("o")} to start searching!`,
    ].join("\n");

    this.contentBox.setContent(homeText);
    this.setStatus("  Press 'o' or '/' to Search or enter a URL");
    this.screen.render();
  }

  public start() {
    this.screen.render();
  }
}

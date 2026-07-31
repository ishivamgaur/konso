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
  private isFirstKeyPressInPrompt = false;
  private currentTitle = "Press 'o' to Search or Enter URL";
  private currentUrl = "[?] Help";

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
      content: this.formatHeader(this.currentTitle, this.currentUrl),
      tags: true,
    });

    // Live RAM monitoring indicator on top bar updating every 2 seconds
    setInterval(() => {
      this.headerBox.setContent(this.formatHeader(this.currentTitle, this.currentUrl));
      this.screen.render();
    }, 2000).unref();

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
      label: " ❯ SEARCH / ADDRESS BAR (Press Esc or Ctrl+C to Cancel & Unfocus) ",
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
      label: " ≡ WEB CONTENT (Selectable Text) ",
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
      label: " ◆ KONSO KEYBOARD GUIDE ",
      tags: true,
    });
    this.helpBox.setContent(
      [
        "",
        `  ${chalk.bold.yellow("SEARCH & NAVIGATION:")}`,
        `    • Press ${chalk.green.bold("o")} or ${chalk.green.bold("/")} to Search Google or Enter URL`,
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
      label: " [ # ] ENTER LINK NUMBER [N] ",
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

    // Escape cancels prompts / closes modal / unfocuses address bar
    this.screen.key(["escape"], () => {
      if (!this.helpBox.hidden) {
        this.helpBox.hide();
        this.screen.render();
      } else if (this.isPromptActive) {
        this.cancelActivePrompt();
      }
    });

    this.addressBox.on("keypress", (ch, key) => {
      if (key && (key.name === "escape" || (key.ctrl && key.name === "c") || key.name === "tab")) {
        this.cancelActivePrompt();
        return;
      }
      if (this.isFirstKeyPressInPrompt) {
        this.isFirstKeyPressInPrompt = false;
        if (
          ch &&
          (!key ||
            (!key.ctrl &&
              !key.meta &&
              key.name !== "backspace" &&
              key.name !== "left" &&
              key.name !== "right" &&
              key.name !== "enter"))
        ) {
          setTimeout(() => {
            this.addressBox.setValue(ch);
            this.screen.render();
          }, 0);
        }
      }
    });

    this.linkPromptBox.on("keypress", (_ch, key) => {
      if (key && (key.name === "escape" || (key.ctrl && key.name === "c") || key.name === "tab")) {
        this.cancelActivePrompt();
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
        this.setStatus(" ↻ Going back...");
        try {
          const state = await this.browser.back((this.contentBox.width as number) || 80, (s) =>
            this.updatePageDynamically(s),
          );
          if (state) {
            this.displayPage(state);
          } else {
            this.setStatus(" [!] No back history.");
          }
        } catch (err) {
          this.setStatus(` × Error: ${(err as Error).message}`);
        }
      }
    });

    // History Forward ('f')
    this.screen.key(["f"], async () => {
      if (!this.isPromptActive && this.helpBox.hidden) {
        this.setStatus(" ↻ Going forward...");
        try {
          const state = await this.browser.forward((this.contentBox.width as number) || 80, (s) =>
            this.updatePageDynamically(s),
          );
          if (state) {
            this.displayPage(state);
          } else {
            this.setStatus(" [!] No forward history.");
          }
        } catch (err) {
          this.setStatus(` × Error: ${(err as Error).message}`);
        }
      }
    });
  }

  private cancelActivePrompt() {
    this.addressBox.cancel();
    this.linkPromptBox.cancel();
    this.linkPromptBox.hide();
    if (this.currentUrl !== "[?] Help") {
      this.addressBox.setValue(this.currentUrl);
    } else {
      this.addressBox.setValue("");
    }
    this.isPromptActive = false;
    this.contentBox.focus();
    this.restoreStatusBar();
    this.screen.render();
  }

  private restoreStatusBar() {
    const state = this.browser.getCurrentState();
    if (state) {
      this.setStatus(
        `  [o] Search / URL  │  Links: ${state.links.length} (Press 'g' to open)  │  [b] Back  │  [f] Forward  │  [?] Help`,
      );
    } else {
      this.setStatus("  Press 'o' or '/' to Search or enter a URL  │  [?] Help  │  [q] Quit");
    }
  }

  public focusAddressBar() {
    this.isPromptActive = true;
    this.isFirstKeyPressInPrompt = true;
    const initialVal =
      this.currentUrl !== "[?] Help" && !this.currentUrl.startsWith("Press 'o'")
        ? this.currentUrl
        : "";
    this.addressBox.setValue(initialVal);
    this.addressBox.focus();
    this.setStatus(
      " ❯ SEARCH MODE: Type to override current URL, or use arrows to edit  │  [Esc] or [Ctrl+C] to CANCEL",
    );
    this.screen.render();

    this.addressBox.readInput((_err, value) => {
      this.isPromptActive = false;
      this.contentBox.focus();
      if (value && value.trim()) {
        this.navigate(value.trim());
      } else {
        if (this.currentUrl !== "[?] Help") {
          this.addressBox.setValue(this.currentUrl);
        }
        this.restoreStatusBar();
        this.screen.render();
      }
    });
  }

  public promptLink(initialVal: string = "") {
    const state = this.browser.getCurrentState();
    if (!state || state.links.length === 0) {
      this.setStatus(" [!] No links available on page.");
      return;
    }
    this.isPromptActive = true;
    this.linkPromptBox.show();
    this.linkPromptBox.setValue(initialVal);
    this.linkPromptBox.focus();
    this.setStatus(
      " [ # ] LINK MODE: Type link number [N] and press [Enter]  │  [Esc] or [Ctrl+C] to CANCEL & UNFOCUS",
    );
    this.screen.render();

    this.linkPromptBox.readInput(async (_err, value) => {
      this.linkPromptBox.hide();
      this.isPromptActive = false;
      this.contentBox.focus();

      const num = parseInt(value?.trim() || "", 10);
      if (!isNaN(num)) {
        this.setStatus(` ↻ Opening Link [${num}]...`);
        try {
          const newState = await this.browser.followLink(
            num,
            (this.contentBox.width as number) || 80,
            (s) => this.updatePageDynamically(s),
          );
          this.displayPage(newState);
        } catch (err) {
          this.setStatus(` × Error: ${(err as Error).message}`);
        }
      } else {
        this.restoreStatusBar();
        this.screen.render();
      }
    });
  }

  public async navigate(query: string) {
    this.setStatus(` ↻ Loading: ${query}...`);
    this.addressBox.setValue(query);
    this.screen.render();

    try {
      const width = (this.contentBox.width as number) || 80;
      const state = await this.browser.navigate(query, width, (s) => this.updatePageDynamically(s));
      this.displayPage(state);
    } catch (err) {
      this.setStatus(` × Fetch failed: ${(err as Error).message}`);
    }
  }

  private updatePageDynamically(state: PageState) {
    if (this.currentUrl !== state.url && !state.url.includes(this.currentUrl)) {
      return;
    }
    this.currentTitle = state.title;
    this.headerBox.setContent(this.formatHeader(state.title, state.url));

    const scrollPos = (this.contentBox as any).getScroll ? (this.contentBox as any).getScroll() : 0;
    this.contentBox.setContent(state.text);
    if ((this.contentBox as any).scrollTo) {
      (this.contentBox as any).scrollTo(scrollPos);
    }
    this.setStatus(
      `  [o] Search / URL  │  Links: ${state.links.length} (Press 'g' to open)  │  [b] Back  │  [f] Forward  │  [?] Help`,
    );
    this.screen.render();
  }

  private formatHeader(title: string, url: string): string {
    const memMb = (process.memoryUsage().rss / (1024 * 1024)).toFixed(1);
    return `  ◆ KONSO  │  ${title.slice(0, 38)}  │  ${url.slice(0, 42)}  │  ▪ RAM: ${memMb} Megabytes`;
  }

  private displayPage(state: PageState) {
    this.currentTitle = state.title;
    this.currentUrl = state.url;
    this.addressBox.setValue(state.url);
    this.headerBox.setContent(this.formatHeader(state.title, state.url));
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

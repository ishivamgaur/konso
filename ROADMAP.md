# Konso Development Roadmap

> Konso is a terminal based web browser built with TypeScript. You type `konso https://example.com` in your terminal and it fetches, parses, and renders the website right inside your terminal window. No GUI, no Chrome window, just beautifully formatted text with colors, links, and full keyboard navigation.

## How It Works

```
User types URL
    │
    ▼
CLI (cac) parses the command
    │
    ▼
Network (undici) fetches the raw HTML over HTTP/HTTPS
    │
    ▼
HTML Parser (parse5) builds a DOM tree from the HTML string
    │
    ▼
CSS Parser (css-tree) extracts and resolves style rules
    │
    ▼
Renderer maps styled DOM nodes to terminal grid cells (ANSI colors, bold, underline)
    │
    ▼
Terminal UI (blessed) displays the rendered page in a full screen TUI
    │
    ▼
User scrolls, clicks links, navigates back/forward, searches, opens new tabs
```

---

## Phase 1: Core Foundation (`@konso/core`)

The shared backbone that every other package depends on.

- [ ] **Event Emitter**: A typed event system so packages can talk to each other. For example, the browser package emits `navigate` events that the terminal UI listens to for updating the address bar. This avoids tight coupling between packages.

- [ ] **Error Classes**: Custom error types like `KonsoError` (base), `NetworkError` (fetch failures, timeouts, DNS issues), `ParseError` (malformed HTML/CSS), and `RenderError` (layout failures). Each carries structured metadata so we can show helpful messages to the user.

- [ ] **Shared Constants**: Default user agent string, default timeout values, supported protocols, version info. Centralized so every package uses the same values.

---

## Phase 2: Utilities (`@konso/utils`)

Small helper functions used across the entire codebase.

- [ ] **URL Utilities**: Parse, validate, and normalize URLs. Resolve relative URLs against a base (turning `./about` into `https://example.com/about`). Extract hostname, path, query params.

- [ ] **String Helpers**: Truncate strings to fit terminal width with ellipsis. Strip ANSI codes for length calculation. Pad strings for table alignment.

- [ ] **ANSI Color Mapping**: Convert CSS color values (hex, rgb, named colors) to the closest ANSI 256 color code. This is critical for the renderer since terminals only support 256 colors (or 16M in modern terminals).

- [ ] **Debounce and Throttle**: Rate limit keyboard input handling so rapid key presses don't overwhelm the renderer. Essential for smooth scrolling.

---

## Phase 3: Configuration (`@konso/config`)

User settings and preferences with validation.

- [ ] **Config File Loading**: Read from `~/.konso/config.json` on startup. Merge with defaults using zod schemas. Every field has a sensible default so konso works out of the box without any config file.

- [ ] **CLI Flag Overrides**: Flags like `--headless`, `--no-colors`, `--timeout=5000` override config file values. CLI flags always win over the config file.

- [ ] **Theme System**: Define color schemes (dark, light, solarized, custom). Each theme maps semantic names (link color, heading color, text color, background) to ANSI values.

- [ ] **Keybinding Customization**: Let users remap keys. Default vim style (`j/k` scroll, `gg` top, `G` bottom) but customizable to arrow keys or whatever they prefer.

---

## Phase 4: Networking (`@konso/network`)

Fetch web pages from the internet like a real browser.

- [ ] **Cookie Jar**: Store cookies received from `Set-Cookie` headers. Send matching cookies back on subsequent requests. Handle domain, path, expiry, and secure flags properly.

- [ ] **Redirect Following**: Automatically follow 301 (permanent) and 302 (temporary) redirects. Cap at 10 redirects to prevent infinite loops. Track the redirect chain for the devtools.

- [ ] **Request Headers**: Send proper `User-Agent`, `Accept`, `Accept-Language`, `Accept-Encoding` headers. Make konso look like a real browser to avoid getting blocked by websites.

- [ ] **Response Caching**: Cache responses based on `Cache-Control` and `ETag` headers. Store in SQLite via the storage package. Skip network requests for fresh cached pages. This makes revisiting pages instant.

- [ ] **Timeout and Retry**: Configurable timeout (default 30 seconds). Retry failed requests once with exponential backoff. Show progress in the status bar during slow fetches.

- [ ] **Compression**: Handle gzip and brotli compressed responses. Most websites serve compressed HTML to save bandwidth.

---

## Phase 5: HTML Parsing (`@konso/html`)

Turn raw HTML strings into a structured tree we can work with.

- [ ] **DOM Tree Construction**: Use parse5 to parse HTML into a document tree. Each node has a tag name, attributes, children, and parent reference. This mirrors how Chrome builds its DOM internally.

- [ ] **Tree Walker API**: Helper functions to traverse the tree. `querySelector("a")` finds the first link. `querySelectorAll("h1, h2, h3")` finds all headings. `getElementById("main")` finds by ID. These are essential for the renderer and devtools.

- [ ] **Metadata Extraction**: Pull out `<title>` for the title bar, `<meta>` tags for description, `<link rel="icon">` for favicon (displayed as emoji in terminal), and `<base>` for URL resolution.

- [ ] **Form Extraction**: Find `<form>` elements, their `<input>` fields, action URLs, and methods. This enables form filling and submission later.

- [ ] **Malformed HTML Handling**: Real websites have broken HTML everywhere. Missing closing tags, nested tables, invalid nesting. parse5 handles most of this but we need to gracefully degrade when things are truly broken rather than crashing.

---

## Phase 6: CSS Parsing (`@konso/css`)

Understand how elements should look.

- [ ] **Stylesheet Extraction**: Find all `<style>` blocks and `<link rel="stylesheet">` references in the HTML. Fetch external stylesheets via the network package. Handle `@import` rules.

- [ ] **Parse to AST**: Use css-tree to parse CSS text into an abstract syntax tree. Each rule has selectors and declarations (property/value pairs).

- [ ] **Selector Matching**: Given a DOM element, find all CSS rules whose selectors match it. Support tag selectors (`div`), class selectors (`.header`), ID selectors (`#main`), descendant selectors (`nav a`), and pseudo-classes (`:first-child`).

- [ ] **Cascade Resolution**: When multiple rules match the same element, resolve conflicts using CSS specificity rules. Inline styles beat IDs beat classes beat tags. `!important` overrides everything.

- [ ] **Terminal Property Mapping**: Convert CSS properties to terminal capabilities. `font-weight: bold` becomes ANSI bold. `color: red` becomes ANSI red. `text-decoration: underline` becomes ANSI underline. `display: none` hides the element entirely. Properties without terminal equivalents (border-radius, box-shadow, etc.) are silently ignored.

---

## Phase 7: Renderer (Layout Engine) (`@konso/renderer`)

The heart of the project. Converts the styled DOM into a grid of terminal characters.

- [ ] **Terminal Grid**: Create a 2D array of cells, each cell containing a character, foreground color, background color, and attributes (bold, italic, underline). The grid dimensions match the terminal size.

- [ ] **Block Layout**: Block elements (`div`, `p`, `h1`-`h6`, `section`) stack vertically. Each gets the full width. Add vertical spacing between blocks based on margin.

- [ ] **Inline Layout**: Inline elements (`span`, `a`, `strong`, `em`) flow horizontally within a line. When a line runs out of space, wrap to the next line. Handle word boundaries so words don't break mid-word.

- [ ] **Text Rendering**: Convert text nodes to terminal characters. Apply bold for `<strong>` and `<b>`, italic for `<em>` and `<i>`, underline for `<u>`. Handle whitespace collapsing (multiple spaces become one, like browsers do).

- [ ] **Link Rendering**: Detect `<a>` tags and render them as colored, underlined text followed by a reference number like `[1]`. Maintain a link index so pressing `1` navigates to that link.

- [ ] **Heading Rendering**: `<h1>` gets bold + large spacing. `<h2>` gets bold + medium spacing. Scale down through `<h6>`. Maybe add ascii art underlines for `h1`.

- [ ] **List Rendering**: `<ul>` gets bullet points (`•`, `◦`, `▪`). `<ol>` gets numbers. Handle nested lists with indentation.

- [ ] **Table Rendering**: Render `<table>` with box drawing characters (`┌─┬─┐`). Calculate column widths based on content. Handle `colspan` and `rowspan`.

- [ ] **Image Handling**: Display `alt` text in brackets: `[Photo of a sunset]`. Optionally show image dimensions. Future: ASCII art rendering of images.

- [ ] **Horizontal Rules**: Render `<hr>` as a full-width line using `─` characters.

---

## Phase 8: Terminal UI (`@konso/terminal`)

The full screen TUI that the user interacts with.

- [ ] **App Shell**: Blessed screen with three regions: address bar (top), content viewport (center, scrollable), status bar (bottom).

- [ ] **Address Bar**: Editable text input. Type a URL and press Enter to navigate. Shows the current URL. Auto-complete from history (future).

- [ ] **Content Viewport**: Displays the rendered page. Scroll with `j/k` or arrow keys. Page up/down with `Ctrl+u/d`. Jump to top with `gg`, bottom with `G`.

- [ ] **Status Bar**: Shows loading state (spinner via ora), page title, connection info (HTTP/HTTPS), and available keyboard shortcuts.

- [ ] **Tab System**: Open new tabs with `Ctrl+t`. Switch tabs with `Ctrl+1` through `Ctrl+9`. Close tab with `Ctrl+w`. Each tab has independent navigation history.

- [ ] **Link Navigation**: After rendering, links are numbered `[1]`, `[2]`, etc. Press the number to follow that link. Or use `Tab` to cycle through links and `Enter` to activate.

- [ ] **In-Page Search**: Press `/` to open search bar. Type to highlight matches. `n` goes to next match, `N` goes to previous. `Esc` closes search.

- [ ] **Keyboard Shortcuts**: `q` quit, `o` open URL prompt, `b` back, `f` forward, `r` reload, `H` home, `d` toggle devtools, `?` show help.

---

## Phase 9: Browser Orchestration (`@konso/browser`)

Coordinates the entire pipeline.

- [ ] **Navigation Controller**: Manage the sequence: user enters URL → show loading → fetch page → parse HTML → parse CSS → render → display. Handle errors at each step gracefully.

- [ ] **History Stack**: Maintain back/forward history per tab. `b` goes back, `f` goes forward. History stores URLs and scroll positions so going back restores your place on the page.

- [ ] **Page Lifecycle Events**: Emit events at each stage (`loading`, `loaded`, `parsing`, `parsed`, `rendering`, `rendered`, `error`). Plugins and devtools subscribe to these.

- [ ] **Playwright Fallback**: For JavaScript-heavy pages (SPAs like React apps), optionally fall back to Playwright. Launch headless Chromium, let it execute JS, then grab the final rendered HTML. This is slow but handles pages that are blank without JS.

---

## Phase 10: CLI Commands (`@konso/cli`)

The command line interface. This is what users actually type.

- [ ] `konso <url>` : Open the URL in the full screen terminal browser
- [ ] `konso --headless <url>` : Fetch the page and dump rendered text to stdout (for piping)
- [ ] `konso --source <url>` : Fetch and display raw HTML source
- [ ] `konso bookmarks list` : Show saved bookmarks
- [ ] `konso bookmarks add <url> <name>` : Save a bookmark
- [ ] `konso history` : Show browsing history
- [ ] `konso config set <key> <value>` : Update a config value
- [ ] `konso ai summarize <url>` : AI powered page summary

---

## Phase 11: Storage (`@konso/storage`)

Persist data between sessions using SQLite.

- [ ] **Database Setup**: Create `~/.konso/data.db` on first run. Run migrations to create tables. Use better-sqlite3 for synchronous, fast access.

- [ ] **Bookmarks Table**: URL, title, timestamp, tags. CRUD operations. Import/export as JSON.

- [ ] **History Table**: URL, title, visit timestamp, visit count. Auto-prune entries older than 90 days (configurable).

- [ ] **Cookie Storage**: Persist cookies from the cookie jar. Load on startup, save on shutdown. Respect cookie expiry dates.

- [ ] **Cache Table**: URL, response body, headers, timestamp, etag. LRU eviction when cache exceeds size limit (configurable, default 100MB).

---

## Phase 12: Plugin System (`@konso/plugins`)

Make konso extensible.

- [ ] **Plugin Discovery**: Scan `~/.konso/plugins/` for directories containing a `plugin.json` manifest. Each plugin declares its name, version, and hooks.

- [ ] **Plugin API**: Expose hooks that plugins can tap into. `onBeforeRequest(url)` can modify or block requests (ad blocker). `onAfterParse(dom)` can modify the DOM (reader mode). `onBeforeRender(styledDom)` can inject styles.

- [ ] **Plugin Lifecycle**: `activate()` called on load, `deactivate()` called on unload. Plugins can register keyboard shortcuts, add status bar items, and add CLI commands.

---

## Phase 13: Developer Tools (`@konso/devtools`)

Inspect pages like a lightweight Chrome DevTools.

- [ ] **Source Viewer**: Display the raw HTML with syntax highlighting powered by shiki. Line numbers, search, copy.

- [ ] **DOM Inspector**: Tree view of the parsed DOM. Expand/collapse nodes. Select a node to see its computed styles.

- [ ] **Network Log**: Show all HTTP requests made during page load. URL, method, status code, response time, size. Useful for debugging slow pages.

- [ ] **Markdown Renderer**: When navigating to a `.md` file, render it as formatted markdown using remark and rehype instead of showing raw text.

---

## Phase 14: AI Features (`@konso/ai`)

The modern twist that makes konso unique.

- [ ] **Page Summarization**: Send page text content to an LLM and get back a concise summary. Useful for long articles. "TL;DR this page in 3 sentences."

- [ ] **Question Answering**: Ask questions about the current page. "What is the pricing?" or "When was this article published?" The LLM reads the page content and answers.

- [ ] **Smart Navigation**: Tell the AI what you want to do and it figures out which link to click. "Find the login page" or "Go to the documentation." The AI maps your intent to page links.

- [ ] **Provider Selection**: Support multiple AI backends. OpenAI (GPT-4), Anthropic (Claude), Google (Gemini), or a local Ollama instance for privacy. User picks their provider in config.

---

## Milestone Targets

| Milestone | What Works                              | Phases         |
| --------- | --------------------------------------- | -------------- |
| **v0.1**  | Fetch a page and dump text to terminal  | 1, 2, 3, 4, 5  |
| **v0.2**  | Styled rendering with colors and layout | 6, 7           |
| **v0.3**  | Full interactive TUI with navigation    | 8, 9, 10       |
| **v0.4**  | Persistence (bookmarks, history, cache) | 11, 3 (config) |
| **v0.5**  | Plugin system and devtools              | 12, 13         |
| **v1.0**  | AI features, polish, release            | 14             |

---

## What the Final Product Looks Like

```
$ konso https://news.ycombinator.com

┌─ konso ─────────────────────────────────────────────────┐
│ 🌐 https://news.ycombinator.com                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Hacker News                                            │
│                                                         │
│  1. [1] Show HN: Terminal browser written in TS  (42)   │
│  2. [2] Why Rust is eating the world             (187)  │
│  3. [3] SQLite is underrated                     (93)   │
│  4. [4] Building a layout engine from scratch    (28)   │
│  5. [5] The beauty of terminal UIs               (64)   │
│  ...                                                    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ [o]pen [b]ack [f]orward [/]search [q]uit    Loading: ✓  │
└─────────────────────────────────────────────────────────┘
```

/**
 * @konso/html — HTML parsing, DOM walking, and text extraction
 */
import { parse, serialize } from "parse5";

export { parse, serialize };

export function parseHTML(html: string): any {
  return parse(html);
}

export function serializeHTML(document: any): string {
  return serialize(document);
}

export interface ExtractedLink {
  index: number;
  href: string;
  text: string;
}

export interface PageContent {
  title: string;
  text: string;
  links: ExtractedLink[];
  description: string;
}

type Node = any;

// Tags whose content should be hidden
const HIDDEN_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "svg",
  "path",
  "head",
  "meta",
  "link",
  "template",
  "select",
  "option",
  "button",
  "input",
]);

// Block-level elements get newlines before/after
const BLOCK_TAGS = new Set([
  "div",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "section",
  "article",
  "header",
  "footer",
  "nav",
  "main",
  "aside",
  "blockquote",
  "pre",
  "figure",
  "figcaption",
  "details",
  "summary",
  "ul",
  "ol",
  "li",
  "table",
  "tr",
  "td",
  "th",
  "thead",
  "tbody",
  "tfoot",
  "form",
  "fieldset",
  "legend",
  "hr",
  "br",
  "address",
  "dl",
  "dt",
  "dd",
]);

// Heading tags for special rendering
const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

function getTagName(node: Node): string | null {
  return node && typeof node.tagName === "string" ? node.tagName.toLowerCase() : null;
}

function getAttribute(node: Node, name: string): string | null {
  if (!node || !Array.isArray(node.attrs)) return null;
  const attr = node.attrs.find((a: { name: string; value: string }) => a.name === name);
  return attr?.value ?? null;
}

function getClassNames(node: Node): string[] {
  const cls = getAttribute(node, "class");
  return cls ? cls.split(/\s+/) : [];
}

function getChildren(node: Node): Node[] {
  return node && Array.isArray(node.childNodes) ? node.childNodes : [];
}

/**
 * Extract the <title> text from a parsed document.
 */
export function extractTitle(document: Node): string {
  function walk(node: Node): string | null {
    for (const child of getChildren(node)) {
      const tag = getTagName(child);
      if (tag === "title") {
        const text = getChildren(child)
          .filter((c) => typeof c.value === "string")
          .map((c) => c.value)
          .join("");
        return text.trim();
      }
      const found = walk(child);
      if (found) return found;
    }
    return null;
  }
  return walk(document) ?? "";
}

/**
 * Extract meta description from a parsed document.
 */
export function extractDescription(document: Node): string {
  function walk(node: Node): string | null {
    for (const child of getChildren(node)) {
      const tag = getTagName(child);
      if (tag === "meta" && getAttribute(child, "name")?.toLowerCase() === "description") {
        return getAttribute(child, "content") ?? "";
      }
      const found = walk(child);
      if (found) return found;
    }
    return null;
  }
  return walk(document) ?? "";
}

/**
 * Walk the DOM tree and extract readable text with structural formatting.
 * Returns formatted text and collected links.
 */
export function extractContent(document: Node): PageContent {
  const links: ExtractedLink[] = [];
  let linkIndex = 0;
  const title = extractTitle(document);
  const description = extractDescription(document);

  function walkNode(node: Node): string {
    const parts: string[] = [];

    for (const child of getChildren(node)) {
      const tag = getTagName(child);
      const classes = getClassNames(child);
      const id = getAttribute(child, "id");

      // Skip hidden elements & form controls / dropdowns / search nav / feedback popups
      if (tag && HIDDEN_TAGS.has(tag)) continue;
      if (
        classes.includes("nav") ||
        classes.includes("dropdown") ||
        classes.includes("header-nav") ||
        classes.includes("user-agent") ||
        classes.includes("filters") ||
        id === "feedback" ||
        id === "footer"
      ) {
        continue;
      }

      if (typeof child.value === "string") {
        // Collapse whitespace in text nodes
        const text = child.value.replace(/\s+/g, " ");
        if (text.trim()) {
          parts.push(text);
        }
        continue;
      }

      const isBlock = tag ? BLOCK_TAGS.has(tag) : false;
      const isHeading = tag ? HEADING_TAGS.has(tag) : false;

      // Special tag handling
      if (tag === "br") {
        parts.push("\n");
        continue;
      }

      if (tag === "hr") {
        parts.push("\n" + "─".repeat(60) + "\n");
        continue;
      }

      // Handle links
      if (tag === "a") {
        const href = getAttribute(child, "href");
        const innerText = walkNode(child).trim();
        if (href && innerText && !href.startsWith("#") && !href.startsWith("javascript:")) {
          linkIndex++;
          links.push({ index: linkIndex, href, text: innerText });
          parts.push(`${innerText} [${linkIndex}]`);
        } else if (innerText) {
          parts.push(innerText);
        }
        continue;
      }

      // Handle lists
      if (tag === "li") {
        const parentTag = getTagName(node);
        const bullet =
          parentTag === "ol"
            ? `  ${parts.filter((p) => p.includes("•") || p.includes(".")).length + 1}. `
            : "  • ";
        const innerText = walkNode(child).trim();
        if (innerText) {
          parts.push("\n" + bullet + innerText);
        }
        continue;
      }

      // Handle table cells
      if (tag === "td" || tag === "th") {
        const innerText = walkNode(child).trim();
        parts.push(innerText + "\t");
        continue;
      }

      if (tag === "tr") {
        const innerText = walkNode(child).trim();
        parts.push("\n" + innerText);
        continue;
      }

      // Handle img alt text
      if (tag === "img") {
        const alt = getAttribute(child, "alt");
        if (alt) {
          parts.push(`[${alt}]`);
        }
        continue;
      }

      // Handle blockquotes
      if (tag === "blockquote") {
        const innerText = walkNode(child).trim();
        if (innerText) {
          const quoted = innerText
            .split("\n")
            .map((line) => "  │ " + line)
            .join("\n");
          parts.push("\n" + quoted + "\n");
        }
        continue;
      }

      // Handle pre/code
      if (tag === "pre") {
        const innerText = walkNode(child);
        parts.push("\n```\n" + innerText.trim() + "\n```\n");
        continue;
      }

      // Recurse into children
      const innerText = walkNode(child);

      if (isHeading && tag) {
        const level = parseInt(tag[1]!);
        const prefix = level <= 2 ? "═".repeat(40) : "─".repeat(30);
        parts.push("\n\n" + innerText.trim().toUpperCase() + "\n" + prefix + "\n");
        continue;
      }

      if (isBlock) {
        parts.push("\n" + innerText.trim() + "\n");
      } else {
        parts.push(innerText);
      }
    }

    return parts.join("");
  }

  // Find <body> or fall back to document
  let rootNode: Node = document;
  function findBody(node: Node): Node | null {
    for (const child of getChildren(node)) {
      if (getTagName(child) === "body") {
        return child;
      }
      const found = findBody(child);
      if (found) return found;
    }
    return null;
  }
  const body = findBody(document);
  if (body) rootNode = body;

  let text = walkNode(rootNode);

  // Strip top navigation clutter on search result pages
  if (text.includes("Web results")) {
    const idx = text.indexOf("Web results");
    text = text.slice(idx);
  }

  // Clean up feedback / rating popups at bottom of search pages
  text = text.replace(/How would you rate your experience[\s\S]*/i, "").trim();

  // Clean up excessive newlines
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return { title, text, links, description };
}

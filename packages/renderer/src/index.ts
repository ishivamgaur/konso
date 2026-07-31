/**
 * @konso/renderer — Transforms parsed HTML into styled terminal text & renders images
 */
import chalk from "chalk";
import { parseHTML, extractContent } from "@konso/html";
import type { ExtractedLink } from "@konso/html";
import { wordWrap } from "@konso/utils";

export { decodeImage, renderImageToAnsi } from "./image.js";
export type { PixelData } from "./image.js";

export interface RenderResult {
  text: string;
  links: ExtractedLink[];
  title: string;
  description: string;
}

/**
 * Render raw HTML into formatted, colorized terminal text.
 */
export function renderToText(html: string, width: number = 80): RenderResult {
  const document = parseHTML(html);
  const content = extractContent(document);

  // Apply terminal styling
  let text = content.text;

  // Style link references [N] with cyan
  text = text.replace(/\[(\d+)\]/g, (_match, num) => {
    return chalk.cyan.bold(`[${num}]`);
  });

  // Style headings (lines followed by ═ or ─ lines)
  text = text.replace(/^(.+)\n(═{10,})/gm, (_match, heading, underline) => {
    return chalk.bold.yellow(heading) + "\n" + chalk.dim(underline);
  });
  text = text.replace(/^(.+)\n(─{10,})/gm, (_match, heading, underline) => {
    return chalk.bold.cyan(heading) + "\n" + chalk.dim(underline);
  });

  // Style horizontal rules
  text = text.replace(/^─{40,}$/gm, (match) => chalk.dim(match));

  // Style blockquote markers
  text = text.replace(/^ {2}│ /gm, chalk.dim("  │ "));

  // Style code blocks
  text = text.replace(/```\n([\s\S]*?)```/g, (_match, code) => {
    return chalk.dim("```") + "\n" + chalk.green(code) + chalk.dim("```");
  });

  // Style bullet points
  text = text.replace(/^ {2}• /gm, chalk.yellow("  • "));

  // Word wrap to terminal width (leaving some margin)
  const effectiveWidth = Math.max(width - 4, 40);
  text = wordWrap(text, effectiveWidth);

  return {
    text,
    links: content.links,
    title: content.title || "Untitled",
    description: content.description,
  };
}

/**
 * Format a link list for display (e.g., in a help/footer section).
 */
export function formatLinkList(links: ExtractedLink[]): string {
  if (links.length === 0) return chalk.dim("  No links found on this page.");

  return links
    .slice(0, 50)
    .map(
      (link) =>
        `  ${chalk.cyan.bold(`[${link.index}]`)} ${chalk.white(link.text)} ${chalk.dim("→")} ${chalk.underline.blue(link.href)}`,
    )
    .join("\n");
}

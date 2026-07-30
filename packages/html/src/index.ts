/**
 * @konso/html — HTML parsing with parse5
 */
import { parse, serialize } from "parse5";

export function parseHTML(html: string) {
  return parse(html);
}

export function serializeHTML(document: ReturnType<typeof parse>) {
  return serialize(document);
}

export { parse, serialize } from "parse5";

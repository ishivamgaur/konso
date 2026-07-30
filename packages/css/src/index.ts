/**
 * @konso/css — CSS parsing with css-tree
 */
import { parse, generate, type CssNode } from "css-tree";

export function parseCSS(css: string): CssNode {
  return parse(css);
}

export function generateCSS(ast: CssNode): string {
  return generate(ast);
}

export { parse, generate } from "css-tree";

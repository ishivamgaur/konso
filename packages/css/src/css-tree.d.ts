declare module "css-tree" {
  export function parse(css: string, options?: any): any;
  export function generate(ast: any, options?: any): string;
  export type CssNode = any;
}

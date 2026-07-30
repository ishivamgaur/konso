/**
 * @konso/config — Configuration management
 */
import { z } from "zod";

const ConfigSchema = z.object({
  browser: z.object({
    headless: z.boolean().default(true),
    timeout: z.number().default(30_000),
  }).default({}),
  network: z.object({
    userAgent: z.string().default("Konso/0.0.1"),
    maxRedirects: z.number().default(10),
  }).default({}),
  terminal: z.object({
    theme: z.enum(["dark", "light"]).default("dark"),
    colors: z.boolean().default(true),
  }).default({}),
  storage: z.object({
    dbPath: z.string().default(".konso/data.db"),
  }).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

export function defineConfig(input: z.input<typeof ConfigSchema> = {}): Config {
  return ConfigSchema.parse(input);
}

export { ConfigSchema };

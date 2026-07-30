import { z } from "zod";

export const KonsoConfigSchema = z.object({
  headless: z.boolean().default(false),
  userAgent: z.string().default("Konso/0.0.1"),
  timeout: z.number().default(30_000),
  viewport: z.object({
    width: z.number().default(120),
    height: z.number().default(40),
  }).default({}),
});

export type KonsoConfig = z.infer<typeof KonsoConfigSchema>;

export interface Plugin {
  name: string;
  version: string;
  setup: () => Promise<void>;
  teardown?: () => Promise<void>;
}

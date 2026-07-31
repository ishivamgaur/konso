/**
 * @konso/renderer — Terminal Image Renderer
 * Converts PNG and JPEG image buffers into high-resolution 24-bit ANSI block art.
 */
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import chalk from "chalk";

export interface PixelData {
  width: number;
  height: number;
  data: Uint8Array | Buffer;
}

/**
 * Decode image buffer (PNG or JPEG) to raw RGBA pixel data.
 */
export function decodeImage(buffer: Buffer): PixelData | null {
  try {
    // Try PNG
    const png = PNG.sync.read(buffer);
    return { width: png.width, height: png.height, data: png.data };
  } catch {
    try {
      // Try JPEG
      const raw = jpeg.decode(buffer, { useTArray: true });
      return { width: raw.width, height: raw.height, data: raw.data };
    } catch {
      return null;
    }
  }
}

/**
 * Convert pixel data into 24-bit ANSI block art text.
 */
export function renderImageToAnsi(pixelData: PixelData, maxWidth: number = 50): string {
  const { width: origWidth, height: origHeight, data } = pixelData;

  // Terminal cells are roughly 1:2 aspect ratio (twice as tall as wide)
  // Half-block character '▀' displays 2 vertical pixels in 1 character cell.
  const targetWidth = Math.min(maxWidth, origWidth);
  const targetHeight = Math.round((origHeight / origWidth) * targetWidth);

  const lines: string[] = [];

  for (let y = 0; y < targetHeight; y += 2) {
    let line = "";
    for (let x = 0; x < targetWidth; x++) {
      // Map target cell back to original image pixel coordinates
      const origX = Math.floor((x / targetWidth) * origWidth);
      const origYTop = Math.floor((y / targetHeight) * origHeight);
      const origYBot = Math.floor(((y + 1) / targetHeight) * origHeight);

      // Top pixel color
      const topIdx = (origYTop * origWidth + origX) * 4;
      const r1 = data[topIdx] ?? 0;
      const g1 = data[topIdx + 1] ?? 0;
      const b1 = data[topIdx + 2] ?? 0;

      // Bottom pixel color
      const botIdx = (origYBot * origWidth + origX) * 4;
      const r2 = data[botIdx] ?? 0;
      const g2 = data[botIdx + 1] ?? 0;
      const b2 = data[botIdx + 2] ?? 0;

      // Render top pixel as foreground and bottom pixel as background using '▀'
      line += chalk.rgb(r1, g1, b1).bgRgb(r2, g2, b2)("▀");
    }
    lines.push(line);
  }

  return lines.join("\n");
}

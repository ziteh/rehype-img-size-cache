import fs from 'node:fs';
import path from 'node:path';
import sizeOf from 'image-size';
import { isRemoteUrl } from './urlResolver';
import type { ImageSize } from '../types';

const USER_AGENT =
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0';

const FETCH_TIMEOUT_MS = 10000;

// Enough to cover large EXIF blocks before giving up
const MAX_PROBE_BYTES = 1024 * 1024;

function tryParseSize(buffer: Buffer): ImageSize | null {
  try {
    const dimensions = sizeOf(buffer);
    if (dimensions?.width && dimensions?.height) {
      return { width: dimensions.width, height: dimensions.height };
    }
  } catch {
    // Not enough data yet, keep reading
  }
  return null;
}

async function getRemoteImageSize(src: string): Promise<ImageSize | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(src, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      return null;
    }

    const reader = response.body.getReader();
    let buffer = Buffer.alloc(0);
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          return null;
        }

        buffer = Buffer.concat([buffer, value]);
        const size = tryParseSize(buffer);
        if (size) {
          return size;
        }
        if (buffer.length >= MAX_PROBE_BYTES) {
          return null;
        }
      }
    } finally {
      reader.cancel().catch(() => {});
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

function getLocalImageSize(src: string, baseDir: string): ImageSize | null {
  const imagePath = path.isAbsolute(src) ? src : path.resolve(baseDir, src);

  if (!fs.existsSync(imagePath)) {
    console.warn(`Local image file does not exist: ${imagePath}`);
    return null;
  }

  const dimensions = sizeOf(fs.readFileSync(imagePath));
  if (!dimensions?.width || !dimensions?.height) {
    console.warn(`Unable to get image dimensions: ${src}`);
    return null;
  }

  return { width: dimensions.width, height: dimensions.height };
}

export async function getImageSize(
  src: string,
  baseDir: string = process.cwd(),
): Promise<ImageSize | null> {
  try {
    if (isRemoteUrl(src)) {
      const size = await getRemoteImageSize(src);
      if (!size) {
        console.warn(`Unable to get image dimensions: ${src}`);
      }
      return size;
    }
    return getLocalImageSize(src, baseDir);
  } catch (error) {
    console.error(
      `Error occurred while fetching image dimensions ${src}:`,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

import fs from 'node:fs';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import type { ImageSizeCache, ImageSizeCacheArray } from '../types';

function arrayToObject(cacheArray: ImageSizeCacheArray): ImageSizeCache {
  const cache: ImageSizeCache = {};
  for (const entry of cacheArray) {
    cache[entry.url] = {
      width: entry.width,
      height: entry.height,
    };
  }
  return cache;
}

function objectToArray(cache: ImageSizeCache): ImageSizeCacheArray {
  return Object.entries(cache).map(([url, { width, height }]) => ({
    url,
    width,
    height,
  }));
}

export function readCache(cacheFilePath: string): ImageSizeCache {
  try {
    if (fs.existsSync(cacheFilePath)) {
      const fileContents = fs.readFileSync(cacheFilePath, 'utf8');
      const parsed = parse(fileContents);

      if (Array.isArray(parsed)) {
        return arrayToObject(parsed as ImageSizeCacheArray);
      }
    }
  } catch (error) {
    console.warn(
      'Error reading cache file:',
      error instanceof Error ? error.message : String(error),
    );
  }
  return {};
}

export function writeCache(cacheFilePath: string, cache: ImageSizeCache): void {
  try {
    const dir = path.dirname(cacheFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const cacheArray = objectToArray(cache);
    const yamlStr = stringify(cacheArray);
    fs.writeFileSync(cacheFilePath, yamlStr, 'utf8');
  } catch (error) {
    console.warn(
      'Error writing cache file:',
      error instanceof Error ? error.message : String(error),
    );
  }
}

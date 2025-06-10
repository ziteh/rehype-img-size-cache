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

function readCacheFromFile(cacheFilePath: string): ImageSizeCache {
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

function writeCacheToFile(cacheFilePath: string, cache: ImageSizeCache): void {
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

export function readCache(cacheFilePath: string): ImageSizeCache {
  return readCacheFromFile(cacheFilePath);
}

/**
 * Thread-safe cache update function
 * Reads the latest cache from file, merges with new entries, and writes back
 * @returns true if update was successful, false otherwise
 */
export function updateCache(
  cacheFilePath: string,
  newEntries: ImageSizeCache,
): boolean {
  try {
    const dir = path.dirname(cacheFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Read the latest cache from file to get any updates from other processes
    const latestCache = readCacheFromFile(cacheFilePath);

    // Merge new entries with latest cache
    const mergedCache = { ...latestCache, ...newEntries };

    // Write the merged cache back to file
    writeCacheToFile(cacheFilePath, mergedCache);
    return true;
  } catch (error) {
    console.warn(
      'Error updating cache file:',
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}

export function writeCache(cacheFilePath: string, cache: ImageSizeCache): void {
  writeCacheToFile(cacheFilePath, cache);
}

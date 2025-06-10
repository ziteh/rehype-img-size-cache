import { visit } from 'unist-util-visit';
import { resolve } from 'node:path';
import { getImageSize } from './utils/imageSize';
import { readCache, updateCache } from './utils/cache';
import { isRemoteUrl, shouldSkipUrl } from './utils/urlResolver';
import type { RehypeImgSizeCacheOptions } from './types';
import type { Node } from 'unist';
import type { Element } from 'hast';

export default function rehypeImgSizeCache(
  options: RehypeImgSizeCacheOptions = {},
) {
  const {
    cacheFilePath = resolve(process.cwd(), 'cache/image-sizes.yaml'),
    processRemoteImages = true,
  } = options;

  return async (tree: Node) => {
    const cache = readCache(cacheFilePath);
    const newCacheEntries: {
      [url: string]: { width: number; height: number };
    } = {};

    // Collect all images to process
    const imagesToProcess: Array<{ node: Element; src: string }> = [];

    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'img' && node.properties?.src) {
        const src = node.properties.src as string;

        // Skip data URLs and blob URLs (cannot be processed)
        if (shouldSkipUrl(src)) {
          return;
        }

        // Skip remote images if processRemoteImages is false
        const isRemoteImage = isRemoteUrl(src);
        if (isRemoteImage && !processRemoteImages) {
          return;
        }

        // Only process images that we can handle
        imagesToProcess.push({ node, src });
      }
    });

    // Process each image
    for (const { node, src } of imagesToProcess) {
      try {
        if (cache[src]) {
          // Read size from cache
          node.properties = node.properties || {};
          node.properties.width = cache[src].width;
          node.properties.height = cache[src].height;
          console.log(
            `Read size from cache: ${src} (${cache[src].width}x${cache[src].height})`,
          );
        } else {
          // Get new image size
          const size = await getImageSize(src);
          if (size) {
            node.properties = node.properties || {};
            node.properties.width = size.width;
            node.properties.height = size.height;
            newCacheEntries[src] = size;
            console.log(
              `Fetched and cached image size: ${src} (${size.width}x${size.height})`,
            );
          } else {
            console.warn(`Unable to get image dimensions: ${src}`);
          }
        }
      } catch (error) {
        console.error(
          `Error occurred while processing image ${src}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    // If we have new cache entries, update the cache file (thread-safe)
    if (Object.keys(newCacheEntries).length > 0) {
      const success = updateCache(cacheFilePath, newCacheEntries);
      if (success) {
        console.log(`Cache updated and saved to: ${cacheFilePath}`);
      }
    }
  };
}

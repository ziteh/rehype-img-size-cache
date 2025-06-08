import { visit } from 'unist-util-visit';
import { resolve } from 'node:path';
import { getImageSize } from './utils/imageSize';
import { readCache, writeCache } from './utils/cache';
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
    let cacheUpdated = false;

    // Collect all images to process
    const imagesToProcess: Array<{ node: Element; src: string }> = [];

    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'img' && node.properties?.src) {
        const src = node.properties.src as string;
        // Skip data URLs and other non-standard URLs
        if (!src.startsWith('data:') && !src.startsWith('blob:')) {
          imagesToProcess.push({ node, src });
        }
      }
    });

    // Process each image
    for (const { node, src } of imagesToProcess) {
      try {
        const isRemoteImage = /^https?:\/\//.test(src);

        // Skip remote images if processRemoteImages is false
        if (isRemoteImage && !processRemoteImages) {
          continue;
        }

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
            cache[src] = size;
            cacheUpdated = true;
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

    // If cache is updated, write to file
    if (cacheUpdated) {
      writeCache(cacheFilePath, cache);
      console.log(`Cache updated and saved to: ${cacheFilePath}`);
    }
  };
}

import { visit } from 'unist-util-visit';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { getImageSize } from './utils/imageSize';
import { readCache, updateCache } from './utils/cache';
import { isRemoteUrl, shouldSkipUrl } from './utils/urlResolver';
import type {
  RehypeImgSizeCacheOptions,
  ImageSize,
  SrcsetOptions,
} from './types';
import type { Node } from 'unist';
import type { Element } from 'hast';
import type { VFile } from 'vfile';

function applySrcset(
  node: Element,
  src: string,
  size: ImageSize,
  srcset: SrcsetOptions,
): void {
  if (srcset.match && !srcset.match(src)) {
    return;
  }

  const variantWidths = srcset.widths.filter((width) => width < size.width);
  if (variantWidths.length === 0) {
    return;
  }

  const srcSet = [
    ...variantWidths.map((width) => `${srcset.url(src, width)} ${width}w`),
    `${src} ${size.width}w`,
  ].join(', ');

  node.properties = node.properties || {};
  node.properties.srcSet = srcSet;
  if (srcset.sizes) {
    node.properties.sizes = srcset.sizes;
  }
}

// Local paths are cache keys relative to process.cwd(), so two articles
// that both use e.g. `./img/a.webp` don't collide on the same cache entry.
function getCacheKey(src: string, baseDir: string): string {
  if (isRemoteUrl(src)) {
    return src;
  }

  const absolutePath = isAbsolute(src) ? src : resolve(baseDir, src);
  const relativePath = relative(process.cwd(), absolutePath);
  const posixPath = relativePath.split(sep).join('/');
  const isParentRelative = posixPath === '..' || posixPath.startsWith('../');
  return isParentRelative ? posixPath : `./${posixPath}`;
}

export default function rehypeImgSizeCache(
  options: RehypeImgSizeCacheOptions = {},
) {
  const {
    cacheFilePath = resolve(process.cwd(), 'cache/image-sizes.yaml'),
    processRemoteImages = true,
    verbose = false,
    srcset,
  } = options;

  return async (tree: Node, file: VFile) => {
    const cache = readCache(cacheFilePath);
    const newCacheEntries: {
      [url: string]: { width: number; height: number };
    } = {};

    const baseDir = file?.path ? dirname(file.path) : process.cwd();

    // Collect all images to process
    const imagesToProcess: Array<{
      node: Element;
      src: string;
      cacheKey: string;
    }> = [];

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
        imagesToProcess.push({
          node,
          src,
          cacheKey: getCacheKey(src, baseDir),
        });
      }
    });

    // Fetch each distinct cache-miss src once, in parallel
    const uncached = imagesToProcess.filter(({ cacheKey }) => !cache[cacheKey]);
    const uncachedSrcs = [...new Set(uncached.map(({ src }) => src))];
    const sizeBySrc = new Map<string, ImageSize>();

    await Promise.all(
      uncachedSrcs.map(async (src) => {
        try {
          const size = await getImageSize(src, baseDir);
          if (size) {
            sizeBySrc.set(src, size);
            console.log(
              `Fetched and cached image size: ${src} (${size.width}x${size.height})`,
            );
          }
        } catch (error) {
          console.error(
            `Error occurred while processing image ${src}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }),
    );

    for (const { node, src, cacheKey } of uncached) {
      const size = sizeBySrc.get(src);
      if (!size) {
        continue;
      }

      node.properties = node.properties || {};
      node.properties.width = size.width;
      node.properties.height = size.height;
      newCacheEntries[cacheKey] = size;
      if (srcset) {
        applySrcset(node, src, size, srcset);
      }
    }

    // Apply cache hits
    for (const { node, src, cacheKey } of imagesToProcess) {
      const cached = cache[cacheKey];
      if (!cached) {
        continue;
      }

      node.properties = node.properties || {};
      node.properties.width = cached.width;
      node.properties.height = cached.height;
      if (verbose) {
        console.log(
          `Read size from cache: ${src} (${cached.width}x${cached.height})`,
        );
      }
      if (srcset) {
        applySrcset(node, src, cached, srcset);
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

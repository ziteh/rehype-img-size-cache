import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import rehypeImgSizeCache from '../src';
import * as cacheUtils from '../src/utils/cache';
import * as imageSizeUtils from '../src/utils/imageSize';
import { ImageSizeCache } from '../src/types';

// Mock the cache and image size utilities
vi.mock('../src/utils/cache');
vi.mock('../src/utils/imageSize');

describe('rehype-img-size-cache integration tests', () => {
  const mockCache: ImageSizeCache = {};
  let cacheUpdated = false;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock cache
    Object.keys(mockCache).forEach((key) => delete mockCache[key]);
    cacheUpdated = false;

    // Mock readCache() to return our mock cache
    vi.mocked(cacheUtils.readCache).mockImplementation(() => mockCache);

    // Mock updateCache() to simulate cache updating
    vi.mocked(cacheUtils.updateCache).mockImplementation(
      (_path, newEntries) => {
        Object.assign(mockCache, newEntries);
        cacheUpdated = true;
        return true;
      },
    );

    // Mock writeCache() to simulate cache writing (still needed for some tests)
    vi.mocked(cacheUtils.writeCache).mockImplementation((_path, cache) => {
      Object.assign(mockCache, cache);
      cacheUpdated = true;
    });

    // Mock getImageSize() to return predefined sizes
    vi.mocked(imageSizeUtils.getImageSize).mockImplementation(
      async (src: string) => {
        // Simulate different image sizes based on URL
        if (src.includes('400/300')) {
          return { width: 400, height: 300 };
        } else if (src.includes('600x400')) {
          return { width: 600, height: 400 };
        } else if (src.includes('800/200')) {
          return { width: 800, height: 200 };
        } else if (src.includes('local-image.jpg')) {
          return { width: 1024, height: 768 };
        } else if (src.includes('invalid-image')) {
          return null; // Simulate failed image size detection
        }
        return { width: 500, height: 500 }; // Default size
      },
    );
  });

  test('Should add width and height attributes to remote images', async () => {
    const markdown = `
# Test

![img1](https://picsum.photos/400/300)
![img2](https://example.com/image-600x400.jpg)
`;

    const processor = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeImgSizeCache, {
        cacheFilePath: './mock-cache.yaml',
        processRemoteImages: true,
      })
      .use(rehypeStringify);

    const result = await processor.process(markdown);
    const html = result.toString();

    // Check if the images have width and height attributes
    expect(html).toContain('width="400"');
    expect(html).toContain('height="300"');
    expect(html).toContain('width="600"');
    expect(html).toContain('height="400"');

    // Check if the cache file was updated
    expect(cacheUpdated).toBe(true);
    expect(mockCache['https://picsum.photos/400/300']).toEqual({
      width: 400,
      height: 300,
    });
    expect(mockCache['https://example.com/image-600x400.jpg']).toEqual({
      width: 600,
      height: 400,
    });
  });

  test('Should read image width and height from the cache', async () => {
    // Set up some data in the cache
    mockCache['https://cached-image.jpg'] = { width: 1200, height: 800 };

    const markdown = `
![cached img](https://cached-image.jpg)
![new img](https://picsum.photos/800/200)
`;

    const processor = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeImgSizeCache, {
        cacheFilePath: './mock-cache.yaml',
        processRemoteImages: true,
      })
      .use(rehypeStringify);

    const result = await processor.process(markdown);
    const html = result.toString();

    // Check cached image
    expect(html).toContain('width="1200"');
    expect(html).toContain('height="800"');

    // Check new image
    expect(html).toContain('width="800"');
    expect(html).toContain('height="200"');

    // Check if getImageSize() was called only once (for the new image)
    expect(imageSizeUtils.getImageSize).toHaveBeenCalledTimes(1);
    expect(imageSizeUtils.getImageSize).toHaveBeenCalledWith(
      'https://picsum.photos/800/200',
      expect.any(String),
    );
  });

  test('Should not log cache hits by default (verbose: false)', async () => {
    mockCache['https://cached-image.jpg'] = { width: 1200, height: 800 };

    const markdown = `![cached img](https://cached-image.jpg)`;

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const processor = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeImgSizeCache, { cacheFilePath: './mock-cache.yaml' })
      .use(rehypeStringify);

    await processor.process(markdown);

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test('Should log cache hits when verbose is true', async () => {
    mockCache['https://cached-image.jpg'] = { width: 1200, height: 800 };

    const markdown = `![cached img](https://cached-image.jpg)`;

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const processor = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeImgSizeCache, {
        cacheFilePath: './mock-cache.yaml',
        verbose: true,
      })
      .use(rehypeStringify);

    await processor.process(markdown);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Read size from cache'),
    );

    consoleSpy.mockRestore();
  });

  test('Should skip remote images when processRemoteImages is false.', async () => {
    const markdown = `
![remote img](https://example.com/remote.jpg)
![local img](./local-image.jpg)
`;

    const processor = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeImgSizeCache, {
        cacheFilePath: './mock-cache.yaml',
        processRemoteImages: false,
      })
      .use(rehypeStringify);

    const result = await processor.process(markdown);
    const html = result.toString();

    // Remote image should not have width and height attributes
    expect(html).not.toContain('width="500"'); // Default size

    // Local image should have width and height attributes
    expect(html).toContain('width="1024"');
    expect(html).toContain('height="768"');

    // Should call getImageSize() only once (for the local image)
    expect(imageSizeUtils.getImageSize).toHaveBeenCalledTimes(1);
    expect(imageSizeUtils.getImageSize).toHaveBeenCalledWith(
      './local-image.jpg',
      expect.any(String),
    );
  });

  test('Should skip data URL and blob URL', async () => {
    const markdown = `
![data url](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==)
![blob url](blob:https://example.com/123-456-789)
![normal img](https://example.com/normal.jpg)
`;

    const processor = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeImgSizeCache, {
        cacheFilePath: './mock-cache.yaml',
        processRemoteImages: true,
      })
      .use(rehypeStringify);

    const result = await processor.process(markdown);
    const html = result.toString();

    // data URL and blob URL should not be processed
    expect(imageSizeUtils.getImageSize).toHaveBeenCalledTimes(1);
    expect(imageSizeUtils.getImageSize).toHaveBeenCalledWith(
      'https://example.com/normal.jpg',
      expect.any(String),
    );

    // Only the normal image should have width and height attributes
    expect(html).toContain('width="500"');
    expect(html).toContain('height="500"');
  });

  test('Should handle image size acquisition failures.', async () => {
    const markdown = `
![valid img](https://picsum.photos/400/300)
![invalid img](https://example.com/invalid-image.jpg)
`;

    const processor = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeImgSizeCache, {
        cacheFilePath: './mock-cache.yaml',
        processRemoteImages: true,
      })
      .use(rehypeStringify);

    const result = await processor.process(markdown);
    const html = result.toString();

    // Valid image should have width and height attributes
    expect(html).toContain('width="400"');
    expect(html).toContain('height="300"');

    // Invalid image should not have width and height attributes
    expect(html).toContain(
      '<img src="https://example.com/invalid-image.jpg" alt="invalid img">',
    );

    // Invalid image should not be in the cache
    expect(mockCache['https://example.com/invalid-image.jpg']).toBeUndefined();
    expect(mockCache['https://picsum.photos/400/300']).toEqual({
      width: 400,
      height: 300,
    });
  });

  test('Should handle images without alt attributes.', async () => {
    const markdown = `
![](https://picsum.photos/400/300)
`;

    const processor = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeImgSizeCache, {
        cacheFilePath: './mock-cache.yaml',
        processRemoteImages: true,
      })
      .use(rehypeStringify);

    const result = await processor.process(markdown);
    const html = result.toString();

    expect(html).toContain('width="400"');
    expect(html).toContain('height="300"');
    expect(html).toContain('<img src="https://picsum.photos/400/300" alt=""');
  });

  test('Should handle complex Markdown structures.', async () => {
    const markdown = `
# Title

This is a paragraph.

## Image Block

![img1](https://picsum.photos/400/300)

- List item 1
- List item 2 ![inline img](https://example.com/inline.jpg)
- List item 3

> Blockquote
>
> ![blockquote img](https://picsum.photos/800/200)

\`\`\`javascript
// Code block
console.log('hello');
\`\`\`

Ref: ![final img](https://example.com/final.jpg)
`;

    const processor = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeImgSizeCache, {
        cacheFilePath: './mock-cache.yaml',
        processRemoteImages: true,
      })
      .use(rehypeStringify);

    const result = await processor.process(markdown);
    const html = result.toString();

    // Check image in paragraph
    expect(html).toContain('width="400"');
    expect(html).toContain('height="300"');
    expect(html).toContain('width="500"');
    expect(html).toContain('width="800"');
    expect(html).toContain('height="200"');

    // Check if getImageSize() was called for each image
    expect(imageSizeUtils.getImageSize).toHaveBeenCalledTimes(4);

    // Check if cache was updated
    expect(cacheUpdated).toBe(true);
    expect(Object.keys(mockCache)).toHaveLength(4);
  });

  test('Should use default configuration options', async () => {
    const markdown = `![test](https://picsum.photos/400/300)`;

    const processor = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeImgSizeCache) // No options provided, should use defaults
      .use(rehypeStringify);

    const result = await processor.process(markdown);
    const html = result.toString();

    expect(html).toContain('width="400"');
    expect(html).toContain('height="300"');

    // Check if readCache() was called with the default cache file path
    expect(cacheUtils.readCache).toHaveBeenCalledWith(
      expect.stringMatching(/cache[\/\\]image-sizes\.yaml$/),
    );
  });

  test('Should generate srcset with widths smaller than the original, ending with the original width', async () => {
    const markdown = `![img](https://example.com/image-600x400.jpg)`;

    const processor = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeImgSizeCache, {
        cacheFilePath: './mock-cache.yaml',
        srcset: {
          widths: [200, 400, 600, 800],
          url: (src: string, width: number) => `${src}?w=${width}`,
        },
      })
      .use(rehypeStringify);

    const result = await processor.process(markdown);
    const html = result.toString();

    expect(html).toContain(
      'srcset="https://example.com/image-600x400.jpg?w=200 200w, https://example.com/image-600x400.jpg?w=400 400w, https://example.com/image-600x400.jpg 600w"',
    );
  });

  test('Should output the sizes attribute when provided', async () => {
    const markdown = `![img](https://example.com/image-600x400.jpg)`;

    const processor = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeImgSizeCache, {
        cacheFilePath: './mock-cache.yaml',
        srcset: {
          widths: [200, 400],
          url: (src: string, width: number) => `${src}?w=${width}`,
          sizes: '(max-width: 600px) 100vw, 600px',
        },
      })
      .use(rehypeStringify);

    const result = await processor.process(markdown);
    const html = result.toString();

    expect(html).toContain('sizes="(max-width: 600px) 100vw, 600px"');
  });

  test('Should exclude images that do not satisfy the match predicate', async () => {
    const markdown = `
![matched](https://example.com/image-600x400.jpg)
![unmatched](https://picsum.photos/400/300)
`;

    const processor = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeImgSizeCache, {
        cacheFilePath: './mock-cache.yaml',
        srcset: {
          widths: [200, 400],
          url: (src: string, width: number) => `${src}?w=${width}`,
          match: (src: string) => src.includes('example.com'),
        },
      })
      .use(rehypeStringify);

    const result = await processor.process(markdown);
    const html = result.toString();

    expect(html).toContain('image-600x400.jpg?w=200');
    expect(html).not.toContain('picsum.photos/400/300?w=');
  });

  test('Should not output srcset for images without a resolved size', async () => {
    const markdown = `![invalid img](https://example.com/invalid-image.jpg)`;

    const processor = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeImgSizeCache, {
        cacheFilePath: './mock-cache.yaml',
        srcset: {
          widths: [200, 400],
          url: (src: string, width: number) => `${src}?w=${width}`,
        },
      })
      .use(rehypeStringify);

    const result = await processor.process(markdown);
    const html = result.toString();

    expect(html).not.toContain('srcset');
  });

  test('Should resolve local relative paths against the source file location', async () => {
    const markdown = `![img](./local-image.jpg)`;

    const processor = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeImgSizeCache, {
        cacheFilePath: './mock-cache.yaml',
        processRemoteImages: true,
      })
      .use(rehypeStringify);

    await processor.process({
      value: markdown,
      path: '/posts/my-post/index.md',
    });

    expect(imageSizeUtils.getImageSize).toHaveBeenCalledWith(
      './local-image.jpg',
      '/posts/my-post',
    );
  });

  test('Should cache same-named local paths from different articles under different keys', async () => {
    const markdown = `![img](./local-image.jpg)`;

    const processor = () =>
      unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypeImgSizeCache, { cacheFilePath: './mock-cache.yaml' })
        .use(rehypeStringify);

    await processor().process({
      value: markdown,
      path: '/posts/post-a/index.md',
    });
    await processor().process({
      value: markdown,
      path: '/posts/post-b/index.md',
    });

    expect(imageSizeUtils.getImageSize).toHaveBeenCalledTimes(2);
    expect(imageSizeUtils.getImageSize).toHaveBeenCalledWith(
      './local-image.jpg',
      '/posts/post-a',
    );
    expect(imageSizeUtils.getImageSize).toHaveBeenCalledWith(
      './local-image.jpg',
      '/posts/post-b',
    );
    expect(Object.keys(mockCache)).toHaveLength(2);
    expect(Object.keys(mockCache).some((key) => key.includes('post-a'))).toBe(
      true,
    );
    expect(Object.keys(mockCache).some((key) => key.includes('post-b'))).toBe(
      true,
    );
  });

  test('Should prefix a dot-directory local path with ./ in the cache key', async () => {
    const markdown = `![img](./.assets/local-image.jpg)`;
    const postDir = path.join(process.cwd(), 'posts', 'my-post');

    const processor = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeImgSizeCache, { cacheFilePath: './mock-cache.yaml' })
      .use(rehypeStringify);

    await processor.process({
      value: markdown,
      path: path.join(postDir, 'index.md'),
    });

    const keys = Object.keys(mockCache);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^\.\//);
    expect(keys[0]).not.toMatch(/^\.\.\//);
  });

  test('Should only fetch a repeated src once per document', async () => {
    const markdown = `
![img1](https://picsum.photos/400/300)
![img2](https://picsum.photos/400/300)
`;

    const processor = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeImgSizeCache, { cacheFilePath: './mock-cache.yaml' })
      .use(rehypeStringify);

    const result = await processor.process(markdown);
    const html = result.toString();

    expect(imageSizeUtils.getImageSize).toHaveBeenCalledTimes(1);
    expect(html.match(/width="400"/g)).toHaveLength(2);
    expect(html.match(/height="300"/g)).toHaveLength(2);
  });
});

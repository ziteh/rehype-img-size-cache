# rehype-img-size-cache Plugin

A [rehype](https://github.com/rehypejs/rehype) plugin that automatically adds `width` and `height` attributes to `<img>` with caching support, includes local and remote images.

Helps improve Cumulative Layout Shift (CLS).

## Install

```bash
npm i @ziteh/rehype-img-size-cache

# or

pnpm add @ziteh/rehype-img-size-cache
```

## Usage

```js
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeImgSizeCache from '@ziteh/rehype-img-size-cache';

const processor = unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeImgSizeCache, {
    cacheFilePath: './cache/image-sizes.yaml',
    processRemoteImages: true,
  })
  .use(rehypeStringify);

const markdown = `![Example](https://example.com/full-hd.jpg)`;
const result = await processor.process(markdown);

console.log(result.toString());
```

Output:

```html
<img
  src="https://example.com/full-hd.jpg"
  alt="Example"
  width="1920"
  height="1080"
/>
```

With `srcset`:

```js
.use(rehypeImgSizeCache, {
  cacheFilePath: './cache/image-sizes.yaml',
  srcset: {
    widths: [640, 1280],
    url: (src, width) => `${src}?w=${width}`,
    sizes: '(max-width: 640px) 100vw, 1280px',
  },
})
```

```html
<img
  src="https://example.com/full-hd.jpg"
  alt="Example"
  width="1920"
  height="1080"
  srcset="
    https://example.com/full-hd.jpg?w=640   640w,
    https://example.com/full-hd.jpg?w=1280 1280w,
    https://example.com/full-hd.jpg        1920w
  "
  sizes="(max-width: 640px) 100vw, 1280px"
/>
```

## Options

```ts
interface SrcsetOptions {
  widths: number[];
  url: (src: string, width: number) => string;
  match?: (src: string) => boolean;
  sizes?: string;
}

interface RehypeImgSizeCacheOptions {
  cacheFilePath?: string;
  processRemoteImages?: boolean;
  verbose?: boolean;
  srcset?: SrcsetOptions;
}

declare function rehypeImgSizeCache(
  options?: RehypeImgSizeCacheOptions,
): (tree: Node, file: VFile) => Promise<void>;
```

### `cacheFilePath?`

Path to the cache file. Default is `'cache/image-sizes.yaml'`.

### `processRemoteImages?`

Whether to process remote images (HTTP/HTTPS). Default is `true`.

### `verbose?`

Whether to log every cache hit. Default is `false`; images that are newly
measured (or fail to measure) are always logged.

### `srcset?`

Adds a `srcset` (and optionally `sizes`) attribute to `<img>` once its
dimensions are known.

- `widths`: candidate widths to generate. Only widths smaller than the
  image's original width are used; the original image is always appended as
  the last entry.
- `url`: builds the URL for a given width, e.g. for a CDN resizing
  parameter or a custom naming convention.
- `match?`: restricts which images get a `srcset`. Defaults to all images.
- `sizes?`: written as-is to the `sizes` attribute.

Images whose dimensions can't be determined, or that have no `widths` smaller
than their original width, are left without `srcset` and `sizes`.

## Local image paths

Relative local paths (e.g. `./img/photo.jpg`) are resolved against the
directory of the file being processed (`file.path`), falling back to
`process.cwd()` when it's not available.

## Cache Format

The plugin stores cache in YAML format:

```yaml
- url: https://example.com/image1.jpg
  width: 400
  height: 300
- url: ./local/image2.jpg
  width: 800
  height: 600
```

Local paths are keyed relative to `process.cwd()`, so two articles using
the same relative path (e.g. `./img/photo.jpg`) don't collide.

The cache is also kept in memory for the lifetime of the process, so a dev
server won't pick up manual edits to the YAML file until it's restarted.

## Development

```bash
pnpm install

pnpm build

pnpm test
```

## Related

- [ksoichiro/rehype-img-size: rehype plugin to set local image size properties to img tag.](https://github.com/ksoichiro/rehype-img-size)
- [potato4d/rehype-plugin-auto-resolve-layout-shift: Flexible improve CLS plugin for rehype.](https://github.com/potato4d/rehype-plugin-auto-resolve-layout-shift)
- [theMosaad/rehype-external-img-size: rehype plugin to add width and height attributes to external images](https://github.com/theMosaad/rehype-external-img-size)

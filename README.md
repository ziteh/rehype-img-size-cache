# rehype-image-size-cache Plugin

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
import rehypeImgSizeCache from 'rehype-img-size-cache';

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

## Options

```ts
interface RehypeImgSizeCacheOptions {
  cacheFilePath?: string;
  processRemoteImages?: boolean;
}

declare function rehypeImgSizeCache(
  options?: RehypeImgSizeCacheOptions,
): (tree: Node) => Promise<void>;
```

### `cacheFilePath?`

Path to the cache file. Default is `'cache/image-sizes.yaml'`.

### `processRemoteImages?`

Whether to process remote images (HTTP/HTTPS). Default is `true`.

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

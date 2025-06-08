# rehype-image-size-cache Plugin

A [rehype](https://github.com/rehypejs/rehype) plugin that automatically adds `width` and `height` attributes to `<img>` with caching support, includes local and remote images.

Helps improve Cumulative Layout Shift (CLS).

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
<img src="https://example.com/full-hd.jpg" alt="Example" width="1920" height="1080">
```

## Options

| Option                | Type      | Default                    | Description                                   |
| --------------------- | --------- | -------------------------- | --------------------------------------------- |
| `cacheFilePath`       | `string`  | `'cache/image-sizes.yaml'` | Path to the cache file                        |
| `processRemoteImages` | `boolean` | `true`                     | Whether to process remote images (HTTP/HTTPS) |

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

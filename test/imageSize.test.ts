import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest';
import * as fs from 'node:fs';
import { getImageSize } from '../src/utils/imageSize';

vi.mock('node:fs');

// Minimal valid PNG: signature + IHDR chunk (300x200), enough for image-size to parse.
function buildPngBytes(width: number, height: number): Buffer {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  const crc32 = (buf: Buffer) => {
    let crc = 0xffffffff;
    for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  };

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  return Buffer.concat([sig, chunk('IHDR', ihdrData)]);
}

// JPEG with a large APP1/EXIF segment before the SOF0 marker, so dimensions
// are only parseable once several KB of data have been read.
function buildJpegWithLateSof(
  width: number,
  height: number,
  exifSize: number,
): Buffer {
  const parts: Buffer[] = [Buffer.from([0xff, 0xd8])]; // SOI

  const exifPayload = Buffer.alloc(exifSize, 0);
  const app1Len = Buffer.alloc(2);
  app1Len.writeUInt16BE(exifPayload.length + 2);
  parts.push(Buffer.from([0xff, 0xe1]), app1Len, exifPayload);

  const sofData = Buffer.alloc(15);
  sofData[0] = 8;
  sofData.writeUInt16BE(height, 1);
  sofData.writeUInt16BE(width, 3);
  sofData[5] = 3;
  const sofLen = Buffer.alloc(2);
  sofLen.writeUInt16BE(sofData.length + 2);
  parts.push(Buffer.from([0xff, 0xc0]), sofLen, sofData);

  return Buffer.concat(parts);
}

const PADDING_CHUNKS = 20;

function mockFetchWithChunks(chunks: Buffer[]) {
  let pullCount = 0;
  let cancelled = false;

  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pullCount < chunks.length) {
        controller.enqueue(chunks[pullCount]);
        pullCount++;
      } else {
        controller.close();
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      body,
    }),
  );

  return {
    getPullCount: () => pullCount,
    wasCancelled: () => cancelled,
  };
}

describe('imageSize utility function tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getImageSize (remote)', () => {
    test('Should abort the stream once dimensions are parsed, without reading the full body', async () => {
      const png = buildPngBytes(300, 200);
      // Split into small chunks, followed by many trailing chunks that should
      // never be consumed once parsing succeeds (streams may read a little
      // ahead of the consumer, so we pad well beyond that lookahead).
      const chunks = [
        png.subarray(0, 10),
        png.subarray(10),
        ...Array.from({ length: PADDING_CHUNKS }, () =>
          Buffer.from('this chunk should never be read'),
        ),
      ];
      const stream = mockFetchWithChunks(chunks);

      const result = await getImageSize('https://example.com/image.png');

      expect(result).toEqual({ width: 300, height: 200 });
      expect(stream.getPullCount()).toBeLessThan(chunks.length);
      expect(stream.wasCancelled()).toBe(true);
    });

    test('Should parse JPEG dimensions when SOF0 appears after a large EXIF segment', async () => {
      const jpeg = buildJpegWithLateSof(300, 200, 3000);
      const chunkSize = 500;
      const chunks: Buffer[] = [];
      for (let i = 0; i < jpeg.length; i += chunkSize) {
        chunks.push(jpeg.subarray(i, i + chunkSize));
      }
      chunks.push(
        ...Array.from({ length: PADDING_CHUNKS }, () =>
          Buffer.from('trailing scan data that should not be read'),
        ),
      );

      const stream = mockFetchWithChunks(chunks);

      const result = await getImageSize('https://example.com/image.jpg');

      expect(result).toEqual({ width: 300, height: 200 });
      expect(stream.getPullCount()).toBeLessThan(chunks.length);
      expect(stream.wasCancelled()).toBe(true);
    });

    test('Should return null when the stream ends without enough data', async () => {
      const stream = mockFetchWithChunks([Buffer.from([1, 2, 3])]);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await getImageSize('https://example.com/broken.jpg');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Unable to get image dimensions: https://example.com/broken.jpg',
      );

      consoleSpy.mockRestore();
    });

    test('Should stop probing once the read limit is reached for endless invalid data', async () => {
      const chunkSize = 64 * 1024;
      // Comfortably exceeds the probe limit
      const chunkCount = 40;
      const chunks = Array.from({ length: chunkCount }, () =>
        Buffer.alloc(chunkSize, 0),
      );
      const stream = mockFetchWithChunks(chunks);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await getImageSize('https://example.com/endless.jpg');

      expect(result).toBeNull();
      expect(stream.getPullCount()).toBeLessThan(chunkCount);
      expect(stream.wasCancelled()).toBe(true);

      consoleSpy.mockRestore();
    });

    test('Should return null when the response is not ok', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, body: null }),
      );

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await getImageSize('https://example.com/missing.jpg');

      expect(result).toBeNull();

      consoleSpy.mockRestore();
    });

    test('Should return null when the fetch request fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Network error')),
      );

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const result = await getImageSize('https://example.com/unreachable.jpg');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error occurred while fetching image dimensions https://example.com/unreachable.jpg:',
        'Network error',
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getImageSize (local)', () => {
    test('Should get local image dimensions (absolute path)', async () => {
      const mockImageData = buildPngBytes(800, 600);

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockImageData);

      const result = await getImageSize('/absolute/path/to/image.png');

      expect(result).toEqual({ width: 800, height: 600 });
      expect(fs.existsSync).toHaveBeenCalledWith('/absolute/path/to/image.png');
      expect(fs.readFileSync).toHaveBeenCalledWith(
        '/absolute/path/to/image.png',
      );
    });

    test('Should resolve relative paths against the given base directory', async () => {
      const mockImageData = buildPngBytes(1024, 768);

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockImageData);

      const result = await getImageSize('./image.png', '/posts/my-post');

      expect(result).toEqual({ width: 1024, height: 768 });
      expect(fs.existsSync).toHaveBeenCalledWith('/posts/my-post/image.png');
    });

    test('Should resolve relative paths against process.cwd() by default', async () => {
      const mockImageData = buildPngBytes(1024, 768);

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockImageData);

      await getImageSize('./image.png');

      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining('image.png'),
      );
    });

    test('Should return null when local image file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await getImageSize('./nonexistent.png', '/posts/my-post');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Local image file does not exist: /posts/my-post/nonexistent.png',
      );

      consoleSpy.mockRestore();
    });

    test('Should return null when the file is not a recognizable image', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('not an image'));

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const result = await getImageSize('/path/to/invalid.jpg');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error occurred while fetching image dimensions /path/to/invalid.jpg:',
        expect.any(String),
      );

      consoleSpy.mockRestore();
    });
  });
});

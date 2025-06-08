import { beforeEach, describe, expect, test, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readCache, writeCache } from '../src/utils/cache';
import { ImageSizeCache } from '../src/types';

// Mock fs and path modules
vi.mock('node:fs');
vi.mock('node:path');

describe('Cache utility function tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('readCache', () => {
    test('Should read valid YAML cache file', () => {
      const mockYamlContent = `
- url: https://example.com/image1.jpg
  width: 400
  height: 300
- url: https://example.com/image2.jpg
  width: 800
  height: 600
`;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockYamlContent);

      const result = readCache('/mock/cache.yaml');

      expect(result).toEqual({
        'https://example.com/image1.jpg': { width: 400, height: 300 },
        'https://example.com/image2.jpg': { width: 800, height: 600 },
      });
    });

    test('Should return empty object when cache file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = readCache('/mock/cache.yaml');

      expect(result).toEqual({});
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    test('Should return empty object and log warning when file read fails', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File read error');
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = readCache('/mock/cache.yaml');

      expect(result).toEqual({});
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error reading cache file:',
        'File read error',
      );

      consoleSpy.mockRestore();
    });
  });

  describe('writeCache', () => {
    test('Should write cache to YAML file', () => {
      const mockCache: ImageSizeCache = {
        'https://example.com/image1.jpg': { width: 400, height: 300 },
        'https://example.com/image2.jpg': { width: 800, height: 600 },
      };

      vi.mocked(path.dirname).mockReturnValue('/mock');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      writeCache('/mock/cache.yaml', mockCache);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/mock/cache.yaml',
        expect.stringContaining('url: https://example.com/image1.jpg'),
        'utf8',
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/mock/cache.yaml',
        expect.stringContaining('width: 400'),
        'utf8',
      );
    });

    test('Should create directory if it does not exist', () => {
      const mockCache: ImageSizeCache = {
        'https://example.com/test.jpg': { width: 100, height: 100 },
      };

      vi.mocked(path.dirname).mockReturnValue('/mock/subdir');
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      writeCache('/mock/subdir/cache.yaml', mockCache);

      expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/subdir', {
        recursive: true,
      });
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    test('Should log warning when write fails', () => {
      const mockCache: ImageSizeCache = {
        'https://example.com/test.jpg': { width: 100, height: 100 },
      };

      vi.mocked(path.dirname).mockReturnValue('/mock');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Write error');
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      writeCache('/mock/cache.yaml', mockCache);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error writing cache file:',
        'Write error',
      );

      consoleSpy.mockRestore();
    });
  });
});

import { beforeEach, describe, expect, test, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readCache, writeCache, updateCache } from '../src/utils/cache';
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

  describe('updateCache', () => {
    test('Should merge new entries with existing cache', () => {
      const existingCache = `
- url: https://example.com/existing.jpg
  width: 200
  height: 150
`;
      const newEntries: ImageSizeCache = {
        'https://example.com/new.jpg': { width: 400, height: 300 },
      };

      vi.mocked(path.dirname).mockReturnValue('/mock');
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(true) // directory exists
        .mockReturnValueOnce(true); // cache file exists
      vi.mocked(fs.readFileSync).mockReturnValue(existingCache);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const result = updateCache('/mock/cache.yaml', newEntries);

      // Should return true for successful update
      expect(result).toBe(true);

      // Should read existing cache
      expect(fs.readFileSync).toHaveBeenCalledWith('/mock/cache.yaml', 'utf8');

      // Should write merged cache
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/mock/cache.yaml',
        expect.stringContaining('url: https://example.com/existing.jpg'),
        'utf8',
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/mock/cache.yaml',
        expect.stringContaining('url: https://example.com/new.jpg'),
        'utf8',
      );
    });

    test('Should create cache file when it does not exist', () => {
      const newEntries: ImageSizeCache = {
        'https://example.com/new.jpg': { width: 400, height: 300 },
      };

      vi.mocked(path.dirname).mockReturnValue('/mock');
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(false) // directory does not exist
        .mockReturnValueOnce(false); // cache file does not exist
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const result = updateCache('/mock/cache.yaml', newEntries);

      // Should return true for successful update
      expect(result).toBe(true);

      // Should create directory
      expect(fs.mkdirSync).toHaveBeenCalledWith('/mock', { recursive: true });

      // Should write new cache
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/mock/cache.yaml',
        expect.stringContaining('url: https://example.com/new.jpg'),
        'utf8',
      );
    });

    test('Should handle concurrent updates gracefully', () => {
      const existingCache = `
- url: https://example.com/image1.jpg
  width: 200
  height: 150
- url: https://example.com/image2.jpg
  width: 300
  height: 250
`;

      const newEntries: ImageSizeCache = {
        'https://example.com/image3.jpg': { width: 400, height: 300 },
      };

      vi.mocked(path.dirname).mockReturnValue('/mock');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      // Mock reading existing cache with image1 and image2
      vi.mocked(fs.readFileSync).mockReturnValue(existingCache);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const result = updateCache('/mock/cache.yaml', newEntries);

      // Should return true for successful update
      expect(result).toBe(true);

      // Should include all images: image1, image2 (existing), image3 (our new entry)
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/mock/cache.yaml',
        expect.stringContaining('url: https://example.com/image1.jpg'),
        'utf8',
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/mock/cache.yaml',
        expect.stringContaining('url: https://example.com/image2.jpg'),
        'utf8',
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/mock/cache.yaml',
        expect.stringContaining('url: https://example.com/image3.jpg'),
        'utf8',
      );
    });

    test('Should log warning when update fails', () => {
      const newEntries: ImageSizeCache = {
        'https://example.com/new.jpg': { width: 400, height: 300 },
      };

      vi.mocked(path.dirname).mockImplementation(() => {
        throw new Error('Path error');
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = updateCache('/mock/cache.yaml', newEntries);

      // Should return false for failed update
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error updating cache file:',
        'Path error',
      );

      consoleSpy.mockRestore();
    });
  });
});

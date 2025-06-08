import { beforeEach, describe, expect, test, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import axios from 'axios';
import sizeOf from 'image-size';
import { getImageSize } from '../src/utils/imageSize';

type ISizeCalculationResult = ReturnType<typeof sizeOf>;

// Mock dependencies
vi.mock('node:fs');
vi.mock('node:path');
vi.mock('axios');
vi.mock('image-size');

describe('imageSize utility function tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getImageSize', () => {
    test('Should get remote image dimensions', async () => {
      const mockImageData = Buffer.from('fake image data');
      const mockResponse = { data: mockImageData };

      vi.mocked(axios.get).mockResolvedValue(mockResponse);
      vi.mocked(sizeOf).mockReturnValue({ width: 400, height: 300 });

      const result = await getImageSize('https://example.com/image.jpg');

      expect(result).toEqual({ width: 400, height: 300 });
      expect(axios.get).toHaveBeenCalledWith('https://example.com/image.jpg', {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
        },
      });
      expect(sizeOf).toHaveBeenCalledWith(mockImageData);
    });
    test('Should get local image dimensions (absolute path)', async () => {
      const mockImageData = Buffer.from('fake image data');

      vi.mocked(path.isAbsolute).mockReturnValue(true);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockImageData);
      vi.mocked(sizeOf).mockReturnValue({ width: 800, height: 600 });

      const result = await getImageSize('/absolute/path/to/image.jpg');

      expect(result).toEqual({ width: 800, height: 600 });
      expect(fs.existsSync).toHaveBeenCalledWith('/absolute/path/to/image.jpg');
      expect(fs.readFileSync).toHaveBeenCalledWith(
        '/absolute/path/to/image.jpg',
      );
      expect(sizeOf).toHaveBeenCalledWith(mockImageData);
    });

    test('Should get local image dimensions (relative path)', async () => {
      const mockImageData = Buffer.from('fake image data');

      vi.mocked(path.isAbsolute).mockReturnValue(false);
      vi.mocked(path.resolve).mockReturnValue('/resolved/path/to/image.jpg');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockImageData);
      vi.mocked(sizeOf).mockReturnValue({ width: 1024, height: 768 });

      const result = await getImageSize('./relative/path/image.jpg');

      expect(result).toEqual({ width: 1024, height: 768 });
      expect(path.resolve).toHaveBeenCalledWith(
        process.cwd(),
        './relative/path/image.jpg',
      );
      expect(fs.existsSync).toHaveBeenCalledWith('/resolved/path/to/image.jpg');
    });
    test('Should return null when local image file does not exist', async () => {
      vi.mocked(path.isAbsolute).mockReturnValue(false);
      vi.mocked(path.resolve).mockReturnValue(
        '/resolved/path/to/nonexistent.jpg',
      );
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await getImageSize('./nonexistent.jpg');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Local image file does not exist: /resolved/path/to/nonexistent.jpg',
      );

      consoleSpy.mockRestore();
    });
    test('Should return null when unable to get image dimensions', async () => {
      const mockImageData = Buffer.from('invalid image data');

      vi.mocked(path.isAbsolute).mockReturnValue(true);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockImageData);
      vi.mocked(sizeOf).mockReturnValue({} as ISizeCalculationResult); // No dimension info

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await getImageSize('/path/to/invalid.jpg');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Unable to get image dimensions: /path/to/invalid.jpg',
      );

      consoleSpy.mockRestore();
    });

    test('Should return null when remote image request fails', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));

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
    test('Should handle sizeOf returning undefined dimensions', async () => {
      const mockImageData = Buffer.from('fake image data');

      vi.mocked(path.isAbsolute).mockReturnValue(true);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockImageData);
      vi.mocked(sizeOf).mockReturnValue({
        width: undefined,
        height: 300,
      } as unknown as ISizeCalculationResult);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await getImageSize('/path/to/image.jpg');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Unable to get image dimensions: /path/to/image.jpg',
      );

      consoleSpy.mockRestore();
    });
  });
});

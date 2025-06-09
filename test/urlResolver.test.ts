import { describe, expect, test } from 'vitest';
import {
  isRemoteUrl,
  shouldSkipUrl,
  resolveUrl,
} from '../src/utils/urlResolver';

describe('URL resolver utility functions', () => {
  describe('isRemoteUrl', () => {
    test('Should return true for HTTP URLs', () => {
      expect(isRemoteUrl('http://example.com/image.jpg')).toBe(true);
    });

    test('Should return true for HTTPS URLs', () => {
      expect(isRemoteUrl('https://example.com/image.jpg')).toBe(true);
    });

    test('Should return false for relative paths', () => {
      expect(isRemoteUrl('./image.jpg')).toBe(false);
      expect(isRemoteUrl('../images/photo.png')).toBe(false);
    });

    test('Should return false for absolute paths', () => {
      expect(isRemoteUrl('/path/to/image.jpg')).toBe(false);
    });

    test('Should return false for data URLs', () => {
      expect(isRemoteUrl('data:image/png;base64,iVBORw0KG')).toBe(false);
    });

    test('Should return false for blob URLs', () => {
      expect(isRemoteUrl('blob:https://example.com/123')).toBe(false);
    });
  });

  describe('shouldSkipUrl', () => {
    test('Should return true for data URLs', () => {
      expect(shouldSkipUrl('data:image/png;base64,iVBORw0KG')).toBe(true);
    });

    test('Should return true for blob URLs', () => {
      expect(shouldSkipUrl('blob:https://example.com/123')).toBe(true);
    });

    test('Should return false for HTTP URLs', () => {
      expect(shouldSkipUrl('https://example.com/image.jpg')).toBe(false);
    });

    test('Should return false for relative paths', () => {
      expect(shouldSkipUrl('./image.jpg')).toBe(false);
    });
  });

  describe('resolveUrl', () => {
    test('Should return absolute URLs as-is', () => {
      const absoluteUrl = 'https://example.com/image.jpg';
      expect(resolveUrl('https://base.com/', absoluteUrl)).toBe(absoluteUrl);
    });

    test('Should resolve relative URLs against base URL', () => {
      expect(resolveUrl('https://example.com/', './image.jpg')).toBe(
        'https://example.com/image.jpg',
      );
    });

    test('Should resolve relative paths with parent directory', () => {
      expect(resolveUrl('https://example.com/path/', '../image.jpg')).toBe(
        'https://example.com/image.jpg',
      );
    });

    test('Should handle complex relative paths', () => {
      expect(
        resolveUrl('https://example.com/a/b/c/', '../../images/photo.png'),
      ).toBe('https://example.com/a/images/photo.png');
    });
  });
});

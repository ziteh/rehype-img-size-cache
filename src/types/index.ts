export interface ImageSize {
  width: number;
  height: number;
}

export interface CacheEntry {
  url: string;
  width: number;
  height: number;
}

export interface ImageSizeCache {
  [url: string]: ImageSize;
}

export type ImageSizeCacheArray = CacheEntry[];

export interface RehypeImgSizeCacheOptions {
  cacheFilePath?: string;
  processRemoteImages?: boolean;
}

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

export interface SrcsetOptions {
  widths: number[];
  url: (src: string, width: number) => string;
  match?: (src: string) => boolean;
  sizes?: string;
}

export interface RehypeImgSizeCacheOptions {
  cacheFilePath?: string;
  processRemoteImages?: boolean;
  verbose?: boolean;
  srcset?: SrcsetOptions;
}

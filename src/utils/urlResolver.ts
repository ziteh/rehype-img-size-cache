import { URL } from 'node:url';

export function isRemoteUrl(url: string): boolean {
  return /^https?:\/\//.test(url);
}

export function shouldSkipUrl(url: string): boolean {
  return url.startsWith('data:') || url.startsWith('blob:');
}

export function resolveUrl(base: string, relative: string): string {
  if (isRemoteUrl(relative)) {
    return relative;
  }
  return new URL(relative, base).href;
}

import { URL } from 'node:url';

export function resolveUrl(base: string, relative: string): string {
  if (relative.startsWith('http://') || relative.startsWith('https://')) {
    return relative;
  }
  return new URL(relative, base).href;
}

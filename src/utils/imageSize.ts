import fs from 'node:fs';
import path from 'node:path';
import sizeOf from 'image-size';
import axios from 'axios';
import { isRemoteUrl } from './urlResolver';
import type { ImageSize } from '../types';

export async function getImageSize(src: string): Promise<ImageSize | null> {
  try {
    const isUrl = isRemoteUrl(src);
    let dimensions;

    if (isUrl) {
      // Remote image
      const response = await axios.get(src, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
        },
      });
      dimensions = sizeOf(Buffer.from(response.data));
    } else {
      // Local image
      let imagePath: string;
      if (path.isAbsolute(src)) {
        imagePath = src;
      } else {
        imagePath = path.resolve(process.cwd(), src);
      }

      if (!fs.existsSync(imagePath)) {
        console.warn(`Local image file does not exist: ${imagePath}`);
        return null;
      }

      dimensions = sizeOf(fs.readFileSync(imagePath));
    }

    if (!dimensions || !dimensions.width || !dimensions.height) {
      console.warn(`Unable to get image dimensions: ${src}`);
      return null;
    }

    return {
      width: dimensions.width!,
      height: dimensions.height!,
    };
  } catch (error) {
    console.error(
      `Error occurred while fetching image dimensions ${src}:`,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

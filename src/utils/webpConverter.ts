/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WebPConversionResult {
  src: string;
  width: number;
  height: number;
  originalSize: number;
  webpSize: number;
  compressionRatio: number;
  format: 'webp' | 'gif' | 'video' | 'audio';
}

/**
 * Converts an image file (PNG, JPG, BMP, etc.) into optimized WebP format
 * using an offscreen canvas. Preserves transparency and applies high-efficiency
 * lossy/lossless WebP compression.
 */
export async function convertImageToWebP(
  fileOrBlob: File | Blob,
  quality = 0.85,
  maxWidth = 2048,
  maxHeight = 2048
): Promise<WebPConversionResult> {
  const originalSize = fileOrBlob.size;

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(fileOrBlob);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let width = img.naturalWidth || img.width || 400;
      let height = img.naturalHeight || img.height || 300;

      // Downscale if exceeds max bounding dimension to ensure fast canvas performance
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        // Fallback: return original object URL as data URL
        const reader = new FileReader();
        reader.onload = () => {
          const resultStr = reader.result as string;
          resolve({
            src: resultStr,
            width,
            height,
            originalSize,
            webpSize: resultStr.length,
            compressionRatio: 1,
            format: 'webp',
          });
        };
        reader.readAsDataURL(fileOrBlob);
        return;
      }

      // Draw onto canvas and export as WebP
      ctx.drawImage(img, 0, 0, width, height);

      // Try WebP export; if browser does not support it will fall back to PNG
      const webpDataUrl = canvas.toDataURL('image/webp', quality);
      const webpSize = Math.round((webpDataUrl.length * 3) / 4); // approximate byte size from base64
      const ratio = originalSize > 0 ? Number((webpSize / originalSize).toFixed(2)) : 1;

      resolve({
        src: webpDataUrl,
        width,
        height,
        originalSize,
        webpSize,
        compressionRatio: ratio,
        format: 'webp',
      });
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo decodificar la imagen para optimización WebP: ' + err));
    };

    img.src = objectUrl;
  });
}

/**
 * Checks if a given MIME type or file extension is an animated GIF
 */
export function isGifFile(file: File): boolean {
  return file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
}

/**
 * Checks if a given MIME type or file extension is a video
 */
export function isVideoFile(file: File): boolean {
  return (
    file.type.startsWith('video/') ||
    /\.(mp4|webm|mov|m4v|ogg)$/i.test(file.name)
  );
}

/**
 * Checks if a given MIME type or file extension is an audio file
 */
export function isAudioFile(file: File): boolean {
  return (
    file.type.startsWith('audio/') ||
    /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)
  );
}

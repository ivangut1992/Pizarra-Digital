/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OptimizedMediaResult {
  src: string;
  type: 'image' | 'video' | 'audio';
  mediaType: 'image' | 'gif' | 'video' | 'audio';
  width: number;
  height: number;
  fileName: string;
  duration?: number;
  poster?: string;
  originalSize: number;
  optimizedSize?: number;
}

/**
 * Converts an image file (PNG, JPG, SVG, static GIF) or ImageBitmap into WebP format
 * using an offscreen canvas at high visual fidelity (quality 0.85).
 */
export async function convertImageToWebP(file: File): Promise<{
  webpDataUrl: string;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let targetW = img.naturalWidth || 600;
          let targetH = img.naturalHeight || 400;

          // Scale down if extremely large to prevent browser crash & massive memory usage
          const MAX_DIM = 2400;
          if (targetW > MAX_DIM || targetH > MAX_DIM) {
            if (targetW >= targetH) {
              targetH = Math.round((targetH * MAX_DIM) / targetW);
              targetW = MAX_DIM;
            } else {
              targetW = Math.round((targetW * MAX_DIM) / targetH);
              targetH = MAX_DIM;
            }
          }

          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({
              webpDataUrl: reader.result as string,
              width: targetW,
              height: targetH,
            });
            return;
          }

          ctx.drawImage(img, 0, 0, targetW, targetH);
          const webpDataUrl = canvas.toDataURL('image/webp', 0.85);

          resolve({
            webpDataUrl,
            width: targetW,
            height: targetH,
          });
        } catch {
          // If canvas export fails, fallback to original data url
          resolve({
            webpDataUrl: reader.result as string,
            width: img.naturalWidth || 400,
            height: img.naturalHeight || 300,
          });
        }
      };
      img.onerror = () => reject(new Error('Formato de imagen inválido o corrupto.'));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Extracts a high-resolution WebP poster frame and video metadata (duration, width, height)
 * from a video file.
 */
export async function processVideoFile(file: File): Promise<{
  videoSrc: string;
  posterWebP: string;
  width: number;
  height: number;
  duration: number;
}> {
  return new Promise((resolve, reject) => {
    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;

    video.onloadeddata = () => {
      video.currentTime = 0.1; // seek slightly into the video to avoid black first frames
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        const vw = video.videoWidth || 640;
        const vh = video.videoHeight || 360;
        canvas.width = vw;
        canvas.height = vh;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, vw, vh);
        }
        const posterWebP = canvas.toDataURL('image/webp', 0.85);

        // Read video as DataURL so it persists in storage and offline
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            videoSrc: reader.result as string,
            posterWebP,
            width: vw,
            height: vh,
            duration: video.duration || 0,
          });
          URL.revokeObjectURL(videoUrl);
        };
        reader.onerror = () => {
          resolve({
            videoSrc: videoUrl,
            posterWebP,
            width: vw,
            height: vh,
            duration: video.duration || 0,
          });
        };
        reader.readAsDataURL(file);
      } catch (e) {
        reject(e);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(videoUrl);
      reject(new Error('No se pudo decodificar el archivo de video.'));
    };
  });
}

/**
 * Reads audio file metadata and returns DataURL.
 */
export async function processAudioFile(file: File): Promise<{
  audioSrc: string;
  duration: number;
}> {
  return new Promise((resolve, reject) => {
    const audioUrl = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = audioUrl;

    audio.onloadedmetadata = () => {
      const dur = audio.duration || 0;
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          audioSrc: reader.result as string,
          duration: dur,
        });
        URL.revokeObjectURL(audioUrl);
      };
      reader.onerror = () => {
        resolve({
          audioSrc: audioUrl,
          duration: dur,
        });
      };
      reader.readAsDataURL(file);
    };

    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      reject(new Error('No se pudo decodificar el archivo de audio.'));
    };
  });
}

/**
 * Optimizes an uploaded media file based on its MIME type:
 * - Images & GIFs: Optimized to WebP
 * - Videos: Processed with WebP poster frame
 * - Audio: Parsed with duration and data source
 */
export async function optimizeUploadedFile(file: File): Promise<OptimizedMediaResult> {
  const fileType = file.type.toLowerCase();
  const fileName = file.name;
  const originalSize = file.size;

  // Video types
  if (
    fileType.startsWith('video/') ||
    fileName.match(/\.(mp4|webm|ogg|mov|mkv)$/i)
  ) {
    const { videoSrc, posterWebP, width, height, duration } = await processVideoFile(file);
    return {
      src: videoSrc,
      type: 'video',
      mediaType: 'video',
      width: Math.min(width, 480),
      height: Math.round(Math.min(width, 480) * (height / width)),
      fileName,
      duration,
      poster: posterWebP,
      originalSize,
    };
  }

  // Audio types
  if (
    fileType.startsWith('audio/') ||
    fileName.match(/\.(mp3|wav|ogg|aac|m4a|flac)$/i)
  ) {
    const { audioSrc, duration } = await processAudioFile(file);
    return {
      src: audioSrc,
      type: 'audio',
      mediaType: 'audio',
      width: 320,
      height: 90,
      fileName,
      duration,
      originalSize,
    };
  }

  // Animated GIF
  if (fileType === 'image/gif' || fileName.match(/\.gif$/i)) {
    // If GIF, read original to preserve animation, also create optimized WebP poster
    const webpRes = await convertImageToWebP(file);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          src: reader.result as string, // Animated GIF source
          type: 'image',
          mediaType: 'gif',
          width: webpRes.width,
          height: webpRes.height,
          fileName,
          poster: webpRes.webpDataUrl, // WebP optimized poster
          originalSize,
          optimizedSize: webpRes.webpDataUrl.length,
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // Standard Images (PNG, JPEG, WebP, SVG, etc.) -> Convert to WebP
  const { webpDataUrl, width, height } = await convertImageToWebP(file);
  return {
    src: webpDataUrl,
    type: 'image',
    mediaType: 'image',
    width,
    height,
    fileName,
    poster: webpDataUrl,
    originalSize,
    optimizedSize: webpDataUrl.length,
  };
}

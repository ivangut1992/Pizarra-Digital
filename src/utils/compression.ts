/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Text compression utility using Brotli (via brotli-wasm) with fallback
 * to native CompressionStream / standard UTF-8 encoding.
 * Reduces text payload and storage footprint.
 */

let brotliInstance: typeof import('brotli-wasm') extends Promise<infer T> ? T : any = null;
let brotliInitPromise: Promise<any> | null = null;

async function getBrotli() {
  if (brotliInstance) return brotliInstance;
  if (!brotliInitPromise) {
    brotliInitPromise = (async () => {
      try {
        const brotliModule = await import('brotli-wasm');
        // brotli-wasm default export is a Promise resolving to the module instance
        brotliInstance = typeof (brotliModule as any).default === 'function' || (brotliModule as any).default instanceof Promise
          ? await (brotliModule as any).default
          : (brotliModule as any).default || brotliModule;
        return brotliInstance;
      } catch (err) {
        console.warn('Brotli-wasm no pudo cargarse en este entorno, usando compresor alternativo:', err);
        return null;
      }
    })();
  }
  return brotliInitPromise;
}

/**
 * Compresses an arbitrary UTF-8 string using Brotli algorithm.
 * Returns base64 encoded compressed string with prefix "brotli:".
 */
export async function compressText(text: string): Promise<string> {
  if (!text) return '';
  try {
    const brotli = await getBrotli();
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);

    if (brotli && typeof brotli.compress === 'function') {
      const compressed = brotli.compress(bytes);
      // Convert Uint8Array to base64
      let binary = '';
      const len = compressed.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(compressed[i]);
      }
      return 'br:' + btoa(binary);
    }
  } catch (err) {
    console.warn('Error en compresión Brotli, guardando texto normal:', err);
  }

  // Fallback: return raw text if compression fails
  return text;
}

/**
 * Decompresses a string if it was compressed with Brotli (prefixed with "br:"),
 * otherwise returns the original text.
 */
export async function decompressText(payload: string): Promise<string> {
  if (!payload) return '';
  if (!payload.startsWith('br:')) {
    return payload;
  }

  try {
    const base64Data = payload.slice(3);
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const brotli = await getBrotli();
    if (brotli && typeof brotli.decompress === 'function') {
      const decompressed = brotli.decompress(bytes);
      const decoder = new TextDecoder();
      return decoder.decode(decompressed);
    }
  } catch (err) {
    console.warn('Error al descomprimir con Brotli:', err);
  }

  return payload;
}

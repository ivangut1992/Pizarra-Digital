/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoardState, CanvasElement } from '../types/canvas';
import { calculateBoundingBox, DEFAULT_VIEWPORT } from './viewport';
import { createTemplateElements, TemplateType } from './templates';
import { renderWrappedText } from './text';
import { compressText, decompressText } from './compression';

const DB_NAME = 'PizarraDigitalDB';
const DB_VERSION = 1;
const STORE_NAME = 'boards';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return dbPromise;
}

export async function getAllBoards(): Promise<BoardState[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const boards: BoardState[] = request.result || [];
        // Sort descending by updatedAt
        boards.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(boards);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error al obtener pizarras de IndexedDB:', error);
    return [];
  }
}

export async function getBoard(id: string): Promise<BoardState | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error(`Error al recuperar pizarra ${id}:`, error);
    return null;
  }
}

export async function saveBoard(board: BoardState): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(board);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error al guardar pizarra en IndexedDB:', error);
  }
}

export async function deleteBoard(id: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error(`Error al eliminar pizarra ${id}:`, error);
  }
}

/**
 * Creates an offscreen snapshot thumbnail of elements for dashboard cards.
 */
export function generateBoardThumbnail(
  elements: CanvasElement[],
  width = 320,
  height = 180
): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Draw dark background
    ctx.fillStyle = '#18181B';
    ctx.fillRect(0, 0, width, height);

    // Draw faint grid dots
    ctx.fillStyle = '#27272A';
    for (let x = 10; x < width; x += 16) {
      for (let y = 10; y < height; y += 16) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }

    if (elements.length === 0) {
      // Empty watermark
      ctx.fillStyle = '#3F3F46';
      ctx.font = '12px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Lienzo en blanco', width / 2, height / 2);
      return canvas.toDataURL('image/webp', 0.8);
    }

    const bbox = calculateBoundingBox(elements);
    if (!bbox) return canvas.toDataURL('image/webp', 0.8);

    const pad = 20;
    const scale = Math.min((width - pad * 2) / bbox.width, (height - pad * 2) / bbox.height);
    const offsetX = width / 2 - (bbox.minX + bbox.width / 2) * scale;
    const offsetY = height / 2 - (bbox.minY + bbox.height / 2) * scale;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    for (const el of elements) {
      ctx.save();
      ctx.globalAlpha = el.opacity ?? 1;

      if (el.type === 'rect') {
        ctx.fillStyle = el.fillColor || 'transparent';
        ctx.strokeStyle = el.strokeColor || '#FFFFFF';
        ctx.lineWidth = Math.max(el.strokeWidth, 1);
        ctx.fillRect(el.x, el.y, el.width, el.height);
        ctx.strokeRect(el.x, el.y, el.width, el.height);
      } else if (el.type === 'circle') {
        ctx.fillStyle = el.fillColor || 'transparent';
        ctx.strokeStyle = el.strokeColor || '#FFFFFF';
        ctx.lineWidth = Math.max(el.strokeWidth, 1);
        ctx.beginPath();
        ctx.ellipse(
          el.x + el.width / 2,
          el.y + el.height / 2,
          Math.abs(el.width) / 2,
          Math.abs(el.height) / 2,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.stroke();
      } else if (el.type === 'pen' && el.points && el.points.length > 1) {
        ctx.strokeStyle = el.strokeColor || '#FFFFFF';
        ctx.lineWidth = Math.max(el.strokeWidth, 1);
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        ctx.stroke();
      } else if (el.type === 'text' && el.text) {
        renderWrappedText(ctx, el);
      } else if (el.type === 'video') {
        ctx.fillStyle = '#1E1E24';
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 1;
        ctx.fillRect(el.x, el.y, el.width, el.height);
        ctx.strokeRect(el.x, el.y, el.width, el.height);
      } else if (el.type === 'audio') {
        ctx.fillStyle = '#1E1E24';
        ctx.strokeStyle = '#A855F7';
        ctx.lineWidth = 1;
        ctx.fillRect(el.x, el.y, el.width, el.height);
        ctx.strokeRect(el.x, el.y, el.width, el.height);
      }

      ctx.restore();
    }

    ctx.restore();
    return canvas.toDataURL('image/webp', 0.8);
  } catch (e) {
    console.error('Error generando miniatura:', e);
    return '';
  }
}

export async function createBoard(
  name?: string
): Promise<BoardState> {
  const elements: CanvasElement[] = [];
  const now = Date.now();
  const id = `pizarra_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const boardName = name?.trim() || 'Nueva Pizarra';

  const thumbnail = generateBoardThumbnail(elements);

  const board: BoardState = {
    id,
    name: boardName,
    createdAt: now,
    updatedAt: now,
    thumbnail,
    elements,
    viewport: DEFAULT_VIEWPORT,
    layers: [
      { id: 1, name: 'Capa 1', visible: true, locked: false },
      { id: 2, name: 'Capa 2', visible: true, locked: false },
      { id: 3, name: 'Capa 3', visible: true, locked: false },
      { id: 4, name: 'Capa 4', visible: true, locked: false },
    ],
  };

  await saveBoard(board);
  return board;
}

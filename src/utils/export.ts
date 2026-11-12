/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoardState, CanvasElement } from '../types/canvas';
import { calculateBoundingBox } from './viewport';
import { drawCatmullRomSpline, getConnectorRoute } from './geometry';
import { getWrappedLines, drawWrappedText } from './textLayout';

/**
 * Downloads a blob as a file in the browser.
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports board to high-resolution PNG image.
 */
export async function exportBoardToPNG(
  board: BoardState,
  options: { scale?: number; background?: boolean } = {}
): Promise<void> {
  const scale = options.scale ?? 2;
  const includeBg = options.background ?? true;

  const bbox = calculateBoundingBox(board.elements);
  const padding = 60;

  const width = bbox ? Math.max((bbox.width + padding * 2), 600) : 800;
  const height = bbox ? Math.max((bbox.height + padding * 2), 450) : 600;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(scale, scale);

  if (includeBg) {
    ctx.fillStyle = '#121212';
    ctx.fillRect(0, 0, width, height);

    // Matrix dot grid
    ctx.fillStyle = '#262626';
    for (let x = 12; x < width; x += 24) {
      for (let y = 12; y < height; y += 24) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }
  }

  const offsetX = bbox ? padding - bbox.minX : width / 2;
  const offsetY = bbox ? padding - bbox.minY : height / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);

  // Group and sort elements by layer (1 to 4)
  const hiddenLayers = new Set<number>();
  if (board.layers) {
    board.layers.forEach((l) => {
      if (!l.visible) hiddenLayers.add(l.id);
    });
  }

  // Filter out hidden layers and sort ascending by layer (Layer 1 bottom -> Layer 4 top)
  const renderableElements = [...board.elements]
    .filter((el) => !hiddenLayers.has(el.layer ?? 1))
    .sort((a, b) => (a.layer ?? 1) - (b.layer ?? 1));

  // Render elements in layer order
  for (const el of renderableElements) {
    ctx.save();
    ctx.globalAlpha = el.opacity ?? 1;

    if (el.strokeStyle === 'dashed' || el.strokeStyle === 'dotted') {
      ctx.lineCap = 'round';
      ctx.setLineDash([0.001, Math.max(el.strokeWidth * 3.5, 12)]);
    } else {
      ctx.lineCap = el.type === 'pen' ? 'round' : 'square';
      ctx.setLineDash([]);
    }

    if (el.type === 'pen' && el.points && el.points.length > 0) {
      ctx.strokeStyle = el.strokeColor;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      drawCatmullRomSpline(ctx, el.points);
      ctx.stroke();
    } else if (el.type === 'rect') {
      ctx.fillStyle = el.fillColor;
      ctx.strokeStyle = el.strokeColor;
      ctx.lineWidth = el.strokeWidth;
      if (el.fillColor && el.fillColor !== 'transparent') {
        ctx.fillRect(el.x, el.y, el.width, el.height);
      }
      if (el.strokeWidth > 0 && el.strokeColor !== 'transparent') {
        ctx.strokeRect(el.x, el.y, el.width, el.height);
      }
    } else if (el.type === 'circle') {
      ctx.fillStyle = el.fillColor;
      ctx.strokeStyle = el.strokeColor;
      ctx.lineWidth = el.strokeWidth;
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
      if (el.fillColor && el.fillColor !== 'transparent') ctx.fill();
      if (el.strokeWidth > 0 && el.strokeColor !== 'transparent') ctx.stroke();
    } else if (el.type === 'triangle') {
      ctx.fillStyle = el.fillColor;
      ctx.strokeStyle = el.strokeColor;
      ctx.lineWidth = el.strokeWidth;
      ctx.beginPath();
      ctx.moveTo(el.x + el.width / 2, el.y);
      ctx.lineTo(el.x, el.y + el.height);
      ctx.lineTo(el.x + el.width, el.y + el.height);
      ctx.closePath();
      if (el.fillColor && el.fillColor !== 'transparent') ctx.fill();
      if (el.strokeWidth > 0 && el.strokeColor !== 'transparent') ctx.stroke();
    } else if (el.type === 'text' && el.text) {
      const fSize = el.fontSize || 18;
      const fFamily = el.fontFamily || 'Plus Jakarta Sans';
      const { lines, lineHeight } = getWrappedLines(ctx, el.text, el.width, fSize, fFamily);
      drawWrappedText(
        ctx,
        lines,
        el.x,
        el.y,
        el.width,
        lineHeight,
        el.textAlign || 'left',
        el.strokeColor || '#FFFFFF',
        fSize,
        fFamily
      );
    } else if (el.type === 'connector') {
      const startEl = board.elements.find((e) => e.id === el.startElementId) || null;
      const endEl = board.elements.find((e) => e.id === el.endElementId) || null;
      const route = getConnectorRoute(el, startEl, endEl);

      if (route.length > 1) {
        ctx.strokeStyle = el.strokeColor;
        ctx.lineWidth = el.strokeWidth;
        ctx.beginPath();
        ctx.moveTo(route[0].x, route[0].y);
        for (let i = 1; i < route.length; i++) {
          ctx.lineTo(route[i].x, route[i].y);
        }
        ctx.stroke();

        // Draw arrow head at end
        const last = route[route.length - 1];
        const prev = route[route.length - 2];
        const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
        const arrowLen = Math.max(el.strokeWidth * 4, 12);
        ctx.fillStyle = el.strokeColor;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(
          last.x - arrowLen * Math.cos(angle - Math.PI / 6),
          last.y - arrowLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          last.x - arrowLen * Math.cos(angle + Math.PI / 6),
          last.y - arrowLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

        // Arrow is drawn cleanly without connection point dots
      }
    } else if (el.type === 'image' && el.src) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = el.src!;
        });
        if (img.naturalWidth > 0) {
          ctx.drawImage(img, el.x, el.y, el.width, el.height);
        }
      } catch {
        // Continue if image fails to load
      }
    } else if (el.type === 'video') {
      try {
        if (el.poster) {
          const pImg = new Image();
          pImg.crossOrigin = 'anonymous';
          await new Promise<void>((resolve) => {
            pImg.onload = () => resolve();
            pImg.onerror = () => resolve();
            pImg.src = el.poster!;
          });
          if (pImg.naturalWidth > 0) {
            ctx.drawImage(pImg, el.x, el.y, el.width, el.height);
          }
        } else {
          ctx.fillStyle = '#18181B';
          ctx.fillRect(el.x, el.y, el.width, el.height);
        }
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.strokeRect(el.x, el.y, el.width, el.height);
      } catch {
        // Continue
      }
    } else if (el.type === 'audio') {
      ctx.fillStyle = '#1A1A22';
      ctx.strokeStyle = '#A855F7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(el.x, el.y, el.width, el.height, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#F4F4F5';
      ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(el.fileName || 'Pista de audio', el.x + 20, el.y + 24);
    }

    ctx.restore();
  }

  ctx.restore();

  canvas.toBlob((blob) => {
    if (blob) {
      const sanitized = board.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      downloadBlob(blob, `${sanitized}_pizarra.png`);
    }
  }, 'image/png');
}

/**
 * Exports board state to downloadable JSON file.
 */
export function exportBoardToJSON(board: BoardState): void {
  const data = JSON.stringify(board, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const sanitized = board.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  downloadBlob(blob, `${sanitized}_pizarra.json`);
}

/**
 * Imports board state from JSON string.
 */
export function importBoardFromJSON(jsonString: string): BoardState | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !Array.isArray(parsed.elements)) {
      throw new Error('Estructura de pizarra JSON no válida');
    }
    return {
      id: parsed.id || `pizarra_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: parsed.name ? `${parsed.name} (Importada)` : 'Pizarra Importada',
      createdAt: parsed.createdAt || Date.now(),
      updatedAt: Date.now(),
      thumbnail: parsed.thumbnail,
      elements: parsed.elements,
      viewport: parsed.viewport || { panX: 0, panY: 0, zoom: 1 },
    };
  } catch (err) {
    console.error('Error al importar archivo JSON:', err);
    return null;
  }
}

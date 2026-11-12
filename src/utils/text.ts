/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CanvasElement } from '../types/canvas';

export interface WrappedLine {
  text: string;
  isParagraphEnd: boolean;
}

/**
 * Wraps text into lines that fit within maxWidth.
 */
export function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): WrappedLine[] {
  if (!text) return [];

  // Minimum safety width to avoid infinite loops or 0-width bounds
  const effectiveWidth = Math.max(maxWidth, 40);
  const paragraphs = text.split('\n');
  const wrappedLines: WrappedLine[] = [];

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const paragraph = paragraphs[pIdx];
    if (paragraph.trim() === '') {
      wrappedLines.push({ text: '', isParagraphEnd: true });
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (let wIdx = 0; wIdx < words.length; wIdx++) {
      const word = words[wIdx];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = ctx.measureText(testLine).width;

      if (testWidth <= effectiveWidth || currentLine === '') {
        currentLine = testLine;
      } else {
        // Line exceeded maxWidth: push currentLine and start new line
        wrappedLines.push({ text: currentLine, isParagraphEnd: false });
        currentLine = word;
      }
    }

    if (currentLine) {
      wrappedLines.push({ text: currentLine, isParagraphEnd: true });
    }
  }

  return wrappedLines;
}

/**
 * Renders wrapped text inside an element's bounding box with alignment support.
 */
export function renderWrappedText(
  ctx: CanvasRenderingContext2D,
  el: CanvasElement,
  options: { zoom?: number } = {}
): void {
  if (!el.text) return;

  const fontSize = el.fontSize || 18;
  const fontFamily = el.fontFamily || 'Plus Jakarta Sans';
  const align = el.textAlign || 'left';
  const width = Math.max(el.width, 40);
  const lineHeight = fontSize * 1.35;

  ctx.save();
  ctx.font = `${fontSize}px "${fontFamily}", sans-serif`;
  ctx.fillStyle = el.strokeColor || '#FFFFFF';
  ctx.textBaseline = 'top';

  const lines = wrapTextLines(ctx, el.text, width);

  lines.forEach((line, idx) => {
    const lineY = el.y + idx * lineHeight;
    const trimmed = line.text;

    if (!trimmed) return;

    if (align === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(trimmed, el.x + width / 2, lineY);
    } else if (align === 'right') {
      ctx.textAlign = 'right';
      ctx.fillText(trimmed, el.x + width, lineY);
    } else if (align === 'justify') {
      const words = trimmed.split(' ');
      // If last line of paragraph or only 1 word, align left
      if (line.isParagraphEnd || words.length <= 1) {
        ctx.textAlign = 'left';
        ctx.fillText(trimmed, el.x, lineY);
      } else {
        // Distribute extra spacing evenly between words across bounding box width
        const wordsWidth = words.reduce((acc, w) => acc + ctx.measureText(w).width, 0);
        const totalSpacing = Math.max(width - wordsWidth, 0);
        const spacePerGap = totalSpacing / (words.length - 1);

        ctx.textAlign = 'left';
        let curX = el.x;
        for (let i = 0; i < words.length; i++) {
          const w = words[i];
          ctx.fillText(w, curX, lineY);
          curX += ctx.measureText(w).width + spacePerGap;
        }
      }
    } else {
      // Default left
      ctx.textAlign = 'left';
      ctx.fillText(trimmed, el.x, lineY);
    }
  });

  ctx.restore();
}

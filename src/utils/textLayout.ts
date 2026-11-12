/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TextAlign } from '../types/canvas';

export interface WrappedLine {
  text: string;
  words: string[];
  isLastLineOfParagraph: boolean;
}

/**
 * Splits text into wrapped lines based on maxWidth and font settings.
 */
export function getWrappedLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontSize: number,
  fontFamily: string
): { lines: WrappedLine[]; totalHeight: number; lineHeight: number } {
  ctx.save();
  ctx.font = `${fontSize}px ${fontFamily || 'Plus Jakarta Sans'}, sans-serif`;

  const lineHeight = Math.round(fontSize * 1.35);
  const paragraphs = text.split('\n');
  const result: WrappedLine[] = [];

  const safeMaxWidth = Math.max(maxWidth, 40);

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const para = paragraphs[pIdx];
    if (!para || para.trim().length === 0) {
      result.push({ text: '', words: [], isLastLineOfParagraph: true });
      continue;
    }

    const words = para.split(' ');
    let currentLineWords: string[] = [];
    let currentLineText = '';

    for (let wIdx = 0; wIdx < words.length; wIdx++) {
      const word = words[wIdx];
      const testLine = currentLineText ? `${currentLineText} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > safeMaxWidth && currentLineWords.length > 0) {
        result.push({
          text: currentLineText,
          words: [...currentLineWords],
          isLastLineOfParagraph: false,
        });
        currentLineWords = [word];
        currentLineText = word;
      } else {
        currentLineWords.push(word);
        currentLineText = testLine;
      }
    }

    if (currentLineWords.length > 0) {
      result.push({
        text: currentLineText,
        words: [...currentLineWords],
        isLastLineOfParagraph: true,
      });
    }
  }

  ctx.restore();

  const totalHeight = Math.max(result.length * lineHeight, lineHeight);
  return { lines: result, totalHeight, lineHeight };
}

/**
 * Draws wrapped and aligned text onto canvas context.
 */
export function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  lines: WrappedLine[],
  x: number,
  y: number,
  width: number,
  lineHeight: number,
  align: TextAlign = 'left',
  textColor: string,
  fontSize: number,
  fontFamily: string
): void {
  ctx.save();
  ctx.font = `${fontSize}px ${fontFamily || 'Plus Jakarta Sans'}, sans-serif`;
  ctx.fillStyle = textColor;
  ctx.textBaseline = 'top';

  const safeWidth = Math.max(width, 40);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineY = y + i * lineHeight;

    if (!line.text) continue;

    if (align === 'center') {
      const lineMetrics = ctx.measureText(line.text);
      const startX = x + (safeWidth - lineMetrics.width) / 2;
      ctx.textAlign = 'left';
      ctx.fillText(line.text, startX, lineY);
    } else if (align === 'right') {
      const lineMetrics = ctx.measureText(line.text);
      const startX = x + safeWidth - lineMetrics.width;
      ctx.textAlign = 'left';
      ctx.fillText(line.text, startX, lineY);
    } else if (align === 'justify') {
      if (line.isLastLineOfParagraph || line.words.length <= 1) {
        // Last line of paragraph or single-word line is left aligned
        ctx.textAlign = 'left';
        ctx.fillText(line.text, x, lineY);
      } else {
        // Justify words across width
        const wordWidths = line.words.map((w) => ctx.measureText(w).width);
        const wordsTotalWidth = wordWidths.reduce((acc, val) => acc + val, 0);
        const totalSpace = Math.max(0, safeWidth - wordsTotalWidth);
        const spaceBetween = totalSpace / (line.words.length - 1);

        ctx.textAlign = 'left';
        let curX = x;
        for (let w = 0; w < line.words.length; w++) {
          ctx.fillText(line.words[w], curX, lineY);
          curX += wordWidths[w] + spaceBetween;
        }
      }
    } else {
      // Left aligned
      ctx.textAlign = 'left';
      ctx.fillText(line.text, x, lineY);
    }
  }

  ctx.restore();
}

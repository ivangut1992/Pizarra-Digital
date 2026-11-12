/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CanvasElement, Point, ViewportState } from '../types/canvas';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5.0;

export const DEFAULT_VIEWPORT: ViewportState = {
  panX: 0,
  panY: 0,
  zoom: 1.0,
};

/**
 * Screen Space to World Space Coordinate Translation:
 * X_w = (X_s - panX) / zoom
 * Y_w = (Y_s - panY) / zoom
 */
export function screenToWorld(screenPt: Point, viewport: ViewportState): Point {
  return {
    x: (screenPt.x - viewport.panX) / viewport.zoom,
    y: (screenPt.y - viewport.panY) / viewport.zoom,
  };
}

/**
 * World Space to Screen Space Coordinate Translation:
 * X_s = X_w * zoom + panX
 * Y_s = Y_w * zoom + panY
 */
export function worldToScreen(worldPt: Point, viewport: ViewportState): Point {
  return {
    x: worldPt.x * viewport.zoom + viewport.panX,
    y: worldPt.y * viewport.zoom + viewport.panY,
  };
}

/**
 * Zoom anchored at the current pointer position in screen coordinates.
 * Keeps the world coordinate under the cursor stationary.
 */
export function zoomAt(
  anchorScreen: Point,
  targetZoomFactor: number,
  currentViewport: ViewportState,
  minZoom = MIN_ZOOM,
  maxZoom = MAX_ZOOM
): ViewportState {
  const newZoom = Math.min(Math.max(currentViewport.zoom * targetZoomFactor, minZoom), maxZoom);
  if (Math.abs(newZoom - currentViewport.zoom) < 0.0001) {
    return currentViewport;
  }

  // Calculate new pan to keep world point under anchorScreen invariant:
  // anchorScreen.x = worldX * newZoom + newPanX
  // worldX = (anchorScreen.x - panX) / oldZoom
  const newPanX = anchorScreen.x - (anchorScreen.x - currentViewport.panX) * (newZoom / currentViewport.zoom);
  const newPanY = anchorScreen.y - (anchorScreen.y - currentViewport.panY) * (newZoom / currentViewport.zoom);

  return {
    panX: newPanX,
    panY: newPanY,
    zoom: newZoom,
  };
}

/**
 * Calculates the collective bounding box of all elements in World space.
 */
export function calculateBoundingBox(elements: CanvasElement[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} | null {
  if (elements.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    if (el.type === 'pen' && el.points && el.points.length > 0) {
      for (const pt of el.points) {
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }
    } else {
      const elMinX = Math.min(el.x, el.x + el.width);
      const elMaxX = Math.max(el.x, el.x + el.width);
      const elMinY = Math.min(el.y, el.y + el.height);
      const elMaxY = Math.max(el.y, el.y + el.height);

      if (elMinX < minX) minX = elMinX;
      if (elMinY < minY) minY = elMinY;
      if (elMaxX > maxX) maxX = elMaxX;
      if (elMaxY > maxY) maxY = elMaxY;
    }
  }

  if (minX === Infinity || minY === Infinity) return null;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(maxX - minX, 20),
    height: Math.max(maxY - minY, 20),
  };
}

/**
 * Fit all canvas elements into view, centering and scaling comfortably.
 */
export function fitToScreen(
  elements: CanvasElement[],
  screenWidth: number,
  screenHeight: number,
  padding = 80
): ViewportState {
  const bbox = calculateBoundingBox(elements);
  if (!bbox) {
    return {
      panX: screenWidth / 2,
      panY: screenHeight / 2,
      zoom: 1.0,
    };
  }

  const availableWidth = Math.max(screenWidth - padding * 2, 100);
  const availableHeight = Math.max(screenHeight - padding * 2, 100);

  const scaleX = availableWidth / bbox.width;
  const scaleY = availableHeight / bbox.height;
  const targetZoom = Math.min(Math.max(Math.min(scaleX, scaleY), MIN_ZOOM), 2.0);

  const centerX = bbox.minX + bbox.width / 2;
  const centerY = bbox.minY + bbox.height / 2;

  return {
    zoom: targetZoom,
    panX: screenWidth / 2 - centerX * targetZoom,
    panY: screenHeight / 2 - centerY * targetZoom,
  };
}

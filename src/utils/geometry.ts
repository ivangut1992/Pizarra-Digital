/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnchorPosition, CanvasElement, Point, TransformHandle } from '../types/canvas';

/**
 * Returns the anchor point of an element in world coordinates.
 */
export function getElementAnchor(element: CanvasElement, anchor: AnchorPosition): Point {
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;

  let localX = cx;
  let localY = cy;

  switch (anchor) {
    case 'top':
      localX = cx;
      localY = element.y;
      break;
    case 'bottom':
      localX = cx;
      localY = element.y + element.height;
      break;
    case 'left':
      localX = element.x;
      localY = cy;
      break;
    case 'right':
      localX = element.x + element.width;
      localY = cy;
      break;
  }

  if (!element.rotation) {
    return { x: localX, y: localY };
  }

  // Rotate point around element center
  const cos = Math.cos(element.rotation);
  const sin = Math.sin(element.rotation);
  const dx = localX - cx;
  const dy = localY - cy;

  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

/**
 * Returns list of 4 cardinal anchors for snapping.
 */
export function getAllAnchors(element: CanvasElement): { anchor: AnchorPosition; point: Point }[] {
  return [
    { anchor: 'top', point: getElementAnchor(element, 'top') },
    { anchor: 'right', point: getElementAnchor(element, 'right') },
    { anchor: 'bottom', point: getElementAnchor(element, 'bottom') },
    { anchor: 'left', point: getElementAnchor(element, 'left') },
  ];
}

/**
 * Returns the closest anchor on an element to a given world point.
 */
export function getClosestAnchor(element: CanvasElement, point: Point): { anchor: AnchorPosition; point: Point } {
  const anchors = getAllAnchors(element);
  let best = anchors[0];
  let bestDist = distance(point, best.point);
  for (let i = 1; i < anchors.length; i++) {
    const d = distance(point, anchors[i].point);
    if (d < bestDist) {
      bestDist = d;
      best = anchors[i];
    }
  }
  return best;
}

/**
 * Distance between two points.
 */
export function distance(p1: Point, p2: Point): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Distance from point P to line segment AB.
 */
export function distToSegment(p: Point, a: Point, b: Point): number {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (l2 === 0) return distance(p, a);
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return distance(p, {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
  });
}

/**
 * Catmull-Rom spline smoothing algorithm:
 * Takes raw sampled points and renders smooth cubic spline on 2D canvas context.
 */
export function drawCatmullRomSpline(ctx: CanvasRenderingContext2D, points: Point[], tension = 0.5) {
  if (points.length < 2) return;

  if (points.length === 2) {
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    return;
  }

  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension;

    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
}

/**
 * Rotates a point around origin (ox, oy) by angle (radians).
 */
export function rotatePoint(pt: Point, origin: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = pt.x - origin.x;
  const dy = pt.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/**
 * Checks whether point (in world space) hits an element.
 */
export function isPointInElement(
  pt: Point,
  el: CanvasElement,
  threshold = 6,
  allElements?: CanvasElement[]
): boolean {
  if (el.type === 'pen' || el.type === 'path') {
    if (!el.points || el.points.length === 0) return false;
    for (let i = 0; i < el.points.length - 1; i++) {
      if (distToSegment(pt, el.points[i], el.points[i + 1]) <= Math.max(el.strokeWidth / 2, threshold)) {
        return true;
      }
    }
    return false;
  }

  if (el.type === 'connector') {
    // Test connector path segments with dynamic anchors if linked
    const startElem = allElements?.find((e) => e.id === el.startElementId) || null;
    const endElem = allElements?.find((e) => e.id === el.endElementId) || null;
    const pts = getConnectorRoute(el, startElem, endElem);
    for (let i = 0; i < pts.length - 1; i++) {
      if (distToSegment(pt, pts[i], pts[i + 1]) <= Math.max(el.strokeWidth, threshold)) {
        return true;
      }
    }
    return false;
  }

  // For 2D shapes: unrotate test point around element center
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const unrotated = el.rotation ? rotatePoint(pt, { x: cx, y: cy }, -el.rotation) : pt;

  const minX = Math.min(el.x, el.x + el.width);
  const maxX = Math.max(el.x, el.x + el.width);
  const minY = Math.min(el.y, el.y + el.height);
  const maxY = Math.max(el.y, el.y + el.height);

  if (el.type === 'circle') {
    const rx = Math.abs(el.width) / 2;
    const ry = Math.abs(el.height) / 2;
    if (rx === 0 || ry === 0) return false;
    const normalizedDist = ((unrotated.x - cx) ** 2) / (rx ** 2) + ((unrotated.y - cy) ** 2) / (ry ** 2);
    return normalizedDist <= 1.05;
  }

  if (el.type === 'triangle') {
    // Barycentric coordinates check
    const p1 = { x: cx, y: minY };
    const p2 = { x: minX, y: maxY };
    const p3 = { x: maxX, y: maxY };
    const area = 0.5 * (-p2.y * p3.x + p1.y * (-p2.x + p3.x) + p1.x * (p2.y - p3.y) + p2.x * p3.y);
    const s = 1 / (2 * area) * (p1.y * p3.x - p1.x * p3.y + (p3.y - p1.y) * unrotated.x + (p1.x - p3.x) * unrotated.y);
    const t = 1 / (2 * area) * (p1.x * p2.y - p1.y * p2.x + (p1.y - p2.y) * unrotated.x + (p2.x - p1.x) * unrotated.y);
    return s >= 0 && t >= 0 && (1 - s - t) >= 0;
  }

  // Rect, Text, Image
  return (
    unrotated.x >= minX - threshold &&
    unrotated.x <= maxX + threshold &&
    unrotated.y >= minY - threshold &&
    unrotated.y <= maxY + threshold
  );
}

/**
 * Calculates waypoints for orthogonal or curved connectors.
 */
export function getConnectorRoute(
  connector: CanvasElement,
  startElem: CanvasElement | null,
  endElem: CanvasElement | null
): Point[] {
  let pStart: Point = connector.startPoint || { x: connector.x, y: connector.y };
  let pEnd: Point = connector.endPoint || { x: connector.x + connector.width, y: connector.y + connector.height };

  if (startElem && connector.startAnchor) {
    pStart = getElementAnchor(startElem, connector.startAnchor);
  }
  if (endElem && connector.endAnchor) {
    pEnd = getElementAnchor(endElem, connector.endAnchor);
  }

  if (connector.routing === 'curved') {
    // Generate curved points for hit-testing / rendering
    const dx = pEnd.x - pStart.x;
    const dy = pEnd.y - pStart.y;
    const midX = (pStart.x + pEnd.x) / 2;
    const midY = (pStart.y + pEnd.y) / 2;
    // Slight curvature offset perpendicular to line
    const offset = Math.min(Math.hypot(dx, dy) * 0.2, 40);
    const ctrl = { x: midX, y: midY - offset };
    
    // Sample curve for hit-testing
    const pts: Point[] = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = (1 - t) ** 2 * pStart.x + 2 * (1 - t) * t * ctrl.x + t ** 2 * pEnd.x;
      const y = (1 - t) ** 2 * pStart.y + 2 * (1 - t) * t * ctrl.y + t ** 2 * pEnd.y;
      pts.push({ x, y });
    }
    return pts;
  }

  // Orthogonal routing (Manhattan step with safe exits)
  const pts: Point[] = [pStart];
  const midX = (pStart.x + pEnd.x) / 2;

  // Simple clean 3-step orthogonal path
  pts.push({ x: midX, y: pStart.y });
  pts.push({ x: midX, y: pEnd.y });
  pts.push(pEnd);

  return pts;
}

/**
 * Returns positions of the 8 transformation handles and 1 rotation handle.
 */
export function getTransformHandles(
  el: CanvasElement,
  handleSize = 8
): { handle: TransformHandle; x: number; y: number; cursor: string }[] {
  const minX = Math.min(el.x, el.x + el.width);
  const maxX = Math.max(el.x, el.x + el.width);
  const minY = Math.min(el.y, el.y + el.height);
  const maxY = Math.max(el.y, el.y + el.height);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const cx = midX;
  const cy = midY;

  const rawHandles: { handle: TransformHandle; pt: Point; cursor: string }[] = [
    { handle: 'nw', pt: { x: minX, y: minY }, cursor: 'nwse-resize' },
    { handle: 'n',  pt: { x: midX, y: minY }, cursor: 'ns-resize' },
    { handle: 'ne', pt: { x: maxX, y: minY }, cursor: 'nesw-resize' },
    { handle: 'e',  pt: { x: maxX, y: midY }, cursor: 'ew-resize' },
    { handle: 'se', pt: { x: maxX, y: maxY }, cursor: 'nwse-resize' },
    { handle: 's',  pt: { x: midX, y: maxY }, cursor: 'ns-resize' },
    { handle: 'sw', pt: { x: minX, y: maxY }, cursor: 'nesw-resize' },
    { handle: 'w',  pt: { x: minX, y: midY }, cursor: 'ew-resize' },
    // Rotation handle 24px above top edge
    { handle: 'rot', pt: { x: midX, y: minY - 24 }, cursor: 'crosshair' },
  ];

  return rawHandles.map((h) => {
    const rotated = el.rotation ? rotatePoint(h.pt, { x: cx, y: cy }, el.rotation) : h.pt;
    return {
      handle: h.handle,
      x: rotated.x,
      y: rotated.y,
      cursor: h.cursor,
    };
  });
}

/**
 * Test whether point is over a specific handle of an active selected element.
 */
export function getHandleUnderPoint(
  pt: Point,
  el: CanvasElement,
  hitRadius = 8
): TransformHandle | null {
  const handles = getTransformHandles(el);
  for (const h of handles) {
    if (Math.hypot(pt.x - h.x, pt.y - h.y) <= hitRadius) {
      return h.handle;
    }
  }
  return null;
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Point {
  x: number;
  y: number;
}

export interface ViewportState {
  panX: number;
  panY: number;
  zoom: number; // 0.1 to 5.0
}

export type CanvasElementType =
  | 'pen'
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'path'
  | 'text'
  | 'connector'
  | 'image'
  | 'video'
  | 'audio';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';

export type AnchorPosition = 'top' | 'right' | 'bottom' | 'left';

export type ConnectorRouting = 'orthogonal' | 'curved';

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

export interface LayerConfig {
  id: number; // 1, 2, 3, 4
  name: string;
  visible: boolean;
  locked: boolean;
}

export interface CanvasElement {
  id: string;
  type: CanvasElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // in radians
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  opacity: number; // 0.0 to 1.0
  layer?: number; // 1, 2, 3, 4 (default 1)

  // For 'pen' & 'path'
  points?: Point[];

  // For 'text'
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: TextAlign; // 'left' | 'center' | 'right' | 'justify'

  // For 'image', 'video', 'audio'
  src?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  aspectRatio?: number;
  mediaType?: 'image' | 'gif' | 'video' | 'audio';
  fileName?: string;
  duration?: number;
  isPlaying?: boolean;
  poster?: string;
  volume?: number; // 0.0 to 1.0 (default 1.0)
  isMuted?: boolean;

  // For 'connector'
  startElementId?: string;
  startAnchor?: AnchorPosition;
  endElementId?: string;
  endAnchor?: AnchorPosition;
  routing?: ConnectorRouting;
  startPoint?: Point; // fallback if not anchored
  endPoint?: Point;   // fallback if not anchored
}

export interface BoardState {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
  elements: CanvasElement[];
  viewport: ViewportState;
  layers?: LayerConfig[];
  activeLayer?: number;
}

export type ToolType =
  | 'hand'
  | 'select'
  | 'pen'
  | 'eraser'
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'text'
  | 'connector'
  | 'image';

export type TransformHandle =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'rot';

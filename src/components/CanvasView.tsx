/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  AnchorPosition,
  BoardState,
  CanvasElement,
  CanvasElementType,
  ConnectorRouting,
  LayerConfig,
  Point,
  StrokeStyle,
  TextAlign,
  ToolType,
  TransformHandle,
  ViewportState,
} from '../types/canvas';
import {
  fitToScreen,
  screenToWorld,
  worldToScreen,
  zoomAt,
  DEFAULT_VIEWPORT,
  MIN_ZOOM,
  MAX_ZOOM,
} from '../utils/viewport';
import {
  distToSegment,
  drawCatmullRomSpline,
  getAllAnchors,
  getClosestAnchor,
  getConnectorRoute,
  getElementAnchor,
  getHandleUnderPoint,
  getTransformHandles,
  isPointInElement,
  rotatePoint,
} from '../utils/geometry';
import { getWrappedLines, drawWrappedText } from '../utils/textLayout';
import { Toolbar } from './Toolbar';
import { ToolOptionsPanel } from './ToolOptionsPanel';
import { ColorPanel } from './ColorPanel';
import { TopNav } from './TopNav';
import { ImageModal } from './ImageModal';
import { LayerControl } from './LayerControl';
import { generateBoardThumbnail, saveBoard } from '../utils/storage';
import { OptimizedMediaResult, optimizeUploadedFile } from '../utils/mediaOptimization';
import { ImagePlus } from 'lucide-react';

export const DEFAULT_LAYERS: LayerConfig[] = [
  { id: 1, name: 'Capa 1', visible: true, locked: false },
  { id: 2, name: 'Capa 2', visible: true, locked: false },
  { id: 3, name: 'Capa 3', visible: true, locked: false },
  { id: 4, name: 'Capa 4', visible: true, locked: false },
];

interface DragItemOrigin {
  id: string;
  x: number;
  y: number;
  points?: Point[];
  startPoint?: Point;
  endPoint?: Point;
}

function moveElementToFrontOfLayer(
  allElements: CanvasElement[],
  elementId: string,
  layerId: number
): CanvasElement[] {
  const targetEl = allElements.find((e) => e.id === elementId);
  if (!targetEl) return allElements;

  const otherLayers = allElements.filter((el) => (el.layer ?? 1) !== layerId);
  const currentLayerElements = allElements.filter((el) => (el.layer ?? 1) === layerId);
  const withoutTarget = currentLayerElements.filter((el) => el.id !== elementId);
  const reorderedLayer = [...withoutTarget, targetEl];

  return [...otherLayers, ...reorderedLayer].sort(
    (a, b) => (a.layer ?? 1) - (b.layer ?? 1)
  );
}

interface CanvasViewProps {
  initialBoard: BoardState;
  onBackToDashboard: () => void;
  onBoardUpdated: (board: BoardState) => void;
}

export const CanvasView: React.FC<CanvasViewProps> = ({
  initialBoard,
  onBackToDashboard,
  onBoardUpdated,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Core board state
  const [board, setBoard] = useState<BoardState>(initialBoard);
  const [viewport, setViewport] = useState<ViewportState>(
    initialBoard.viewport || DEFAULT_VIEWPORT
  );
  const [isSaving, setIsSaving] = useState(false);

  // Tool states
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [activeShapeType, setActiveShapeType] = useState<'rect' | 'circle' | 'triangle'>('rect');
  const [strokeColor, setStrokeColor] = useState<string>('#F5F5F5');
  const [fillColor, setFillColor] = useState<string>('transparent');
  const [strokeWidth, setStrokeWidth] = useState<number>(2);
  const [strokeStyle, setStrokeStyle] = useState<StrokeStyle>('solid');
  const [opacity, setOpacity] = useState<number>(1.0);
  const [fontSize, setFontSize] = useState<number>(18);
  const [fontFamily, setFontFamily] = useState<string>('Plus Jakarta Sans');
  const [textAlign, setTextAlign] = useState<TextAlign>('left');
  const [connectorRouting, setConnectorRouting] = useState<ConnectorRouting>('orthogonal');
  const [isColorPanelOpen, setIsColorPanelOpen] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // 4-Layers feature state
  const [layers, setLayers] = useState<LayerConfig[]>(
    initialBoard.layers && initialBoard.layers.length === 4
      ? initialBoard.layers
      : DEFAULT_LAYERS
  );
  const [activeLayer, setActiveLayer] = useState<number>(initialBoard.activeLayer || 1);

  // Compute element count per layer
  const layerElementCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const el of board.elements) {
      const l = el.layer ?? 1;
      counts[l] = (counts[l] || 0) + 1;
    }
    return counts;
  }, [board.elements]);

  // Selection states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<{ start: Point; current: Point } | null>(null);

  const selectedElements = useMemo(
    () => board.elements.filter((el) => selectedIds.includes(el.id)),
    [board.elements, selectedIds]
  );

  const selectedElementType: CanvasElementType | null = useMemo(() => {
    if (selectedElements.length === 0) return null;
    const last = selectedElements[selectedElements.length - 1];
    return last.type;
  }, [selectedElements]);

  // Interactive interaction modes
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<Point>({ x: 0, y: 0 });
  const viewportStartRef = useRef<ViewportState>(viewport);

  // Active transform (resize or rotate)
  const [activeHandle, setActiveHandle] = useState<TransformHandle | null>(null);
  const transformStartRef = useRef<{
    pointerStart: Point;
    elementStart: CanvasElement;
  } | null>(null);

  // Element dragging (supports multiple selected elements)
  const [isDraggingElements, setIsDraggingElements] = useState(false);
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });
  const dragElementsStartRef = useRef<DragItemOrigin[]>([]);

  // Pen drawing
  const currentStrokePointsRef = useRef<Point[]>([]);

  // Shape creation
  const shapeStartRef = useRef<Point | null>(null);

  // Connector drawing
  const connectorStartRef = useRef<{
    startPoint: Point;
    elementId?: string;
    anchor?: AnchorPosition;
  } | null>(null);
  const [hoveredAnchor, setHoveredAnchor] = useState<{
    elementId: string;
    anchor: AnchorPosition;
    point: Point;
  } | null>(null);
  const connectorCurrentPtRef = useRef<Point | null>(null);

  // Text inline editing overlay
  const [editingTextElement, setEditingTextElement] = useState<CanvasElement | null>(null);
  const [editTextValue, setEditTextValue] = useState<string>('');

  // Image modal state
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // Media element caches for Canvas rendering
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const videoCacheRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioCacheRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Undo / Redo history stacks
  const historyUndoStack = useRef<CanvasElement[][]>([]);
  const historyRedoStack = useRef<CanvasElement[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Push state to undo stack
  const recordHistory = useCallback((currentElements: CanvasElement[]) => {
    historyUndoStack.current.push(JSON.parse(JSON.stringify(currentElements)));
    if (historyUndoStack.current.length > 50) {
      historyUndoStack.current.shift();
    }
    historyRedoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyUndoStack.current.length === 0) return;
    const previousElements = historyUndoStack.current.pop()!;
    historyRedoStack.current.push(JSON.parse(JSON.stringify(board.elements)));
    setBoard((prev) => ({ ...prev, elements: previousElements, updatedAt: Date.now() }));
    setSelectedIds([]);
    setCanUndo(historyUndoStack.current.length > 0);
    setCanRedo(true);
  }, [board.elements]);

  const handleRedo = useCallback(() => {
    if (historyRedoStack.current.length === 0) return;
    const nextElements = historyRedoStack.current.pop()!;
    historyUndoStack.current.push(JSON.parse(JSON.stringify(board.elements)));
    setBoard((prev) => ({ ...prev, elements: nextElements, updatedAt: Date.now() }));
    setSelectedIds([]);
    setCanUndo(true);
    setCanRedo(historyRedoStack.current.length > 0);
  }, [board.elements]);

  // Auto-save tracking: 5-minute periodic interval and page-close trigger
  const isDirtyRef = useRef(false);
  const isInitialMountRef = useRef(true);
  const latestBoardRef = useRef<BoardState>({
    ...board,
    viewport,
    layers,
    activeLayer,
  });

  // Keep latestBoardRef updated with current canvas state
  useEffect(() => {
    latestBoardRef.current = {
      ...board,
      viewport,
      layers,
      activeLayer,
    };
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
    } else {
      isDirtyRef.current = true;
    }
  }, [board, viewport, layers, activeLayer]);

  // Execute board save operation
  const executeSave = useCallback(async (currentBoard: BoardState) => {
    try {
      setIsSaving(true);
      const thumbnail = generateBoardThumbnail(currentBoard.elements);
      const updatedBoard: BoardState = {
        ...currentBoard,
        thumbnail,
        updatedAt: Date.now(),
      };

      // 1. Synchronous emergency backup in localStorage
      try {
        localStorage.setItem(`pizarra_autosave_${updatedBoard.id}`, JSON.stringify(updatedBoard));
      } catch (lsErr) {
        // Continue if localStorage is constrained
      }

      // 2. Persistent save in IndexedDB
      await saveBoard(updatedBoard);
      onBoardUpdated(updatedBoard);
      isDirtyRef.current = false;
      setIsSaving(false);
    } catch (err) {
      console.error('Error al guardar la pizarra:', err);
      setIsSaving(false);
    }
  }, [onBoardUpdated]);

  // Periodic 5-minute auto-save interval (5 min = 300,000 ms)
  useEffect(() => {
    const AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

    const timer = setInterval(() => {
      if (isDirtyRef.current) {
        executeSave(latestBoardRef.current);
      }
    }, AUTO_SAVE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [executeSave]);

  // Trigger auto-save when the page is closed or hidden
  useEffect(() => {
    const handleCloseOrUnload = () => {
      if (isDirtyRef.current) {
        const current = latestBoardRef.current;
        // Immediate synchronous backup
        try {
          const thumbnail = generateBoardThumbnail(current.elements);
          const snap: BoardState = {
            ...current,
            thumbnail,
            updatedAt: Date.now(),
          };
          localStorage.setItem(`pizarra_autosave_${snap.id}`, JSON.stringify(snap));
          saveBoard(snap).catch(() => {});
          isDirtyRef.current = false;
        } catch {}
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isDirtyRef.current) {
        handleCloseOrUnload();
      }
    };

    window.addEventListener('beforeunload', handleCloseOrUnload);
    window.addEventListener('pagehide', handleCloseOrUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      handleCloseOrUnload();
      window.removeEventListener('beforeunload', handleCloseOrUnload);
      window.removeEventListener('pagehide', handleCloseOrUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Volume control handlers for video and audio elements
  const handleChangeVolume = useCallback(
    (newVol: number) => {
      setVolume(newVol);
      setIsMuted(newVol === 0);

      if (selectedIds.length > 0) {
        setBoard((prev) => ({
          ...prev,
          elements: prev.elements.map((el) => {
            if (selectedIds.includes(el.id) && (el.type === 'video' || el.type === 'audio')) {
              return { ...el, volume: newVol, isMuted: newVol === 0 };
            }
            return el;
          }),
        }));

        selectedElements.forEach((el) => {
          if (el.src) {
            if (el.type === 'video') {
              const vid = videoCacheRef.current.get(el.src);
              if (vid) {
                vid.volume = newVol;
                vid.muted = newVol === 0;
              }
            } else if (el.type === 'audio') {
              const aud = audioCacheRef.current.get(el.src);
              if (aud) {
                aud.volume = newVol;
                aud.muted = newVol === 0;
              }
            }
          }
        });
      }
    },
    [selectedIds, selectedElements]
  );

  const handleToggleMute = useCallback(() => {
    setIsMuted((prevMuted) => {
      const nextMuted = !prevMuted;
      if (selectedIds.length > 0) {
        setBoard((prev) => ({
          ...prev,
          elements: prev.elements.map((el) => {
            if (selectedIds.includes(el.id) && (el.type === 'video' || el.type === 'audio')) {
              return { ...el, isMuted: nextMuted };
            }
            return el;
          }),
        }));

        selectedElements.forEach((el) => {
          if (el.src) {
            if (el.type === 'video') {
              const vid = videoCacheRef.current.get(el.src);
              if (vid) {
                vid.muted = nextMuted;
                if (!nextMuted && vid.volume === 0) vid.volume = volume > 0 ? volume : 1.0;
              }
            } else if (el.type === 'audio') {
              const aud = audioCacheRef.current.get(el.src);
              if (aud) {
                aud.muted = nextMuted;
                if (!nextMuted && aud.volume === 0) aud.volume = volume > 0 ? volume : 1.0;
              }
            }
          }
        });
      }
      return nextMuted;
    });
  }, [selectedIds, selectedElements, volume]);

  // Keyboard events listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcut keys when typing inside an input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
      } else if (e.key === 'v' || e.key === 'V') {
        setActiveTool('select');
      } else if (e.key === 'h' || e.key === 'H') {
        setActiveTool('hand');
      } else if (e.key === 'p' || e.key === 'P') {
        setActiveTool('pen');
      } else if (e.key === 'e' || e.key === 'E') {
        setActiveTool('eraser');
      } else if (e.key === 'r' || e.key === 'R') {
        setActiveTool('rect');
      } else if (e.key === 't' || e.key === 'T') {
        setActiveTool('text');
      } else if (e.key === 'c' || e.key === 'C') {
        setActiveTool('connector');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          recordHistory(board.elements);
          setBoard((prev) => ({
            ...prev,
            elements: prev.elements.filter((el) => !selectedIds.includes(el.id)),
          }));
          setSelectedIds([]);
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
      } else if (e.shiftKey && e.key === '!') {
        // Fit to screen shortcut (Shift + 1)
        e.preventDefault();
        const nextVp = fitToScreen(board.elements, window.innerWidth, window.innerHeight);
        setViewport(nextVp);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedIds, board.elements, handleUndo, handleRedo, recordHistory]);

  // Main Render Loop with requestAnimationFrame
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      // Reset transform and clear
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Apply DPR scaling
      ctx.scale(dpr, dpr);

      // Draw background
      ctx.fillStyle = '#121212';
      ctx.fillRect(0, 0, screenWidth, screenHeight);

      // Draw matrix dot-grid scaled to zoom
      const baseGridSize = 24;
      const scaledGridSize = baseGridSize * viewport.zoom;
      // Fade out dots gracefully if too dense or sparse
      const dotAlpha = Math.min(Math.max((viewport.zoom - 0.2) / 0.5, 0.2), 0.7);

      ctx.fillStyle = `rgba(55, 55, 55, ${dotAlpha})`;
      const startX = ((viewport.panX % scaledGridSize) + scaledGridSize) % scaledGridSize;
      const startY = ((viewport.panY % scaledGridSize) + scaledGridSize) % scaledGridSize;

      for (let x = startX; x < screenWidth; x += scaledGridSize) {
        for (let y = startY; y < screenHeight; y += scaledGridSize) {
          ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
        }
      }

      // Apply World-to-Screen matrix transform
      ctx.save();
      ctx.translate(viewport.panX, viewport.panY);
      ctx.scale(viewport.zoom, viewport.zoom);

      // Filter out hidden layers and sort ascending by layer (Layer 1 bottom -> Layer 4 top)
      const hiddenLayerIds = new Set<number>();
      layers.forEach((l) => {
        if (!l.visible) hiddenLayerIds.add(l.id);
      });

      const renderableElements = [...board.elements]
        .filter((el) => !hiddenLayerIds.has(el.layer ?? 1))
        .sort((a, b) => (a.layer ?? 1) - (b.layer ?? 1));

      // Render elements in layer order
      for (const el of renderableElements) {
        ctx.save();
        ctx.globalAlpha = el.opacity ?? 1;

        // Lines and strokes remain the same visible screen size regardless of zooming in or out
        const screenStrokeWidth = el.strokeWidth / viewport.zoom;

        if (el.strokeStyle === 'dashed' || el.strokeStyle === 'dotted') {
          // For dashed lines, ensure that the segments always appear as dots
          ctx.lineCap = 'round';
          const dotSpacing = Math.max(el.strokeWidth * 3.5, 12) / viewport.zoom;
          ctx.setLineDash([0.001, dotSpacing]);
        } else {
          ctx.lineCap = el.type === 'pen' ? 'round' : 'square';
          ctx.setLineDash([]);
        }

        // Apply element rotation if any
        if (el.rotation && el.type !== 'pen' && el.type !== 'connector') {
          const cx = el.x + el.width / 2;
          const cy = el.y + el.height / 2;
          ctx.translate(cx, cy);
          ctx.rotate(el.rotation);
          ctx.translate(-cx, -cy);
        }

        if (el.type === 'pen' && el.points && el.points.length > 0) {
          ctx.strokeStyle = el.strokeColor;
          ctx.lineWidth = screenStrokeWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          drawCatmullRomSpline(ctx, el.points);
          ctx.stroke();
        } else if (el.type === 'rect') {
          if (el.fillColor && el.fillColor !== 'transparent') {
            ctx.fillStyle = el.fillColor;
            ctx.fillRect(el.x, el.y, el.width, el.height);
          }
          if (el.strokeWidth > 0 && el.strokeColor !== 'transparent') {
            ctx.strokeStyle = el.strokeColor;
            ctx.lineWidth = screenStrokeWidth;
            ctx.strokeRect(el.x, el.y, el.width, el.height);
          }
        } else if (el.type === 'circle') {
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
          if (el.fillColor && el.fillColor !== 'transparent') {
            ctx.fillStyle = el.fillColor;
            ctx.fill();
          }
          if (el.strokeWidth > 0 && el.strokeColor !== 'transparent') {
            ctx.strokeStyle = el.strokeColor;
            ctx.lineWidth = screenStrokeWidth;
            ctx.stroke();
          }
        } else if (el.type === 'triangle') {
          ctx.beginPath();
          ctx.moveTo(el.x + el.width / 2, el.y);
          ctx.lineTo(el.x, el.y + el.height);
          ctx.lineTo(el.x + el.width, el.y + el.height);
          ctx.closePath();
          if (el.fillColor && el.fillColor !== 'transparent') {
            ctx.fillStyle = el.fillColor;
            ctx.fill();
          }
          if (el.strokeWidth > 0 && el.strokeColor !== 'transparent') {
            ctx.strokeStyle = el.strokeColor;
            ctx.lineWidth = screenStrokeWidth;
            ctx.stroke();
          }
        } else if (el.type === 'text' && el.text) {
          const fSize = el.fontSize || 18;
          const fFamily = el.fontFamily || 'Plus Jakarta Sans';
          const { lines, lineHeight, totalHeight } = getWrappedLines(
            ctx,
            el.text,
            el.width,
            fSize,
            fFamily
          );
          if (el.height < totalHeight) {
            el.height = totalHeight;
          }
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
        } else if (el.type === 'image' && el.src) {
          const isGif =
            el.mediaType === 'gif' ||
            el.src.toLowerCase().includes('.gif') ||
            el.src.toLowerCase().includes('format=gif') ||
            el.src.toLowerCase().includes('giphy.com') ||
            el.src.toLowerCase().includes('tenor.com');
          if (!isGif) {
            let cachedImg = imageCacheRef.current.get(el.src);
            if (!cachedImg) {
              cachedImg = new Image();
              cachedImg.src = el.src;
              imageCacheRef.current.set(el.src, cachedImg);
            }
            if (cachedImg.complete && cachedImg.naturalWidth > 0) {
              ctx.drawImage(cachedImg, el.x, el.y, el.width, el.height);
            } else {
              // Placeholder frame while loading
              ctx.strokeStyle = '#38BDF8';
              ctx.lineWidth = 1 / viewport.zoom;
              ctx.strokeRect(el.x, el.y, el.width, el.height);
            }
          }
        } else if (el.type === 'video' && el.src) {
          let cachedVid = videoCacheRef.current.get(el.src);
          if (!cachedVid) {
            cachedVid = document.createElement('video');
            cachedVid.crossOrigin = 'anonymous';
            cachedVid.playsInline = true;
            cachedVid.loop = true;
            cachedVid.src = el.src;
            cachedVid.currentTime = 0.1;
            cachedVid.volume = el.volume ?? 1.0;
            cachedVid.muted = el.isMuted ?? false;
            videoCacheRef.current.set(el.src, cachedVid);
          } else {
            if (el.volume !== undefined && cachedVid.volume !== el.volume) {
              cachedVid.volume = el.volume;
            }
            if (el.isMuted !== undefined && cachedVid.muted !== el.isMuted) {
              cachedVid.muted = el.isMuted;
            }
          }

          // Video background container
          ctx.fillStyle = '#0F0F12';
          ctx.fillRect(el.x, el.y, el.width, el.height);

          if (cachedVid.readyState >= 2) {
            ctx.drawImage(cachedVid, el.x, el.y, el.width, el.height);
          } else if (el.poster) {
            let cachedPoster = imageCacheRef.current.get(el.poster);
            if (!cachedPoster) {
              cachedPoster = new Image();
              cachedPoster.crossOrigin = 'anonymous';
              cachedPoster.src = el.poster;
              imageCacheRef.current.set(el.poster, cachedPoster);
            }
            if (cachedPoster.complete && cachedPoster.naturalWidth > 0) {
              ctx.drawImage(cachedPoster, el.x, el.y, el.width, el.height);
            }
          }

          // Video border
          ctx.strokeStyle = '#27272A';
          ctx.lineWidth = 1 / viewport.zoom;
          ctx.strokeRect(el.x, el.y, el.width, el.height);

          // Video Play / Pause button badge overlay
          const isPlaying = !cachedVid.paused && !cachedVid.ended;
          const badgeSize = Math.min(36 / viewport.zoom, Math.min(Math.abs(el.width), Math.abs(el.height)) * 0.35);
          const badgeX = el.x + 10 / viewport.zoom;
          const badgeY = el.y + el.height - badgeSize - 10 / viewport.zoom;

          ctx.save();
          ctx.fillStyle = 'rgba(18, 18, 22, 0.85)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 1 / viewport.zoom;
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, badgeSize, badgeSize, 6 / viewport.zoom);
          ctx.fill();
          ctx.stroke();

          // Play/Pause icon inside badge
          ctx.fillStyle = '#38BDF8';
          if (isPlaying) {
            const barW = badgeSize * 0.18;
            const barH = badgeSize * 0.45;
            const barY = badgeY + (badgeSize - barH) / 2;
            ctx.fillRect(badgeX + badgeSize * 0.28, barY, barW, barH);
            ctx.fillRect(badgeX + badgeSize * 0.54, barY, barW, barH);
          } else {
            ctx.beginPath();
            ctx.moveTo(badgeX + badgeSize * 0.35, badgeY + badgeSize * 0.25);
            ctx.lineTo(badgeX + badgeSize * 0.72, badgeY + badgeSize * 0.5);
            ctx.lineTo(badgeX + badgeSize * 0.35, badgeY + badgeSize * 0.75);
            ctx.closePath();
            ctx.fill();
          }

          // Video tag on top-left
          ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
          ctx.beginPath();
          const tagW = Math.min(65 / viewport.zoom, Math.abs(el.width) - 20 / viewport.zoom);
          const tagH = 18 / viewport.zoom;
          ctx.roundRect(el.x + 8 / viewport.zoom, el.y + 8 / viewport.zoom, tagW, tagH, 4 / viewport.zoom);
          ctx.fill();
          ctx.fillStyle = '#E4E4E7';
          ctx.font = `bold ${Math.max(10 / viewport.zoom, 8)}px sans-serif`;
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'left';
          ctx.fillText('VIDEO', el.x + 14 / viewport.zoom, el.y + 8 / viewport.zoom + tagH / 2);
          ctx.restore();
        } else if (el.type === 'audio' && el.src) {
          let cachedAud = audioCacheRef.current.get(el.src);
          if (!cachedAud) {
            cachedAud = new Audio();
            cachedAud.crossOrigin = 'anonymous';
            cachedAud.src = el.src;
            cachedAud.volume = el.volume ?? 1.0;
            cachedAud.muted = el.isMuted ?? false;
            audioCacheRef.current.set(el.src, cachedAud);
          } else {
            if (el.volume !== undefined && cachedAud.volume !== el.volume) {
              cachedAud.volume = el.volume;
            }
            if (el.isMuted !== undefined && cachedAud.muted !== el.isMuted) {
              cachedAud.muted = el.isMuted;
            }
          }

          const isPlaying = !cachedAud.paused && !cachedAud.ended;

          ctx.save();
          // Draw rounded audio card container
          ctx.fillStyle = '#1A1A22';
          ctx.strokeStyle = isPlaying ? '#38BDF8' : '#2E2E38';
          ctx.lineWidth = 1.5 / viewport.zoom;
          ctx.beginPath();
          ctx.roundRect(el.x, el.y, el.width, el.height, 10 / viewport.zoom);
          ctx.fill();
          ctx.stroke();

          // Play / Pause circular button
          const btnRadius = Math.min(el.height * 0.28, 18 / viewport.zoom);
          const btnCenterX = el.x + btnRadius + 14 / viewport.zoom;
          const btnCenterY = el.y + el.height / 2;

          ctx.fillStyle = isPlaying ? '#38BDF8' : '#2A2A38';
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 1 / viewport.zoom;
          ctx.beginPath();
          ctx.arc(btnCenterX, btnCenterY, btnRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Play/Pause icon
          ctx.fillStyle = isPlaying ? '#0F172A' : '#F8FAFC';
          if (isPlaying) {
            const barW = btnRadius * 0.35;
            const barH = btnRadius * 0.9;
            ctx.fillRect(btnCenterX - barW - 1 / viewport.zoom, btnCenterY - barH / 2, barW, barH);
            ctx.fillRect(btnCenterX + 1 / viewport.zoom, btnCenterY - barH / 2, barW, barH);
          } else {
            ctx.beginPath();
            ctx.moveTo(btnCenterX - btnRadius * 0.35, btnCenterY - btnRadius * 0.5);
            ctx.lineTo(btnCenterX + btnRadius * 0.55, btnCenterY);
            ctx.lineTo(btnCenterX - btnRadius * 0.35, btnCenterY + btnRadius * 0.5);
            ctx.closePath();
            ctx.fill();
          }

          // Track Title
          const textStartX = btnCenterX + btnRadius + 14 / viewport.zoom;
          ctx.fillStyle = '#F4F4F5';
          ctx.font = `600 ${Math.max(12 / viewport.zoom, 10)}px "Plus Jakarta Sans", sans-serif`;
          ctx.textBaseline = 'top';
          ctx.textAlign = 'left';
          const title = el.fileName || 'Pista de audio';
          const maxTextW = el.width - (textStartX - el.x) - 14 / viewport.zoom;
          ctx.fillText(title, textStartX, el.y + 14 / viewport.zoom, Math.max(maxTextW, 40));

          // Audio Equalizer Waveform bars
          const waveY = el.y + el.height - 20 / viewport.zoom;
          const barCount = 16;
          const barGap = 4 / viewport.zoom;
          const barWidth = 3 / viewport.zoom;
          const now = Date.now();

          for (let i = 0; i < barCount; i++) {
            const bx = textStartX + i * (barWidth + barGap);
            if (bx > el.x + el.width - 16 / viewport.zoom) break;
            let bh = (Math.sin(i * 0.8 + 1) * 0.5 + 0.5) * (el.height * 0.28) + 4 / viewport.zoom;
            if (isPlaying) {
              bh = (Math.sin(i * 1.2 + now * 0.008) * 0.5 + 0.5) * (el.height * 0.35) + 4 / viewport.zoom;
            }
            ctx.fillStyle = isPlaying ? '#38BDF8' : '#52525B';
            ctx.beginPath();
            ctx.roundRect(bx, waveY - bh, barWidth, bh, 1 / viewport.zoom);
            ctx.fill();
          }

          ctx.restore();
        } else if (el.type === 'connector') {
          const startEl = board.elements.find((e) => e.id === el.startElementId) || null;
          const endEl = board.elements.find((e) => e.id === el.endElementId) || null;
          const route = getConnectorRoute(el, startEl, endEl);

          if (route.length > 1) {
            ctx.strokeStyle = el.strokeColor;
            ctx.lineWidth = screenStrokeWidth;
            ctx.beginPath();
            ctx.moveTo(route[0].x, route[0].y);
            for (let i = 1; i < route.length; i++) {
              ctx.lineTo(route[i].x, route[i].y);
            }
            ctx.stroke();

            // Draw arrowhead invariant to zoom
            const last = route[route.length - 1];
            const prev = route[route.length - 2];
            const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
            const arrowLen = Math.max(el.strokeWidth * 4, 12) / viewport.zoom;
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

            // Connection point dot on start element (only visible when connection tool is active)
            if (activeTool === 'connector' && startEl && el.startAnchor) {
              ctx.save();
              ctx.fillStyle = '#38BDF8';
              ctx.strokeStyle = '#FFFFFF';
              ctx.lineWidth = 1.5 / viewport.zoom;
              ctx.setLineDash([]);
              ctx.beginPath();
              ctx.arc(route[0].x, route[0].y, 4.5 / viewport.zoom, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              ctx.restore();
            }

            // Connection point dot on end element (only visible when connection tool is active)
            if (activeTool === 'connector' && endEl && el.endAnchor) {
              ctx.save();
              ctx.fillStyle = '#38BDF8';
              ctx.strokeStyle = '#FFFFFF';
              ctx.lineWidth = 1.5 / viewport.zoom;
              ctx.setLineDash([]);
              ctx.beginPath();
              ctx.arc(last.x, last.y, 4.5 / viewport.zoom, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              ctx.restore();
            }
          }
        }

        ctx.restore();
      }

      // Draw live pen stroke currently being drawn
      if (activeTool === 'pen' && currentStrokePointsRef.current.length > 1) {
        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth / viewport.zoom;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (strokeStyle === 'dashed' || strokeStyle === 'dotted') {
          ctx.setLineDash([0.001, Math.max(strokeWidth * 3.5, 12) / viewport.zoom]);
        }
        ctx.beginPath();
        drawCatmullRomSpline(ctx, currentStrokePointsRef.current);
        ctx.stroke();
        ctx.restore();
      }

      // Draw live connector line during drag
      if (activeTool === 'connector' && connectorStartRef.current && connectorCurrentPtRef.current) {
        const startData = connectorStartRef.current;
        const currentPt = hoveredAnchor ? hoveredAnchor.point : connectorCurrentPtRef.current;
        const tempConn: CanvasElement = {
          id: 'temp_conn',
          type: 'connector',
          x: Math.min(startData.startPoint.x, currentPt.x),
          y: Math.min(startData.startPoint.y, currentPt.y),
          width: Math.abs(currentPt.x - startData.startPoint.x),
          height: Math.abs(currentPt.y - startData.startPoint.y),
          rotation: 0,
          strokeColor,
          fillColor: strokeColor,
          strokeWidth,
          strokeStyle,
          opacity: 0.85,
          startPoint: startData.startPoint,
          endPoint: currentPt,
          routing: connectorRouting,
        };
        const route = getConnectorRoute(tempConn, null, null);
        if (route.length > 1) {
          ctx.save();
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = strokeWidth / viewport.zoom;
          if (strokeStyle === 'dashed' || strokeStyle === 'dotted') {
            ctx.lineCap = 'round';
            ctx.setLineDash([0.001, Math.max(strokeWidth * 3.5, 12) / viewport.zoom]);
          } else {
            ctx.setLineDash([]);
          }
          ctx.beginPath();
          ctx.moveTo(route[0].x, route[0].y);
          for (let i = 1; i < route.length; i++) {
            ctx.lineTo(route[i].x, route[i].y);
          }
          ctx.stroke();
          ctx.restore();
        }
      }

      // Render connection anchor points on all shapes when connector tool is active
      if (activeTool === 'connector') {
        for (const el of board.elements) {
          if (el.type === 'pen' || el.type === 'connector') continue;
          const anchors = getAllAnchors(el);
          for (const a of anchors) {
            const isHovered =
              hoveredAnchor &&
              hoveredAnchor.elementId === el.id &&
              hoveredAnchor.anchor === a.anchor;
            ctx.save();
            ctx.fillStyle = isHovered ? '#38BDF8' : 'rgba(56, 189, 248, 0.45)';
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5 / viewport.zoom;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(
              a.point.x,
              a.point.y,
              (isHovered ? 6 : 4) / viewport.zoom,
              0,
              Math.PI * 2
            );
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      // Draw active transformation gizmo only on selected elements of the active layer
      const activeLayerConfig = layers.find((l) => l.id === activeLayer);
      const isCurrentLayerLocked = activeLayerConfig?.locked ?? false;
      const selectedElements = !isCurrentLayerLocked
        ? board.elements.filter((el) => selectedIds.includes(el.id) && (el.layer ?? 1) === activeLayer)
        : [];
      for (const sel of selectedElements) {
        ctx.save();
        const handles = getTransformHandles(sel);

        // Bounding box outline
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 1.5 / viewport.zoom;
        ctx.setLineDash([4 / viewport.zoom, 4 / viewport.zoom]);

        const minX = Math.min(sel.x, sel.x + sel.width);
        const maxX = Math.max(sel.x, sel.x + sel.width);
        const minY = Math.min(sel.y, sel.y + sel.height);
        const maxY = Math.max(sel.y, sel.y + sel.height);
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;

        if (sel.rotation) {
          ctx.translate(cx, cy);
          ctx.rotate(sel.rotation);
          ctx.translate(-cx, -cy);
        }

        ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

        // Rotation stalk line to rotation handle
        ctx.beginPath();
        ctx.moveTo(cx, minY);
        ctx.lineTo(cx, minY - 24);
        ctx.stroke();

        ctx.restore();

        // Draw individual handles in world space
        ctx.save();
        const handleRadius = 4.5 / viewport.zoom;
        for (const h of handles) {
          ctx.fillStyle = h.handle === 'rot' ? '#38BDF8' : '#FFFFFF';
          ctx.strokeStyle = '#18181B';
          ctx.lineWidth = 1.5 / viewport.zoom;
          ctx.beginPath();
          if (h.handle === 'rot') {
            ctx.arc(h.x, h.y, handleRadius + 1 / viewport.zoom, 0, Math.PI * 2);
          } else {
            ctx.rect(h.x - handleRadius, h.y - handleRadius, handleRadius * 2, handleRadius * 2);
          }
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.restore(); // Restore World-to-Screen transform

      // Render Screen-space Marquee Selection Box
      if (marquee) {
        ctx.save();
        const mx = Math.min(marquee.start.x, marquee.current.x);
        const my = Math.min(marquee.start.y, marquee.current.y);
        const mw = Math.abs(marquee.current.x - marquee.start.x);
        const mh = Math.abs(marquee.current.y - marquee.start.y);

        ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
        ctx.fillRect(mx, my, mw, mh);
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(mx, my, mw, mh);
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    board.elements,
    viewport,
    selectedIds,
    marquee,
    activeTool,
    strokeColor,
    strokeWidth,
    hoveredAnchor,
    layers,
    activeLayer,
  ]);

  // Pointer Down Handler
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenPt: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPt = screenToWorld(screenPt, viewport);

    // Right-Click or Spacebar + Left-Click -> Pan
    if (e.button === 2 || (e.button === 0 && (isSpacePressed || activeTool === 'hand'))) {
      setIsPanning(true);
      panStartRef.current = screenPt;
      viewportStartRef.current = viewport;
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    if (e.button !== 0) return; // Only process left click below

    const activeLayerConfig = layers.find((l) => l.id === activeLayer);
    const isLayerLocked = activeLayerConfig?.locked ?? false;
    const isLayerVisible = activeLayerConfig?.visible ?? true;

    // Check if clicked on a transformation handle of a selected element on the active layer
    if (selectedIds.length === 1 && activeTool === 'select' && !isLayerLocked && isLayerVisible) {
      const selectedEl = board.elements.find(
        (el) => el.id === selectedIds[0] && (el.layer ?? 1) === activeLayer
      );
      if (selectedEl) {
        const handle = getHandleUnderPoint(worldPt, selectedEl, 10 / viewport.zoom);
        if (handle) {
          recordHistory(board.elements);
          setActiveHandle(handle);
          transformStartRef.current = {
            pointerStart: worldPt,
            elementStart: { ...selectedEl },
          };
          canvas.setPointerCapture(e.pointerId);
          return;
        }
      }
    }

    // Tool: Select
    if (activeTool === 'select') {
      // Find element under pointer belonging to active layer
      let hitEl: CanvasElement | null = null;
      if (!isLayerLocked && isLayerVisible) {
        for (let i = board.elements.length - 1; i >= 0; i--) {
          const el = board.elements[i];
          if ((el.layer ?? 1) !== activeLayer) continue;
          if (isPointInElement(worldPt, el, 8 / viewport.zoom, board.elements)) {
            hitEl = el;
            break;
          }
        }
      }

      if (hitEl) {
        // Sync toolbar options with hit element
        if (hitEl.strokeColor && hitEl.strokeColor !== 'transparent') setStrokeColor(hitEl.strokeColor);
        if (hitEl.fillColor) setFillColor(hitEl.fillColor);
        if (hitEl.strokeWidth) setStrokeWidth(hitEl.strokeWidth);
        if (hitEl.strokeStyle) setStrokeStyle(hitEl.strokeStyle);
        if (hitEl.opacity !== undefined) setOpacity(hitEl.opacity);
        if (hitEl.fontSize) setFontSize(hitEl.fontSize);
        if (hitEl.fontFamily) setFontFamily(hitEl.fontFamily);
        if (hitEl.textAlign) setTextAlign(hitEl.textAlign);
        if (hitEl.routing) setConnectorRouting(hitEl.routing);
        if (hitEl.type === 'rect' || hitEl.type === 'circle' || hitEl.type === 'triangle') {
          setActiveShapeType(hitEl.type);
        }
        if (hitEl.volume !== undefined) setVolume(hitEl.volume);
        if (hitEl.isMuted !== undefined) setIsMuted(hitEl.isMuted);

        // Toggle media playback on click
        if (hitEl.type === 'video' && hitEl.src) {
          const vid = videoCacheRef.current.get(hitEl.src);
          if (vid) {
            if (vid.paused) {
              vid.play().catch(() => {});
            } else {
              vid.pause();
            }
          }
        } else if (hitEl.type === 'audio' && hitEl.src) {
          const aud = audioCacheRef.current.get(hitEl.src);
          if (aud) {
            if (aud.paused) {
              aud.play().catch(() => {});
            } else {
              aud.pause();
            }
          }
        }

        // Multiple selection: if hit element is already part of selection, keep all selected elements!
        let nextSelected: string[];
        if (e.shiftKey) {
          nextSelected = selectedIds.includes(hitEl.id)
            ? selectedIds.filter((id) => id !== hitEl!.id)
            : [...selectedIds, hitEl.id];
        } else {
          nextSelected = selectedIds.includes(hitEl.id) ? selectedIds : [hitEl.id];
        }
        setSelectedIds(nextSelected);

        // Move to front within the active layer
        const reorderedElements = moveElementToFrontOfLayer(board.elements, hitEl.id, activeLayer);

        // Prepare multi-element dragging
        setIsDraggingElements(true);
        dragStartRef.current = worldPt;

        dragElementsStartRef.current = reorderedElements
          .filter((el) => nextSelected.includes(el.id))
          .map((el) => ({
            id: el.id,
            x: el.x,
            y: el.y,
            points: el.points ? el.points.map((p) => ({ ...p })) : undefined,
            startPoint: el.startPoint ? { ...el.startPoint } : undefined,
            endPoint: el.endPoint ? { ...el.endPoint } : undefined,
          }));

        recordHistory(board.elements);
        setBoard((prev) => ({ ...prev, elements: reorderedElements }));
      } else {
        // Clicked on empty canvas -> clear selection and start marquee
        if (!e.shiftKey) {
          setSelectedIds([]);
        }
        setMarquee({ start: screenPt, current: screenPt });
      }
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    // Inactive or locked layer guard: cannot draw on locked or hidden layer
    if (isLayerLocked || !isLayerVisible) {
      return;
    }

    // Tool: Pen
    if (activeTool === 'pen') {
      recordHistory(board.elements);
      currentStrokePointsRef.current = [worldPt];
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    // Tool: Eraser (Stroke-level intersection deletion)
    if (activeTool === 'eraser') {
      recordHistory(board.elements);
      eraseAtPoint(worldPt);
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    // Tool: Shapes (rect, circle, triangle)
    if (activeTool === 'rect' || activeTool === 'circle' || activeTool === 'triangle') {
      recordHistory(board.elements);
      shapeStartRef.current = worldPt;
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    // Tool: Text
    if (activeTool === 'text') {
      recordHistory(board.elements);
      const newText: CanvasElement = {
        id: `text_${Date.now()}`,
        type: 'text',
        x: worldPt.x,
        y: worldPt.y,
        width: 240,
        height: 60,
        rotation: 0,
        strokeColor: strokeColor,
        fillColor: 'transparent',
        strokeWidth: 0,
        strokeStyle: 'solid',
        opacity: opacity,
        text: 'Escribe aquí...',
        fontSize: fontSize,
        fontFamily: fontFamily,
        textAlign: textAlign,
        layer: activeLayer,
      };
      setBoard((prev) => ({ ...prev, elements: [...prev.elements, newText] }));
      setSelectedIds([newText.id]);
      setEditingTextElement(newText);
      setEditTextValue('Escribe aquí...');
      setActiveTool('select');
      return;
    }

    // Tool: Connector
    if (activeTool === 'connector') {
      recordHistory(board.elements);
      let anchorStart: AnchorPosition | undefined;
      let startElemId: string | undefined;
      let startPoint = worldPt;

      if (hoveredAnchor) {
        startElemId = hoveredAnchor.elementId;
        anchorStart = hoveredAnchor.anchor;
        startPoint = hoveredAnchor.point;
      } else {
        // If not hovering an explicit dot, check if pointer is over any shape/element
        for (let i = board.elements.length - 1; i >= 0; i--) {
          const el = board.elements[i];
          if (el.type === 'pen' || el.type === 'connector') continue;
          if (isPointInElement(worldPt, el, 16 / viewport.zoom, board.elements)) {
            const closest = getClosestAnchor(el, worldPt);
            startElemId = el.id;
            anchorStart = closest.anchor;
            startPoint = closest.point;
            break;
          }
        }
      }

      connectorStartRef.current = {
        startPoint,
        elementId: startElemId,
        anchor: anchorStart,
      };
      connectorCurrentPtRef.current = startPoint;
      canvas.setPointerCapture(e.pointerId);
      return;
    }
  };

  // Pointer Move Handler
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenPt: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPt = screenToWorld(screenPt, viewport);

    // Pan canvas
    if (isPanning) {
      const dx = screenPt.x - panStartRef.current.x;
      const dy = screenPt.y - panStartRef.current.y;
      setViewport({
        ...viewportStartRef.current,
        panX: viewportStartRef.current.panX + dx,
        panY: viewportStartRef.current.panY + dy,
      });
      return;
    }

    // Resize or Rotate element handle
    if (activeHandle && transformStartRef.current) {
      const { pointerStart, elementStart } = transformStartRef.current;
      const dx = worldPt.x - pointerStart.x;
      const dy = worldPt.y - pointerStart.y;

      setBoard((prev) => {
        const nextElements = prev.elements.map((el) => {
          if (el.id !== elementStart.id) return el;

          if (activeHandle === 'rot') {
            const cx = elementStart.x + elementStart.width / 2;
            const cy = elementStart.y + elementStart.height / 2;
            const angle = Math.atan2(worldPt.y - cy, worldPt.x - cx) + Math.PI / 2;
            return { ...el, rotation: angle };
          }

          // Handle resizing with aspect ratio preservation for images
          let newX = elementStart.x;
          let newY = elementStart.y;
          let newW = elementStart.width;
          let newH = elementStart.height;

          if (activeHandle.includes('e')) newW = elementStart.width + dx;
          if (activeHandle.includes('w')) {
            newW = elementStart.width - dx;
            newX = elementStart.x + dx;
          }
          if (activeHandle.includes('s')) newH = elementStart.height + dy;
          if (activeHandle.includes('n')) {
            newH = elementStart.height - dy;
            newY = elementStart.y + dy;
          }

          // Reflow text height when resizing width
          if (el.type === 'text') {
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                const wrapped = getWrappedLines(
                  ctx,
                  el.text || '',
                  newW,
                  el.fontSize || 18,
                  el.fontFamily || 'Plus Jakarta Sans'
                );
                newH = Math.max(wrapped.totalHeight, 30);
              }
            }
          }

          // Aspect ratio preservation for image and video elements
          if ((el.type === 'image' || el.type === 'video') && el.aspectRatio) {
            newH = Math.abs(newW) / el.aspectRatio;
          }

          return {
            ...el,
            x: newX,
            y: newY,
            width: newW,
            height: newH,
          };
        });
        return { ...prev, elements: nextElements };
      });
      return;
    }

    // Drag elements simultaneously (all selected elements move together)
    if (isDraggingElements) {
      const dx = worldPt.x - dragStartRef.current.x;
      const dy = worldPt.y - dragStartRef.current.y;

      setBoard((prev) => {
        const nextElements = prev.elements.map((el) => {
          const original = dragElementsStartRef.current.find((o) => o.id === el.id);
          if (original) {
            const updated: CanvasElement = {
              ...el,
              x: original.x + dx,
              y: original.y + dy,
            };
            if (original.points && original.points.length > 0) {
              updated.points = original.points.map((p) => ({
                x: p.x + dx,
                y: p.y + dy,
              }));
            }
            if (original.startPoint) {
              updated.startPoint = {
                x: original.startPoint.x + dx,
                y: original.startPoint.y + dy,
              };
            }
            if (original.endPoint) {
              updated.endPoint = {
                x: original.endPoint.x + dx,
                y: original.endPoint.y + dy,
              };
            }
            return updated;
          }
          return el;
        });
        return { ...prev, elements: nextElements };
      });
      return;
    }

    // Marquee selection (only selects elements on the active layer)
    if (marquee) {
      setMarquee((prev) => (prev ? { ...prev, current: screenPt } : null));

      // Compute elements inside marquee belonging to active layer
      const mStartWorld = screenToWorld(marquee.start, viewport);
      const mCurrWorld = screenToWorld(screenPt, viewport);
      const minX = Math.min(mStartWorld.x, mCurrWorld.x);
      const maxX = Math.max(mStartWorld.x, mCurrWorld.x);
      const minY = Math.min(mStartWorld.y, mCurrWorld.y);
      const maxY = Math.max(mStartWorld.y, mCurrWorld.y);

      const enclosed = board.elements.filter((el) => {
        if ((el.layer ?? 1) !== activeLayer) return false;
        const elMinX = Math.min(el.x, el.x + el.width);
        const elMaxX = Math.max(el.x, el.x + el.width);
        const elMinY = Math.min(el.y, el.y + el.height);
        const elMaxY = Math.max(el.y, el.y + el.height);
        return elMinX >= minX && elMaxX <= maxX && elMinY >= minY && elMaxY <= maxY;
      });

      setSelectedIds(enclosed.map((e) => e.id));
      return;
    }

    // Pen drawing live sampling
    if (activeTool === 'pen' && currentStrokePointsRef.current.length > 0) {
      currentStrokePointsRef.current.push(worldPt);
      return;
    }

    // Eraser live brushing
    if (activeTool === 'eraser' && e.buttons === 1) {
      eraseAtPoint(worldPt);
      return;
    }

    // Connector anchor snapping detection and drag point tracking
    if (activeTool === 'connector') {
      connectorCurrentPtRef.current = worldPt;
      let nearestAnchor: { elementId: string; anchor: AnchorPosition; point: Point } | null = null;
      let minDistance = 24 / viewport.zoom;

      for (const el of board.elements) {
        if (el.type === 'pen' || el.type === 'connector') continue;
        const anchors = getAllAnchors(el);
        for (const a of anchors) {
          const d = Math.hypot(worldPt.x - a.point.x, worldPt.y - a.point.y);
          if (d < minDistance) {
            minDistance = d;
            nearestAnchor = { elementId: el.id, anchor: a.anchor, point: a.point };
          }
        }
      }

      // If not within minDistance of anchor but inside an element, snap to closest anchor
      if (!nearestAnchor) {
        for (let i = board.elements.length - 1; i >= 0; i--) {
          const el = board.elements[i];
          if (el.type === 'pen' || el.type === 'connector') continue;
          if (isPointInElement(worldPt, el, 12 / viewport.zoom, board.elements)) {
            const closest = getClosestAnchor(el, worldPt);
            nearestAnchor = { elementId: el.id, anchor: closest.anchor, point: closest.point };
            break;
          }
        }
      }

      setHoveredAnchor(nearestAnchor);
    }
  };

  // Pointer Up Handler
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (activeHandle) {
      setActiveHandle(null);
      transformStartRef.current = null;
      return;
    }

    if (isDraggingElements) {
      setIsDraggingElements(false);
      dragElementsStartRef.current = [];
      return;
    }

    if (marquee) {
      setMarquee(null);
      return;
    }

    // Finish Pen Stroke
    if (activeTool === 'pen' && currentStrokePointsRef.current.length > 1) {
      const pts = [...currentStrokePointsRef.current];
      const minX = Math.min(...pts.map((p) => p.x));
      const maxX = Math.max(...pts.map((p) => p.x));
      const minY = Math.min(...pts.map((p) => p.y));
      const maxY = Math.max(...pts.map((p) => p.y));

      const newPenElement: CanvasElement = {
        id: `pen_${Date.now()}`,
        type: 'pen',
        x: minX,
        y: minY,
        width: Math.max(maxX - minX, 10),
        height: Math.max(maxY - minY, 10),
        rotation: 0,
        strokeColor: strokeColor,
        fillColor: 'transparent',
        strokeWidth: strokeWidth,
        strokeStyle: strokeStyle,
        opacity: opacity,
        points: pts,
        layer: activeLayer,
      };

      setBoard((prev) => ({ ...prev, elements: [...prev.elements, newPenElement] }));
      currentStrokePointsRef.current = [];
      return;
    }

    // Finish Shape Creation
    if (
      (activeTool === 'rect' || activeTool === 'circle' || activeTool === 'triangle') &&
      shapeStartRef.current
    ) {
      const rect = canvas?.getBoundingClientRect();
      const screenPt: Point = {
        x: e.clientX - (rect?.left || 0),
        y: e.clientY - (rect?.top || 0),
      };
      const endWorld = screenToWorld(screenPt, viewport);
      const start = shapeStartRef.current;

      const x = Math.min(start.x, endWorld.x);
      const y = Math.min(start.y, endWorld.y);
      const w = Math.max(Math.abs(endWorld.x - start.x), 24);
      const h = Math.max(Math.abs(endWorld.y - start.y), 24);

      const newShape: CanvasElement = {
        id: `shape_${Date.now()}`,
        type: activeTool,
        x,
        y,
        width: w,
        height: h,
        rotation: 0,
        strokeColor,
        fillColor,
        strokeWidth,
        strokeStyle,
        opacity,
        layer: activeLayer,
      };

      setBoard((prev) => ({ ...prev, elements: [...prev.elements, newShape] }));
      setSelectedIds([newShape.id]);
      shapeStartRef.current = null;
      setActiveTool('select');
      return;
    }

    // Finish Connector Creation
    if (activeTool === 'connector' && connectorStartRef.current) {
      const rect = canvas?.getBoundingClientRect();
      const screenPt: Point = {
        x: e.clientX - (rect?.left || 0),
        y: e.clientY - (rect?.top || 0),
      };
      const endWorld = screenToWorld(screenPt, viewport);

      let endElemId: string | undefined;
      let endAnchor: AnchorPosition | undefined;
      let endPoint: Point = endWorld;

      if (hoveredAnchor) {
        endElemId = hoveredAnchor.elementId;
        endAnchor = hoveredAnchor.anchor;
        endPoint = hoveredAnchor.point;
      } else {
        // If not hovering an explicit dot, check if released on or near any element
        for (let i = board.elements.length - 1; i >= 0; i--) {
          const el = board.elements[i];
          if (el.type === 'pen' || el.type === 'connector') continue;
          if (isPointInElement(endWorld, el, 16 / viewport.zoom, board.elements)) {
            const closest = getClosestAnchor(el, endWorld);
            endElemId = el.id;
            endAnchor = closest.anchor;
            endPoint = closest.point;
            break;
          }
        }
      }

      const startData = connectorStartRef.current;

      // Only create if start and end are distinct
      if (Math.hypot(endPoint.x - startData.startPoint.x, endPoint.y - startData.startPoint.y) > 5) {
        const newConnector: CanvasElement = {
          id: `conn_${Date.now()}`,
          type: 'connector',
          x: Math.min(startData.startPoint.x, endPoint.x),
          y: Math.min(startData.startPoint.y, endPoint.y),
          width: Math.abs(endPoint.x - startData.startPoint.x),
          height: Math.abs(endPoint.y - startData.startPoint.y),
          rotation: 0,
          strokeColor,
          fillColor: strokeColor,
          strokeWidth: Math.max(strokeWidth, 2),
          strokeStyle,
          opacity,
          startElementId: startData.elementId,
          startAnchor: startData.anchor,
          startPoint: startData.startPoint,
          endElementId: endElemId,
          endAnchor: endAnchor,
          endPoint: endPoint,
          routing: connectorRouting,
          layer: activeLayer,
        };

        setBoard((prev) => ({ ...prev, elements: [...prev.elements, newConnector] }));
      }

      connectorStartRef.current = null;
      connectorCurrentPtRef.current = null;
      setHoveredAnchor(null);
      setActiveTool('select');
      return;
    }
  };

  // Stroke-level eraser helper
  const eraseAtPoint = (worldPt: Point) => {
    const activeLayerConfig = layers.find((l) => l.id === activeLayer);
    if (activeLayerConfig?.locked || !activeLayerConfig?.visible) return;

    const eraserRadius = 14 / viewport.zoom;
    setBoard((prev) => {
      const remaining = prev.elements.filter((el) => {
        // Elements on other layers cannot be erased!
        if ((el.layer ?? 1) !== activeLayer) return true;
        return !isPointInElement(worldPt, el, eraserRadius, prev.elements);
      });
      return { ...prev, elements: remaining };
    });
  };

  // Mouse Wheel Zoom anchored at current pointer position
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenPt: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const nextVp = zoomAt(screenPt, zoomFactor, viewport, MIN_ZOOM, MAX_ZOOM);
    setViewport(nextVp);
  };

  // Double click for text editing
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const activeLayerConfig = layers.find((l) => l.id === activeLayer);
    if (activeLayerConfig?.locked || !activeLayerConfig?.visible) return;

    const rect = canvas.getBoundingClientRect();
    const screenPt: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPt = screenToWorld(screenPt, viewport);

    for (let i = board.elements.length - 1; i >= 0; i--) {
      const el = board.elements[i];
      if ((el.layer ?? 1) !== activeLayer) continue;
      if (el.type === 'text' && isPointInElement(worldPt, el, 10 / viewport.zoom, board.elements)) {
        setEditingTextElement(el);
        setEditTextValue(el.text || '');
        if (el.textAlign) setTextAlign(el.textAlign);
        if (el.fontSize) setFontSize(el.fontSize);
        if (el.fontFamily) setFontFamily(el.fontFamily);
        break;
      }
    }
  };

  // Drag and drop listener for native files (images, gifs, videos, audios) dropped onto canvas
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const activeLayerConfig = layers.find((l) => l.id === activeLayer);
    if (activeLayerConfig?.locked || !activeLayerConfig?.visible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenPt: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPt = screenToWorld(screenPt, viewport);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      try {
        const optimized = await optimizeUploadedFile(file);
        recordHistory(board.elements);
        let targetW = optimized.width;
        let targetH = optimized.height;

        if (optimized.type === 'audio') {
          targetW = 320;
          targetH = 88;
        } else {
          targetW = Math.min(optimized.width, 420);
          targetH = targetW * (optimized.height / optimized.width);
        }

        const isGif =
          optimized.type === 'image' &&
          (optimized.mediaType === 'gif' ||
            (optimized.fileName && optimized.fileName.toLowerCase().endsWith('.gif')) ||
            (optimized.src &&
              (optimized.src.toLowerCase().includes('.gif') ||
                optimized.src.toLowerCase().includes('format=gif') ||
                optimized.src.toLowerCase().includes('giphy.com') ||
                optimized.src.toLowerCase().includes('tenor.com'))));

        const newMediaEl: CanvasElement = {
          id: `${optimized.type}_${Date.now()}`,
          type: optimized.type,
          x: worldPt.x - targetW / 2,
          y: worldPt.y - targetH / 2,
          width: targetW,
          height: targetH,
          rotation: 0,
          strokeColor: 'transparent',
          fillColor: 'transparent',
          strokeWidth: 0,
          strokeStyle: 'solid',
          opacity: 1,
          src: optimized.src,
          naturalWidth: optimized.width,
          naturalHeight: optimized.height,
          aspectRatio: optimized.width / optimized.height,
          mediaType: isGif ? 'gif' : optimized.mediaType,
          fileName: optimized.fileName,
          duration: optimized.duration,
          poster: optimized.poster,
          layer: activeLayer,
          volume: 1.0,
          isMuted: false,
        };

        setBoard((prev) => ({ ...prev, elements: [...prev.elements, newMediaEl] }));
        setSelectedIds([newMediaEl.id]);
      } catch (err) {
        console.error('Error al procesar archivo multimedia arrastrado:', err);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Insert media (image, gif, video, audio) from modal
  const handleInsertMedia = (media: OptimizedMediaResult) => {
    const activeLayerConfig = layers.find((l) => l.id === activeLayer);
    if (activeLayerConfig?.locked || !activeLayerConfig?.visible) return;

    recordHistory(board.elements);
    const centerScreen: Point = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const centerWorld = screenToWorld(centerScreen, viewport);

    let targetW = media.width;
    let targetH = media.height;

    if (media.type === 'audio') {
      targetW = 320;
      targetH = 88;
    } else {
      targetW = Math.min(media.width, 420);
      targetH = targetW * (media.height / media.width);
    }

    const isGif =
      media.type === 'image' &&
      (media.mediaType === 'gif' ||
        (media.fileName && media.fileName.toLowerCase().endsWith('.gif')) ||
        (media.src &&
          (media.src.toLowerCase().includes('.gif') ||
            media.src.toLowerCase().includes('format=gif') ||
            media.src.toLowerCase().includes('giphy.com') ||
            media.src.toLowerCase().includes('tenor.com'))));

    const newMediaEl: CanvasElement = {
      id: `${media.type}_${Date.now()}`,
      type: media.type,
      x: centerWorld.x - targetW / 2,
      y: centerWorld.y - targetH / 2,
      width: targetW,
      height: targetH,
      rotation: 0,
      strokeColor: 'transparent',
      fillColor: 'transparent',
      strokeWidth: 0,
      strokeStyle: 'solid',
      opacity: 1,
      src: media.src,
      naturalWidth: media.width,
      naturalHeight: media.height,
      aspectRatio: media.width / media.height,
      mediaType: isGif ? 'gif' : media.mediaType,
      fileName: media.fileName,
      duration: media.duration,
      poster: media.poster,
      layer: activeLayer,
      volume: 1.0,
      isMuted: false,
    };

    setBoard((prev) => ({ ...prev, elements: [...prev.elements, newMediaEl] }));
    setSelectedIds([newMediaEl.id]);
  };

  // Backwards-compatible image insert
  const handleInsertImage = (src: string, naturalWidth: number, naturalHeight: number) => {
    handleInsertMedia({
      src,
      type: 'image',
      mediaType: 'image',
      width: naturalWidth,
      height: naturalHeight,
      fileName: 'imagen',
      originalSize: 0,
    });
  };

  // Delete selected elements
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    recordHistory(board.elements);
    setBoard((prev) => ({
      ...prev,
      elements: prev.elements.filter((el) => !selectedIds.includes(el.id)),
    }));
    setSelectedIds([]);
  };

  // Zoom helpers
  const handleZoomIn = () => {
    const center: Point = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    setViewport((prev) => zoomAt(center, 1.25, prev, MIN_ZOOM, MAX_ZOOM));
  };

  const handleZoomOut = () => {
    const center: Point = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    setViewport((prev) => zoomAt(center, 0.8, prev, MIN_ZOOM, MAX_ZOOM));
  };

  const handleFitToScreen = () => {
    const nextVp = fitToScreen(board.elements, window.innerWidth, window.innerHeight);
    setViewport(nextVp);
  };

  // Cursor style based on active tool and state
  const getCursor = () => {
    if (isPanning) return 'grabbing';
    if (isSpacePressed || activeTool === 'hand') return 'grab';
    if (activeTool === 'pen') return 'crosshair';
    if (activeTool === 'eraser') return 'pointer';
    if (activeTool === 'text') return 'text';
    if (activeTool === 'rect' || activeTool === 'circle' || activeTool === 'triangle')
      return 'crosshair';
    if (activeTool === 'connector') return 'crosshair';
    return 'default';
  };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-[#121212] select-none"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Top Navigation */}
      <TopNav
        board={board}
        onBackToDashboard={onBackToDashboard}
        onUpdateTitle={(newTitle) => setBoard((prev) => ({ ...prev, name: newTitle }))}
        isSaving={isSaving}
      />

      {/* Floating Collapsible Left Toolbar */}
      <Toolbar
        activeTool={activeTool}
        onSelectTool={(tool) => {
          setActiveTool(tool);
          if (tool !== 'select') setSelectedIds([]);
        }}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        zoomPercent={Math.round(viewport.zoom * 100)}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitToScreen={handleFitToScreen}
        activeShapeType={activeShapeType}
        onSelectShapeType={(shape) => {
          setActiveShapeType(shape);
          setActiveTool(shape);
        }}
      />

      {/* Floating Tool Options Subpanel */}
      <ToolOptionsPanel
        activeTool={activeTool}
        selectedElementType={selectedElementType}
        activeColor={strokeColor}
        isColorPanelOpen={isColorPanelOpen}
        onToggleColorPanel={() => setIsColorPanelOpen((prev) => !prev)}
        strokeWidth={strokeWidth}
        onChangeStrokeWidth={(w) => {
          setStrokeWidth(w);
          if (selectedIds.length > 0) {
            setBoard((prev) => ({
              ...prev,
              elements: prev.elements.map((el) =>
                selectedIds.includes(el.id) ? { ...el, strokeWidth: w } : el
              ),
            }));
          }
        }}
        strokeStyle={strokeStyle}
        onChangeStrokeStyle={(s) => {
          setStrokeStyle(s);
          if (selectedIds.length > 0) {
            setBoard((prev) => ({
              ...prev,
              elements: prev.elements.map((el) =>
                selectedIds.includes(el.id) ? { ...el, strokeStyle: s } : el
              ),
            }));
          }
        }}
        opacity={opacity}
        onChangeOpacity={(o) => {
          setOpacity(o);
          if (selectedIds.length > 0) {
            setBoard((prev) => ({
              ...prev,
              elements: prev.elements.map((el) =>
                selectedIds.includes(el.id) ? { ...el, opacity: o } : el
              ),
            }));
          }
        }}
        activeShapeType={activeShapeType}
        onChangeShapeType={(s) => {
          setActiveShapeType(s);
          if (selectedIds.length > 0) {
            setBoard((prev) => ({
              ...prev,
              elements: prev.elements.map((el) =>
                selectedIds.includes(el.id) &&
                (el.type === 'rect' || el.type === 'circle' || el.type === 'triangle')
                  ? { ...el, type: s }
                  : el
              ),
            }));
          } else {
            setActiveTool(s);
          }
        }}
        fontSize={fontSize}
        onChangeFontSize={(s) => {
          setFontSize(s);
          if (selectedIds.length > 0) {
            setBoard((prev) => ({
              ...prev,
              elements: prev.elements.map((el) =>
                selectedIds.includes(el.id) ? { ...el, fontSize: s } : el
              ),
            }));
          }
        }}
        fontFamily={fontFamily}
        onChangeFontFamily={(f) => {
          setFontFamily(f);
          if (selectedIds.length > 0) {
            setBoard((prev) => ({
              ...prev,
              elements: prev.elements.map((el) =>
                selectedIds.includes(el.id) ? { ...el, fontFamily: f } : el
              ),
            }));
          }
        }}
        textAlign={textAlign}
        onChangeTextAlign={(align) => {
          setTextAlign(align);
          if (selectedIds.length > 0) {
            setBoard((prev) => ({
              ...prev,
              elements: prev.elements.map((el) =>
                selectedIds.includes(el.id) && el.type === 'text'
                  ? { ...el, textAlign: align }
                  : el
              ),
            }));
          }
        }}
        connectorRouting={connectorRouting}
        onChangeConnectorRouting={(r) => {
          setConnectorRouting(r);
          if (selectedIds.length > 0) {
            setBoard((prev) => ({
              ...prev,
              elements: prev.elements.map((el) =>
                selectedIds.includes(el.id) ? { ...el, routing: r } : el
              ),
            }));
          }
        }}
        hasSelectedElements={selectedIds.length > 0}
        selectedElementsCount={selectedIds.length}
        onDeleteSelected={handleDeleteSelected}
        volume={volume}
        onChangeVolume={handleChangeVolume}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />

      {/* Separate Rectangular Color Selection Window (Top-Right Corner) */}
      <ColorPanel
        isOpen={isColorPanelOpen}
        onClose={() => setIsColorPanelOpen(false)}
        strokeColor={strokeColor}
        onChangeStrokeColor={(c) => {
          setStrokeColor(c);
          if (selectedIds.length > 0) {
            setBoard((prev) => ({
              ...prev,
              elements: prev.elements.map((el) =>
                selectedIds.includes(el.id) ? { ...el, strokeColor: c } : el
              ),
            }));
          }
        }}
        fillColor={fillColor}
        onChangeFillColor={(c) => {
          setFillColor(c);
          if (selectedIds.length > 0) {
            setBoard((prev) => ({
              ...prev,
              elements: prev.elements.map((el) =>
                selectedIds.includes(el.id) &&
                (el.type === 'rect' || el.type === 'circle' || el.type === 'triangle')
                  ? { ...el, fillColor: c }
                  : el
              ),
            }));
          }
        }}
        hasSelectedElements={selectedIds.length > 0}
        selectedElementType={selectedElementType}
      />

      {/* Layers Control Button & Panel (Bottom-Left Corner) */}
      <LayerControl
        layers={layers}
        activeLayer={activeLayer}
        onSelectLayer={(layerId) => {
          setActiveLayer(layerId);
          setSelectedIds([]); // Deselect when switching layers
        }}
        onToggleVisibility={(layerId) => {
          setLayers((prev) =>
            prev.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l))
          );
        }}
        onToggleLock={(layerId) => {
          setLayers((prev) =>
            prev.map((l) => (l.id === layerId ? { ...l, locked: !l.locked } : l))
          );
        }}
        layerElementCounts={layerElementCounts}
      />

      {/* Bottom-Right Action Button: Add Media */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setIsImageModalOpen(true)}
          aria-label="Añadir archivos multimedia (GIF, video, audio o imagen) al lienzo"
          title="Añadir multimedia (GIF, video, audio o imagen, o arrastra un archivo al lienzo)"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1E1E1E]/95 hover:bg-[#282828] text-neutral-200 hover:text-white border border-[#2D2D2D] shadow-2xl backdrop-blur-md text-xs font-semibold transition-all hover:scale-105 active:scale-95"
        >
          <ImagePlus className="w-4 h-4 text-sky-400" />
          <span>Añadir multimedia</span>
        </button>
      </div>

      {/* Main High-Performance HTML5 2D Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full block touch-none"
        style={{ cursor: getCursor() }}
      />

      {/* Animated GIFs Layer for native 60fps playback & zero-CORS URL support */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-10">
        {board.elements
          .filter((el) => {
            const layerConfig = layers.find((l) => l.id === (el.layer ?? 1));
            return layerConfig?.visible ?? true;
          })
          .filter(
            (el) =>
              el.type === 'image' &&
              el.src &&
              (el.mediaType === 'gif' ||
                el.src.toLowerCase().includes('.gif') ||
                el.src.toLowerCase().includes('format=gif') ||
                el.src.toLowerCase().includes('giphy.com') ||
                el.src.toLowerCase().includes('tenor.com'))
          )
          .map((el) => {
            const left = Math.min(el.x, el.x + el.width);
            const top = Math.min(el.y, el.y + el.height);
            const absW = Math.abs(el.width);
            const absH = Math.abs(el.height);
            const screen = worldToScreen({ x: left, y: top }, viewport);
            const w = absW * viewport.zoom;
            const h = absH * viewport.zoom;
            const isSelected = selectedIds.includes(el.id);

            return (
              <div
                key={el.id}
                className="absolute pointer-events-none select-none"
                style={{
                  left: `${screen.x}px`,
                  top: `${screen.y}px`,
                  width: `${w}px`,
                  height: `${h}px`,
                  opacity: el.opacity ?? 1,
                  transform: el.rotation ? `rotate(${el.rotation}rad)` : undefined,
                  transformOrigin: 'center center',
                }}
              >
                <img
                  src={el.src}
                  alt={el.fileName || 'Animación GIF'}
                  className="w-full h-full object-fill pointer-events-none select-none rounded-sm"
                  loading="eager"
                />
                {isSelected && (
                  <>
                    <div className="absolute inset-0 border-2 border-dashed border-[#38BDF8] pointer-events-none" />
                    <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-sky-500 rounded-sm pointer-events-none" />
                    <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-sky-500 rounded-sm pointer-events-none" />
                    <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-sky-500 rounded-sm pointer-events-none" />
                    <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-sky-500 rounded-sm pointer-events-none" />
                  </>
                )}
              </div>
            );
          })}
      </div>

      {/* Text Editing Inline Overlay Textarea */}
      {editingTextElement && (
        <div
          className="absolute z-50 pointer-events-auto"
          style={{
            left: `${worldToScreen({ x: editingTextElement.x, y: editingTextElement.y }, viewport).x}px`,
            top: `${worldToScreen({ x: editingTextElement.x, y: editingTextElement.y }, viewport).y}px`,
          }}
        >
          <textarea
            autoFocus
            value={editTextValue}
            onChange={(e) => setEditTextValue(e.target.value)}
            onBlur={() => {
              if (editingTextElement) {
                recordHistory(board.elements);
                let newHeight = editingTextElement.height;
                const canvas = canvasRef.current;
                if (canvas) {
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    const wrapped = getWrappedLines(
                      ctx,
                      editTextValue,
                      editingTextElement.width,
                      editingTextElement.fontSize || 18,
                      editingTextElement.fontFamily || 'Plus Jakarta Sans'
                    );
                    newHeight = Math.max(wrapped.totalHeight, 40);
                  }
                }
                setBoard((prev) => ({
                  ...prev,
                  elements: prev.elements.map((el) =>
                    el.id === editingTextElement.id
                      ? { ...el, text: editTextValue, height: newHeight }
                      : el
                  ),
                }));
              }
              setEditingTextElement(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setEditingTextElement(null);
              }
            }}
            className="bg-[#1A1A1A]/95 text-white border border-sky-400 rounded-lg p-2 outline-none shadow-2xl resize-none font-sans"
            style={{
              fontSize: `${(editingTextElement.fontSize || 18) * viewport.zoom}px`,
              fontFamily: editingTextElement.fontFamily || 'Plus Jakarta Sans',
              width: `${Math.max(editingTextElement.width * viewport.zoom, 140)}px`,
              minHeight: `${Math.max(editingTextElement.height * viewport.zoom, 50)}px`,
              textAlign: editingTextElement.textAlign || 'left',
              lineHeight: 1.35,
            }}
          />
        </div>
      )}

      {/* Multimedia Upload/Import Modal */}
      <ImageModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onInsertMedia={handleInsertMedia}
      />
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Hand,
  MousePointer2,
  Pencil,
  Eraser,
  Square,
  Circle,
  Triangle,
  Type,
  Spline,
  Undo2,
  Redo2,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { ToolType } from '../types/canvas';

interface ToolbarProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  activeShapeType: 'rect' | 'circle' | 'triangle';
  onSelectShapeType: (shape: 'rect' | 'circle' | 'triangle') => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onSelectTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  activeShapeType,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const getShapeIcon = () => {
    switch (activeShapeType) {
      case 'circle':
        return <Circle className="w-5 h-5" />;
      case 'triangle':
        return <Triangle className="w-5 h-5" />;
      default:
        return <Square className="w-5 h-5" />;
    }
  };

  const isShapeActive =
    activeTool === 'rect' || activeTool === 'circle' || activeTool === 'triangle';

  return (
    <aside
      className="fixed left-5 top-1/2 -translate-y-1/2 z-40 select-none transition-transform duration-200"
      aria-label="Barra de herramientas de la pizarra"
    >
      <div className="flex items-center gap-1.5">
        {/* Main Toolbar Panel */}
        <div
          className={`flex flex-col items-center bg-[#1E1E1E]/95 backdrop-blur-md border border-[#2D2D2D] rounded-xl p-1.5 shadow-2xl transition-all duration-200 ${
            isCollapsed ? 'opacity-0 -translate-x-12 pointer-events-none' : 'opacity-100 translate-x-0'
          }`}
        >
          {/* Group 1: Navigation & Selection */}
          <div className="flex flex-col items-center gap-1 pb-2 border-b border-[#2D2D2D]/80">
            <button
              type="button"
              onClick={() => onSelectTool('hand')}
              aria-label="Herramienta Mano (Mover lienzo o mantener Barra espaciadora)"
              title="Mano (H) — Arrastrar lienzo o clic derecho"
              className={`p-2.5 rounded-lg transition-colors duration-150 ${
                activeTool === 'hand'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/80'
              }`}
            >
              <Hand className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => onSelectTool('select')}
              aria-label="Herramienta Selección (Clic simple o recuadro de selección)"
              title="Selección (V) — Clic simple o Mayús + Clic"
              className={`p-2.5 rounded-lg transition-colors duration-150 ${
                activeTool === 'select'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/80'
              }`}
            >
              <MousePointer2 className="w-5 h-5" />
            </button>
          </div>

          {/* Group 2: Creative Drawing Tools */}
          <div className="flex flex-col items-center gap-1 py-2 border-b border-[#2D2D2D]/80">
            <button
              type="button"
              onClick={() => onSelectTool('pen')}
              aria-label="Herramienta Pluma y Dibujo libre con suavizado"
              title="Lápiz (P) — Trazo suave Catmull-Rom"
              className={`p-2.5 rounded-lg transition-colors duration-150 ${
                activeTool === 'pen'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/80'
              }`}
            >
              <Pencil className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => onSelectTool('eraser')}
              aria-label="Herramienta Borrador por intersección de trazos"
              title="Borrador (E) — Elimina trazos tocados"
              className={`p-2.5 rounded-lg transition-colors duration-150 ${
                activeTool === 'eraser'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/80'
              }`}
            >
              <Eraser className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => onSelectTool(activeShapeType)}
              aria-label="Herramienta Figuras geométricas (Rectángulo, Círculo, Triángulo)"
              title="Figuras geométricas (R)"
              className={`p-2.5 rounded-lg transition-colors duration-150 ${
                isShapeActive
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/80'
              }`}
            >
              {getShapeIcon()}
            </button>

            <button
              type="button"
              onClick={() => onSelectTool('text')}
              aria-label="Herramienta Texto enriquecido editable"
              title="Texto (T) — Clic para escribir"
              className={`p-2.5 rounded-lg transition-colors duration-150 ${
                activeTool === 'text'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/80'
              }`}
            >
              <Type className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => onSelectTool('connector')}
              aria-label="Herramienta Conectores inteligentes con anclaje magnético"
              title="Conector inteligente (C) — Flechas con imán a nodos"
              className={`p-2.5 rounded-lg transition-colors duration-150 ${
                activeTool === 'connector'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/80'
              }`}
            >
              <Spline className="w-5 h-5" />
            </button>
          </div>

          {/* Group 3: History Actions */}
          <div className="flex flex-col items-center gap-1 py-2 border-b border-[#2D2D2D]/80">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              aria-label="Deshacer última acción (Ctrl + Z)"
              title="Deshacer (Ctrl+Z)"
              className="p-2.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/80 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-400 transition-colors duration-150"
            >
              <Undo2 className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              aria-label="Rehacer acción deshecha (Ctrl + Y / Ctrl + Mayús + Z)"
              title="Rehacer (Ctrl+Y)"
              className="p-2.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/80 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-400 transition-colors duration-150"
            >
              <Redo2 className="w-5 h-5" />
            </button>
          </div>

          {/* Group 4: Zoom & Viewport Controls */}
          <div className="flex flex-col items-center gap-1 pt-2">
            <button
              type="button"
              onClick={onZoomIn}
              aria-label="Acercar vista (Zoom +)"
              title="Acercar (+)"
              className="p-2.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/80 transition-colors duration-150"
            >
              <ZoomIn className="w-5 h-5" />
            </button>

            <span
              className="text-[11px] font-mono tabular-nums text-neutral-400 py-0.5"
              aria-label={`Nivel de zoom actual: ${zoomPercent} por ciento`}
              title="Nivel de zoom actual"
            >
              {zoomPercent}%
            </span>

            <button
              type="button"
              onClick={onZoomOut}
              aria-label="Alejar vista (Zoom -)"
              title="Alejar (-)"
              className="p-2.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/80 transition-colors duration-150"
            >
              <ZoomOut className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={onFitToScreen}
              aria-label="Ajustar todos los elementos a la pantalla"
              title="Ajustar a la pantalla (Shift + 1)"
              className="p-2.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/80 transition-colors duration-150"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Retractable Sidebar Toggle Button */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expandir barra de herramientas' : 'Ocultar barra de herramientas'}
          title={isCollapsed ? 'Expandir panel lateral' : 'Contraer panel lateral'}
          className="p-2 bg-[#1E1E1E]/90 hover:bg-[#282828] text-neutral-400 hover:text-neutral-100 border border-[#2D2D2D] rounded-lg shadow-lg backdrop-blur-md transition-all duration-150"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};

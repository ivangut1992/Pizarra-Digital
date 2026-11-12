/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Square,
  Circle,
  Triangle,
  Minus,
  Spline,
  CornerDownRight,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Volume2,
  Volume1,
  VolumeX,
} from 'lucide-react';
import {
  CanvasElementType,
  ConnectorRouting,
  StrokeStyle,
  TextAlign,
  ToolType,
} from '../types/canvas';

interface ToolOptionsPanelProps {
  activeTool: ToolType;
  selectedElementType?: CanvasElementType | null;
  activeColor: string;
  isColorPanelOpen: boolean;
  onToggleColorPanel: () => void;
  strokeWidth: number;
  onChangeStrokeWidth: (width: number) => void;
  strokeStyle: StrokeStyle;
  onChangeStrokeStyle: (style: StrokeStyle) => void;
  opacity: number;
  onChangeOpacity: (opacity: number) => void;
  activeShapeType: 'rect' | 'circle' | 'triangle';
  onChangeShapeType: (shape: 'rect' | 'circle' | 'triangle') => void;
  fontSize: number;
  onChangeFontSize: (size: number) => void;
  fontFamily: string;
  onChangeFontFamily: (font: string) => void;
  textAlign: TextAlign;
  onChangeTextAlign: (align: TextAlign) => void;
  connectorRouting: ConnectorRouting;
  onChangeConnectorRouting: (routing: ConnectorRouting) => void;
  hasSelectedElements: boolean;
  selectedElementsCount?: number;
  onDeleteSelected: () => void;
  volume?: number;
  onChangeVolume?: (volume: number) => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
}

const FONT_FAMILIES = [
  { label: 'Sans-Serif', value: 'Plus Jakarta Sans' },
  { label: 'Editorial', value: 'DM Sans' },
  { label: 'Monoespaciada', value: 'JetBrains Mono' },
  { label: 'Clásica Serif', value: 'Georgia' },
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 90, 100];

export const ToolOptionsPanel: React.FC<ToolOptionsPanelProps> = ({
  activeTool,
  selectedElementType,
  activeColor,
  isColorPanelOpen,
  onToggleColorPanel,
  strokeWidth,
  onChangeStrokeWidth,
  strokeStyle,
  onChangeStrokeStyle,
  opacity,
  onChangeOpacity,
  activeShapeType,
  onChangeShapeType,
  fontSize,
  onChangeFontSize,
  fontFamily,
  onChangeFontFamily,
  textAlign,
  onChangeTextAlign,
  connectorRouting,
  onChangeConnectorRouting,
  hasSelectedElements,
  selectedElementsCount = 0,
  onDeleteSelected,
  volume = 1.0,
  onChangeVolume,
  isMuted = false,
  onToggleMute,
}) => {
  // Determine effective element type:
  // - If elements are selected: use the selected element's type
  // - If no elements are selected: use active creation tool
  const effectiveType: CanvasElementType | null = hasSelectedElements
    ? (selectedElementType ?? null)
    : (activeTool === 'rect' || activeTool === 'circle' || activeTool === 'triangle'
        ? activeShapeType
        : activeTool === 'text'
        ? 'text'
        : activeTool === 'pen'
        ? 'pen'
        : activeTool === 'connector'
        ? 'connector'
        : null);

  // If no relevant tool is active and no element is selected, don't show the panel
  if (!effectiveType) {
    return null;
  }

  const isShape =
    effectiveType === 'rect' ||
    effectiveType === 'circle' ||
    effectiveType === 'triangle';
  const isText = effectiveType === 'text';
  const isPen = effectiveType === 'pen' || effectiveType === 'path';
  const isConnector = effectiveType === 'connector';
  const isVideo = effectiveType === 'video';
  const isAudio = effectiveType === 'audio';
  const isMedia = isVideo || isAudio;

  const [thicknessInput, setThicknessInput] = React.useState<string>(String(strokeWidth));

  React.useEffect(() => {
    setThicknessInput(String(strokeWidth));
  }, [strokeWidth]);

  // Square Color Button that opens the color window in the top-right corner
  const renderColorButton = () => (
    <button
      type="button"
      onClick={onToggleColorPanel}
      aria-label="Abrir ventana de ajustes de color"
      title={`Color: ${activeColor}. Haz clic para abrir la ventana de color.`}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all cursor-pointer ${
        isColorPanelOpen
          ? 'bg-[#252525] border-sky-400 ring-1 ring-sky-400/50 shadow-sm text-white'
          : 'bg-[#141414] border-[#2B2B2B] hover:border-neutral-500 hover:bg-[#1C1C1C] text-neutral-300'
      }`}
    >
      <div
        className="w-4 h-4 rounded-[3px] border border-white/20 shadow-sm shrink-0"
        style={{ backgroundColor: activeColor }}
      />
      <span className="font-mono text-[10px] uppercase font-medium">
        {activeColor}
      </span>
    </button>
  );

  // Numeric Input Field for Stroke Thickness (1 px to 50 px)
  const renderStrokeWidthInput = () => (
    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#141414] border border-[#2B2B2B] rounded-lg">
      <span className="text-[10px] text-neutral-400 font-medium select-none" title="Grosor de trazo (1 a 50 px)">
        Grosor
      </span>
      <input
        type="number"
        min={1}
        max={50}
        value={thicknessInput}
        onChange={(e) => {
          const raw = e.target.value;
          setThicknessInput(raw);
          const val = parseInt(raw, 10);
          if (!isNaN(val) && val >= 1 && val <= 50) {
            onChangeStrokeWidth(val);
          }
        }}
        onBlur={() => {
          const parsed = parseInt(thicknessInput, 10);
          if (isNaN(parsed) || parsed < 1) {
            setThicknessInput('1');
            onChangeStrokeWidth(1);
          } else if (parsed > 50) {
            setThicknessInput('50');
            onChangeStrokeWidth(50);
          } else {
            setThicknessInput(String(parsed));
            onChangeStrokeWidth(parsed);
          }
        }}
        aria-label="Grosor de trazo en píxeles (1 a 50)"
        title="Grosor de trazo (1 a 50 px)"
        className="w-12 bg-[#1C1C1C] border border-[#333333] text-neutral-100 rounded px-1.5 py-0.5 text-center font-mono text-xs outline-none focus:border-sky-400 transition-colors"
      />
      <span className="text-[10px] text-neutral-500 font-mono select-none">
        px
      </span>
    </div>
  );

  return (
    <div
      className="fixed top-[68px] left-1/2 -translate-x-1/2 z-30 bg-[#1E1E1E]/95 backdrop-blur-md border border-[#2D2D2D] rounded-xl px-3 py-1.5 shadow-2xl flex items-center gap-2 max-w-[95vw] overflow-x-auto text-xs text-neutral-300 select-none animate-in fade-in slide-in-from-top-1 duration-150"
      aria-label="Barra de herramientas contextual de edición de elementos"
    >
      {/* 1. SELECTION BADGE & DELETE BUTTON */}
      {hasSelectedElements && (
        <div className="flex items-center gap-1.5 pr-2 border-r border-[#2D2D2D]">
          <span className="text-[11px] text-sky-400 font-medium px-1.5 py-0.5 rounded bg-sky-950/40 border border-sky-800/40 whitespace-nowrap">
            {selectedElementsCount > 1
              ? `${selectedElementsCount} seleccionados`
              : isShape
              ? 'Figura'
              : isText
              ? 'Texto'
              : isPen
              ? 'Trazo'
              : isConnector
              ? 'Conector'
              : isVideo
              ? 'Video'
              : isAudio
              ? 'Audio'
              : 'Seleccionado'}
          </span>
          <button
            type="button"
            onClick={onDeleteSelected}
            title="Eliminar elemento(s) seleccionado(s) (Supr)"
            aria-label="Eliminar selección"
            className="p-1 rounded-lg text-rose-400 hover:text-rose-200 hover:bg-rose-950/60 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. MEDIA (VIDEO / AUDIO) SPECIFIC OPTIONS: VOLUME CONTROL */}
      {isMedia && (
        <div className="flex items-center gap-2 pr-2 border-r border-[#2D2D2D]">
          {/* Mute/Unmute Toggle Button */}
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted || volume === 0 ? 'Activar sonido' : 'Silenciar sonido'}
            title={isMuted || volume === 0 ? 'Silenciado (clic para activar sonido)' : 'Sonido activado (clic para silenciar)'}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
              isMuted || volume === 0
                ? 'bg-rose-950/50 border-rose-800/50 text-rose-300 hover:bg-rose-900/60'
                : 'bg-[#141414] border-[#2B2B2B] text-sky-400 hover:text-sky-300 hover:bg-[#1C1C1C]'
            }`}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : volume < 0.5 ? (
              <Volume1 className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Volume Slider & Percentage */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-neutral-400 font-medium select-none">
              Volumen
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                if (onChangeVolume) {
                  onChangeVolume(parseFloat(e.target.value));
                }
              }}
              aria-label="Control de volumen"
              title={`Volumen: ${isMuted ? '0%' : Math.round(volume * 100) + '%'}`}
              className="w-20 accent-sky-400 bg-neutral-800 h-1.5 rounded-lg cursor-pointer"
            />
            <span className="font-mono text-[10px] text-neutral-300 min-w-[30px] text-right tabular-nums select-none">
              {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
            </span>
          </div>
        </div>
      )}

      {/* 3. SHAPE-SPECIFIC OPTIONS (Only when creating or selecting shapes) */}
      {isShape && (
        <>
          {/* Shape Type Selector: Rect, Circle, Triangle */}
          <div className="flex items-center gap-1 pr-2 border-r border-[#2D2D2D]">
            <button
              type="button"
              onClick={() => onChangeShapeType('rect')}
              aria-label="Seleccionar Rectángulo"
              title="Rectángulo"
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                activeShapeType === 'rect'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChangeShapeType('circle')}
              aria-label="Seleccionar Círculo o Elipse"
              title="Círculo / Elipse"
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                activeShapeType === 'circle'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Circle className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChangeShapeType('triangle')}
              aria-label="Seleccionar Triángulo"
              title="Triángulo"
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                activeShapeType === 'triangle'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Triangle className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Color Button with Square Preview */}
          {renderColorButton()}

          {/* Stroke Width Numeric Input (1 px - 50 px) */}
          {renderStrokeWidthInput()}

          {/* Stroke Style Selector */}
          <div className="flex items-center gap-1 pr-2 border-r border-[#2D2D2D]">
            <button
              type="button"
              onClick={() => onChangeStrokeStyle('solid')}
              aria-label="Línea continua sólida"
              title="Sólida"
              className={`p-1.5 rounded flex items-center justify-center transition-colors cursor-pointer ${
                strokeStyle === 'solid'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChangeStrokeStyle('dashed')}
              aria-label="Línea discontinua"
              title="Discontinua"
              className={`px-1.5 py-1 rounded flex items-center justify-center text-[10px] font-mono transition-colors cursor-pointer ${
                strokeStyle === 'dashed'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              - -
            </button>
            <button
              type="button"
              onClick={() => onChangeStrokeStyle('dotted')}
              aria-label="Línea de puntos"
              title="Punteada"
              className={`px-1.5 py-1 rounded flex items-center justify-center text-[10px] font-mono transition-colors cursor-pointer ${
                strokeStyle === 'dotted'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              ···
            </button>
          </div>
        </>
      )}

      {/* 3. TEXT-SPECIFIC OPTIONS (Only when creating or selecting text) */}
      {isText && (
        <>
          {/* Font Family Dropdown */}
          <select
            value={fontFamily}
            onChange={(e) => onChangeFontFamily(e.target.value)}
            aria-label="Familia tipográfica"
            className="bg-[#141414] border border-[#2B2B2B] text-neutral-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-sky-400 cursor-pointer"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          {/* Font Size Dropdown (up to 100) */}
          <select
            value={fontSize}
            onChange={(e) => onChangeFontSize(parseInt(e.target.value, 10))}
            aria-label="Tamaño de fuente"
            className="bg-[#141414] border border-[#2B2B2B] text-neutral-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-sky-400 font-mono tabular-nums cursor-pointer"
          >
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} px
              </option>
            ))}
          </select>

          {/* Text Alignment: Left, Center, Right, Justified */}
          <div className="flex items-center gap-0.5 bg-[#141414] p-0.5 rounded-lg border border-[#2B2B2B]">
            <button
              type="button"
              onClick={() => onChangeTextAlign('left')}
              aria-label="Alinear a la izquierda"
              title="Alinear a la izquierda"
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                textAlign === 'left'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChangeTextAlign('center')}
              aria-label="Centrar texto"
              title="Centrar"
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                textAlign === 'center'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChangeTextAlign('right')}
              aria-label="Alinear a la derecha"
              title="Alinear a la derecha"
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                textAlign === 'right'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChangeTextAlign('justify')}
              aria-label="Justificar texto"
              title="Justificar"
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                textAlign === 'justify'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Color Button with Square Preview */}
          {renderColorButton()}
        </>
      )}

      {/* 4. PEN-SPECIFIC OPTIONS (Only when creating or selecting pen strokes) */}
      {isPen && (
        <>
          {/* Color Button with Square Preview */}
          {renderColorButton()}

          {/* Stroke Width Numeric Input (1 px - 50 px) */}
          {renderStrokeWidthInput()}

          {/* Stroke Style Selector */}
          <div className="flex items-center gap-1 pr-2 border-r border-[#2D2D2D]">
            <button
              type="button"
              onClick={() => onChangeStrokeStyle('solid')}
              aria-label="Línea continua sólida"
              title="Sólida"
              className={`p-1.5 rounded flex items-center justify-center transition-colors cursor-pointer ${
                strokeStyle === 'solid'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChangeStrokeStyle('dashed')}
              aria-label="Línea discontinua"
              title="Discontinua"
              className={`px-1.5 py-1 rounded flex items-center justify-center text-[10px] font-mono transition-colors cursor-pointer ${
                strokeStyle === 'dashed'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              - -
            </button>
            <button
              type="button"
              onClick={() => onChangeStrokeStyle('dotted')}
              aria-label="Línea de puntos"
              title="Punteada"
              className={`px-1.5 py-1 rounded flex items-center justify-center text-[10px] font-mono transition-colors cursor-pointer ${
                strokeStyle === 'dotted'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              ···
            </button>
          </div>
        </>
      )}

      {/* 5. CONNECTOR-SPECIFIC OPTIONS (Only when creating or selecting connectors) */}
      {isConnector && (
        <>
          {/* Connector Routing Toggle: Orthogonal vs Curved */}
          <div className="flex items-center gap-1 pr-2 border-r border-[#2D2D2D]">
            <button
              type="button"
              onClick={() => onChangeConnectorRouting('orthogonal')}
              aria-label="Conector ortogonal en ángulo recto"
              title="Ortogonal (Ángulos rectos)"
              className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] transition-colors cursor-pointer ${
                connectorRouting === 'orthogonal'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <CornerDownRight className="w-3.5 h-3.5" />
              <span>Ortogonal</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeConnectorRouting('curved')}
              aria-label="Conector curvado Bezier"
              title="Curvado (Suave)"
              className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] transition-colors cursor-pointer ${
                connectorRouting === 'curved'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Spline className="w-3.5 h-3.5" />
              <span>Curvo</span>
            </button>
          </div>

          {/* Color Button with Square Preview */}
          {renderColorButton()}

          {/* Stroke Width Numeric Input (1 px - 50 px) */}
          {renderStrokeWidthInput()}

          {/* Stroke Style Selector */}
          <div className="flex items-center gap-1 pr-2 border-r border-[#2D2D2D]">
            <button
              type="button"
              onClick={() => onChangeStrokeStyle('solid')}
              aria-label="Línea continua sólida"
              title="Sólida"
              className={`p-1.5 rounded flex items-center justify-center transition-colors cursor-pointer ${
                strokeStyle === 'solid'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChangeStrokeStyle('dashed')}
              aria-label="Línea discontinua"
              title="Discontinua"
              className={`px-1.5 py-1 rounded flex items-center justify-center text-[10px] font-mono transition-colors cursor-pointer ${
                strokeStyle === 'dashed'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              - -
            </button>
            <button
              type="button"
              onClick={() => onChangeStrokeStyle('dotted')}
              aria-label="Línea de puntos"
              title="Punteada"
              className={`px-1.5 py-1 rounded flex items-center justify-center text-[10px] font-mono transition-colors cursor-pointer ${
                strokeStyle === 'dotted'
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              ···
            </button>
          </div>
        </>
      )}

      {/* 6. OPACITY SLIDER (Available on graphical elements, shapes, pen, connectors, text, video) */}
      {!isAudio && (
        <div className="flex items-center gap-1.5 pl-1">
          <span className="text-[10px] text-neutral-400 font-mono tabular-nums min-w-[28px]">
            {Math.round(opacity * 100)}%
          </span>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={opacity}
            onChange={(e) => onChangeOpacity(parseFloat(e.target.value))}
            aria-label="Control de opacidad"
            title={`Opacidad: ${Math.round(opacity * 100)}%`}
            className="w-16 accent-sky-400 bg-neutral-800 h-1 rounded-lg cursor-pointer"
          />
        </div>
      )}
    </div>
  );
};

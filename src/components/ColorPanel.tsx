/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Palette, X, Plus, Check } from 'lucide-react';
import { CanvasElementType } from '../types/canvas';

interface ColorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  strokeColor: string;
  onChangeStrokeColor: (color: string) => void;
  fillColor: string;
  onChangeFillColor: (color: string) => void;
  hasSelectedElements?: boolean;
  selectedElementType?: CanvasElementType | null;
}

// Convert HSL to RGB
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

// Convert HSL to Hex
function hslToHex(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, s, l);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}

// Convert Hex to HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  if (!hex || hex === 'transparent') {
    return { h: 0, s: 0, l: 50 };
  }
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  if (c.length !== 6) return { h: 0, s: 0, l: 50 };

  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

// 14 Curated Fast Color Presets for standard selection
const PRESET_COLORS = [
  '#FFFFFF', // Blanco
  '#E4E4E7', // Gris muy claro
  '#A1A1AA', // Gris medio
  '#52525B', // Gris oscuro
  '#27272A', // Carbón
  '#09090B', // Negro
  '#F43F5E', // Rojo / Rosa
  '#F97316', // Naranja
  '#FACC15', // Amarillo
  '#10B981', // Verde esmeralda
  '#06B6D4', // Cian / Celeste
  '#3B82F6', // Azul
  '#8B5CF6', // Violeta
  '#EC4899', // Fucsia
];

export const ColorPanel: React.FC<ColorPanelProps> = ({
  isOpen,
  onClose,
  strokeColor,
  onChangeStrokeColor,
  fillColor,
  onChangeFillColor,
  hasSelectedElements = false,
  selectedElementType,
}) => {
  // Target: 'stroke' (element color) vs 'fill' (shape fill color)
  const [activeTarget, setActiveTarget] = useState<'stroke' | 'fill'>('stroke');

  const currentColor = activeTarget === 'stroke' ? strokeColor : fillColor;
  const isTransparent = activeTarget === 'fill' && fillColor === 'transparent';

  // HSL Color Wheel state with default luminosity set to 50%
  const initialHsl = hexToHsl(currentColor);
  const [hue, setHue] = useState<number>(initialHsl.h);
  const [saturation, setSaturation] = useState<number>(initialHsl.s);
  const [lightness, setLightness] = useState<number>(50); // Set luminosity to 50%
  const [hexInput, setHexInput] = useState<string>(currentColor);

  // Quick-access saved colors palette (10 slots) with localStorage persistence
  const [savedColors, setSavedColors] = useState<(string | null)[]>(() => {
    try {
      const stored = localStorage.getItem('pizarra_custom_saved_colors');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length === 10) return parsed;
      }
    } catch {
      // ignore parsing errors
    }
    return [null, null, null, null, null, null, null, null, null, null];
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef(false);

  // Sync state when active target or external color changes
  useEffect(() => {
    const col = activeTarget === 'stroke' ? strokeColor : fillColor;
    setHexInput(col);
    if (col && col !== 'transparent') {
      const hsl = hexToHsl(col);
      setHue(hsl.h);
      setSaturation(hsl.s);
      // Keep luminosity at 50% unless modified by user
    }
  }, [activeTarget, strokeColor, fillColor]);

  const handleColorChange = useCallback(
    (newHex: string) => {
      if (activeTarget === 'stroke') {
        onChangeStrokeColor(newHex);
      } else {
        onChangeFillColor(newHex);
      }
    },
    [activeTarget, onChangeStrokeColor, onChangeFillColor]
  );

  // Save current color into an empty slot
  const handleSaveColorToSlot = (slotIndex: number) => {
    if (!currentColor || currentColor === 'transparent') return;
    setSavedColors((prev) => {
      const updated = [...prev];
      updated[slotIndex] = currentColor;
      try {
        localStorage.setItem('pizarra_custom_saved_colors', JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
      return updated;
    });
  };

  // Remove saved color from a slot
  const handleClearSlot = (slotIndex: number) => {
    setSavedColors((prev) => {
      const updated = [...prev];
      updated[slotIndex] = null;
      try {
        localStorage.setItem('pizarra_custom_saved_colors', JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
      return updated;
    });
  };

  const wheelSize = 124;
  const radius = wheelSize / 2 - 4;

  // Redraw canvas wheel when lightness changes
  const renderWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const imgData = ctx.createImageData(canvas.width, canvas.height);
    const data = imgData.data;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.hypot(dx, dy);
        const idx = (y * canvas.width + x) * 4;

        if (dist <= radius) {
          const sat = (dist / radius) * 100;
          let angle = Math.atan2(dy, dx) * (180 / Math.PI);
          if (angle < 0) angle += 360;

          const [r, g, b] = hslToRgb(angle, sat, lightness);
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        } else {
          data[idx + 3] = 0;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [lightness, radius]);

  useEffect(() => {
    if (isOpen) {
      renderWheel();
    }
  }, [isOpen, renderWheel]);

  // Handle pointer interactions on the wheel
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    pickColorFromEvent(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    pickColorFromEvent(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const pickColorFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy);

    const clampedDist = Math.min(dist, radius);
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle < 0) angle += 360;

    const newSat = Math.round((clampedDist / radius) * 100);
    const newHue = Math.round(angle);

    setHue(newHue);
    setSaturation(newSat);

    const newHex = hslToHex(newHue, newSat, lightness);
    setHexInput(newHex);
    handleColorChange(newHex);
  };

  const handleLightnessChange = (newL: number) => {
    setLightness(newL);
    const newHex = hslToHex(hue, saturation, newL);
    setHexInput(newHex);
    handleColorChange(newHex);
  };

  // Compute cursor pin coordinates on the wheel
  const cx = wheelSize / 2;
  const cy = wheelSize / 2;
  const pinDist = (saturation / 100) * radius;
  const pinRad = (hue * Math.PI) / 180;
  const pinX = cx + pinDist * Math.cos(pinRad);
  const pinY = cy + pinDist * Math.sin(pinRad);

  const isShape =
    selectedElementType === 'rect' ||
    selectedElementType === 'circle' ||
    selectedElementType === 'triangle';

  if (!isOpen) {
    return null;
  }

  return (
    <aside
      className="fixed top-[68px] right-5 z-30 w-[304px] bg-[#1A1A1A]/95 backdrop-blur-md border border-[#2D2D2D] rounded-xl shadow-2xl p-3.5 text-neutral-200 select-none animate-in fade-in slide-in-from-top-1 duration-150"
      aria-label="Ventana de selección de color y relleno"
    >
      {/* 1. Window Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#2B2B2B]">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-sky-400 shrink-0" />
          <div>
            <h2 className="text-xs font-semibold text-neutral-100 leading-tight">
              Color y Relleno
            </h2>
            <p className="text-[10px] text-neutral-400">
              {hasSelectedElements
                ? isShape
                  ? 'Figura seleccionada'
                  : 'Elemento seleccionado'
                : 'Ajuste general del lienzo'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ventana de color"
          title="Cerrar (Esc)"
          className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {/* 2. Target Selector: Element Color vs Shape Fill Color */}
        <div className="grid grid-cols-2 gap-2">
          {/* Element Color (Stroke / Line / Text) */}
          <button
            type="button"
            onClick={() => setActiveTarget('stroke')}
            aria-label="Seleccionar Color del Elemento o Trazo"
            className={`p-2 rounded-xl border flex flex-col items-start gap-1 transition-all text-left cursor-pointer ${
              activeTarget === 'stroke'
                ? 'bg-[#222222] border-sky-400 ring-1 ring-sky-400/50 shadow-sm'
                : 'bg-[#141414] border-[#2C2C2C] hover:border-neutral-500 hover:bg-[#1A1A1A]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-medium text-neutral-200">Color Elemento</span>
              <div
                className="w-4 h-4 rounded-[3px] border border-neutral-700 shadow-sm shrink-0"
                style={{ backgroundColor: strokeColor }}
              />
            </div>
            <span className="font-mono text-[10px] text-neutral-400 uppercase">
              {strokeColor}
            </span>
          </button>

          {/* Shape Fill Color (Relleno) */}
          <button
            type="button"
            onClick={() => setActiveTarget('fill')}
            aria-label="Seleccionar Relleno de Figuras"
            className={`p-2 rounded-xl border flex flex-col items-start gap-1 transition-all text-left cursor-pointer ${
              activeTarget === 'fill'
                ? 'bg-[#222222] border-sky-400 ring-1 ring-sky-400/50 shadow-sm'
                : 'bg-[#141414] border-[#2C2C2C] hover:border-neutral-500 hover:bg-[#1A1A1A]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-medium text-neutral-200">Relleno Figuras</span>
              <div
                className="w-4 h-4 rounded-[3px] border border-neutral-700 shadow-sm shrink-0 relative overflow-hidden flex items-center justify-center"
                style={{
                  backgroundColor: fillColor === 'transparent' ? '#18181B' : fillColor,
                }}
              >
                {fillColor === 'transparent' && (
                  <span className="text-[9px] text-neutral-500 font-mono font-bold leading-none">
                    ∅
                  </span>
                )}
              </div>
            </div>
            <span className="font-mono text-[10px] text-neutral-400 uppercase">
              {fillColor === 'transparent' ? 'Sin relleno' : fillColor}
            </span>
          </button>
        </div>

        {/* 3. Fill Option: "Sin relleno (Transparente)" Button */}
        {activeTarget === 'fill' && (
          <button
            type="button"
            onClick={() => {
              onChangeFillColor('transparent');
              setHexInput('');
            }}
            className={`w-full py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 border transition-all cursor-pointer ${
              isTransparent
                ? 'bg-sky-500/20 text-sky-400 border-sky-500/50 shadow-sm'
                : 'bg-[#141414] text-neutral-400 border-[#2C2C2C] hover:text-neutral-200 hover:bg-[#1E1E1E]'
            }`}
          >
            <span className="font-mono text-sm font-bold">∅</span>
            <span>Sin relleno (Transparente)</span>
            {isTransparent && <Check className="w-3.5 h-3.5 ml-auto text-sky-400" />}
          </button>
        )}

        {/* 4. Quick-access Palette for Saving Colors */}
        <div className="p-2 bg-[#141414] border border-[#2B2B2B] rounded-xl">
          <div className="flex items-center justify-between text-[11px] text-neutral-300 font-medium mb-1.5">
            <span>Colores guardados</span>
            <span className="text-[9px] text-neutral-500 font-normal">
              Toca un cuadro vacío para guardar
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {savedColors.map((savedCol, idx) => {
              if (!savedCol) {
                // Empty square slot -> clicking saves the currently chosen color
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSaveColorToSlot(idx)}
                    aria-label={`Guardar color actual en ranura ${idx + 1}`}
                    title={
                      currentColor !== 'transparent'
                        ? `Guardar ${currentColor} aquí`
                        : 'Selecciona un color para guardar'
                    }
                    className="w-full aspect-square rounded-md border-2 border-dashed border-neutral-700 hover:border-sky-400 bg-neutral-900/60 hover:bg-neutral-800 transition-all flex items-center justify-center cursor-pointer group"
                  >
                    <Plus className="w-3 h-3 text-neutral-600 group-hover:text-sky-400 transition-colors" />
                  </button>
                );
              }

              // Filled slot -> clicking uses this color
              const isSelected =
                !isTransparent && currentColor.toUpperCase() === savedCol.toUpperCase();
              return (
                <div key={idx} className="relative group">
                  <button
                    type="button"
                    onClick={() => {
                      handleColorChange(savedCol);
                      const hsl = hexToHsl(savedCol);
                      setHue(hsl.h);
                      setSaturation(hsl.s);
                      setLightness(hsl.l);
                      setHexInput(savedCol);
                    }}
                    aria-label={`Usar color guardado ${savedCol}`}
                    title={`${savedCol} (Clic para usar)`}
                    className={`w-full aspect-square rounded-md border transition-all hover:scale-105 cursor-pointer relative ${
                      isSelected
                        ? 'border-white ring-2 ring-sky-400 shadow-md scale-105 z-10'
                        : 'border-white/20 hover:border-white/60'
                    }`}
                    style={{ backgroundColor: savedCol }}
                  />
                  {/* Small delete cross on hover */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearSlot(idx);
                    }}
                    title="Borrar de guardados"
                    aria-label="Borrar color guardado"
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-neutral-900 text-neutral-400 hover:text-rose-400 rounded-full border border-neutral-700 flex items-center justify-center text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5. Standard Preset Colors Palette */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-neutral-400 font-medium mb-1.5">
            <span>Paleta rápida</span>
            <span className="font-mono text-[10px] text-neutral-400 uppercase">
              {isTransparent ? 'Transparente' : currentColor}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {PRESET_COLORS.map((preset) => {
              const isSelected =
                !isTransparent && currentColor.toUpperCase() === preset.toUpperCase();
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    handleColorChange(preset);
                    const hsl = hexToHsl(preset);
                    setHue(hsl.h);
                    setSaturation(hsl.s);
                    setLightness(hsl.l);
                    setHexInput(preset);
                  }}
                  aria-label={`Color ${preset}`}
                  title={preset}
                  className={`w-full aspect-square rounded-md border transition-all hover:scale-110 cursor-pointer relative ${
                    isSelected
                      ? 'border-white ring-2 ring-sky-400 shadow-md scale-105 z-10'
                      : 'border-white/10 hover:border-white/50'
                  }`}
                  style={{ backgroundColor: preset }}
                />
              );
            })}
          </div>
        </div>

        {/* 6. Circular HSL Color Wheel Canvas */}
        <div className="flex flex-col items-center justify-center py-1">
          <div className="relative w-[124px] h-[124px] flex items-center justify-center cursor-crosshair">
            <canvas
              ref={canvasRef}
              width={wheelSize}
              height={wheelSize}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="rounded-full shadow-lg block touch-none"
            />
            {/* Draggable Indicator Pin */}
            {!isTransparent && (
              <div
                className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-xl pointer-events-none ring-1 ring-black/40"
                style={{
                  left: `${pinX}px`,
                  top: `${pinY}px`,
                  backgroundColor: currentColor,
                }}
              />
            )}
          </div>
        </div>

        {/* 7. Lightness Slider (Default 50%) */}
        <div className="w-full flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span>Luminosidad</span>
            <span className="font-mono tabular-nums text-neutral-200">{lightness}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={lightness}
            onChange={(e) => handleLightnessChange(parseInt(e.target.value, 10))}
            aria-label="Luminosidad del color"
            className="w-full h-2 bg-gradient-to-r from-black via-neutral-500 to-white rounded-lg appearance-none cursor-pointer accent-sky-400"
          />
        </div>

        {/* 8. Hex Input and Native System Color Picker */}
        <div className="w-full flex items-center gap-2 pt-2 border-t border-[#2B2B2B]">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 font-mono text-xs">
              #
            </span>
            <input
              type="text"
              value={isTransparent ? '' : hexInput.replace('#', '')}
              placeholder={isTransparent ? 'TRANSPARENTE' : 'FFFFFF'}
              maxLength={6}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9A-Fa-f]/g, '');
                const formatted = '#' + raw.toUpperCase();
                setHexInput(formatted);
                if (raw.length === 6) {
                  handleColorChange(formatted);
                  const hsl = hexToHsl(formatted);
                  setHue(hsl.h);
                  setSaturation(hsl.s);
                  setLightness(hsl.l);
                }
              }}
              className="w-full bg-[#121212] border border-[#2B2B2B] text-neutral-100 rounded-lg pl-6 pr-2 py-1.5 font-mono text-xs uppercase outline-none focus:border-sky-400 transition-colors"
            />
          </div>

          {/* Native browser color picker input as alternative */}
          <label
            title="Selector de color del sistema"
            className="w-8 h-8 rounded-lg border border-[#2B2B2B] cursor-pointer overflow-hidden shrink-0 relative flex items-center justify-center hover:border-sky-400 transition-all hover:scale-105 shadow-sm"
            style={{
              backgroundColor: isTransparent ? '#121212' : currentColor,
            }}
          >
            <input
              type="color"
              value={isTransparent ? '#ffffff' : currentColor}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                handleColorChange(val);
                const hsl = hexToHsl(val);
                setHue(hsl.h);
                setSaturation(hsl.s);
                setLightness(hsl.l);
                setHexInput(val);
              }}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
            />
          </label>
        </div>
      </div>
    </aside>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Palette, X } from 'lucide-react';

interface ColorWheelPickerProps {
  label: string;
  color: string;
  onChangeColor: (color: string) => void;
  allowTransparent?: boolean;
  compact?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
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
    return { h: 0, s: 0, l: 100 };
  }
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  if (c.length !== 6) return { h: 0, s: 0, l: 100 };

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

// 12 curated fast color presets for high efficiency
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

export const ColorWheelPicker: React.FC<ColorWheelPickerProps> = ({
  label,
  color,
  onChangeColor,
  allowTransparent = false,
  compact = false,
  isOpen: controlledIsOpen,
  onToggle: controlledOnToggle,
  onClose: controlledOnClose,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef(false);

  // Controlled or uncontrolled open state
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;

  const handleToggle = () => {
    if (controlledOnToggle) {
      controlledOnToggle();
    } else {
      setInternalOpen((prev) => !prev);
    }
  };

  const handleClose = useCallback(() => {
    if (controlledOnClose) {
      controlledOnClose();
    } else {
      setInternalOpen(false);
    }
  }, [controlledOnClose]);

  // Parse initial HSL from color
  const initialHsl = hexToHsl(color);
  const [hue, setHue] = useState<number>(initialHsl.h);
  const [saturation, setSaturation] = useState<number>(initialHsl.s);
  const [lightness, setLightness] = useState<number>(initialHsl.l);
  const [hexInput, setHexInput] = useState<string>(color);

  // Close independent window on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        (containerRef.current && containerRef.current.contains(target)) ||
        (dropdownRef.current && dropdownRef.current.contains(target))
      ) {
        return;
      }
      handleClose();
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleClose]);

  // Sync state if color changes externally
  useEffect(() => {
    setHexInput(color);
    if (color && color !== 'transparent') {
      const hsl = hexToHsl(color);
      setHue(hsl.h);
      setSaturation(hsl.s);
      setLightness(hsl.l);
    }
  }, [color]);

  const wheelSize = 136;
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
    onChangeColor(newHex);
  };

  const handleLightnessChange = (newL: number) => {
    setLightness(newL);
    const newHex = hslToHex(hue, saturation, newL);
    setHexInput(newHex);
    onChangeColor(newHex);
  };

  // Compute cursor pin coordinates on the wheel
  const cx = wheelSize / 2;
  const cy = wheelSize / 2;
  const pinDist = (saturation / 100) * radius;
  const pinRad = (hue * Math.PI) / 180;
  const pinX = cx + pinDist * Math.cos(pinRad);
  const pinY = cy + pinDist * Math.sin(pinRad);

  const isTransparent = color === 'transparent';

  return (
    <div ref={containerRef} className="relative select-none">
      {/* Compact Trigger Button in Toolbar */}
      {compact ? (
        <button
          type="button"
          onClick={handleToggle}
          aria-label={`Rueda de color para ${label}`}
          title={`${label}: ${isTransparent ? 'Transparente' : color}`}
          className={`flex items-center gap-1.5 px-2 py-1 bg-[#141414] hover:bg-[#1A1A1A] border rounded-lg transition-all text-xs cursor-pointer group ${
            isOpen ? 'border-sky-400 bg-[#1F1F1F] shadow-sm ring-1 ring-sky-400/50' : 'border-[#2B2B2B] hover:border-[#38BDF8]/60'
          }`}
        >
          <div
            className="w-4 h-4 rounded-full border border-neutral-700 shadow-sm relative overflow-hidden shrink-0 flex items-center justify-center"
            style={{
              backgroundColor: isTransparent ? '#18181B' : color,
            }}
          >
            {isTransparent && (
              <span className="text-[9px] text-neutral-500 font-mono font-bold leading-none">
                ∅
              </span>
            )}
          </div>
          <span className="font-mono text-[10px] text-neutral-300 group-hover:text-white uppercase">
            {isTransparent ? 'Sin relleno' : color}
          </span>
          <div
            className="w-2.5 h-2.5 rounded-full shadow-inner border border-white/20 shrink-0 opacity-80"
            style={{
              background:
                'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)',
            }}
          />
        </button>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] text-neutral-400 font-medium">
            <span>{label}</span>
            {allowTransparent && (
              <button
                type="button"
                onClick={() => {
                  onChangeColor('transparent');
                  handleClose();
                }}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  isTransparent
                    ? 'bg-sky-500/20 text-sky-400 font-semibold'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Sin relleno
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleToggle}
            aria-label={`Rueda de color para ${label}`}
            title="Abrir rueda de color"
            className="flex items-center justify-between gap-2.5 p-1.5 bg-[#141414] hover:bg-[#1A1A1A] border border-[#2B2B2B] hover:border-[#38BDF8]/60 rounded-lg transition-all text-xs cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-full border border-neutral-700 shadow-sm relative overflow-hidden shrink-0 flex items-center justify-center"
                style={{
                  backgroundColor: isTransparent ? '#18181B' : color,
                }}
              >
                {isTransparent && (
                  <span className="text-[11px] text-neutral-500 font-mono font-bold leading-none">
                    ∅
                  </span>
                )}
              </div>
              <span className="font-mono text-[11px] text-neutral-300 group-hover:text-white uppercase tracking-wider">
                {isTransparent ? 'Transparente' : color}
              </span>
            </div>

            <div
              className="w-4 h-4 rounded-full shadow-inner border border-white/20 shrink-0"
              style={{
                background:
                  'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)',
              }}
            />
          </button>
        </div>
      )}

      {/* Independent Color Window in Top-Right Corner */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="fixed top-[72px] right-6 z-50 w-72 bg-[#1A1A1A]/98 backdrop-blur-md border border-[#2F2F2F] rounded-2xl shadow-2xl p-4 text-neutral-200 select-none animate-in fade-in slide-in-from-top-2 duration-150"
          role="dialog"
          aria-label={`Ajustes de color para ${label}`}
        >
          {/* Window Header */}
          <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#2C2C2C]">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-semibold text-neutral-100">
                {label.startsWith('Color') ? label : `Color de ${label}`}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Cerrar ventana de color"
              title="Cerrar"
              className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Preset Colors Palette */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-[11px] text-neutral-400 font-medium mb-1.5">
              <span>Paleta rápida</span>
              <span className="font-mono text-[10px] text-neutral-400 uppercase">
                {isTransparent ? 'Transparente' : color}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {PRESET_COLORS.map((preset) => {
                const isSelected = !isTransparent && color.toUpperCase() === preset.toUpperCase();
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      onChangeColor(preset);
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

          {/* Transparent option button if allowed */}
          {allowTransparent && (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => {
                  onChangeColor('transparent');
                  setHexInput('');
                }}
                className={`w-full py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  isTransparent
                    ? 'bg-sky-500/20 text-sky-400 border-sky-500/50 shadow-sm'
                    : 'bg-[#141414] text-neutral-400 border-[#2D2D2D] hover:text-neutral-200 hover:bg-[#202020]'
                }`}
              >
                <span className="font-mono text-sm font-bold">∅</span>
                <span>Sin relleno (Transparente)</span>
              </button>
            </div>
          )}

          {/* Circular HSL Color Wheel Canvas */}
          <div className="flex flex-col items-center justify-center my-2">
            <div className="relative w-[136px] h-[136px] flex items-center justify-center cursor-crosshair">
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
                  className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-xl pointer-events-none ring-1 ring-black/40"
                  style={{
                    left: `${pinX}px`,
                    top: `${pinY}px`,
                    backgroundColor: color,
                  }}
                />
              )}
            </div>
          </div>

          {/* Lightness Slider */}
          <div className="w-full flex flex-col gap-1.5 my-2">
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

          {/* Hex Input and Native System Color Picker */}
          <div className="w-full flex items-center gap-2 pt-2.5 border-t border-[#2C2C2C]">
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
                    onChangeColor(formatted);
                    const hsl = hexToHsl(formatted);
                    setHue(hsl.h);
                    setSaturation(hsl.s);
                    setLightness(hsl.l);
                  }
                }}
                className="w-full bg-[#121212] border border-[#2E2E2E] text-neutral-100 rounded-lg pl-6 pr-2 py-1.5 font-mono text-xs uppercase outline-none focus:border-sky-400 transition-colors"
              />
            </div>

            {/* Native browser color picker input as alternative */}
            <label
              title="Selector de color del sistema"
              className="w-8 h-8 rounded-lg border border-[#2E2E2E] cursor-pointer overflow-hidden shrink-0 relative flex items-center justify-center hover:border-sky-400 transition-all hover:scale-105 shadow-sm"
              style={{
                backgroundColor: isTransparent ? '#121212' : color,
              }}
            >
              <input
                type="color"
                value={isTransparent ? '#ffffff' : color}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  onChangeColor(val);
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
      )}
    </div>
  );
};

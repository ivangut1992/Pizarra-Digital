/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Layers,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Check,
  ShieldAlert,
} from 'lucide-react';
import { LayerConfig } from '../types/canvas';

interface LayerControlProps {
  layers: LayerConfig[];
  activeLayer: number;
  onSelectLayer: (layerId: number) => void;
  onToggleVisibility: (layerId: number) => void;
  onToggleLock: (layerId: number) => void;
  layerElementCounts: Record<number, number>;
}

export const LayerControl: React.FC<LayerControlProps> = ({
  layers,
  activeLayer,
  onSelectLayer,
  onToggleVisibility,
  onToggleLock,
  layerElementCounts,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const currentLayer = layers.find((l) => l.id === activeLayer) || layers[0];

  // Visual stack order: Capa 4 (top) down to Capa 1 (bottom)
  const sortedLayers = [...layers].sort((a, b) => b.id - a.id);

  return (
    <div ref={containerRef} className="fixed bottom-5 left-5 z-40 select-none">
      {/* Expanded Layers Popover */}
      {isOpen && (
        <div className="absolute bottom-12 left-0 mb-2 w-72 bg-[#1A1A1A]/95 backdrop-blur-md border border-[#2D2D2D] rounded-xl shadow-2xl p-3 text-neutral-200 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2D2D2D]">
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-400" />
              <h4 className="text-xs font-semibold text-neutral-100">Control de Capas</h4>
            </div>
            <span className="text-[10px] text-neutral-400 font-mono">1 abajo · 4 arriba</span>
          </div>

          <div className="flex flex-col gap-1.5">
            {sortedLayers.map((layer) => {
              const isActive = layer.id === activeLayer;
              const count = layerElementCounts[layer.id] || 0;

              return (
                <div
                  key={layer.id}
                  onClick={() => onSelectLayer(layer.id)}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border ${
                    isActive
                      ? 'bg-sky-950/40 border-sky-500/50 text-white shadow-sm'
                      : 'bg-[#141414] border-[#262626] hover:bg-[#1E1E1E] text-neutral-300'
                  }`}
                >
                  {/* Left: Active Indicator & Layer Name */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        isActive
                          ? 'bg-sky-400 text-neutral-950'
                          : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                      }`}
                    >
                      {layer.id}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium truncate">{layer.name}</span>
                        {isActive && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-400/20 text-sky-300 font-semibold uppercase">
                            Activa
                          </span>
                        )}
                        {!isActive && (
                          <span className="text-[9px] text-neutral-400">
                            (Solo vista)
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-neutral-400">
                        {count} {count === 1 ? 'elemento' : 'elementos'}
                      </span>
                    </div>
                  </div>

                  {/* Right: Visibility & Lock Actions */}
                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Toggle Visibility */}
                    <button
                      type="button"
                      onClick={() => onToggleVisibility(layer.id)}
                      aria-label={`${layer.visible ? 'Ocultar' : 'Mostrar'} ${layer.name}`}
                      title={layer.visible ? 'Capa visible (clic para ocultar)' : 'Capa oculta (clic para mostrar)'}
                      className={`p-1.5 rounded transition-colors ${
                        layer.visible
                          ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                          : 'text-amber-400 bg-amber-950/40 hover:bg-amber-900/60'
                      }`}
                    >
                      {layer.visible ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Toggle Lock */}
                    <button
                      type="button"
                      onClick={() => onToggleLock(layer.id)}
                      aria-label={`${layer.locked ? 'Desbloquear' : 'Bloquear'} ${layer.name}`}
                      title={layer.locked ? 'Capa bloqueada (clic para desbloquear)' : 'Capa desbloqueada (clic para bloquear)'}
                      className={`p-1.5 rounded transition-colors ${
                        layer.locked
                          ? 'text-rose-400 bg-rose-950/40 hover:bg-rose-900/60'
                          : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                      }`}
                    >
                      {layer.locked ? (
                        <Lock className="w-3.5 h-3.5" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2.5 pt-2 border-t border-[#262626] text-[10px] text-neutral-400 flex items-center justify-between">
            <span>Solo los elementos de la capa activa se pueden editar.</span>
          </div>
        </div>
      )}

      {/* Persistent Button Displaying Active Layer */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Gestor de capas. Capa activa actual: Capa ${activeLayer}`}
        title={`Capa activa: Capa ${activeLayer} (clic para abrir panel)`}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1E1E1E]/95 backdrop-blur-md border shadow-2xl transition-all cursor-pointer group ${
          isOpen
            ? 'border-sky-400 text-white'
            : 'border-[#2D2D2D] hover:border-[#38BDF8]/60 text-neutral-300 hover:text-white'
        }`}
      >
        <Layers className="w-4 h-4 text-sky-400 group-hover:scale-105 transition-transform" />
        <span className="text-xs font-semibold tracking-wide">
          Capa {activeLayer}
        </span>

        {/* Status badges for active layer */}
        <div className="flex items-center gap-1">
          {currentLayer.locked && (
            <span title="Capa activa bloqueada">
              <Lock className="w-3 h-3 text-rose-400" />
            </span>
          )}
          {!currentLayer.visible && (
            <span title="Capa activa oculta">
              <EyeOff className="w-3 h-3 text-amber-400" />
            </span>
          )}
        </div>
      </button>
    </div>
  );
};

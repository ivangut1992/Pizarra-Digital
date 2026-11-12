/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Download,
  FileJson,
  Image as ImageIcon,
  Check,
  CloudUpload,
  Keyboard,
  HelpCircle,
  Share2,
  X,
} from 'lucide-react';
import { BoardState } from '../types/canvas';
import { exportBoardToJSON, exportBoardToPNG } from '../utils/export';
import { ShareModal } from './ShareModal';

interface TopNavProps {
  board: BoardState;
  onBackToDashboard: () => void;
  onUpdateTitle: (newTitle: string) => void;
  isSaving: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({
  board,
  onBackToDashboard,
  onUpdateTitle,
  isSaving,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(board.name);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    setTitleInput(board.name);
  }, [board.name]);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    const trimmed = titleInput.trim();
    if (trimmed && trimmed !== board.name) {
      onUpdateTitle(trimmed);
    } else {
      setTitleInput(board.name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setTitleInput(board.name);
      setIsEditingTitle(false);
    }
  };

  return (
    <>
      <header
        className="fixed top-4 left-5 right-5 z-40 flex items-center justify-between pointer-events-none select-none"
        aria-label="Barra de navegación principal"
      >
        {/* Left Zone: Back Button & Editable Title */}
        <div className="flex items-center gap-3 bg-[#1E1E1E]/95 backdrop-blur-md border border-[#2D2D2D] rounded-xl px-3 py-2 shadow-2xl pointer-events-auto">
          <button
            type="button"
            onClick={onBackToDashboard}
            aria-label="Volver al panel principal de pizarras"
            title="Volver a mis pizarras"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="h-4 w-px bg-neutral-800" />

          {isEditingTitle ? (
            <input
              type="text"
              value={titleInput}
              autoFocus
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleKeyDown}
              className="bg-[#141414] text-neutral-100 px-2.5 py-1 rounded-md text-sm font-semibold outline-none border border-sky-400 min-w-[200px]"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              title="Clic para renombrar la pizarra"
              className="group flex items-center gap-2 px-2 py-1 rounded-md hover:bg-neutral-800/60 transition-colors text-left"
            >
              <span className="text-sm font-semibold text-neutral-100 tracking-tight max-w-[280px] truncate">
                {board.name}
              </span>
              <span className="text-[10px] text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity">
                Renombrar
              </span>
            </button>
          )}

          {/* Sync status indicator */}
          <div className="flex items-center gap-1.5 pl-2 text-[11px] text-neutral-500">
            {isSaving ? (
              <>
                <CloudUpload className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                <span className="hidden sm:inline">Guardando...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Guardado</span>
              </>
            )}
          </div>
        </div>

        {/* Right Zone: Shortcuts guide and Export Action */}
        <div className="flex items-center gap-2 bg-[#1E1E1E]/95 backdrop-blur-md border border-[#2D2D2D] rounded-xl p-1.5 shadow-2xl pointer-events-auto relative">
          {/* Share Button (Sin restricciones) - Positioned to the left of the keyboard shortcut button */}
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            aria-label="Compartir pizarra sin restricciones"
            title="Invitar usuarios a la pizarra (acceso total sin restricciones)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 hover:text-sky-200 text-xs font-semibold transition-all hover:scale-102 active:scale-98"
          >
            <Share2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Compartir</span>
          </button>

          <button
            type="button"
            onClick={() => setShowShortcutsModal(true)}
            aria-label="Ver atajos de teclado de la pizarra"
            title="Atajos de teclado"
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-neutral-800" />

          <button
            type="button"
            onClick={() => setShowExportMenu(!showExportMenu)}
            aria-label="Abrir menú de exportación de la pizarra"
            title="Exportar pizarra"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-900 hover:bg-white text-xs font-semibold transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar</span>
          </button>

          {/* Export Dropdown Popover */}
          {showExportMenu && (
            <div
              className="absolute right-0 top-12 w-48 bg-[#1E1E1E] border border-[#2D2D2D] rounded-xl shadow-2xl p-1.5 flex flex-col gap-1 text-xs text-neutral-200 animate-in fade-in duration-150"
              onMouseLeave={() => setShowExportMenu(false)}
            >
              <button
                type="button"
                onClick={() => {
                  exportBoardToPNG(board, { scale: 2 });
                  setShowExportMenu(false);
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-neutral-800/80 transition-colors text-left"
              >
                <ImageIcon className="w-4 h-4 text-sky-400" />
                <div>
                  <div className="font-medium">Imagen PNG</div>
                  <div className="text-[10px] text-neutral-400">Alta resolución (2x)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  exportBoardToJSON(board);
                  setShowExportMenu(false);
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-neutral-800/80 transition-colors text-left"
              >
                <FileJson className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="font-medium">Archivo JSON</div>
                  <div className="text-[10px] text-neutral-400">Copia de seguridad local</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Keyboard Shortcuts Dialog Modal */}
      {showShortcutsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowShortcutsModal(false)}
        >
          <div
            className="bg-[#1E1E1E] border border-[#2D2D2D] rounded-2xl max-w-md w-full p-6 shadow-2xl text-neutral-200 relative animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#2D2D2D]">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-sky-400" />
                <h3 className="text-base font-semibold text-neutral-100">Atajos de Teclado</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Mover / Pan</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[11px]">Espacio + Arrastre</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Deshacer</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[11px]">Ctrl + Z</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Rehacer</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[11px]">Ctrl + Y</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Eliminar</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[11px]">Supr / Del</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Selección múltiple</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[11px]">Mayús + Clic</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Zoom con ancla</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[11px]">Rueda ratón</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Herramienta Selección</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[11px]">V</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Herramienta Lápiz</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[11px]">P</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Herramienta Figuras</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[11px]">R</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Herramienta Texto</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[11px]">T</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Conector inteligente</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[11px]">C</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Herramienta Borrador</span>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[11px]">E</kbd>
              </div>
            </div>

            <div className="pt-3 border-t border-[#2D2D2D] flex justify-end">
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share & Invite Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        boardId={board.id}
        boardName={board.name}
      />
    </>
  );
};

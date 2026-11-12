/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Plus,
  FolderOpen,
  Trash2,
  Download,
  FileJson,
  Upload,
  Calendar,
  Layers,
  Sparkles,
  LayoutGrid,
  GitFork,
  LayoutTemplate,
  X,
  AlertTriangle,
} from 'lucide-react';
import { BoardState } from '../types/canvas';
import { exportBoardToJSON, exportBoardToPNG, importBoardFromJSON } from '../utils/export';

interface DashboardProps {
  boards: BoardState[];
  onOpenBoard: (boardId: string) => void;
  onCreateBoard: (name?: string) => void;
  onDeleteBoard: (boardId: string) => void;
  onUpdateBoardName: (boardId: string, newName: string) => void;
  onImportBoard: (importedBoard: BoardState) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  boards,
  onOpenBoard,
  onCreateBoard,
  onDeleteBoard,
  onUpdateBoardName,
  onImportBoard,
}) => {
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [boardToDelete, setBoardToDelete] = useState<BoardState | null>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const startEditing = (b: BoardState, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBoardId(b.id);
    setEditingName(b.name);
  };

  const handleSaveName = (id: string) => {
    setEditingBoardId(null);
    const trimmed = editingName.trim();
    if (trimmed) {
      onUpdateBoardName(id, trimmed);
    }
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const imported = importBoardFromJSON(content);
      if (imported) {
        onImportBoard(imported);
      }
    };
    reader.readAsText(file);
    if (jsonInputRef.current) jsonInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen w-full bg-[#121212] text-neutral-100 flex flex-col select-none">
      {/* Header Bar */}
      <header className="border-b border-[#242424] bg-[#181818]/90 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-neutral-100 to-neutral-400 text-neutral-950 flex items-center justify-center font-black text-lg shadow-md">
              P
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                Pizarra Digital
              </h1>
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <span className="font-mono tabular-nums">{boards.length}</span>
                <span>{boards.length === 1 ? 'pizarra guardada' : 'pizarras guardadas'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={jsonInputRef}
              accept=".json"
              onChange={handleJsonUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => jsonInputRef.current?.click()}
              title="Importar una pizarra en formato JSON"
              className="px-3.5 py-2 rounded-xl bg-[#222222] hover:bg-[#2A2A2A] text-neutral-300 hover:text-white border border-[#333333] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Importar JSON</span>
            </button>

            <button
              type="button"
              onClick={() => onCreateBoard('Nueva Pizarra')}
              className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-neutral-950 text-xs font-bold flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Pizarra</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full flex-1 px-6 py-8">
        {boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 mb-4 shadow-inner">
              <Layers className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-neutral-200">No tienes pizarras aún</h2>
            <p className="text-sm text-neutral-500 max-w-sm mt-1 mb-6">
              Empieza creando un lienzo en blanco para dibujar y diagramar tus ideas.
            </p>
            <button
              type="button"
              onClick={() => onCreateBoard('Nueva Pizarra')}
              className="px-5 py-2.5 rounded-xl bg-white text-neutral-950 text-xs font-bold flex items-center gap-2 shadow-xl hover:bg-neutral-200 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Crear mi primera pizarra</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {boards.map((b) => (
              <div
                key={b.id}
                onClick={() => onOpenBoard(b.id)}
                className="group relative bg-[#1A1A1A] hover:bg-[#202020] border border-[#2B2B2B] hover:border-neutral-600 rounded-2xl overflow-hidden flex flex-col shadow-lg transition-all duration-200 cursor-pointer hover:-translate-y-1"
              >
                {/* Thumbnail Preview Area */}
                <div className="aspect-[16/10] w-full bg-[#141414] border-b border-[#2B2B2B] relative overflow-hidden flex items-center justify-center">
                  {b.thumbnail ? (
                    <img
                      src={b.thumbnail}
                      alt={b.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="text-xs text-neutral-600 flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-neutral-700" />
                      <span>Lienzo vacío</span>
                    </div>
                  )}

                  {/* Hover Overlay Button to Open */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="px-3 py-1.5 rounded-lg bg-white text-neutral-950 text-xs font-semibold flex items-center gap-1.5 shadow-xl">
                      <FolderOpen className="w-3.5 h-3.5" />
                      Abrir
                    </span>
                  </div>
                </div>

                {/* Card Info and Inline Title Edit */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    {editingBoardId === b.id ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingName}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => handleSaveName(b.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveName(b.id);
                          if (e.key === 'Escape') setEditingBoardId(null);
                        }}
                        className="bg-[#121212] border border-sky-400 text-white text-sm font-semibold rounded px-2 py-1 w-full outline-none"
                      />
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <h3
                          title="Clic para editar título"
                          onClick={(e) => startEditing(b, e)}
                          className="font-semibold text-sm text-neutral-100 truncate hover:text-sky-300 transition-colors"
                        >
                          {b.name}
                        </h3>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 font-mono tabular-nums mt-1.5">
                      <Calendar className="w-3.5 h-3.5 text-neutral-600" />
                      <span>{formatDate(b.updatedAt)}</span>
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#262626] text-xs">
                    <div className="flex items-center gap-1 text-neutral-500">
                      <span className="font-mono tabular-nums">{b.elements.length}</span>
                      <span>{b.elements.length === 1 ? 'nodo' : 'nodos'}</span>
                    </div>

                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => exportBoardToPNG(b, { scale: 2 })}
                        title="Exportar imagen PNG"
                        aria-label="Exportar imagen PNG"
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => exportBoardToJSON(b)}
                        title="Exportar archivo JSON"
                        aria-label="Exportar archivo JSON"
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                      >
                        <FileJson className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setBoardToDelete(b)}
                        title="Eliminar pizarra"
                        aria-label="Eliminar pizarra"
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>



      {/* Delete Board Confirmation Modal (Guardrail) */}
      {boardToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none"
          onClick={() => setBoardToDelete(null)}
        >
          <div
            className="bg-[#1E1E1E] border border-rose-900/60 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-neutral-200 relative animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800 flex items-center justify-center text-rose-400 mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <h3 className="text-base font-bold text-white">
              ¿Eliminar pizarra permanentemente?
            </h3>
            <p className="text-xs text-neutral-400 mt-2 mb-6">
              Estás a punto de eliminar <strong className="text-neutral-200">{boardToDelete.name}</strong>. Esta acción borrará todos sus elementos locales en IndexedDB de forma irreversible.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setBoardToDelete(null)}
                className="px-4 py-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteBoard(boardToDelete.id);
                  setBoardToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg transition-colors"
              >
                Eliminar Pizarra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

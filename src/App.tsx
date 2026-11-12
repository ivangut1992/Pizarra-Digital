/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BoardState } from './types/canvas';
import {
  getAllBoards,
  getBoard,
  createBoard,
  deleteBoard,
  saveBoard,
} from './utils/storage';
import { Dashboard } from './components/Dashboard';
import { CanvasView } from './components/CanvasView';
import { TemplateType } from './utils/templates';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [boards, setBoards] = useState<BoardState[]>([]);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [activeBoard, setActiveBoard] = useState<BoardState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load all boards on mount
  const refreshBoards = async () => {
    const list = await getAllBoards();
    setBoards(list);
    return list;
  };

  useEffect(() => {
    const initApp = async () => {
      setIsLoading(true);
      const list = await getAllBoards();

      // Check URL hash for direct board link #/canvas/:id
      const hash = window.location.hash;
      let targetId: string | null = null;
      if (hash.startsWith('#/canvas/')) {
        targetId = hash.replace('#/canvas/', '');
      }

      // Filter out any previously created showcase example boards if they exist
      const userBoards = list.filter((b) => b.name !== 'Estrategia de Producto Q4');
      if (userBoards.length !== list.length) {
        // Purge previous showcase boards from storage
        for (const b of list) {
          if (b.name === 'Estrategia de Producto Q4') {
            await deleteBoard(b.id);
          }
        }
      }

      setBoards(userBoards);
      if (targetId) {
        const found = userBoards.find((b) => b.id === targetId) || (await getBoard(targetId));
        if (found) {
          setActiveBoard(found);
          setCurrentBoardId(found.id);
        }
      }

      setIsLoading(false);
    };

    initApp();

    const handleHashChange = async () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/canvas/')) {
        const id = hash.replace('#/canvas/', '');
        const board = await getBoard(id);
        if (board) {
          setActiveBoard(board);
          setCurrentBoardId(board.id);
        }
      } else {
        setActiveBoard(null);
        setCurrentBoardId(null);
        await refreshBoards();
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleOpenBoard = async (boardId: string) => {
    const board = await getBoard(boardId);
    if (board) {
      setActiveBoard(board);
      setCurrentBoardId(board.id);
      window.location.hash = `#/canvas/${board.id}`;
    }
  };

  const handleBackToDashboard = async () => {
    setActiveBoard(null);
    setCurrentBoardId(null);
    window.location.hash = '#/dashboard';
    await refreshBoards();
  };

  const handleCreateBoard = async (name?: string) => {
    const newBoard = await createBoard(name);
    await refreshBoards();
    setActiveBoard(newBoard);
    setCurrentBoardId(newBoard.id);
    window.location.hash = `#/canvas/${newBoard.id}`;
  };

  const handleDeleteBoard = async (boardId: string) => {
    await deleteBoard(boardId);
    await refreshBoards();
    if (currentBoardId === boardId) {
      handleBackToDashboard();
    }
  };

  const handleUpdateBoardName = async (boardId: string, newName: string) => {
    const board = await getBoard(boardId);
    if (board) {
      const updated = { ...board, name: newName, updatedAt: Date.now() };
      await saveBoard(updated);
      await refreshBoards();
      if (activeBoard && activeBoard.id === boardId) {
        setActiveBoard(updated);
      }
    }
  };

  const handleImportBoard = async (importedBoard: BoardState) => {
    await saveBoard(importedBoard);
    await refreshBoards();
    setActiveBoard(importedBoard);
    setCurrentBoardId(importedBoard.id);
    window.location.hash = `#/canvas/${importedBoard.id}`;
  };

  const handleBoardUpdated = (updatedBoard: BoardState) => {
    setActiveBoard(updatedBoard);
    setBoards((prev) =>
      prev.map((b) => (b.id === updatedBoard.id ? updatedBoard : b))
    );
  };

  if (isLoading) {
    return (
      <div className="w-screen h-screen bg-[#121212] text-neutral-300 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        <span className="text-xs font-medium text-neutral-500">Cargando pizarra...</span>
      </div>
    );
  }

  if (activeBoard && currentBoardId) {
    return (
      <CanvasView
        key={activeBoard.id}
        initialBoard={activeBoard}
        onBackToDashboard={handleBackToDashboard}
        onBoardUpdated={handleBoardUpdated}
      />
    );
  }

  return (
    <Dashboard
      boards={boards}
      onOpenBoard={handleOpenBoard}
      onCreateBoard={handleCreateBoard}
      onDeleteBoard={handleDeleteBoard}
      onUpdateBoardName={handleUpdateBoardName}
      onImportBoard={handleImportBoard}
    />
  );
}

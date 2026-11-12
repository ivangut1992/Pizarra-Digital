/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Upload,
  Link as LinkIcon,
  X,
  AlertCircle,
  FileVideo,
  Music,
  Sparkles,
  Layers,
} from 'lucide-react';
import {
  convertImageToWebP,
  isGifFile,
  isVideoFile,
  isAudioFile,
} from '../utils/webpConverter';

export interface InsertMediaPayload {
  type: 'image' | 'video' | 'audio';
  mediaType?: 'image' | 'gif' | 'video' | 'audio';
  src: string;
  width: number;
  height: number;
  fileName?: string;
  duration?: number;
}

interface MediaUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertMedia: (payload: InsertMediaPayload) => void;
}

export const MediaUploadModal: React.FC<MediaUploadModalProps> = ({
  isOpen,
  onClose,
  onInsertMedia,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [selectedMediaType, setSelectedMediaType] = useState<'all' | 'image' | 'gif' | 'video' | 'audio'>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processFile = async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const fileName = file.name;

      // 1. Audio handling (MP3, WAV, OGG, etc.)
      if (isAudioFile(file)) {
        setStatusMessage('Procesando archivo de audio...');
        const objectUrl = URL.createObjectURL(file);
        const audio = new Audio();
        audio.preload = 'metadata';

        audio.onloadedmetadata = () => {
          const duration = audio.duration || 0;
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            URL.revokeObjectURL(objectUrl);
            onInsertMedia({
              type: 'audio',
              mediaType: 'audio',
              src: dataUrl,
              width: 300,
              height: 76,
              fileName,
              duration,
            });
            setIsLoading(false);
            onClose();
          };
          reader.readAsDataURL(file);
        };

        audio.onerror = () => {
          // Fallback if metadata probe fails
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            onInsertMedia({
              type: 'audio',
              mediaType: 'audio',
              src: dataUrl,
              width: 300,
              height: 76,
              fileName,
              duration: 30,
            });
            setIsLoading(false);
            onClose();
          };
          reader.readAsDataURL(file);
        };

        audio.src = objectUrl;
        return;
      }

      // 2. Video handling (MP4, WebM, etc.)
      if (isVideoFile(file)) {
        setStatusMessage('Cargando video (configuración de reproducción única sin segundo plano)...');
        const objectUrl = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        video.onloadedmetadata = () => {
          const naturalW = video.videoWidth || 640;
          const naturalH = video.videoHeight || 360;
          const duration = video.duration || 0;
          const targetW = Math.min(naturalW, 480);
          const targetH = Math.round(targetW * (naturalH / naturalW));

          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            URL.revokeObjectURL(objectUrl);
            onInsertMedia({
              type: 'video',
              mediaType: 'video',
              src: dataUrl,
              width: targetW,
              height: targetH,
              fileName,
              duration,
            });
            setIsLoading(false);
            onClose();
          };
          reader.readAsDataURL(file);
        };

        video.onerror = () => {
          setErrorMessage('No se pudo procesar el formato del video seleccionado.');
          setIsLoading(false);
          URL.revokeObjectURL(objectUrl);
        };

        video.src = objectUrl;
        return;
      }

      // 3. GIF animation handling
      if (isGifFile(file)) {
        setStatusMessage('Cargando animación GIF (reproducción pausada por defecto)...');
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          const img = new Image();
          img.onload = () => {
            const naturalW = img.naturalWidth || 400;
            const naturalH = img.naturalHeight || 300;
            const targetW = Math.min(naturalW, 420);
            const targetH = Math.round(targetW * (naturalH / naturalW));

            onInsertMedia({
              type: 'image',
              mediaType: 'gif',
              src: dataUrl,
              width: targetW,
              height: targetH,
              fileName,
              duration: 3, // default GIF cycle length
            });
            setIsLoading(false);
            onClose();
          };
          img.onerror = () => {
            setErrorMessage('Error al leer el archivo GIF.');
            setIsLoading(false);
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
        return;
      }

      // 4. Raster Images (PNG, JPG, BMP, etc.) -> OPTIMIZE TO WEBP AUTOMATICALLY!
      if (file.type.startsWith('image/')) {
        setStatusMessage('Optimizando imagen al formato WebP de alta fidelidad...');
        const result = await convertImageToWebP(file, 0.85);

        const targetW = Math.min(result.width, 420);
        const targetH = Math.round(targetW * (result.height / result.width));

        onInsertMedia({
          type: 'image',
          mediaType: 'image',
          src: result.src,
          width: targetW,
          height: targetH,
          fileName,
        });
        setIsLoading(false);
        onClose();
        return;
      }

      // Unsupported file type
      setErrorMessage(
        'Tipo de archivo no compatible. Sube imágenes (WebP, PNG, JPG), GIF, videos (MP4, WebM) o audios (MP3, WAV, OGG).'
      );
      setIsLoading(false);
    } catch (err: unknown) {
      console.error('Error al procesar archivo multimedia:', err);
      setErrorMessage('Ocurrió un error al procesar el archivo. Intenta de nuevo.');
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setErrorMessage('Por favor, ingresa una URL multimedia válida.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setStatusMessage('Cargando recurso multimedia desde la web...');

    // Detect media type from URL extension
    const lower = trimmed.toLowerCase();
    const isVideo = /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(lower);
    const isAudio = /\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i.test(lower);
    const isGif = /\.gif(\?.*)?$/i.test(lower);

    if (isVideo) {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const naturalW = video.videoWidth || 640;
        const naturalH = video.videoHeight || 360;
        const targetW = Math.min(naturalW, 480);
        const targetH = Math.round(targetW * (naturalH / naturalW));
        onInsertMedia({
          type: 'video',
          mediaType: 'video',
          src: trimmed,
          width: targetW,
          height: targetH,
          fileName: trimmed.split('/').pop()?.split('?')[0] || 'video.mp4',
          duration: video.duration || 0,
        });
        setIsLoading(false);
        setUrlInput('');
        onClose();
      };
      video.onerror = () => {
        // Fallback default video frame
        onInsertMedia({
          type: 'video',
          mediaType: 'video',
          src: trimmed,
          width: 480,
          height: 270,
          fileName: trimmed.split('/').pop()?.split('?')[0] || 'video.mp4',
        });
        setIsLoading(false);
        setUrlInput('');
        onClose();
      };
      video.src = trimmed;
      return;
    }

    if (isAudio) {
      onInsertMedia({
        type: 'audio',
        mediaType: 'audio',
        src: trimmed,
        width: 300,
        height: 76,
        fileName: trimmed.split('/').pop()?.split('?')[0] || 'audio.mp3',
      });
      setIsLoading(false);
      setUrlInput('');
      onClose();
      return;
    }

    // Default: treat as Image / GIF
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const naturalW = img.naturalWidth || 400;
      const naturalH = img.naturalHeight || 300;
      const targetW = Math.min(naturalW, 420);
      const targetH = Math.round(targetW * (naturalH / naturalW));

      onInsertMedia({
        type: 'image',
        mediaType: isGif ? 'gif' : 'image',
        src: trimmed,
        width: targetW,
        height: targetH,
        fileName: trimmed.split('/').pop()?.split('?')[0] || 'imagen.webp',
      });
      setIsLoading(false);
      setUrlInput('');
      onClose();
    };
    img.onerror = () => {
      onInsertMedia({
        type: 'image',
        mediaType: isGif ? 'gif' : 'image',
        src: trimmed,
        width: 420,
        height: 300,
        fileName: 'recurso_web',
      });
      setIsLoading(false);
      setUrlInput('');
      onClose();
    };
    img.src = trimmed;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none"
      onClick={onClose}
    >
      <div
        className="bg-[#1E1E1E] border border-[#2D2D2D] rounded-2xl max-w-lg w-full p-6 shadow-2xl text-neutral-200 relative animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#2D2D2D]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-950/60 border border-sky-800/40 text-sky-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-100">
                Añadir Archivo Multimedia
              </h3>
              <p className="text-xs text-neutral-400">
                Imágenes WebP, GIF, Video y Audio con reproducción individual
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal multimedia"
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 p-1 bg-[#141414] rounded-lg border border-[#2B2B2B] my-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setActiveTab('upload');
              setErrorMessage(null);
            }}
            className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'upload'
                ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Subir archivo local</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('url');
              setErrorMessage(null);
            }}
            className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'url'
                ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            <span>Enlace URL directo</span>
          </button>
        </div>

        {/* Format Badges Indicator */}
        <div className="grid grid-cols-4 gap-2 mb-4 text-[11px]">
          <div className="p-2 rounded-lg bg-neutral-800/60 border border-neutral-700/50 flex flex-col items-center text-center">
            <span className="font-semibold text-sky-400">WebP / Img</span>
            <span className="text-[10px] text-neutral-400">Optimizadas</span>
          </div>
          <div className="p-2 rounded-lg bg-neutral-800/60 border border-neutral-700/50 flex flex-col items-center text-center">
            <span className="font-semibold text-amber-400">GIF Animado</span>
            <span className="text-[10px] text-neutral-400">Pausa auto</span>
          </div>
          <div className="p-2 rounded-lg bg-neutral-800/60 border border-neutral-700/50 flex flex-col items-center text-center">
            <span className="font-semibold text-emerald-400">Video MP4/WebM</span>
            <span className="text-[10px] text-neutral-400">1 reproducción</span>
          </div>
          <div className="p-2 rounded-lg bg-neutral-800/60 border border-neutral-700/50 flex flex-col items-center text-center">
            <span className="font-semibold text-purple-400">Audio MP3/WAV</span>
            <span className="text-[10px] text-neutral-400">Al pulsar</span>
          </div>
        </div>

        {/* Status Callout */}
        {statusMessage && (
          <div className="mb-4 p-2.5 rounded-lg bg-sky-950/50 border border-sky-800/50 text-sky-300 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-sky-400 animate-spin" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Error message callout */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tab 1: Local Upload */}
        {activeTab === 'upload' && (
          <div className="flex flex-col items-center">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="w-full border-2 border-dashed border-[#333333] hover:border-sky-500/80 rounded-xl p-7 flex flex-col items-center justify-center gap-3 bg-[#141414]/50 hover:bg-[#18181B] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2 p-2.5 rounded-full bg-neutral-800 group-hover:bg-sky-950/60 text-neutral-300 group-hover:text-sky-400 transition-colors">
                <FileVideo className="w-5 h-5 text-emerald-400" />
                <Music className="w-5 h-5 text-purple-400" />
                <Upload className="w-5 h-5 text-sky-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-neutral-200">
                  {isLoading ? 'Optimizando e insertando...' : 'Selecciona o arrastra tu archivo multimedia'}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  Soporta imágenes (WebP automático), GIF, MP4, WebM, MP3 o WAV
                </p>
              </div>
            </button>
          </div>
        )}

        {/* Tab 2: External URL */}
        {activeTab === 'url' && (
          <form onSubmit={handleUrlSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="media-url-input" className="text-xs text-neutral-400 font-medium">
                Dirección web del recurso multimedia (HTTPS)
              </label>
              <input
                id="media-url-input"
                type="url"
                placeholder="https://ejemplo.com/archivo.mp4 ó .mp3 ó .gif"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="bg-[#141414] border border-[#2D2D2D] text-neutral-100 rounded-lg px-3 py-2 text-xs outline-none focus:border-sky-400 placeholder:text-neutral-600"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !urlInput.trim()}
              className="w-full py-2 px-4 rounded-lg bg-neutral-100 hover:bg-white text-neutral-900 text-xs font-semibold disabled:opacity-40 disabled:hover:bg-neutral-100 transition-colors"
            >
              {isLoading ? 'Cargando archivo...' : 'Insertar archivo multimedia'}
            </button>
          </form>
        )}

        {/* Clarification Note on Background Playback */}
        <div className="mt-4 pt-3 border-t border-[#2D2D2D] text-[11px] text-neutral-500 text-center">
          Los archivos multimedia no se reproducen en segundo plano; únicamente se ejecutan una sola vez al hacer clic sobre ellos.
        </div>
      </div>
    </div>
  );
};

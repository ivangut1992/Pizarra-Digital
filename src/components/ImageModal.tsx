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
  Film,
  Music,
  Image as ImageIcon,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { optimizeUploadedFile, OptimizedMediaResult } from '../utils/mediaOptimization';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertMedia: (media: OptimizedMediaResult) => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  onClose,
  onInsertMedia,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [urlType, setUrlType] = useState<'image' | 'video' | 'audio'>('image');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setErrorMessage(null);
    setStatusMessage('Optimizando a formato WebP y procesando archivo...');

    try {
      const result = await optimizeUploadedFile(file);
      setStatusMessage('¡Archivo optimizado con éxito!');
      setTimeout(() => {
        onInsertMedia(result);
        setIsLoading(false);
        setStatusMessage(null);
        onClose();
      }, 350);
    } catch (err: any) {
      console.error('Error al procesar archivo multimedia:', err);
      setErrorMessage(err?.message || 'Error al procesar o convertir el archivo.');
      setIsLoading(false);
      setStatusMessage(null);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setErrorMessage('Por favor, ingresa una URL válida.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    if (urlType === 'video') {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = trimmed;
      video.onloadedmetadata = () => {
        const vw = video.videoWidth || 540;
        const vh = video.videoHeight || 360;
        onInsertMedia({
          src: trimmed,
          type: 'video',
          mediaType: 'video',
          width: Math.min(vw, 480),
          height: Math.round(Math.min(vw, 480) * (vh / vw)),
          fileName: 'video_enlace.mp4',
          duration: video.duration || 0,
          originalSize: 0,
        });
        setIsLoading(false);
        setUrlInput('');
        onClose();
      };
      video.onerror = () => {
        // Fallback default dimensions
        onInsertMedia({
          src: trimmed,
          type: 'video',
          mediaType: 'video',
          width: 480,
          height: 320,
          fileName: 'video_enlace.mp4',
          originalSize: 0,
        });
        setIsLoading(false);
        setUrlInput('');
        onClose();
      };
      return;
    }

    if (urlType === 'audio') {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.src = trimmed;
      audio.onloadedmetadata = () => {
        onInsertMedia({
          src: trimmed,
          type: 'audio',
          mediaType: 'audio',
          width: 320,
          height: 90,
          fileName: 'audio_enlace.mp3',
          duration: audio.duration || 0,
          originalSize: 0,
        });
        setIsLoading(false);
        setUrlInput('');
        onClose();
      };
      audio.onerror = () => {
        onInsertMedia({
          src: trimmed,
          type: 'audio',
          mediaType: 'audio',
          width: 320,
          height: 90,
          fileName: 'audio_enlace.mp3',
          originalSize: 0,
        });
        setIsLoading(false);
        setUrlInput('');
        onClose();
      };
      return;
    }

    // Default image / GIF URL
    const isGif = trimmed.toLowerCase().includes('.gif') || trimmed.toLowerCase().includes('format=gif');
    const img = new Image();
    img.onload = () => {
      onInsertMedia({
        src: trimmed,
        type: 'image',
        mediaType: isGif ? 'gif' : 'image',
        width: img.naturalWidth || 400,
        height: img.naturalHeight || 300,
        fileName: isGif ? 'animacion.gif' : 'imagen_enlace',
        originalSize: 0,
      });
      setIsLoading(false);
      setUrlInput('');
      onClose();
    };
    img.onerror = () => {
      onInsertMedia({
        src: trimmed,
        type: 'image',
        mediaType: isGif ? 'gif' : 'image',
        width: 450,
        height: 320,
        fileName: isGif ? 'animacion.gif' : 'imagen_enlace',
        originalSize: 0,
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
            <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-100">
                Añadir Multimedia al Lienzo
              </h3>
              <p className="text-xs text-neutral-400">
                Imágenes, GIFs animados, Videos y Audios
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

        {/* Feature Banner: WebP & Brotli optimization */}
        <div className="mt-4 p-2.5 rounded-xl bg-sky-950/30 border border-sky-500/25 flex items-center gap-2 text-xs text-sky-300">
          <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
          <span>
            Optimización automática a <strong>formato WebP</strong> y compresión para reducir el tamaño de almacenamiento.
          </span>
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
            <span>Enlace URL</span>
          </button>
        </div>

        {/* Error message callout */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Status message */}
        {statusMessage && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 animate-spin" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Tab 1: Local Upload */}
        {activeTab === 'upload' && (
          <div className="flex flex-col items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime,audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/flac,audio/mp4,.gif,.mp4,.webm,.ogg,.mov,.mp3,.wav,.aac,.m4a,.flac"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="w-full border-2 border-dashed border-[#333333] hover:border-sky-500/80 rounded-xl p-7 flex flex-col items-center justify-center gap-3 bg-[#141414]/50 hover:bg-[#18181B] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2 text-neutral-400 group-hover:text-sky-400 transition-colors">
                <div className="p-2.5 rounded-full bg-neutral-800 group-hover:bg-sky-950/60">
                  <ImageIcon className="w-5 h-5 text-sky-400" />
                </div>
                <div className="p-2.5 rounded-full bg-neutral-800 group-hover:bg-purple-950/60">
                  <Film className="w-5 h-5 text-purple-400" />
                </div>
                <div className="p-2.5 rounded-full bg-neutral-800 group-hover:bg-emerald-950/60">
                  <Music className="w-5 h-5 text-emerald-400" />
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm font-medium text-neutral-200">
                  {isLoading
                    ? 'Procesando y convirtiendo a WebP...'
                    : 'Haz clic o arrastra tu archivo aquí'}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  Formatos: <strong>GIF animado, MP4/WebM, MP3/WAV, PNG, JPG</strong>
                </p>
              </div>
            </button>

            {/* Quick format tags */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-neutral-400">
              <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700/60">
                GIF animado
              </span>
              <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700/60">
                Video MP4 / WebM
              </span>
              <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700/60">
                Audio MP3 / WAV
              </span>
              <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700/60">
                WebP automático
              </span>
            </div>
          </div>
        )}

        {/* Tab 2: External URL */}
        {activeTab === 'url' && (
          <form onSubmit={handleUrlSubmit} className="flex flex-col gap-4">
            {/* Format Type Selector for URL */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400 font-medium">Tipo:</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setUrlType('image')}
                  className={`px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                    urlType === 'image'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <ImageIcon className="w-3 h-3" />
                  <span>Imagen / GIF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUrlType('video')}
                  className={`px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                    urlType === 'video'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Film className="w-3 h-3" />
                  <span>Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUrlType('audio')}
                  className={`px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                    urlType === 'audio'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Music className="w-3 h-3" />
                  <span>Audio</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="media-url-input" className="text-xs text-neutral-400 font-medium">
                Dirección web HTTPS del archivo
              </label>
              <input
                id="media-url-input"
                type="url"
                placeholder={
                  urlType === 'video'
                    ? 'https://ejemplo.com/clip.mp4'
                    : urlType === 'audio'
                    ? 'https://ejemplo.com/pista.mp3'
                    : 'https://ejemplo.com/animacion.gif'
                }
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
              {isLoading ? 'Cargando contenido...' : 'Insertar en el lienzo'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

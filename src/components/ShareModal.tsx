/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Share2,
  Copy,
  Check,
  Globe2,
  Users,
  ShieldCheck,
  X,
  ExternalLink,
  QrCode,
  Sparkles,
} from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  boardName: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  boardId,
  boardName,
}) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!isOpen) return null;

  // Construct absolute shareable URL
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?board=${encodeURIComponent(boardId)}`
    : `https://pizarra.local/?board=${encodeURIComponent(boardId)}`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for older browsers / iframe security
        const input = document.createElement('textarea');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error('Error al copiar enlace:', e);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Colabora en: ${boardName}`,
          text: `Te invito a unirte a la pizarra "${boardName}" con acceso total sin restricciones.`,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or share dismissed
      }
    } else {
      handleCopyLink();
    }
  };

  // QR Code URL via safe QR SVG generator
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}&bgcolor=1E1E1E&color=38BDF8&margin=1`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none animate-in fade-in duration-150"
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
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-100">Compartir e Invitar Usuarios</h3>
              <p className="text-xs text-neutral-400">Pizarra: &ldquo;{boardName}&rdquo;</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal de compartir"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Unrestricted badge banner */}
        <div className="mt-5 p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
              <span>Acceso Total sin Restricciones</span>
              <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-mono">
                LIBRE
              </span>
            </div>
            <p className="text-emerald-200/80 mt-1 leading-relaxed">
              Cualquier usuario con este enlace puede ver, dibujar, agregar archivos multimedia y editar los elementos de esta pizarra sin límites de tiempo ni necesidad de iniciar sesión.
            </p>
          </div>
        </div>

        {/* Share Link Box */}
        <div className="mt-4 flex flex-col gap-1.5">
          <label className="text-xs text-neutral-400 font-medium flex items-center justify-between">
            <span>Enlace de invitación directa</span>
            <span className="text-[11px] text-sky-400 flex items-center gap-1">
              <Globe2 className="w-3 h-3" /> Público y editable
            </span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 bg-[#141414] border border-[#2D2D2D] rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none font-mono selection:bg-sky-500/40 truncate"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className={`px-4 py-2.5 rounded-xl font-medium text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 ${
                copied
                  ? 'bg-emerald-500 text-neutral-950 font-bold scale-102'
                  : 'bg-neutral-100 hover:bg-white text-neutral-900'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar enlace</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Extra share actions (QR code and Native Share) */}
        <div className="mt-4 pt-3 border-t border-[#2D2D2D] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowQr(!showQr)}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors border border-neutral-700/60"
            >
              <QrCode className="w-3.5 h-3.5 text-sky-400" />
              <span>{showQr ? 'Ocultar código QR' : 'Mostrar código QR'}</span>
            </button>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors border border-neutral-700/60"
              >
                <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                <span>Compartir vía app</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Users className="w-3.5 h-3.5 text-sky-400" />
            <span>Colaboración abierta</span>
          </div>
        </div>

        {/* QR Code view if toggled */}
        {showQr && (
          <div className="mt-4 p-4 rounded-xl bg-[#141414] border border-[#2D2D2D] flex flex-col items-center justify-center gap-3 animate-in fade-in duration-150">
            <p className="text-xs text-neutral-400 text-center">
              Escanea con tu teléfono o tablet para abrir la pizarra al instante:
            </p>
            <div className="p-3 bg-[#1E1E1E] rounded-xl border border-neutral-700/50 shadow-inner">
              <img
                src={qrCodeUrl}
                alt="Código QR de la pizarra"
                className="w-36 h-36 rounded-lg"
              />
            </div>
            <span className="text-[11px] text-sky-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Sin registro requerido
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-[#2D2D2D] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg transition-colors"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { alertMessage } from '@/lib/alerts';
import type { Html5Qrcode as Html5QrcodeType } from 'html5-qrcode';

interface CameraScanButtonProps {
  onScan: (code: string) => void;
  className?: string;
  title?: string;
}

/**
 * Companion to BarcodeScanField: scans a barcode using the device's own
 * camera (phone or webcam) instead of a USB/Bluetooth scanner — for when
 * there's no physical scanner at hand, which is the common case on mobile.
 */
export function CameraScanButton({ onScan, className, title }: CameraScanButtonProps) {
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const scannerRef = useRef<Html5QrcodeType | null>(null);
  const regionIdRef = useRef(`camera-scan-region-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStarting(true);

    import('html5-qrcode').then(({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
      if (cancelled) return;
      const scanner = new Html5Qrcode(regionIdRef.current, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
      });
      scannerRef.current = scanner;
      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (decodedText) => {
            onScan(decodedText.trim());
            setOpen(false);
          },
          () => {
            // Per-frame "nothing decoded yet" noise — expected on every
            // frame until a code lines up, nothing to surface to the user.
          }
        )
        .catch((err: unknown) => {
          if (cancelled) return;
          console.error('No se pudo acceder a la cámara', err);
          alertMessage('No se pudo acceder a la cámara. Revisá que el navegador tenga permiso de cámara.');
          setOpen(false);
        })
        .finally(() => {
          if (!cancelled) setStarting(false);
        });
    });

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              scanner.clear();
            } catch {
              // element already gone — nothing to clean up
            }
          });
      }
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className || 'flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-accent'}
        title={title || 'Escanear con la cámara'}
      >
        <Camera className="h-5 w-5 text-muted-foreground" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-border/50 bg-card p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">Escanear con la cámara</h3>
              <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div id={regionIdRef.current} className="overflow-hidden rounded-xl bg-black [&_video]:w-full [&_video]:rounded-xl" />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {starting ? 'Iniciando cámara...' : 'Apuntá la cámara al código de barras'}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

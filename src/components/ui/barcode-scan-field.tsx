import React, { useEffect, useRef, useState } from 'react';
import { ScanBarcode } from 'lucide-react';
import { CameraScanButton } from '@/components/ui/camera-scan-button';

interface BarcodeScanFieldProps {
  onScan: (code: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

/**
 * A text input tuned for USB/Bluetooth barcode scanners, which behave like a
 * keyboard typing the code really fast followed by Enter. Stays focused and
 * clears itself after each scan so the next one can go straight in.
 */
export function BarcodeScanField({ onScan, placeholder, autoFocus, className }: BarcodeScanFieldProps) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      onScan(value.trim());
      setValue('');
    }
  };

  return (
    <div className={`relative ${className || ''}`}>
      <ScanBarcode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-400" />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Escaneá o escribí el código de barras y presioná Enter...'}
        className="h-12 w-full rounded-xl border-2 border-emerald-500/30 bg-background/50 pl-11 pr-12 text-sm font-medium transition-all duration-200 placeholder:text-muted-foreground focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
      />
      <CameraScanButton
        onScan={onScan}
        title="Escanear con la cámara del celular/PC"
        className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-emerald-400 transition-colors hover:bg-emerald-500/10"
      />
    </div>
  );
}

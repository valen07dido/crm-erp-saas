import React, { useRef, useState } from 'react';
import { ImagePlus, X, Link as LinkIcon } from 'lucide-react';
import { uploadImage } from '@/lib/uploadImage';

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  businessId: string | null;
  hint?: string;
}

export function ImageUploadField({ label, value, onChange, businessId, hint }: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !businessId) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, businessId);
      onChange(url);
    } catch (err: any) {
      console.error('Error uploading image', err);
      alert(err.message || 'Error subiendo la imagen');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 p-3">
          <img src={value} alt={label} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
          <div className="flex flex-1 flex-col gap-1.5 sm:flex-row">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
            >
              {uploading ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
              )}
              Cambiar
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-red-400 transition-colors hover:bg-destructive/10"
            >
              <X className="h-3.5 w-3.5" />
              Quitar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading || !businessId}
          onClick={() => fileInputRef.current?.click()}
          className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-background/50 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground disabled:opacity-50"
        >
          {uploading ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              Subiendo...
            </>
          ) : (
            <>
              <ImagePlus className="h-5 w-5" />
              Subir imagen
            </>
          )}
        </button>
      )}

      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}

      <button
        type="button"
        onClick={() => setShowUrlInput((s) => !s)}
        className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <LinkIcon className="h-3 w-3" />
        {showUrlInput ? 'Ocultar' : 'o pegar una URL manualmente'}
      </button>

      {showUrlInput && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://ejemplo.com/imagen.jpg"
          className="mt-2 flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30"
        />
      )}
    </div>
  );
}

import React from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Lock,
  LockOpen,
  Monitor,
  Smartphone,
  Square,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
  Trash2,
  TriangleAlert,
  Type,
} from 'lucide-react';
import type { Background, BrandKit, DesignDoc, FormatId, ImageLayer, Layer, ShapeLayer, TextLayer } from '@/lib/marketing/types';
import { FONT_OPTIONS, clampWeight, fontOption } from '@/lib/marketing/fonts';
import { FORMATS, FORMAT_LIST } from '@/lib/marketing/formats';
import { cn } from '@/lib/utils';
import { Btn, IconBtn, Segmented, Select, TextArea, inputCls } from '../studio-ui';

// ─── Small controls ─────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-b border-border px-4 py-4 last:border-b-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)));
        }}
        className={cn(inputCls, 'h-8 px-2 py-1 font-mono text-xs', suffix && 'pr-7')}
      />
      {suffix ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{suffix}</span> : null}
    </div>
  );
}

function Slider({ value, onChange, min, max, step = 1 }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return (
    <div className="flex items-center gap-2">
      <input type="range" value={value} min={min} max={max} step={step} onChange={(e) => onChange(parseFloat(e.target.value))} className="h-1 flex-1 accent-[#D6F36A]" />
      <span className="w-10 text-right font-mono text-[11px] text-muted-foreground">{Math.round(value * 100) / 100}</span>
    </div>
  );
}

export function ColorField({ value, onChange, kit, allowTransparent }: { value: string; onChange: (v: string) => void; kit: BrandKit; allowTransparent?: boolean }) {
  const isHex = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {kit.colors.map((c) => (
          <button
            key={c.hex + c.name}
            title={`${c.name} ${c.hex}`}
            onClick={() => onChange(c.hex)}
            className={cn('h-6 w-6 rounded-md border border-white/15', value.toLowerCase() === c.hex.toLowerCase() && 'ring-2 ring-[#D6F36A] ring-offset-1 ring-offset-card')}
            style={{ background: c.hex }}
          />
        ))}
        {allowTransparent && (
          <button
            title="Sin relleno"
            onClick={() => onChange('transparent')}
            className={cn(
              'h-6 w-6 rounded-md border border-white/15 bg-[linear-gradient(135deg,transparent_45%,#E07575_45%,#E07575_55%,transparent_55%)]',
              value === 'transparent' && 'ring-2 ring-[#D6F36A] ring-offset-1 ring-offset-card',
            )}
          />
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <input type="color" value={isHex ? value : '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5" />
        <input
          value={value}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (/^#[0-9a-fA-F]{6}$/.test(v) || v === 'transparent') onChange(v.toUpperCase() === 'TRANSPARENT' ? 'transparent' : v.toUpperCase());
          }}
          className={cn(inputCls, 'h-8 px-2 py-1 font-mono text-xs uppercase')}
          placeholder="#RRGGBB"
        />
      </div>
    </div>
  );
}

function Geometry({ layer, onChange, height }: { layer: Layer; onChange: (p: Partial<Layer>) => void; height: number }) {
  return (
    <Section title="Posición y tamaño">
      <div className="grid grid-cols-2 gap-2">
        <Row label="X">
          <NumberField value={layer.x} onChange={(x) => onChange({ x })} />
        </Row>
        <Row label="Y">
          <NumberField value={layer.y} onChange={(y) => onChange({ y })} />
        </Row>
        <Row label="Ancho">
          <NumberField value={layer.w} min={10} onChange={(w) => onChange(layer.type === 'image' && layer.role === 'logo' && layer.aspect ? { w, h: Math.round(w / layer.aspect) } : { w })} />
        </Row>
        <Row label="Alto">
          {layer.type === 'text' ? (
            <span className="font-mono text-xs text-muted-foreground">{Math.round(height)} auto</span>
          ) : (
            <NumberField value={layer.h} min={4} onChange={(h) => onChange(layer.type === 'image' && layer.role === 'logo' && layer.aspect ? { h, w: Math.round(h * layer.aspect) } : { h })} />
          )}
        </Row>
      </div>
      <Row label="Rotación">
        <Slider value={layer.rotation} min={-180} max={180} onChange={(rotation) => onChange({ rotation })} />
      </Row>
      <Row label="Opacidad">
        <Slider value={layer.opacity} min={0} max={1} step={0.05} onChange={(opacity) => onChange({ opacity })} />
      </Row>
    </Section>
  );
}

// ─── Per-type panels ────────────────────────────────────────────────────────

function TextPanel({ l, onChange, kit, textRef }: { l: TextLayer; onChange: (p: Partial<TextLayer>) => void; kit: BrandKit; textRef: React.RefObject<HTMLTextAreaElement | null> }) {
  const font = fontOption(l.font);
  return (
    <>
      <Section title="Texto">
        <TextArea ref={textRef} value={l.text} onChange={(e) => onChange({ text: e.target.value })} rows={4} className="text-[13px]" />
        <p className="text-[11px] text-muted-foreground">Usá *asteriscos* para resaltar palabras con el color de acento.</p>
      </Section>
      <Section title="Tipografía">
        <Select value={l.font} onChange={(e) => onChange({ font: e.target.value as TextLayer['font'], weight: clampWeight(e.target.value as TextLayer['font'], l.weight) })} className="h-9">
          {FONT_OPTIONS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label} · {f.role}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Select value={clampWeight(l.font, l.weight)} onChange={(e) => onChange({ weight: Number(e.target.value) })} className="h-8 text-xs">
            {font.weights.map((w) => (
              <option key={w} value={w}>
                Peso {w}
              </option>
            ))}
          </Select>
          <NumberField value={l.size} min={8} max={600} onChange={(size) => onChange({ size })} suffix="px" />
        </div>
        <Row label="Interlineado">
          <Slider value={l.lineHeight} min={0.8} max={2} step={0.02} onChange={(lineHeight) => onChange({ lineHeight })} />
        </Row>
        <Row label="Espaciado">
          <Slider value={l.letterSpacing} min={-0.08} max={0.3} step={0.005} onChange={(letterSpacing) => onChange({ letterSpacing })} />
        </Row>
        <div className="flex items-center justify-between gap-2">
          <Segmented
            value={l.align}
            onChange={(align) => onChange({ align })}
            options={[
              { value: 'left', label: <TextAlignStart className="h-3.5 w-3.5" />, title: 'Izquierda' },
              { value: 'center', label: <TextAlignCenter className="h-3.5 w-3.5" />, title: 'Centro' },
              { value: 'right', label: <TextAlignEnd className="h-3.5 w-3.5" />, title: 'Derecha' },
            ]}
          />
          <button
            onClick={() => onChange({ uppercase: !l.uppercase })}
            className={cn('h-8 rounded-md border px-2.5 font-mono text-[11px]', l.uppercase ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground')}
          >
            AA
          </button>
        </div>
      </Section>
      <Section title="Color">
        <Row label="Texto">
          <ColorField value={l.color} onChange={(color) => onChange({ color })} kit={kit} />
        </Row>
        <Row label="Acento">
          <ColorField value={l.accentColor} onChange={(accentColor) => onChange({ accentColor })} kit={kit} />
        </Row>
      </Section>
      <Section title="Resaltado / botón">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={Boolean(l.highlight)}
            onChange={(e) =>
              onChange({ highlight: e.target.checked ? { color: '#D6F36A', padX: Math.round(l.size * 0.6), padY: Math.round(l.size * 0.3), radius: Math.round(l.size * 0.4) } : null })
            }
            className="accent-[#D6F36A]"
          />
          Fondo detrás de cada línea
        </label>
        {l.highlight && (
          <>
            <ColorField value={l.highlight.color} onChange={(color) => onChange({ highlight: { ...l.highlight!, color } })} kit={kit} />
            <Row label="Relleno X">
              <Slider value={l.highlight.padX} min={0} max={120} onChange={(padX) => onChange({ highlight: { ...l.highlight!, padX } })} />
            </Row>
            <Row label="Relleno Y">
              <Slider value={l.highlight.padY} min={0} max={80} onChange={(padY) => onChange({ highlight: { ...l.highlight!, padY } })} />
            </Row>
            <Row label="Redondeo">
              <Slider value={l.highlight.radius} min={0} max={120} onChange={(radius) => onChange({ highlight: { ...l.highlight!, radius } })} />
            </Row>
          </>
        )}
      </Section>
    </>
  );
}

function ImagePanel({
  l,
  onChange,
  onReplace,
  naturalWidth,
}: {
  l: ImageLayer;
  onChange: (p: Partial<ImageLayer>) => void;
  onReplace: () => void;
  naturalWidth: number | null;
}) {
  const isLogo = l.role === 'logo';
  const pixelated = naturalWidth && l.frame === 'none' && l.w > naturalWidth * 1.35;
  return (
    <Section title={isLogo ? 'Logo original' : 'Imagen'}>
      <Btn variant="outline" size="sm" className="w-full" onClick={onReplace}>
        <ImageIcon className="h-3.5 w-3.5" />
        {l.src ? 'Reemplazar' : 'Elegir de la biblioteca'}
      </Btn>
      {isLogo ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">El logo mantiene su proporción y sus colores originales. Sobre fondos oscuros usalo sobre un fondo claro.</p>
      ) : (
        <>
          <Row label="Tipo">
            <Segmented
              value={l.role === 'screenshot' ? 'screenshot' : 'image'}
              onChange={(role) => onChange({ role })}
              options={[
                { value: 'screenshot', label: 'Captura' },
                { value: 'image', label: 'Foto' },
              ]}
            />
          </Row>
          <Row label="Marco">
            <Segmented
              value={l.frame}
              onChange={(frame) => onChange({ frame })}
              options={[
                { value: 'none', label: <Square className="h-3.5 w-3.5" />, title: 'Sin marco' },
                { value: 'browser', label: <Monitor className="h-3.5 w-3.5" />, title: 'Navegador' },
                { value: 'phone', label: <Smartphone className="h-3.5 w-3.5" />, title: 'Celular' },
              ]}
            />
          </Row>
          {l.frame === 'none' && (
            <Row label="Ajuste">
              <Segmented
                value={l.fit}
                onChange={(fit) => onChange({ fit })}
                options={[
                  { value: 'cover', label: 'Llenar' },
                  { value: 'contain', label: 'Completa' },
                ]}
              />
            </Row>
          )}
          <Row label="Redondeo">
            <Slider value={l.radius} min={0} max={120} onChange={(radius) => onChange({ radius })} />
          </Row>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={l.shadow} onChange={(e) => onChange({ shadow: e.target.checked })} className="accent-[#D6F36A]" />
            Sombra
          </label>
        </>
      )}
      {pixelated ? (
        <p className="flex gap-1.5 text-[11px] text-warning">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          La imagen mide {naturalWidth} px de ancho y está estirada a {Math.round(l.w)} px: puede verse pixelada.
        </p>
      ) : null}
    </Section>
  );
}

function ShapePanel({ l, onChange, kit }: { l: ShapeLayer; onChange: (p: Partial<ShapeLayer>) => void; kit: BrandKit }) {
  return (
    <Section title="Forma">
      <Segmented
        value={l.shape}
        onChange={(shape) => onChange({ shape })}
        options={[
          { value: 'rect', label: 'Rectángulo' },
          { value: 'ellipse', label: 'Elipse' },
          { value: 'line', label: 'Línea' },
        ]}
      />
      <Row label="Relleno">
        <ColorField value={l.fill} onChange={(fill) => onChange({ fill })} kit={kit} allowTransparent />
      </Row>
      <Row label="Borde">
        <ColorField value={l.stroke || '#FFFFFF'} onChange={(stroke) => onChange({ stroke })} kit={kit} />
      </Row>
      <Row label="Grosor">
        <Slider value={l.strokeWidth} min={0} max={40} onChange={(strokeWidth) => onChange({ strokeWidth })} />
      </Row>
      {l.shape === 'rect' && (
        <Row label="Redondeo">
          <Slider value={l.radius} min={0} max={400} onChange={(radius) => onChange({ radius })} />
        </Row>
      )}
    </Section>
  );
}

function DocumentPanel({
  doc,
  onBackground,
  kit,
  onPickBackgroundImage,
  onAdapt,
}: {
  doc: DesignDoc;
  onBackground: (p: Partial<Background>) => void;
  kit: BrandKit;
  onPickBackgroundImage: () => void;
  onAdapt: (f: FormatId) => void;
}) {
  const bg = doc.background;
  const fmt = FORMATS[doc.format];
  return (
    <>
      <Section title="Pieza">
        <p className="text-sm font-semibold">
          {fmt.label} <span className="font-mono text-xs font-normal text-muted-foreground">{fmt.width}×{fmt.height}</span>
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{fmt.safeNote}</p>
      </Section>
      <Section title="Fondo">
        <Segmented
          value={bg.type}
          onChange={(type) => onBackground({ type })}
          options={[
            { value: 'solid', label: 'Color' },
            { value: 'gradient', label: 'Degradé' },
          ]}
        />
        <ColorField value={bg.color} onChange={(color) => onBackground({ color })} kit={kit} />
        {bg.type === 'gradient' && (
          <>
            <ColorField value={bg.color2} onChange={(color2) => onBackground({ color2 })} kit={kit} />
            <Row label="Ángulo">
              <Slider value={bg.angle} min={0} max={360} onChange={(angle) => onBackground({ angle })} />
            </Row>
          </>
        )}
      </Section>
      <Section title="Textura">
        <Select value={bg.pattern} onChange={(e) => onBackground({ pattern: e.target.value as Background['pattern'] })} className="h-9">
          <option value="none">Sin textura</option>
          <option value="grid">Grilla</option>
          <option value="dots">Puntos</option>
          <option value="lines">Líneas diagonales</option>
        </Select>
        {bg.pattern !== 'none' && (
          <>
            <ColorField value={bg.patternColor} onChange={(patternColor) => onBackground({ patternColor })} kit={kit} />
            <Row label="Intensidad">
              <Slider value={bg.patternOpacity} min={0} max={0.3} step={0.005} onChange={(patternOpacity) => onBackground({ patternOpacity })} />
            </Row>
          </>
        )}
      </Section>
      <Section title="Imagen de fondo">
        <div className="flex gap-2">
          <Btn variant="outline" size="sm" className="flex-1" onClick={onPickBackgroundImage}>
            <ImageIcon className="h-3.5 w-3.5" />
            {bg.imageUrl ? 'Cambiar' : 'Elegir'}
          </Btn>
          {bg.imageUrl && (
            <Btn variant="danger" size="sm" onClick={() => onBackground({ imageUrl: undefined })}>
              Quitar
            </Btn>
          )}
        </div>
        {bg.imageUrl && (
          <Row label="Opacidad">
            <Slider value={bg.imageOpacity ?? 1} min={0} max={1} step={0.05} onChange={(imageOpacity) => onBackground({ imageOpacity })} />
          </Row>
        )}
      </Section>
      {doc.templateId && doc.templateId !== 'blanco' && (
        <Section title="Adaptar a otro formato">
          <p className="text-[11px] leading-relaxed text-muted-foreground">Crea una copia en otro formato con los mismos textos y captura, reacomodados para ese tamaño.</p>
          <div className="grid grid-cols-2 gap-1.5">
            {FORMAT_LIST.filter((f) => f.id !== doc.format).map((f) => (
              <Btn key={f.id} variant="outline" size="sm" onClick={() => onAdapt(f.id)}>
                {f.short}
                <ArrowRight className="h-3 w-3" />
              </Btn>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

// ─── Exported panel ─────────────────────────────────────────────────────────

export interface PropertiesProps {
  doc: DesignDoc;
  selected: Layer | null;
  kit: BrandKit;
  textHeight: number;
  naturalWidth: number | null;
  textRef: React.RefObject<HTMLTextAreaElement | null>;
  onLayer: (id: string, p: Partial<Layer>) => void;
  onBackground: (p: Partial<Background>) => void;
  onReplaceImage: (id: string) => void;
  onPickBackgroundImage: () => void;
  onAdapt: (f: FormatId) => void;
}

export function PropertiesPanel(p: PropertiesProps) {
  const l = p.selected;
  if (!l) {
    return <DocumentPanel doc={p.doc} onBackground={p.onBackground} kit={p.kit} onPickBackgroundImage={p.onPickBackgroundImage} onAdapt={p.onAdapt} />;
  }
  const change = (patch: Partial<Layer>) => p.onLayer(l.id, patch);
  return (
    <>
      <div className="border-b border-border px-4 py-3">
        <input
          value={l.name}
          onChange={(e) => change({ name: e.target.value })}
          className="w-full bg-transparent font-heading text-sm font-semibold focus:outline-none"
          aria-label="Nombre de la capa"
        />
      </div>
      {l.type === 'text' && <TextPanel l={l} onChange={change} kit={p.kit} textRef={p.textRef} />}
      {l.type === 'image' && <ImagePanel l={l} onChange={change} onReplace={() => p.onReplaceImage(l.id)} naturalWidth={p.naturalWidth} />}
      {l.type === 'shape' && <ShapePanel l={l} onChange={change} kit={p.kit} />}
      <Geometry layer={l} onChange={change} height={p.textHeight} />
    </>
  );
}

// ─── Layers list ────────────────────────────────────────────────────────────

export function LayersPanel({
  layers,
  selectedId,
  onSelect,
  onToggle,
  onMove,
  onDuplicate,
  onDelete,
}: {
  layers: Layer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string, key: 'hidden' | 'locked') => void;
  onMove: (id: string, dir: 1 | -1) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const icon = (l: Layer) =>
    l.type === 'text' ? <Type className="h-3.5 w-3.5" /> : l.type === 'image' ? <ImageIcon className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />;
  // Top-most first, like design tools.
  const ordered = [...layers].reverse();
  return (
    <div className="space-y-0.5">
      {ordered.map((l, i) => {
        const sel = l.id === selectedId;
        return (
          <div
            key={l.id}
            onClick={() => onSelect(l.id)}
            className={cn('group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs', sel ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-accent/60')}
          >
            <span className={cn(sel && 'text-primary')}>{icon(l)}</span>
            <span className={cn('min-w-0 flex-1 truncate', l.hidden && 'opacity-40')}>{l.name}</span>
            <span className={cn('flex items-center gap-0.5', !sel && 'opacity-0 group-hover:opacity-100')}>
              <IconBtn label="Subir" className="h-6 w-6" disabled={i === 0} onClick={(e) => (e.stopPropagation(), onMove(l.id, 1))}>
                <ChevronUp className="h-3 w-3" />
              </IconBtn>
              <IconBtn label="Bajar" className="h-6 w-6" disabled={i === ordered.length - 1} onClick={(e) => (e.stopPropagation(), onMove(l.id, -1))}>
                <ChevronDown className="h-3 w-3" />
              </IconBtn>
              <IconBtn label="Duplicar" className="h-6 w-6" onClick={(e) => (e.stopPropagation(), onDuplicate(l.id))}>
                <Copy className="h-3 w-3" />
              </IconBtn>
              <IconBtn label="Eliminar" className="h-6 w-6 hover:text-destructive" onClick={(e) => (e.stopPropagation(), onDelete(l.id))}>
                <Trash2 className="h-3 w-3" />
              </IconBtn>
            </span>
            <IconBtn label={l.locked ? 'Desbloquear' : 'Bloquear'} className={cn('h-6 w-6', !l.locked && 'opacity-0 group-hover:opacity-100')} onClick={(e) => (e.stopPropagation(), onToggle(l.id, 'locked'))}>
              {l.locked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
            </IconBtn>
            <IconBtn label={l.hidden ? 'Mostrar' : 'Ocultar'} className="h-6 w-6" onClick={(e) => (e.stopPropagation(), onToggle(l.id, 'hidden'))}>
              {l.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </IconBtn>
          </div>
        );
      })}
    </div>
  );
}

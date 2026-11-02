'use client';

import { useEffect, useRef, useState } from 'react';
import { Arrow, Ellipse, Group, Image as CanvasImage, Layer, Line, Rect, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import { AnnotationDocumentSchema, moveAnnotation, type AnnotationDocument, type AnnotationObject } from '@snagflow/shared';
import { Button } from './ui/button';

type Tool = 'move' | AnnotationObject['type'];
const tools: { type: Tool; label: string }[] = [{ type: 'move', label: 'Select / move' }, { type: 'pen', label: 'Pen' }, { type: 'arrow', label: 'Arrow' }, { type: 'circle', label: 'Circle' }, { type: 'rectangle', label: 'Rectangle' }, { type: 'text', label: 'Text' }, { type: 'measurement', label: 'Measurement' }];

export default function PhotoMarkupEditor({ document, onChange, imageUrl, onImageError, onSave, busy, saveDisabled, saveLabel }: {
  document: AnnotationDocument; onChange: (document: AnnotationDocument) => void; imageUrl: string; onImageError: () => void;
  onSave: (blob: Blob) => Promise<void>; busy: boolean; saveDisabled: boolean; saveLabel: string;
}) {
  const [tool, setTool] = useState<Tool>('move');
  const [colour, setColour] = useState('#dc2626');
  const [label, setLabel] = useState('');
  const [selected, setSelected] = useState<string>();
  const [image, setImage] = useState<HTMLImageElement>();
  const [imageError, setImageError] = useState(false);
  const imageErrorRef = useRef(onImageError);
  useEffect(() => { imageErrorRef.current = onImageError; }, [onImageError]);
  const [viewWidth, setViewWidth] = useState(600);
  const container = useRef<HTMLDivElement>(null);
  const stage = useRef<Konva.Stage>(null);
  const decoration = useRef<Konva.Layer>(null);
  const [undo, setUndo] = useState<AnnotationDocument[]>([]);
  const [redo, setRedo] = useState<AnnotationDocument[]>([]);
  const [drawing, setDrawing] = useState<number[] | null>(null);
  const drawRef = useRef<number[] | null>(null);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [exporting, setExporting] = useState(false);
  const locked = busy || exporting;
  const scale = Math.min(1, viewWidth / document.width);
  const active = document.objects.find((object) => object.id === selected);

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setViewWidth(Math.max(1, Math.floor(entry.contentRect.width))); });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let disposed = false;
    const loaded = new window.Image();
    loaded.crossOrigin = 'anonymous';
    loaded.onload = () => { if (!disposed) { setImage(loaded); setImageError(false); } };
    loaded.onerror = () => { if (!disposed) { setImageError(true); imageErrorRef.current(); } };
    loaded.src = imageUrl;
    return () => { disposed = true; };
  }, [imageUrl]);

  function report(message: string) { setError(message); setTimeout(() => errorRef.current?.focus(), 0); }
  function commit(objects: AnnotationObject[]) {
    const next = { ...document, objects };
    if (!AnnotationDocumentSchema.safeParse(next).success) { report('This draft exceeds the markup limit. Remove objects or use a shorter note.'); return; }
    setUndo([...undo.slice(-49), document]);
    setRedo([]);
    onChange(next); setError('');
  }
  function replace(object: AnnotationObject) { commit(document.objects.map((item) => item.id === object.id ? object : item)); }
  function move(dx: number, dy: number) { if (active && !locked) replace(moveAnnotation(active, dx, dy, document.width, document.height)); }
  function remove() { if (active && !locked) { commit(document.objects.filter((item) => item.id !== active.id)); setSelected(undefined); } }
  function history(direction: 'undo' | 'redo') {
    const from = direction === 'undo' ? undo : redo;
    const previous = from.at(-1);
    if (!previous) return;
    if (direction === 'undo') { setUndo(undo.slice(0, -1)); setRedo([...redo, document]); }
    else { setRedo(redo.slice(0, -1)); setUndo([...undo, document]); }
    onChange(previous); setSelected(undefined); setError('');
  }
  function shape(points: number[]): AnnotationObject | null {
    if (tool === 'move') return null;
    if ((tool === 'text' || tool === 'measurement') && !label.trim()) { report('Enter a text or measurement label before adding it.'); return null; }
    const xs = points.filter((_, index) => index % 2 === 0);
    const ys = points.filter((_, index) => index % 2 !== 0);
    const x = Math.min(...xs), y = Math.min(...ys);
    const width = Math.min(document.width - x, Math.max(1, Math.max(...xs) - x));
    const height = Math.min(document.height - y, Math.max(1, Math.max(...ys) - y));
    const base = { id: crypto.randomUUID(), x, y, width, height, colour, strokeWidth: Math.max(1, Math.min(6, Math.round(document.width / 300))) };
    if (tool === 'pen' || tool === 'arrow') return { ...base, type: tool, points: points.map((point, index) => point - (index % 2 === 0 ? x : y)) };
    if (tool === 'text' || tool === 'measurement') return { ...base, type: tool, text: label.trim(), fontSize: Math.max(8, Math.min(32, Math.round(document.width / 40))) };
    return { ...base, type: tool };
  }
  function insert() {
    const x = Math.round(document.width * .25), y = Math.round(document.height * .25);
    const object = shape([x, y, Math.round(document.width * .7), Math.round(document.height * .5)]);
    if (object) { commit([...document.objects, object]); setSelected(object.id); setTool('move'); }
  }
  function point() {
    const position = stage.current?.getPointerPosition();
    return position ? [Math.max(0, Math.min(document.width - 1, position.x / scale)), Math.max(0, Math.min(document.height - 1, position.y / scale))] : null;
  }
  function startDraw() {
    if (tool === 'move' || locked || !image || imageError) return;
    const first = point();
    if (first) { drawRef.current = [...first, ...first]; setDrawing(drawRef.current); }
  }
  function draw() {
    if (!drawRef.current) return;
    const next = point();
    if (!next) return;
    if (tool === 'pen') {
      if (drawRef.current.length >= 3998) return;
      drawRef.current = [...drawRef.current, ...next];
    } else drawRef.current = [...drawRef.current.slice(0, 2), ...next];
    setDrawing(drawRef.current);
  }
  function endDraw() {
    const points = drawRef.current;
    drawRef.current = null; setDrawing(null);
    if (!points) return;
    const object = shape(points);
    if (object) { commit([...document.objects, object]); setSelected(object.id); }
  }
  async function save() {
    if (locked || !stage.current || !image || imageError || saveDisabled) return;
    setExporting(true); setError('');
    try {
      decoration.current?.hide();
      const rendered = stage.current.toCanvas({ pixelRatio: 1 / scale, width: document.width * scale, height: document.height * scale });
      // Pin exported dimensions even when responsive scale introduces fractional canvas sizes.
      const canvas = window.document.createElement('canvas');
      canvas.width = document.width; canvas.height = document.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('The browser could not prepare this image. Retry saving.');
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(rendered, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('The image could not be prepared. Retry saving.')), 'image/jpeg', .9));
      decoration.current?.show();
      await onSave(blob);
    } catch (failure) { report(failure instanceof Error ? failure.message : 'The image could not be prepared. Your draft is retained.'); }
    finally { decoration.current?.show(); setExporting(false); }
  }

  return <div className="space-y-4">
    <fieldset disabled={locked} className="space-y-3"><legend className="mb-2 text-sm font-medium">Markup tools</legend>
      <div className="flex flex-wrap gap-2">{tools.map((item) => <Button key={item.type} variant={tool === item.type ? 'default' : 'outline'} size="sm" aria-pressed={tool === item.type} onClick={() => setTool(item.type)}>{item.label}</Button>)}</div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm"><span className="block">Markup colour</span><input aria-label="Markup colour" className="h-11 w-16 rounded-md border bg-background p-1" type="color" value={colour} onChange={(event) => { setColour(event.target.value); if (active) replace({ ...active, colour: event.target.value }); }} /></label>
        <label className="min-w-0 flex-1 space-y-1 text-sm"><span className="block">Text or measurement label</span><input className="min-h-11 w-full rounded-md border bg-background px-3" maxLength={200} value={label} onChange={(event) => setLabel(event.target.value)} /></label>
        <Button variant="outline" disabled={tool === 'move' || document.objects.length >= 200} onClick={insert}>Add selected tool</Button>
      </div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!undo.length} onClick={() => history('undo')}>Undo</Button><Button variant="outline" disabled={!redo.length} onClick={() => history('redo')}>Redo</Button></div>
    </fieldset>
    <p className="text-sm text-muted-foreground">Draw on the photo, or add a tool with the button. Select objects below and use the movement buttons or arrow keys. Measurement labels are notes, not calibrated distances.</p>
    {error ? <p role="alert" ref={errorRef} tabIndex={-1} className="text-sm text-destructive">{error}</p> : null}
    <div ref={container} className="min-w-0 overflow-hidden rounded-md border bg-muted" style={{ touchAction: tool === 'move' ? 'auto' : 'none' }}>
      {!image && !imageError ? <p role="status" className="p-5">Loading original photo…</p> : null}
      {imageError ? <p className="p-5 text-sm">The original photo could not be loaded. Refresh photo links to retry.</p> : null}
      {image && !imageError ? <div tabIndex={0} role="group" aria-label="Photo markup canvas. Arrow keys move the selected object; Delete removes it." className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onKeyDown={(event) => {
        if (event.key.startsWith('Arrow')) { event.preventDefault(); const step = event.shiftKey ? 10 : 1; move(event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0); }
        if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); remove(); }
      }}><Stage ref={stage} width={document.width * scale} height={document.height * scale} scaleX={scale} scaleY={scale} onPointerDown={startDraw} onPointerMove={draw} onPointerUp={endDraw} onPointerLeave={endDraw}>
        <Layer><CanvasImage image={image} width={document.width} height={document.height} listening={false} />
          {document.objects.map((object) => <Group key={object.id} x={object.x} y={object.y} draggable={tool === 'move' && !locked} onClick={() => setSelected(object.id)} onTap={() => setSelected(object.id)} onDragStart={() => setSelected(object.id)} onDragEnd={(event) => { const moved = moveAnnotation(object, event.target.x() - object.x, event.target.y() - object.y, document.width, document.height); event.target.position({ x: moved.x, y: moved.y }); replace(moved); }}>
            <Rect width={object.width} height={object.height} fill="transparent" />
            {object.type === 'rectangle' ? <Rect width={object.width} height={object.height} stroke={object.colour} strokeWidth={object.strokeWidth} /> : null}
            {object.type === 'circle' ? <Ellipse x={object.width / 2} y={object.height / 2} radiusX={object.width / 2} radiusY={object.height / 2} stroke={object.colour} strokeWidth={object.strokeWidth} /> : null}
            {object.type === 'pen' ? <Line points={object.points} stroke={object.colour} strokeWidth={object.strokeWidth} lineCap="round" lineJoin="round" /> : null}
            {object.type === 'arrow' ? <Arrow points={object.points} stroke={object.colour} fill={object.colour} strokeWidth={object.strokeWidth} pointerLength={object.strokeWidth * 4} pointerWidth={object.strokeWidth * 4} /> : null}
            {object.type === 'measurement' ? <Line points={[0, object.height - 2, object.width, object.height - 2]} stroke={object.colour} strokeWidth={object.strokeWidth} /> : null}
            {object.type === 'text' || object.type === 'measurement' ? <Text width={object.width} height={object.height} text={object.text} fontSize={object.fontSize} fill={object.colour} padding={2} /> : null}
          </Group>)}
        </Layer>
        <Layer ref={decoration} listening={false}>{active ? <Rect x={active.x} y={active.y} width={active.width} height={active.height} stroke="#2563eb" strokeWidth={2 / scale} dash={[5 / scale, 4 / scale]} /> : null}{drawing ? <Line points={drawing} stroke={colour} strokeWidth={3 / scale} lineCap="round" /> : null}</Layer>
      </Stage></div> : null}
    </div>
    <fieldset disabled={locked} className="space-y-3"><legend className="mb-2 text-sm font-medium">Objects ({document.objects.length}/200)</legend>
      <label className="block space-y-1 text-sm"><span>Select an object</span><select className="min-h-11 w-full rounded-md border bg-background px-3" value={active?.id ?? ''} onChange={(event) => setSelected(event.target.value || undefined)}><option value="">No object selected</option>{document.objects.map((object, index) => <option key={object.id} value={object.id}>{index + 1}. {object.type}{'text' in object ? `: ${object.text}` : ''}</option>)}</select></label>
      {active && 'text' in active ? <label className="block space-y-1 text-sm"><span>Selected object label</span><input className="min-h-11 w-full rounded-md border bg-background px-3" maxLength={200} value={active.text} onChange={(event) => { if (event.target.value.trim()) replace({ ...active, text: event.target.value }); }} /></label> : null}
      <div className="flex flex-wrap gap-2">{[{ label: 'Move left', dx: -10, dy: 0 }, { label: 'Move right', dx: 10, dy: 0 }, { label: 'Move up', dx: 0, dy: -10 }, { label: 'Move down', dx: 0, dy: 10 }].map((item) => <Button key={item.label} variant="outline" size="sm" disabled={!active} onClick={() => move(item.dx, item.dy)}>{item.label}</Button>)}<Button variant="outline" disabled={!active} onClick={remove}>Delete selected object</Button></div>
    </fieldset>
    <Button onClick={save} disabled={locked || saveDisabled || !image || imageError} loading={locked}>{locked ? 'Saving markup…' : saveLabel}</Button>
  </div>;
}

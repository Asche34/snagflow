import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Canvas,
  ClipOp,
  Group,
  ImageFormat,
  PaintStyle,
  Picture,
  Skia,
  StrokeCap,
  matchFont,
  rect,
  type SkCanvas,
  type SkImage,
} from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import {
  AnnotationDocumentSchema,
  type AnnotationDocument,
  type AnnotationObject,
} from '@snagflow/shared';
import {
  createMarkupObject,
  documentPoint,
  editHistory,
  hitMarkup,
  moveMarkup,
  type MarkupHistory,
  type MarkupTool,
} from '../lib/markup';

type Props = {
  uri: string;
  document: AnnotationDocument;
  onSave: (document: AnnotationDocument, flattenedUri: string) => Promise<void>;
  onCancel: () => void;
  onUseOriginal?: () => void;
  fullScreen?: boolean;
};
type Tool = 'move' | MarkupTool;
const tools: { value: Tool; label: string }[] = [
  { value: 'pen', label: 'Pen' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'circle', label: 'Circle' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'text', label: 'Text' },
  { value: 'measurement', label: 'Measure' },
  { value: 'move', label: 'Move' },
];
const colours = [
  { hex: '#c2410c', name: 'Orange' },
  { hex: '#dc2626', name: 'Red' },
  { hex: '#192d25', name: 'Green' },
  { hex: '#2563eb', name: 'Blue' },
  { hex: '#ffffff', name: 'White' },
  { hex: '#202b26', name: 'Charcoal' },
];
type Gesture = { points: number[]; id: string; moving?: string; before: AnnotationDocument };

/** Both the preview picture and flattened JPEG replay these original-pixel commands. */
function drawDocument(canvas: SkCanvas, image: SkImage, document: AnnotationDocument) {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  canvas.clear(Skia.Color('#ffffff'));
  canvas.drawImageRect(
    image,
    rect(0, 0, image.width(), image.height()),
    rect(0, 0, document.width, document.height),
    paint,
  );
  for (const object of document.objects) {
    paint.setColor(Skia.Color(object.colour));
    paint.setStrokeWidth(object.strokeWidth);
    paint.setStrokeCap(StrokeCap.Round);
    paint.setStyle(PaintStyle.Stroke);
    const bounds = rect(object.x, object.y, object.width, object.height);
    if (object.type === 'rectangle') canvas.drawRect(bounds, paint);
    else if (object.type === 'circle') canvas.drawOval(bounds, paint);
    else if (object.type === 'pen' || object.type === 'arrow') {
      const path = Skia.PathBuilder.Make();
      path.moveTo(object.x + object.points[0]!, object.y + object.points[1]!);
      for (let index = 2; index < object.points.length; index += 2)
        path.lineTo(object.x + object.points[index]!, object.y + object.points[index + 1]!);
      if (object.type === 'arrow') {
        const [x0, y0, x1, y1] = object.points as [number, number, number, number];
        const angle = Math.atan2(y1 - y0, x1 - x0);
        const head = Math.min(
          Math.hypot(x1 - x0, y1 - y0) / 3,
          Math.max(12, object.strokeWidth * 4),
        );
        for (const turn of [-Math.PI / 6, Math.PI / 6]) {
          path.moveTo(object.x + x1, object.y + y1);
          path.lineTo(
            object.x + x1 - head * Math.cos(angle + turn),
            object.y + y1 - head * Math.sin(angle + turn),
          );
        }
      }
      canvas.drawPath(path.detach(), paint);
    } else {
      paint.setStyle(PaintStyle.Fill);
      const font = matchFont({
        fontFamily: Platform.OS === 'ios' ? 'Helvetica' : 'sans-serif',
        fontSize: object.fontSize,
      });
      // Preserve wrapping for web-created text and draw within the shared vector box.
      canvas.save();
      canvas.clipRect(bounds, ClipOp.Intersect, true);
      let line = '',
        baseline = object.y + object.fontSize;
      for (const character of object.text) {
        const next = line + character;
        if (character === '\n' || (line && font.measureText(next).width > object.width)) {
          canvas.drawText(line, object.x, baseline, paint, font);
          baseline += object.fontSize * 1.2;
          line = character === '\n' ? '' : character;
        } else line = next;
      }
      if (line) canvas.drawText(line, object.x, baseline, paint, font);
      canvas.restore();
      if (object.type === 'measurement') {
        paint.setStyle(PaintStyle.Stroke);
        canvas.drawLine(
          object.x,
          object.y + object.height,
          object.x + object.width,
          object.y + object.height,
          paint,
        );
      }
    }
  }
}

function Control({
  label,
  onPress,
  disabled,
  selected,
  colour,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  colour?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(selected) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.control,
        selected && styles.selected,
        disabled && styles.disabled,
        pressed && styles.pressed,
        colour ? { borderColor: colour } : undefined,
      ]}
    >
      {colour && <View style={[styles.swatch, { backgroundColor: colour }]} />}
      <Text style={[styles.controlText, selected && styles.selectedText]}>{label}</Text>
    </Pressable>
  );
}

export function MarkupEditor({
  uri,
  document,
  onSave,
  onCancel,
  onUseOriginal,
  fullScreen,
}: Props) {
  const [initial] = useState(() => AnnotationDocumentSchema.safeParse(document));
  const [history, setHistory] = useState<MarkupHistory>(() => ({
    current: initial.success ? initial.data : { version: 1, width: 1, height: 1, objects: [] },
    undo: [],
    redo: [],
  }));
  const [showColours, setShowColours] = useState(false);
  const [showObjects, setShowObjects] = useState(false);
  const [tool, setTool] = useState<Tool>('pen');
  const [colour, setColour] = useState('#c2410c');
  const [customColour, setCustomColour] = useState('#c2410c');
  const [label, setLabel] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [viewWidth, setViewWidth] = useState(1);
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState<{
    uri: string;
    reload: number;
    image: SkImage | null;
    error: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<AnnotationDocument | null>(null);
  const [drawing, setDrawing] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const pending = useRef(false);
  const exported = useRef<{ signature: string; uri: string } | null>(null);
  const current = history.current;
  const shown = preview ?? current;
  const { height: windowHeight } = useWindowDimensions();
  const scale = Math.min(
    viewWidth / current.width,
    Math.max(160, windowHeight * 0.58) / current.height,
  );
  const active = current.objects.find((object) => object.id === selected);
  const image = loaded?.uri === uri && loaded.reload === reload ? loaded.image : null;
  const imageError = loaded?.uri === uri && loaded.reload === reload ? loaded.error : '';
  const locked = saving || !image || Boolean(imageError) || !initial.success;

  useEffect(() => {
    let canceled = false;
    void Skia.Data.fromURI(uri)
      .then((data) => {
        const decoded = Skia.Image.MakeImageFromEncoded(data);
        if (!decoded) throw new Error('This original photo could not be decoded.');
        if (!canceled) setLoaded({ uri, reload, image: decoded, error: '' });
      })
      .catch(() => {
        if (!canceled)
          setLoaded({
            uri,
            reload,
            image: null,
            error: 'The original photo could not be loaded. Your markup draft is retained.',
          });
      });
    return () => {
      canceled = true;
    };
  }, [uri, reload]);

  const picture = useMemo(() => {
    if (!image) return null;
    const recorder = Skia.PictureRecorder();
    drawDocument(recorder.beginRecording(rect(0, 0, shown.width, shown.height)), image, shown);
    return recorder.finishRecordingAsPicture();
  }, [image, shown]);

  function commit(objects: AnnotationObject[]) {
    try {
      setHistory((previous) => editHistory(previous, { type: 'commit', objects }));
      setError('');
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'This edit could not be added. Your draft is retained.',
      );
    }
  }
  // Validate before a state updater: React may run updater functions after this call returns.
  function checkedCommit(objects: AnnotationObject[]) {
    const parsed = AnnotationDocumentSchema.safeParse({ ...current, objects });
    if (!parsed.success) {
      setError(
        'This draft exceeds the markup limit. Remove objects or use a shorter stroke or note.',
      );
      return;
    }
    commit(parsed.data.objects);
  }
  function build(points: number[], id: string) {
    if (tool === 'move') return null;
    return createMarkupObject(current, tool, points, id, colour, label);
  }
  function point(event: GestureResponderEvent) {
    return documentPoint(
      event.nativeEvent.locationX,
      event.nativeEvent.locationY,
      current.width * scale,
      current,
    );
  }
  function start(event: GestureResponderEvent) {
    if (locked) return;
    const first = point(event);
    if (!first) return;
    const moving = tool === 'move' ? hitMarkup(current, first) : null;
    if (tool === 'move') setSelected(moving);
    setDrawing(true);
    gesture.current = {
      points: [...first, ...first],
      id: randomUUID(),
      before: current,
      ...(moving ? { moving } : {}),
    };
  }
  function drag(event: GestureResponderEvent) {
    const started = gesture.current,
      next = point(event);
    if (!started || !next || locked) return;
    if (started.moving) {
      setPreview(
        moveMarkup(
          started.before,
          started.moving,
          next[0] - started.points[0]!,
          next[1] - started.points[1]!,
        ),
      );
    } else if (tool !== 'move') {
      started.points =
        tool === 'pen'
          ? started.points.length < 4000
            ? [...started.points, ...next]
            : started.points
          : [...started.points.slice(0, 2), ...next];
      try {
        const object = build(started.points, started.id);
        if (object) setPreview({ ...current, objects: [...current.objects, object] });
      } catch {
        /* Incomplete notes remain editable; validation is reported on release. */
      }
    }
  }
  function finish(event: GestureResponderEvent) {
    const started = gesture.current;
    setDrawing(false);
    if (!started || locked) return;
    gesture.current = null;
    setPreview(null);
    const last = point(event);
    if (started.moving && last)
      checkedCommit(
        moveMarkup(
          started.before,
          started.moving,
          last[0] - started.points[0]!,
          last[1] - started.points[1]!,
        ).objects,
      );
    else if (tool !== 'move') {
      try {
        let points = started.points;
        if (tool !== 'pen' && last) points = [...points.slice(0, 2), ...last];
        if (
          (tool === 'text' || tool === 'measurement') &&
          Math.hypot(points[2]! - points[0]!, points[3]! - points[1]!) < 5
        ) {
          points = [
            points[0]!,
            points[1]!,
            Math.min(current.width - 1, points[0]! + current.width * 0.6),
            Math.min(current.height - 1, points[1]! + current.height * 0.2),
          ];
        }
        const object = build(points, started.id);
        if (object) {
          checkedCommit([...current.objects, object]);
          setSelected(object.id);
        }
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'This object could not be added.');
      }
    }
  }
  function insert() {
    try {
      const object = build(
        [current.width * 0.15, current.height * 0.2, current.width * 0.8, current.height * 0.5],
        randomUUID(),
      );
      if (object) {
        checkedCommit([...current.objects, object]);
        setSelected(object.id);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'This object could not be added.');
    }
  }
  function recolour(next: string) {
    setColour(next);
    setCustomColour(next);
    if (active)
      checkedCommit(
        current.objects.map((object) =>
          object.id === active.id ? { ...object, colour: next } : object,
        ),
      );
  }
  function move(dx: number, dy: number) {
    if (selected) checkedCommit(moveMarkup(current, selected, dx, dy).objects);
  }
  function cancel() {
    if (pending.current) return;
    if (!history.undo.length) {
      onCancel();
      return;
    }
    Alert.alert('Discard markup draft?', 'Unsaved markup changes will be discarded.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onCancel },
    ]);
  }
  async function save() {
    if (saving || drawing || pending.current) return;
    if (onUseOriginal && !current.objects.length) {
      onUseOriginal();
      return;
    }
    if (locked || !image) return;
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      const validated = AnnotationDocumentSchema.parse(current);
      const signature = JSON.stringify(validated);
      if (exported.current?.signature !== signature || !new File(exported.current.uri).exists) {
        const surface = Skia.Surface.MakeOffscreen(validated.width, validated.height);
        if (!surface)
          throw new Error('The phone could not prepare this image. Close other apps and retry.');
        try {
          drawDocument(surface.getCanvas(), image, validated);
          surface.flush();
          const snapshot = surface.makeImageSnapshot();
          try {
            const bytes = snapshot.encodeToBytes(ImageFormat.JPEG, 90);
            if (!bytes.length) throw new Error('The annotated image could not be encoded.');
            const file = new File(Paths.cache, `snagflow-markup-${randomUUID()}.jpg`);
            file.create();
            await file.write(bytes);
            exported.current = { signature, uri: file.uri };
          } finally {
            snapshot.dispose();
          }
        } finally {
          surface.dispose();
        }
      }
      await onSave(validated, exported.current!.uri);
    } catch (failure) {
      setError(
        `${failure instanceof Error ? failure.message : 'Markup could not be saved.'} Your draft is retained. Retry saving.`,
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  const editor = (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={!drawing}
    >
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Review photo
        </Text>
        <Control
          label={saving ? 'Preparing…' : 'Done'}
          selected
          disabled={saving || drawing || (locked && !(onUseOriginal && !current.objects.length))}
          onPress={() => void save()}
        />
      </View>
      {!initial.success && (
        <Text accessibilityRole="alert" style={styles.error}>
          This saved markup format is unsupported. Close the editor to keep the original safe.
        </Text>
      )}
      {error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <View style={styles.controls}>
        <Control
          label="Undo"
          disabled={locked || !history.undo.length}
          onPress={() => {
            setHistory((previous) => editHistory(previous, { type: 'undo' }));
            setSelected(null);
            setError('');
          }}
        />
        <Control
          label="Redo"
          disabled={locked || !history.redo.length}
          onPress={() => {
            setHistory((previous) => editHistory(previous, { type: 'redo' }));
            setSelected(null);
            setError('');
          }}
        />
      </View>
      {imageError ? (
        <View>
          <Text accessibilityRole="alert" style={styles.error}>
            {imageError}
          </Text>
          <Control label="Retry loading original" onPress={() => setReload((value) => value + 1)} />
        </View>
      ) : (
        !image && <ActivityIndicator accessibilityLabel="Loading original photo" color="#c2410c" />
      )}
      <View onLayout={(event) => setViewWidth(Math.max(1, event.nativeEvent.layout.width))}>
        <View
          accessibilityLabel="Photo markup drawing area"
          onStartShouldSetResponder={() => !locked}
          onMoveShouldSetResponder={() => !locked}
          onResponderGrant={start}
          onResponderMove={drag}
          onResponderRelease={finish}
          onResponderTerminationRequest={() => false}
          onResponderTerminate={() => {
            gesture.current = null;
            setDrawing(false);
            setPreview(null);
          }}
          style={{
            alignSelf: 'center',
            width: current.width * scale,
            height: current.height * scale,
            backgroundColor: '#e4e8e2',
            overflow: 'hidden',
          }}
        >
          {picture && (
            <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Group transform={[{ scale }]}>
                <Picture picture={picture} />
              </Group>
            </Canvas>
          )}
          {selected &&
            shown.objects
              .filter((object) => object.id === selected)
              .map((object) => (
                <View
                  pointerEvents="none"
                  key={object.id}
                  style={{
                    position: 'absolute',
                    left: object.x * scale,
                    top: object.y * scale,
                    width: Math.max(2, object.width * scale),
                    height: Math.max(2, object.height * scale),
                    borderWidth: 2,
                    borderColor: '#2563eb',
                  }}
                />
              ))}
        </View>
      </View>
      <View style={styles.controls}>
        {tools.map((item) => (
          <Control
            key={item.value}
            label={item.label}
            selected={tool === item.value}
            disabled={locked}
            onPress={() => {
              setTool(item.value);
              setSelected(null);
            }}
          />
        ))}
      </View>
      {(tool === 'text' || tool === 'measurement') && (
        <TextInput
          accessibilityLabel={tool === 'measurement' ? 'Measurement label' : 'Markup text'}
          placeholder={tool === 'measurement' ? 'For example, 120 mm' : 'Enter a note'}
          placeholderTextColor="#59675e"
          value={label}
          onChangeText={setLabel}
          maxLength={200}
          editable={!locked}
          style={styles.input}
        />
      )}
      <View style={styles.controls}>
        <Control
          label={showColours ? 'Hide colours' : 'Colour'}
          colour={colour}
          disabled={locked}
          onPress={() => setShowColours(!showColours)}
        />
        <Control label="Insert object" disabled={locked || tool === 'move'} onPress={insert} />
        {current.objects.length > 0 && (
          <Control
            label={showObjects ? 'Hide objects' : 'Objects'}
            disabled={locked}
            onPress={() => setShowObjects(!showObjects)}
          />
        )}
        <Control
          label={onUseOriginal ? 'Discard photo' : 'Cancel'}
          disabled={saving}
          onPress={cancel}
        />
      </View>
      {showColours && (
        <>
          <View style={styles.controls}>
            {colours.map((item) => (
              <Control
                key={item.hex}
                label={item.name}
                colour={item.hex}
                selected={colour === item.hex}
                disabled={locked}
                onPress={() => recolour(item.hex)}
              />
            ))}
          </View>
          <View style={styles.controls}>
            <TextInput
              accessibilityLabel="Custom markup colour in hexadecimal"
              value={customColour}
              onChangeText={setCustomColour}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={7}
              editable={!locked}
              style={styles.colourInput}
            />
            <Control
              label="Apply colour"
              disabled={locked || !/^#[0-9a-f]{6}$/i.test(customColour)}
              onPress={() => recolour(customColour)}
            />
          </View>
        </>
      )}
      {showObjects && current.objects.length > 0 && (
        <View style={styles.controls}>
          {current.objects.map((object, index) => (
            <Control
              key={object.id}
              label={`Select ${object.type} ${index + 1}`}
              selected={selected === object.id}
              disabled={locked}
              onPress={() => {
                setSelected(object.id);
                setTool('move');
              }}
            />
          ))}
        </View>
      )}
      {active && (
        <View>
          <Text style={styles.help}>Selected {active.type}. Move by 10 original pixels:</Text>
          <View style={styles.controls}>
            <Control label="Move left" disabled={locked} onPress={() => move(-10, 0)} />
            <Control label="Move right" disabled={locked} onPress={() => move(10, 0)} />
            <Control label="Move up" disabled={locked} onPress={() => move(0, -10)} />
            <Control label="Move down" disabled={locked} onPress={() => move(0, 10)} />
            <Control
              label="Delete object"
              disabled={locked}
              onPress={() => {
                checkedCommit(current.objects.filter((object) => object.id !== active.id));
                setSelected(null);
              }}
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
  return fullScreen ? (
    <Modal animationType="slide" onRequestClose={cancel} visible>
      <SafeAreaView style={styles.root}>{editor}</SafeAreaView>
    </Modal>
  ) : (
    editor
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#17241f' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: '#ffffff' },
  help: { fontSize: 15, lineHeight: 22, color: '#eaf0e7' },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  control: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#44574e',
    backgroundColor: '#273a31',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  selected: { backgroundColor: '#a8380c', borderColor: '#e98056' },
  controlText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  selectedText: { color: '#ffffff' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  swatch: { width: 16, height: 16, borderWidth: 1, borderColor: '#8d9b91', borderRadius: 8 },
  input: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8d9b91',
    backgroundColor: '#ffffff',
    color: '#202b26',
    padding: 12,
    fontSize: 16,
  },
  colourInput: {
    minHeight: 48,
    minWidth: 120,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8d9b91',
    backgroundColor: '#ffffff',
    color: '#202b26',
    padding: 12,
    fontSize: 16,
  },
  error: { color: '#ffb59a', fontSize: 16, lineHeight: 23 },
});

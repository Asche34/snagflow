import { useEffect, useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import {
  AnnotationDocumentSchema,
  canAnnotatePhoto,
  type AnnotationDocument,
  type ProjectRole,
} from '@snagflow/shared';
import { useAuth } from '../providers/auth';
import type { Row } from '../lib/data';
import { message } from '../lib/mutations';
import { pickPhoto, uploadPhotos, uploadImmutable, type QueuedPhoto } from '../lib/photos';
import { Button, Choices, ErrorText, styles } from './ui';
import { MarkupEditor } from './markup-editor';
type Edit = {
  photo: Row<'snag_photos'>;
  uri: string;
  document: AnnotationDocument;
  expected: string;
  conflict?: { updated: string; url: string };
  path?: string;
  content?: string;
};
export function Photos({
  projectId,
  snagId,
  photos,
  role,
  canAdd,
  onSaved,
}: {
  projectId: string;
  snagId: string;
  photos: Row<'snag_photos'>[];
  role: ProjectRole | null;
  canAdd: boolean;
  onSaved: () => Promise<void>;
}) {
  const { client: supabase, session, profile } = useAuth();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [kind, setKind] = useState<'issue' | 'fix'>('fix');
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const editRef = useRef<Edit | null>(null);
  useEffect(() => {
    editRef.current = edit;
  }, [edit]);
  useEffect(() => {
    let current = true;
    async function load() {
      const next: Record<string, string> = {};
      try {
        for (const photo of photos) {
          const signed = await supabase.storage
            .from('snag-photos')
            .createSignedUrl(photo.annotated_path ?? photo.storage_path, 300);
          if (signed.error) throw signed.error;
          next[photo.id] = signed.data.signedUrl;
        }
        if (current) {
          setUrls(next);
          setFailed(false);
        }
      } catch {
        if (current) setFailed(true);
      }
    }
    void load();
    const timer = setInterval(() => void load(), 240000);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [photos, retry, supabase]);
  const pick = async (source: 'camera' | 'library') => {
    setBusy(true);
    setError(null);
    try {
      const item = await pickPhoto(source, kind);
      if (item) setQueue((q) => [...q, item]);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const upload = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await uploadPhotos(projectId, snagId, queue, setQueue, 0, supabase);
      setQueue(next.filter((p) => p.status !== 'done'));
      await onSaved();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const openEditor = async (photo: Row<'snag_photos'>) => {
    setError(null);
    try {
      const signed = await supabase.storage
        .from('snag-photos')
        .createSignedUrl(photo.storage_path, 300);
      if (signed.error) throw signed.error;
      const parsed = AnnotationDocumentSchema.safeParse(photo.annotation_json);
      if (photo.annotation_json && !parsed.success)
        throw Error(
          'This saved markup version is unsupported. Open the original or use the web app for recovery.',
        );
      setEdit({
        photo,
        uri: signed.data.signedUrl,
        expected: photo.updated_at,
        document: parsed.success
          ? parsed.data
          : { version: 1, width: photo.width, height: photo.height, objects: [] },
      });
    } catch (e) {
      setError(message(e));
    }
  };
  const saveMarkup = async (document: AnnotationDocument, uri: string) => {
    const current = editRef.current;
    if (!current) return;
    if (current.conflict) throw Error('Review the newer saved image below before replacing it.');
    const content = JSON.stringify(document);
    const path =
      current.content === content && current.path
        ? current.path
        : `${projectId}/${snagId}/${randomUUID()}.jpg`;
    const intent = { ...current, content, path };
    editRef.current = intent;
    setEdit(intent);
    await uploadImmutable(path, uri, supabase);
    const r = await supabase.rpc('save_photo_annotation', {
      p_photo_id: current.photo.id,
      p_expected_updated_at: current.expected,
      p_annotated_path: path,
      p_annotation_json: document,
    });
    if (r.error) {
      if (r.error.message.includes('ANNOTATION_CONFLICT')) {
        const latest = await supabase
          .from('snag_photos')
          .select('*')
          .eq('id', current.photo.id)
          .single();
        if (latest.error) throw latest.error;
        const signed = await supabase.storage
          .from('snag-photos')
          .createSignedUrl(latest.data.annotated_path ?? latest.data.storage_path, 300);
        if (signed.error) throw signed.error;
        setEdit({
          ...intent,
          conflict: { updated: latest.data.updated_at, url: signed.data.signedUrl },
        });
      }
      throw Error(
        'Markup was not confirmed saved. Your draft is retained; review access, connection or newer markup before retrying.',
      );
    }
    setEdit(null);
    await onSaved();
  };
  return (
    <View style={{ gap: 16 }}>
      <Text style={styles.title}>Photos · {photos.length}/8</Text>
      <ErrorText error={error} />
      {failed && (
        <>
          <ErrorText error="A private photo could not load." />
          <Button label="Refresh photo links" secondary onPress={() => setRetry((v) => v + 1)} />
        </>
      )}
      {photos.map((photo) => (
        <View key={photo.id} style={styles.card}>
          <Text style={styles.text}>{photo.kind === 'fix' ? 'Fix evidence' : 'Issue photo'}</Text>
          {urls[photo.id] && (
            <Image
              accessibilityLabel={`${photo.kind} photo`}
              source={{ uri: urls[photo.id] }}
              style={{ width: '100%', aspectRatio: photo.width / photo.height }}
              resizeMode="contain"
              onError={() => setFailed(true)}
            />
          )}
          {profile?.is_active &&
            canAnnotatePhoto({
              id: session!.user.id,
              isAdmin: profile.is_admin,
              projectRole: role,
              uploadedBy: photo.uploaded_by,
            }) && <Button label="Edit markup" secondary onPress={() => void openEditor(photo)} />}
        </View>
      ))}
      {edit &&
        profile?.is_active &&
        canAnnotatePhoto({
          id: session!.user.id,
          isAdmin: profile.is_admin,
          projectRole: role,
          uploadedBy: edit.photo.uploaded_by,
        }) && (
          <View style={styles.card}>
            <MarkupEditor
              key={edit.photo.id}
              uri={edit.uri}
              document={edit.document}
              onSave={saveMarkup}
              onCancel={() => setEdit(null)}
            />
            {edit.conflict && (
              <>
                <Text style={styles.text}>
                  Newer saved image. Review before replacing its markup.
                </Text>
                <Image
                  accessibilityLabel="Newer saved markup"
                  source={{ uri: edit.conflict.url }}
                  style={{ width: '100%', aspectRatio: edit.document.width / edit.document.height }}
                  resizeMode="contain"
                />
                <Button
                  label="I reviewed it — allow replacing"
                  secondary
                  onPress={() =>
                    setEdit({ ...edit, expected: edit.conflict!.updated, conflict: undefined })
                  }
                />
              </>
            )}
          </View>
        )}
      {canAdd && (
        <>
          <Choices
            label="Photo kind"
            value={kind}
            options={[
              { value: 'issue', label: 'Issue' },
              { value: 'fix', label: 'Fix' },
            ]}
            onChange={setKind}
            disabled={busy}
          />
          <View style={styles.row}>
            <Button
              label="Take photo"
              disabled={busy || photos.length + queue.length >= 8}
              onPress={() => void pick('camera')}
            />
            <Button
              label="Choose photo"
              secondary
              disabled={busy || photos.length + queue.length >= 8}
              onPress={() => void pick('library')}
            />
          </View>
          {queue.map((q) => (
            <View key={q.id} style={styles.card}>
              <Text style={styles.text}>
                {q.kind} · {q.status}
              </Text>
              <ErrorText error={q.error} />
              <Image
                accessibilityLabel="Pending photo"
                source={{ uri: q.thumbnailUri }}
                style={{ width: 100, height: 100 }}
              />
              <Button
                label="Remove pending photo"
                secondary
                disabled={busy || q.status === 'done'}
                onPress={() => setQueue((items) => items.filter((i) => i.id !== q.id))}
              />
            </View>
          ))}
          {!!queue.length && (
            <Button
              label={busy ? 'Uploading…' : 'Upload / retry photos'}
              disabled={busy}
              onPress={() => void upload()}
            />
          )}
        </>
      )}
    </View>
  );
}

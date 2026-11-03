import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { canAct, type AnnotationDocument, type SnagCreate } from '@snagflow/shared';
import { useAuth } from '../../../providers/auth';
import { projectContext } from '../../../lib/data';
import { useResource } from '../../../lib/use-resource';
import { saveSnag, message } from '../../../lib/mutations';
import { pickPhoto, uploadPhotos, type QueuedPhoto } from '../../../lib/photos';
import { Button, Choices, ErrorText, Loading, Screen, styles } from '../../../components/ui';
import { SnagForm } from '../../../components/snag-form';
import { MarkupEditor } from '../../../components/markup-editor';
import { ProjectSwitcher } from '../../../components/project-switcher';
export default function Capture() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProjectCapture key={id} id={id} />;
}
function ProjectCapture({ id }: { id: string }) {
  const { client: supabase, session, profile } = useAuth();
  const r = useResource(() => projectContext(id, session!.user.id, supabase), `capture:${id}`, [
    'project_members',
    'projects',
    'locations',
    'categories',
  ]);
  const [clientId, setClientId] = useState(randomUUID);
  const [photos, setPhotos] = useState<QueuedPhoto[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [mode, setMode] = useState<'single' | 'continuous'>('single');
  const [another, setAnother] = useState<'open' | 'another'>('open');
  const [formKey, setFormKey] = useState(0);
  const [defaults, setDefaults] = useState<Pick<SnagCreate, 'locationId' | 'categoryId'>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [createdIds, setCreatedIds] = useState<Record<string, string>>({});
  const actor =
    session && profile?.is_active ? { id: session.user.id, isAdmin: profile.is_admin } : null;
  const pick = async (source: 'camera' | 'library') => {
    setBusy(true);
    setError(null);
    try {
      const photo = await pickPhoto(source, 'issue');
      if (photo) {
        setPhotos((items) => [...items, photo]);
        if (mode === 'single') setEditing(photo.id);
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const save = async (details: Omit<SnagCreate, 'clientId' | 'projectId'>) => {
    setBusy(true);
    setError(null);
    try {
      const row = await saveSnag({ ...details, clientId, projectId: id }, supabase);
      const results = await uploadPhotos(id, row.id, photos, setPhotos, 0, supabase);
      if (results.some((p) => p.status !== 'done'))
        throw Error('Snag saved. Some photos need retry; keep this screen open and save again.');
      if (another === 'another') {
        setDefaults({ locationId: details.locationId, categoryId: details.categoryId });
        setPhotos([]);
        setClientId(randomUUID());
        setFormKey((v) => v + 1);
        setNotice(`Snag #${row.number} saved. Ready for the next capture.`);
      } else router.replace({ pathname: '/snags/[id]', params: { id: row.id } });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const saveContinuous = async () => {
    setBusy(true);
    setError(null);
    let items = [...photos];
    try {
      for (const photo of photos) {
        if (photo.status === 'done') continue;
        const row = await saveSnag(
          {
            clientId: photo.id,
            projectId: id,
            title: `Site photo ${new Date(photo.takenAt).toLocaleString()}`,
            priority: 'medium',
          },
          supabase,
        );
        setCreatedIds((ids) => ({ ...ids, [photo.id]: row.id }));
        const result = await uploadPhotos(
          id,
          row.id,
          [photo],
          (next) => {
            items = items.map((p) => (p.id === photo.id ? next[0]! : p));
            setPhotos([...items]);
          },
          0,
          supabase,
        );
        if (result[0]?.status !== 'done')
          throw Error(
            'Capture stopped at an unfinished photo. Retry keeps the same snag identity.',
          );
      }
      setNotice('Captured snags saved. Open each snag to fill in its details.');
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const photo = photos.find((p) => p.id === editing);
  const saveDraft = async (document: AnnotationDocument, uri: string) => {
    setPhotos((items) =>
      items.map((item) =>
        item.id === editing
          ? { ...item, annotation: document, flattenedUri: uri, annotationId: randomUUID() }
          : item,
      ),
    );
    setEditing(null);
  };
  return (
    <Screen title="Capture snag">
      <Stack.Screen options={{ headerRight: () => <ProjectSwitcher disabled={busy} /> }} />
      <ErrorText error={r.error ?? error} />
      {notice && (
        <Text accessibilityRole="alert" style={styles.text}>
          {notice}
        </Text>
      )}
      {r.loading && !r.data && <Loading />}
      {r.error && <Button label="Retry project access" onPress={() => void r.refresh()} />}
      {r.data && canAct(actor, r.data.role, 'snag:create') && (
        <>
          <Text style={styles.muted}>{r.data.project.name} · online capture</Text>
          <Choices
            label="Capture mode"
            value={mode}
            options={[
              { value: 'single', label: 'One snag · up to 8 photos' },
              { value: 'continuous', label: 'One snag per photo' },
            ]}
            onChange={setMode}
            disabled={busy || !!photos.length}
          />
          <View style={styles.row}>
            <Button
              label="Take photo"
              disabled={busy || photos.length >= 8}
              onPress={() => void pick('camera')}
            />
            <Button
              label="Choose photo"
              secondary
              disabled={busy || photos.length >= 8}
              onPress={() => void pick('library')}
            />
          </View>
          <Text style={styles.muted}>
            Capture several photos in a row. Keep this screen open; unfinished photos are not stored
            in an offline queue.
          </Text>
          {photos.map((item) => (
            <View key={item.id} style={styles.card}>
              <Image
                accessibilityLabel="Captured issue photo"
                source={{ uri: item.flattenedUri ?? item.thumbnailUri }}
                style={{ width: '100%', aspectRatio: item.width / item.height }}
                resizeMode="contain"
              />
              <Text style={styles.text}>{item.status}</Text>
              <ErrorText error={item.error} />
              <Button
                label="Markup photo"
                secondary
                disabled={busy || item.status !== 'queued'}
                onPress={() => setEditing(item.id)}
              />
              {createdIds[item.id] && item.status === 'done' && (
                <Button
                  label="Fill snag details"
                  secondary
                  onPress={() =>
                    router.push({ pathname: '/snags/[id]', params: { id: createdIds[item.id] } })
                  }
                />
              )}
              {item.status === 'queued' && (
                <Button
                  label="Remove photo"
                  secondary
                  disabled={busy}
                  onPress={() => setPhotos((items) => items.filter((p) => p.id !== item.id))}
                />
              )}
            </View>
          ))}
          {photo && (
            <MarkupEditor
              key={photo.id}
              uri={photo.originalUri}
              document={
                photo.annotation ?? {
                  version: 1,
                  width: photo.width,
                  height: photo.height,
                  objects: [],
                }
              }
              onSave={saveDraft}
              onCancel={() => setEditing(null)}
            />
          )}
          {!editing &&
            (mode === 'single' ? (
              <>
                <Choices
                  label="After saving"
                  value={another}
                  options={[
                    { value: 'open', label: 'Open snag' },
                    { value: 'another', label: 'Save & add another' },
                  ]}
                  onChange={setAnother}
                  disabled={busy}
                />
                <SnagForm
                  key={formKey}
                  context={r.data}
                  defaults={defaults}
                  busy={busy}
                  onSave={(details) => void save(details)}
                />
              </>
            ) : (
              <Button
                label={busy ? 'Saving captures…' : 'Save captured snags'}
                disabled={busy || !photos.some((p) => p.status !== 'done')}
                onPress={() => void saveContinuous()}
              />
            ))}
        </>
      )}
      {r.data && !canAct(actor, r.data.role, 'snag:create') && (
        <Text style={styles.text}>You do not have permission to create snags in this project.</Text>
      )}
    </Screen>
  );
}

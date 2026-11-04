import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { canAct, canEditSnagDetails } from '@snagflow/shared';
import { useAuth } from '../../providers/auth';
import { snagDetail } from '../../lib/data';
import { useResource } from '../../lib/use-resource';
import { addComment, message, updateSnag } from '../../lib/mutations';
import { Button, ErrorText, Field, human, Loading, Screen, styles } from '../../components/ui';
import { SnagForm } from '../../components/snag-form';
import { Workflow } from '../../components/workflow';
import { Photos } from '../../components/photos';
import { useDurableDraft } from '../../lib/offline/use-draft';
import { useOffline } from '../../providers/offline';
export default function Snag() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { client: supabase, session, profile } = useAuth();
  const r = useResource(() => snagDetail(id, session!.user.id, supabase), `snag:${id}`, [
    'snags',
    'snag_photos',
    'comments',
    'activity_log',
    'project_members',
  ]);
  const [notice, setNotice] = useState('');
  const [edit, setEdit] = useState(false);
  const offline = useOffline();
  const [body, setBody, draftError] = useDurableDraft(`comment:${id}`, '');
  const [commentId, setCommentId] = useDurableDraft(`comment-id:${id}`, randomUUID());
  const [editDraft, setEditDraft, editDraftError] = useDurableDraft<
    Parameters<typeof SnagForm>[0]['draft']
  >(`edit:${id}`, undefined);
  const [editBase, setEditBase] = useDurableDraft<
    import('../../lib/data').Row<'snags'> | undefined
  >(`edit-base:${id}`, undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actor =
    session && profile?.is_active ? { id: session.user.id, isAdmin: profile.is_admin } : null;
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await r.refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = () => {
    const perform = () =>
      void run(async () => {
        const result = await supabase.rpc('soft_delete_snag', { p_snag_id: id });
        if (result.error) {
          const check = await supabase.from('snags').select('id').eq('id', id).maybeSingle();
          if (check.error || check.data) throw result.error;
        }
        router.replace({ pathname: '/projects/[id]', params: { id: r.data!.snag.project_id } });
      });
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this snag? Its history will be retained.')) perform();
    } else
      Alert.alert('Delete snag?', 'Its history will be retained.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: perform },
      ]);
  };
  return (
    <Screen
      title={
        r.data
          ? r.data.snag.number
            ? `Snag #${r.data.snag.number}`
            : 'Snag · pending sync'
          : 'Snag'
      }
      refresh={() => void r.refresh()}
      refreshing={r.loading && !!r.data}
    >
      <ErrorText error={r.error ?? error} />
      <ErrorText error={draftError ?? editDraftError} />
      {r.error && <Button label="Retry" onPress={() => void r.refresh()} />}
      {r.loading && !r.data && <Loading />}
      {r.data && (
        <>
          <Text style={styles.heading}>{r.data.snag.title}</Text>
          {!!notice && (
            <Text accessibilityRole="alert" style={styles.text}>
              {notice}
            </Text>
          )}
          <Text style={styles.muted}>
            {human(r.data.snag.status)} · {r.data.snag.priority} · {r.data.context.project.name}
          </Text>
          <Text style={styles.text}>{r.data.snag.description || 'No description.'}</Text>
          <Text style={styles.text}>
            Location:{' '}
            {r.data.context.locations.find((l) => l.id === r.data!.snag.location_id)?.name ??
              'None'}
            {'\n'}Category:{' '}
            {r.data.context.categories.find((c) => c.id === r.data!.snag.category_id)?.name ??
              'None'}
            {'\n'}Assignee:{' '}
            {r.data.context.members.find((m) => m.user_id === r.data!.snag.assignee_id)?.profiles
              ?.full_name ?? 'Unassigned'}
            {'\n'}Due: {r.data.snag.due_date ?? 'Not set'}
          </Text>
          {actor &&
            canEditSnagDetails({
              actorId: actor.id,
              isAdmin: actor.isAdmin,
              projectRole: r.data.context.role,
              scope: { createdById: r.data.snag.created_by, status: r.data.snag.status },
            }) && (
              <Button
                label={edit ? 'Hide edit form' : 'Edit details'}
                secondary
                onPress={() => {
                  if (!edit && !editBase) setEditBase(r.data!.snag);
                  setEdit((v) => !v);
                }}
              />
            )}
          {edit &&
            actor &&
            canEditSnagDetails({
              actorId: actor.id,
              isAdmin: actor.isAdmin,
              projectRole: r.data.context.role,
              scope: { createdById: r.data.snag.created_by, status: r.data.snag.status },
            }) && (
              <SnagForm
                context={r.data.context}
                initial={editBase ?? r.data.snag}
                draft={editDraft}
                onDraftChange={setEditDraft}
                busy={busy}
                onSave={(value) =>
                  void run(async () => {
                    await updateSnag(id, value, supabase, editBase);
                    setEditDraft(undefined);
                    setEditBase(undefined);
                    await offline?.engine.setDraft(`edit:${id}`, undefined);
                    setEdit(false);
                  })
                }
              />
            )}
          <Photos
            key={id}
            projectId={r.data.snag.project_id}
            snagId={id}
            photos={r.data.photos}
            role={r.data.context.role}
            canAdd={canAct(actor, r.data.context.role, 'snag:add-photo')}
            onSaved={r.refresh}
          />
          <Workflow
            snag={r.data.snag}
            context={r.data.context}
            fixCount={r.data.photos.filter((p) => p.kind === 'fix').length}
            onSaved={r.refresh}
          />
          <Text style={styles.title}>Comments</Text>
          {r.data.comments.map((c) => (
            <View key={c.id} style={styles.card}>
              <Text style={styles.muted}>
                {r.data!.context.members.find((m) => m.user_id === c.author_id)?.profiles
                  ?.full_name ?? 'Colleague'}{' '}
                · {new Date(c.created_at).toLocaleString()}
              </Text>
              <Text style={styles.text}>{c.body}</Text>
            </View>
          ))}
          {!r.data.comments.length && <Text style={styles.muted}>No comments yet.</Text>}
          {canAct(actor, r.data.context.role, 'snag:comment') && (
            <>
              <Field
                label="Comment"
                value={body}
                onChangeText={setBody}
                multiline
                maxLength={5000}
                editable={!busy}
              />
              <Text style={styles.muted}>{body.length}/5000</Text>
              <Button
                label={busy ? 'Posting…' : 'Post comment'}
                disabled={busy || !body.trim()}
                onPress={() =>
                  void run(async () => {
                    const receipt = await addComment(commentId, id, body, supabase);
                    setCommentId(randomUUID());
                    if (receipt.saved) {
                      setBody('');
                      setNotice('Comment saved. Check Sync for delivery status.');
                    } else {
                      setNotice(
                        'Your previous comment was already saved. Your edited draft is retained; press Post comment to send it as a new comment.',
                      );
                    }
                  })
                }
              />
            </>
          )}
          <Text style={styles.title}>Activity</Text>
          {r.data.activity.map((a) => (
            <View key={a.id} style={styles.card}>
              <Text style={styles.text}>{human(a.action)}</Text>
              <Text style={styles.muted}>
                {new Date(a.created_at).toLocaleString()} · {a.from_value ?? ''} →{' '}
                {a.to_value ?? ''}
              </Text>
              {a.meta && typeof a.meta === 'object' && 'comment' in a.meta && (
                <Text style={styles.text}>{String(a.meta.comment)}</Text>
              )}
            </View>
          ))}
          {canAct(actor, r.data.context.role, 'snag:soft-delete') && (
            <Button label="Delete snag" disabled={busy} secondary onPress={remove} />
          )}
        </>
      )}
    </Screen>
  );
}

import { useState } from 'react';
import { Text, View } from 'react-native';
import { canAct, canWorkOnSnag, isReviewer, transitionsFrom } from '@snagflow/shared';
import { useAuth } from '../providers/auth';
import { assignSnag, message, transitionSnag } from '../lib/mutations';
import type { ProjectContext, Row } from '../lib/data';
import { Button, Choices, ErrorText, Field, styles } from './ui';
export function Workflow({
  snag,
  context,
  fixCount,
  onSaved,
}: {
  snag: Row<'snags'>;
  context: ProjectContext;
  fixCount: number;
  onSaved: () => Promise<void>;
}) {
  const { session, profile } = useAuth();
  const [comment, setComment] = useState('');
  const [assignee, setAssignee] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actor =
    session && profile?.is_active ? { id: session.user.id, isAdmin: profile.is_admin } : null;
  const reviewer = isReviewer({ isAdmin: !!actor?.isAdmin, projectRole: context.role });
  const worker =
    actor &&
    canWorkOnSnag({
      actorId: actor.id,
      isAdmin: actor.isAdmin,
      projectRole: context.role,
      scope: { assigneeId: snag.assignee_id, status: snag.status },
    });
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setComment('');
      setAssignee(null);
      await onSaved();
    } catch (e) {
      setError(`${message(e)} Refresh to review the current status before retrying.`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Workflow</Text>
      <ErrorText error={error} />
      {canAct(actor, context.role, 'snag:assign') && (
        <>
          <Choices
            label="Assign to"
            value={assignee ?? snag.assignee_id ?? ''}
            options={[
              { value: '', label: 'Unassigned' },
              ...context.members
                .filter((m) => m.role !== 'viewer' && m.profiles?.is_active)
                .map((m) => ({ value: m.user_id, label: m.profiles?.full_name ?? m.user_id })),
            ]}
            onChange={setAssignee}
            disabled={busy}
          />
          <Button
            label="Save assignment"
            disabled={busy}
            secondary
            onPress={() =>
              void run(() => assignSnag(snag.id, (assignee ?? snag.assignee_id) || null))
            }
          />
        </>
      )}
      {(reviewer || worker) && (
        <Field
          label="Review / reopen reason"
          value={comment}
          onChangeText={setComment}
          maxLength={5000}
          multiline
          editable={!busy}
        />
      )}
      {transitionsFrom(snag.status)
        .filter((rule) => (rule.actor === 'managerOnly' ? reviewer : worker))
        .map((rule) => (
          <View key={rule.action} style={{ gap: 8 }}>
            {rule.fixPhotoRequired && context.project.require_fix_photo && !fixCount && (
              <Text style={styles.muted}>Add a fix photo before requesting review.</Text>
            )}
            <Button
              label={busy ? 'Saving…' : rule.label}
              disabled={
                busy ||
                (rule.commentRequired && !comment.trim()) ||
                (rule.fixPhotoRequired && context.project.require_fix_photo && !fixCount) ||
                (rule.action === 'start_work' && !snag.assignee_id)
              }
              onPress={() => void run(() => transitionSnag(snag.id, rule.to, comment))}
            />
          </View>
        ))}
    </View>
  );
}

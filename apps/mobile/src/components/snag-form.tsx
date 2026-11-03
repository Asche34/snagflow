import { useState } from 'react';
import { Text, View } from 'react-native';
import { SNAG_PRIORITIES, canAct, type SnagCreate, type SnagPriority } from '@snagflow/shared';
import { useAuth } from '../providers/auth';
import type { ProjectContext, Row } from '../lib/data';
import { Button, Choices, Field, styles } from './ui';
export function SnagForm({
  context,
  initial,
  busy,
  onSave,
  label = 'Save snag',
  defaultTitle = '',
  defaults,
}: {
  context: ProjectContext;
  initial?: Row<'snags'>;
  busy: boolean;
  onSave: (value: Omit<SnagCreate, 'clientId' | 'projectId'>) => void;
  label?: string;
  defaultTitle?: string;
  defaults?: Pick<SnagCreate, 'locationId' | 'categoryId'>;
}) {
  const { session, profile } = useAuth();
  const [title, setTitle] = useState(initial?.title ?? defaultTitle);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [priority, setPriority] = useState<SnagPriority | ''>(initial?.priority ?? '');
  const [location, setLocation] = useState(initial?.location_id ?? defaults?.locationId ?? '');
  const [category, setCategory] = useState(initial?.category_id ?? defaults?.categoryId ?? '');
  const [due, setDue] = useState(initial?.due_date ?? '');
  const [assignee, setAssignee] = useState(initial?.assignee_id ?? '');
  const actor =
    session && profile?.is_active ? { id: session.user.id, isAdmin: profile.is_admin } : null;
  return (
    <View style={{ gap: 16 }}>
      <Field label="Title" value={title} onChangeText={setTitle} maxLength={200} editable={!busy} />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        maxLength={5000}
        multiline
        editable={!busy}
      />
      <Choices
        label={initial ? 'Priority' : 'Priority (optional)'}
        value={priority}
        options={[
          ...(!initial ? [{ value: '' as const, label: 'Decide later (Medium default)' }] : []),
          ...SNAG_PRIORITIES.map((value) => ({ value, label: value })),
        ]}
        onChange={setPriority}
        disabled={busy}
      />
      {!initial && (
        <Text style={styles.muted}>
          Priority can be decided by a manager or administrator later. Skipping it uses Medium until
          changed.
        </Text>
      )}
      <Choices
        label="Location"
        value={location}
        options={[
          { value: '', label: 'No location' },
          ...context.locations.map((l) => ({ value: l.id, label: l.name })),
        ]}
        onChange={setLocation}
        disabled={busy}
      />
      <Choices
        label="Category"
        value={category}
        options={[
          { value: '', label: 'No category' },
          ...context.categories.map((c) => ({ value: c.id, label: c.name })),
        ]}
        onChange={setCategory}
        disabled={busy}
      />
      <Field
        label="Due date (YYYY-MM-DD, optional)"
        value={due}
        onChangeText={setDue}
        editable={!busy}
      />
      {!initial && canAct(actor, context.role, 'snag:assign') && (
        <Choices
          label="Assignee"
          value={assignee}
          options={[
            { value: '', label: 'Unassigned' },
            ...context.members
              .filter((m) => m.role !== 'viewer' && m.profiles?.is_active)
              .map((m) => ({ value: m.user_id, label: m.profiles?.full_name ?? m.user_id })),
          ]}
          onChange={setAssignee}
          disabled={busy}
        />
      )}
      <Text style={styles.muted}>
        Your draft stays here if saving fails. Keep this screen open until all photos finish.
      </Text>
      <Button
        label={busy ? 'Saving…' : label}
        disabled={busy}
        onPress={() =>
          onSave({
            title,
            description,
            priority: priority || 'medium',
            locationId: location || null,
            categoryId: category || null,
            dueDate: due || null,
            ...(canAct(actor, context.role, 'snag:assign') ? { assigneeId: assignee || null } : {}),
          })
        }
      />
    </View>
  );
}

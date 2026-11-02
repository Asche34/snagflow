import { useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { Platform, Pressable, Text, View } from 'react-native';
import {
  canAct,
  REPORT_THEMES,
  ReportFiltersSchema,
  ReportOptionsSchema,
  SNAG_PRIORITIES,
  SNAG_STATUSES,
  type ReportFilters,
  type ReportOptions,
  type ReportRequest,
} from '@snagflow/shared';
import {
  Button,
  Choices,
  ErrorText,
  Field,
  human,
  Loading,
  Screen,
  styles,
  colours,
} from '../../../components/ui';
import { projectContext } from '../../../lib/data';
import {
  createReportApi,
  prepareReportRequest,
  requestForRevision,
  shareReport,
  type ReportRevision,
} from '../../../lib/reports';
import { supabase } from '../../../lib/supabase';
import { useResource } from '../../../lib/use-resource';
import { useAuth } from '../../../providers/auth';
import { AccessUnavailableError } from '../../../lib/online';

function Toggle({
  label,
  checked,
  onPress,
  disabled,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 48,
        borderWidth: 1,
        borderColor: checked ? colours.primary : colours.border,
        backgroundColor: checked ? '#fff1e8' : colours.card,
        borderRadius: 8,
        padding: 12,
        justifyContent: 'center',
      }}
    >
      <Text style={styles.text}>
        {checked ? '✓ ' : '○ '}
        {label}
      </Text>
    </Pressable>
  );
}
function Multi({
  label,
  values,
  options,
  onChange,
  disabled,
}: {
  label: string;
  values: string[];
  options: { value: string; label: string }[];
  onChange: (values: string[]) => void;
  disabled: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.text}>
        {label} {values.length ? `(${values.length} selected)` : '(all)'}
      </Text>
      <View style={styles.row}>
        {options.map((option) => (
          <Toggle
            key={option.value}
            label={option.label}
            checked={values.includes(option.value)}
            disabled={disabled || (!values.includes(option.value) && values.length >= 100)}
            onPress={() =>
              onChange(
                values.includes(option.value)
                  ? values.filter((value) => value !== option.value)
                  : [...values, option.value],
              )
            }
          />
        ))}
      </View>
    </View>
  );
}
const booleanOptions: {
  key: 'cover' | 'photos' | 'annotated' | 'comments' | 'timestamps' | 'fixPhotos';
  label: string;
}[] = [
  { key: 'cover', label: 'Cover and summary' },
  { key: 'photos', label: 'Issue photos' },
  { key: 'annotated', label: 'Use annotated photos' },
  { key: 'comments', label: 'Comments' },
  { key: 'timestamps', label: 'Timestamps' },
  { key: 'fixPhotos', label: 'Fix photos' },
];

export default function ReportsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReportsWorkspace key={id} id={id} />;
}

function ReportsWorkspace({ id }: { id: string }) {
  const { session, profile } = useAuth();
  const [page, setPage] = useState(1);
  const [format, setFormat] = useState<ReportRequest['format']>('pdf');
  const [theme, setTheme] = useState<ReportRequest['theme']>('classic');
  const [options, setOptions] = useState<ReportOptions>(() => ReportOptionsSchema.parse({}));
  const [filters, setFilters] = useState<ReportFilters>(() => ReportFiltersSchema.parse({}));
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<ReportRevision | null>(null);
  const [needsRetry, setNeedsRetry] = useState(false);
  const [accessLost, setAccessLost] = useState(false);
  const lastRequest = useRef<ReportRequest | null>(null);
  const config = useMemo(() => {
    try {
      return {
        api: createReportApi(process.env.EXPO_PUBLIC_API_BASE_URL ?? '', async () => {
          const { data, error: sessionError } = await supabase.auth.getSession();
          return sessionError ? null : (data.session?.access_token ?? null);
        }),
        error: null,
      };
    } catch (setupError) {
      return {
        api: null,
        error:
          setupError instanceof Error
            ? setupError.message
            : 'Set EXPO_PUBLIC_API_BASE_URL to the web app URL.',
      };
    }
  }, []);
  const resource = useResource(
    async () => {
      const context = await projectContext(id, session!.user.id);
      const allowed = canAct(
        profile?.is_active ? { id: session!.user.id, isAdmin: profile.is_admin } : null,
        context.role,
        'report:generate',
      );
      return {
        context,
        history: allowed && config.api ? await config.api.history(id, page) : null,
      };
    },
    `reports:${id}:${session?.user.id}:${profile?.is_admin}:${page}`,
    ['reports', 'project_members', 'projects'],
  );
  const actor =
    session && profile?.is_active ? { id: session.user.id, isAdmin: profile.is_admin } : null;
  const allowed =
    !accessLost && !!resource.data && canAct(actor, resource.data.context.role, 'report:generate');
  const busy = !!pending;

  async function generate(saved?: ReportRevision) {
    if (!allowed || !config.api || busy) return;
    setError(null);
    setPending('Generating report');
    try {
      let request: ReportRequest;
      if (saved) {
        // Retain an exact failed regeneration just like a newly configured report.
        const candidate = requestForRevision(saved, Crypto.randomUUID);
        request = prepareReportRequest(
          {
            projectId: candidate.projectId,
            format: candidate.format,
            theme: candidate.theme,
            filters: candidate.filters,
            options: candidate.options,
          },
          lastRequest.current,
          () => candidate.requestId,
        );
      } else
        request = prepareReportRequest(
          { projectId: id, format, theme, options, filters },
          lastRequest.current,
          Crypto.randomUUID,
        );
      lastRequest.current = request;
      setNeedsRetry(true);
      const result = await config.api.generate(request);
      setGenerated(result.report);
      lastRequest.current = null;
      setNeedsRetry(false);
      void resource.refresh();
    } catch (failure) {
      if (failure instanceof AccessUnavailableError) {
        setAccessLost(true);
        setGenerated(null);
        lastRequest.current = null;
        setNeedsRetry(false);
      }
      setError(
        failure instanceof Error && failure.name !== 'ZodError'
          ? failure.message
          : 'Check report filters, dates and options. End date must follow start date.',
      );
    } finally {
      setPending(null);
    }
  }
  async function download(report: ReportRevision) {
    if (!allowed || !config.api || busy) return;
    setError(null);
    setPending('Preparing private download');
    try {
      const url = await config.api.download(report.id);
      await shareReport(url, report, Platform.OS);
    } catch (failure) {
      if (failure instanceof AccessUnavailableError) {
        setAccessLost(true);
        setGenerated(null);
        lastRequest.current = null;
        setNeedsRetry(false);
      }
      setError(
        failure instanceof Error && failure.name !== 'ZodError'
          ? failure.message
          : 'Unable to share this report. Retry download.',
      );
    } finally {
      setPending(null);
    }
  }
  if (accessLost)
    return (
      <Screen title="Reports unavailable">
        <ErrorText error={error ?? 'Report access changed.'} />
        <Button
          label="Return to project"
          onPress={() => router.replace({ pathname: '/projects/[id]', params: { id } })}
        />
      </Screen>
    );
  return (
    <Screen
      title="Project reports"
      refresh={() => {
        void resource.refresh();
      }}
      refreshing={resource.loading && !!resource.data}
    >
      <ErrorText error={config.error ?? resource.error ?? error} />
      {resource.error && (
        <Button
          label="Retry report history"
          onPress={() => {
            void resource.refresh();
          }}
          disabled={busy}
        />
      )}
      {resource.loading && !resource.data && <Loading />}
      {resource.data && !allowed && (
        <Text style={styles.text}>
          Reports require a project manager or administrator. Your access may have changed.
        </Text>
      )}
      {resource.data && allowed && (
        <>
          <Text style={styles.muted}>
            {resource.data.context.project.name} · Generate a private report, then share its file.
          </Text>
          <View style={styles.card}>
            <Choices
              label="Format"
              value={format}
              options={[
                { value: 'pdf', label: 'PDF' },
                { value: 'xlsx', label: 'Excel' },
              ]}
              onChange={setFormat}
              disabled={busy}
            />
            <Choices
              label="Theme"
              value={theme}
              options={REPORT_THEMES.map((value) => ({ value, label: human(value) }))}
              onChange={setTheme}
              disabled={busy}
            />
            <Text style={styles.title}>Content and layout</Text>
            {booleanOptions.map((option) => (
              <Toggle
                key={option.key}
                label={option.label}
                checked={options[option.key]}
                disabled={busy}
                onPress={() =>
                  setOptions((value) => ({ ...value, [option.key]: !value[option.key] }))
                }
              />
            ))}
            <Choices
              label="Photo size"
              value={options.photoSize}
              options={(['small', 'medium', 'large', 'one_per_page'] as const).map((value) => ({
                value,
                label: human(value),
              }))}
              onChange={(photoSize) => setOptions((value) => ({ ...value, photoSize }))}
              disabled={busy}
            />
            <Choices
              label="Group by"
              value={options.groupBy}
              options={(['location', 'assignee', 'status', 'category'] as const).map((value) => ({
                value,
                label: human(value),
              }))}
              onChange={(groupBy) => setOptions((value) => ({ ...value, groupBy }))}
              disabled={busy}
            />
            <Choices
              label="Sort by"
              value={options.sortBy}
              options={(['number', 'priority', 'due_date'] as const).map((value) => ({
                value,
                label: human(value),
              }))}
              onChange={(sortBy) => setOptions((value) => ({ ...value, sortBy }))}
              disabled={busy}
            />
          </View>
          <View style={styles.card}>
            <Text style={styles.title}>Filters</Text>
            <Multi
              label="Statuses"
              values={filters.statuses}
              options={SNAG_STATUSES.map((value) => ({ value, label: human(value) }))}
              onChange={(statuses) =>
                setFilters((value) => ({
                  ...value,
                  statuses: statuses as ReportFilters['statuses'],
                }))
              }
              disabled={busy}
            />
            <Multi
              label="Priorities"
              values={filters.priorities}
              options={SNAG_PRIORITIES.map((value) => ({ value, label: value }))}
              onChange={(priorities) =>
                setFilters((value) => ({
                  ...value,
                  priorities: priorities as ReportFilters['priorities'],
                }))
              }
              disabled={busy}
            />
            <Multi
              label="Assignees"
              values={filters.assigneeIds}
              options={resource.data.context.members.map((member) => ({
                value: member.user_id,
                label: member.profiles?.full_name ?? member.user_id,
              }))}
              onChange={(assigneeIds) => setFilters((value) => ({ ...value, assigneeIds }))}
              disabled={busy}
            />
            <Multi
              label="Locations"
              values={filters.locationIds}
              options={resource.data.context.locations.map((location) => ({
                value: location.id,
                label: location.name,
              }))}
              onChange={(locationIds) => setFilters((value) => ({ ...value, locationIds }))}
              disabled={busy}
            />
            <Multi
              label="Categories"
              values={filters.categoryIds}
              options={resource.data.context.categories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
              onChange={(categoryIds) => setFilters((value) => ({ ...value, categoryIds }))}
              disabled={busy}
            />
            <Field
              label="Created from (YYYY-MM-DD)"
              value={filters.createdFrom ?? ''}
              editable={!busy}
              onChangeText={(createdFrom) =>
                setFilters((value) => ({ ...value, createdFrom: createdFrom || undefined }))
              }
            />
            <Field
              label="Created to (YYYY-MM-DD)"
              value={filters.createdTo ?? ''}
              editable={!busy}
              onChangeText={(createdTo) =>
                setFilters((value) => ({ ...value, createdTo: createdTo || undefined }))
              }
            />
            <Field
              label="Exclude closed before (YYYY-MM-DD)"
              value={filters.excludeClosedBefore ?? ''}
              editable={!busy}
              onChangeText={(excludeClosedBefore) =>
                setFilters((value) => ({
                  ...value,
                  excludeClosedBefore: excludeClosedBefore || undefined,
                }))
              }
            />
            <Button
              label="Clear filters"
              secondary
              disabled={busy}
              onPress={() => setFilters(ReportFiltersSchema.parse({}))}
            />
          </View>
          {pending && (
            <Text accessibilityLiveRegion="polite" style={styles.text}>
              {pending}… Large photo reports can take a few minutes.
            </Text>
          )}
          <Button
            label={needsRetry ? 'Retry generation with current options' : 'Generate report'}
            disabled={busy || !config.api}
            onPress={() => {
              void generate();
            }}
          />
          {generated && (
            <View style={styles.card}>
              <Text accessibilityLiveRegion="polite" style={styles.title}>
                Revision {generated.revision} saved
              </Text>
              <Button
                label={
                  Platform.OS === 'web' ? 'Download generated report' : 'Share generated report'
                }
                disabled={busy}
                onPress={() => {
                  void download(generated);
                }}
              />
            </View>
          )}
          <Text accessibilityRole="header" style={styles.title}>
            Revision history
          </Text>
          {resource.data.history?.reports.length === 0 && (
            <Text style={styles.muted}>No saved reports yet.</Text>
          )}
          {resource.data.history?.reports.map((report) => (
            <View style={styles.card} key={report.id}>
              <Text style={styles.title}>
                Revision {report.revision} · {report.format.toUpperCase()}
              </Text>
              <Text style={styles.muted}>
                {human(report.theme)} · {new Date(report.created_at).toLocaleString()}
              </Text>
              <Button
                label={`${Platform.OS === 'web' ? 'Download' : 'Share'} revision ${report.revision}`}
                secondary
                disabled={busy}
                onPress={() => {
                  void download(report);
                }}
              />
              <Button
                label={`Regenerate revision ${report.revision} options`}
                secondary
                disabled={busy}
                onPress={() => {
                  void generate(report);
                }}
              />
            </View>
          ))}
          {resource.data.history && (
            <View style={styles.row}>
              <Button
                label="Previous history page"
                secondary
                disabled={busy || page <= 1}
                onPress={() => setPage((value) => value - 1)}
              />
              <Text style={styles.text}>
                Page {page} of {resource.data.history.pages}
              </Text>
              <Button
                label="Next history page"
                secondary
                disabled={busy || page >= resource.data.history.pages}
                onPress={() => setPage((value) => value + 1)}
              />
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

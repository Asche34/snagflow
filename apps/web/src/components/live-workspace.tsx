'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { useLiveUpdates, type LiveFilter, type LiveEvent } from '@/lib/use-live-updates';

export function LiveWorkspace({ projectIds, userId }: { projectIds: string[]; userId: string }) {
  const pathname = usePathname();
  // A new route owns a new subscription; old channels and notices are discarded.
  return (
    <RouteUpdates key={pathname} pathname={pathname} projectIds={projectIds} userId={userId} />
  );
}

function RouteUpdates({
  pathname,
  projectIds,
  userId,
}: {
  pathname: string;
  projectIds: string[];
  userId: string;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState('');
  const deferred = useRef(false);
  const snagId = pathname.match(/^\/snags\/([\da-f-]{36})(?:\/|$)/)?.[1];
  const projectId = pathname.match(/^\/projects\/([\da-f-]{36})(?:\/|$)/)?.[1];
  const filters: LiveFilter[] = snagId
    ? [{ table: 'snags', filter: `id=eq.${snagId}` }]
    : (projectId ? [projectId] : projectIds).map((id) => ({
        table: 'snags',
        filter: `project_id=eq.${id}`,
      }));
  if (snagId)
    filters.push(
      ...['comments', 'snag_photos'].map((table) => ({ table, filter: `snag_id=eq.${snagId}` })),
    );
  async function describeUpdate(event: LiveEvent) {
    const row = event.new as Record<string, unknown>;
    let actor = row.author_id ?? row.uploaded_by;
    if (!actor && event.table === 'snags' && typeof row.id === 'string') {
      const result = await createClient()
        .from('activity_log')
        .select('actor_id')
        .eq('snag_id', row.id)
        .gte('created_at', String(row.updated_at))
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      actor =
        result.data?.actor_id ?? (row.created_at === row.updated_at ? row.created_by : undefined);
    }
    if (actor === userId) return;
    if (typeof actor === 'string') {
      const result = await createClient()
        .from('profiles')
        .select('full_name')
        .eq('id', actor)
        .maybeSingle();
      setNotice(`Updated by ${result.data?.full_name || 'a project teammate'}`);
    } else setNotice('Project updated');
  }
  const status = useLiveUpdates(filters, (event) => {
    // Keep confirmations and ambiguous-response recovery available. Replacing
    // a deleted detail under its open dialog would remove its recovery link.
    if (hasOpenDialog()) {
      deferred.current = true;
      return;
    }
    router.refresh();
    if (event) void describeUpdate(event);
  });
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (deferred.current && !hasOpenDialog()) {
        deferred.current = false;
        router.refresh();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [router]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timeout);
  }, [notice]);
  return (
    <>
      <span className="sr-only" role="status">
        {status}
      </span>
      {status !== 'Live updates connected' && (
        <p
          className="fixed bottom-24 right-4 z-30 max-w-[calc(100%-2rem)] rounded-lg border bg-card px-3 py-2 text-xs shadow-sm lg:bottom-4"
          role="status"
        >
          {status}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="fixed bottom-36 right-4 z-30 max-w-[calc(100%-2rem)] rounded-lg border bg-card px-4 py-3 text-sm shadow-md lg:bottom-16"
        >
          {notice}
        </p>
      )}
    </>
  );
}

function hasOpenDialog() {
  return Array.from(document.querySelectorAll('[role="dialog"]')).some(
    (dialog) => dialog.getClientRects().length > 0,
  );
}

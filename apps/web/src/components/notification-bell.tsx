'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import type { Database } from '@snagflow/shared';
import { createClient } from '@/lib/supabase/browser';
import { useLiveUpdates } from '@/lib/use-live-updates';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';

type Notification = Database['public']['Tables']['notifications']['Row'];
const labels: Record<string, string> = {
  assigned: 'Assigned to you',
  review_requested: 'Ready for review',
  approved: 'Approved',
  rejected: 'Changes requested',
  reopened: 'Reopened',
  comment: 'New comment',
};

export function NotificationBell({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Notification[]>([]);
  const [unread, setUnread] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [readError, setReadError] = useState('');
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const busy = useRef(false);
  const load = useCallback(async () => {
    const request = ++generation.current;
    try {
      const supabase = createClient();
      const [recent, count] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .order('id')
          .limit(30),
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .is('read_at', null),
      ]);
      if (!mounted.current || request !== generation.current) return;
      if (recent.error || count.error) throw new Error('read');
      setRows(recent.data ?? []);
      setUnread(count.count ?? 0);
      setReadError('');
      // A background read must not erase a failed write message.
    } catch {
      if (mounted.current && request === generation.current)
        setReadError('Notifications could not be refreshed. Check your connection and retry.');
    }
  }, [userId]);
  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => {
      mounted.current = false;
      clearTimeout(timer);
    };
  }, [load]);
  useLiveUpdates([{ table: 'notifications', filter: `user_id=eq.${userId}` }], () => {
    void load();
  });
  async function markRead(id?: string) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      let query = createClient()
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null);
      if (id) query = query.eq('id', id);
      const result = await query;
      if (result.error) throw new Error('write');
      await load();
    } catch {
      setError('Read status could not be saved. Check your connection and retry.');
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) void load();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="relative size-11 shrink-0 p-0"
          aria-label={`Notifications, ${unread === null ? 'loading' : `${unread} unread`}`}
        >
          <Bell className="size-5" aria-hidden />
          {unread !== null && unread > 0 && (
            <span
              aria-hidden
              className="absolute right-0 top-0 rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Notifications</DialogTitle>
          <DialogDescription>
            {unread === null ? 'Loading updates…' : `${unread} unread · Latest 30 updates`}
          </DialogDescription>
        </DialogHeader>
        {(error || readError) && (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-destructive">
              {error || readError}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setError('');
                void load();
              }}
            >
              Retry notifications
            </Button>
          </div>
        )}
        <Button
          variant="outline"
          disabled={pending || unread === null}
          onClick={() => {
            void markRead();
          }}
        >
          {pending ? 'Saving…' : 'Mark all read'}
        </Button>
        {unread !== null && rows.length === 0 && !error && !readError && (
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        )}
        <ul className="space-y-3">
          {rows.map((row) => {
            const payload =
              row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
                ? row.payload
                : {};
            return (
              <li
                key={row.id}
                className={`min-w-0 space-y-2 rounded-lg border p-3 ${row.read_at ? '' : 'bg-secondary/40'}`}
              >
                <p className="text-sm font-medium">
                  {labels[row.type] ?? 'Project update'}
                  {!row.read_at && <span className="ml-2 text-xs text-primary">Unread</span>}
                </p>
                {typeof payload.snippet === 'string' && (
                  <p className="break-words text-sm [overflow-wrap:anywhere]">{payload.snippet}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString()}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {row.snag_id && (
                    <Link
                      className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline"
                      href={`/snags/${row.snag_id}`}
                      onClick={() => setOpen(false)}
                    >
                      Open snag
                    </Link>
                  )}
                  {!row.read_at && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        void markRead(row.id);
                      }}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

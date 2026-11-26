import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api.js';
import { useApiQuery } from '../lib/queryClient.js';
import { supabase } from '../lib/supabaseClient.js';

// Scheduled deadline reminders become visible over time, so poll once a minute.
const POLL_MS = 60_000;

function timeLabel(value) {
  const date = new Date(value);
  const elapsed = Date.now() - date.getTime();
  if (elapsed >= 0 && elapsed < 60 * 60 * 1000) return `${Math.max(1, Math.floor(elapsed / 60000))} min ago`;
  if (elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function NotificationCenter({ profileId }) {
  const queryClient = useQueryClient();
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState('');

  const countQuery = useApiQuery(['notifications', 'unread-count'], '/notifications/unread-count', {}, { refetchInterval: POLL_MS });
  const listQuery = useApiQuery(
    ['notifications', 'list'],
    '/notifications',
    { page, pageSize: 10, filter: 'all' },
    { enabled: open, refetchInterval: open ? POLL_MS : false },
  );
  const items = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta ?? { page: 1, pageSize: 10, total: 0 };
  const unread = countQuery.data?.data?.count ?? 0;
  const error = actionError || listQuery.error?.message || '';
  const refreshAll = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });

  // Realtime: any change to this user's notifications refreshes the count and list.
  useEffect(() => {
    const channel = supabase.channel(`notifications-${profileId}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profileId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profileId, queryClient]);

  useEffect(() => {
    if (!open) return undefined;
    const dismiss = (event) => { if (panelRef.current && !panelRef.current.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', onKey); };
  }, [open]);

  async function markRead(notification) {
    if (notification.read_at) return;
    setActionError('');
    try {
      await apiFetch(`/notifications/${notification.id}/read`, { method: 'PATCH' });
      refreshAll();
    } catch (reason) { setActionError(reason.message); }
  }
  async function markAllRead() {
    setActionError('');
    try { await apiFetch('/notifications/read-all', { method: 'POST' }); refreshAll(); }
    catch (reason) { setActionError(reason.message); }
  }

  const pages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  return <div className="notification-center" ref={panelRef}>
    <button className={`notification-toggle ${open ? 'active' : ''}`} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} aria-controls="notification-panel" onClick={() => setOpen((value) => !value)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg><span>Alerts</span>{unread ? <b>{unread > 99 ? '99+' : unread}</b> : null}
    </button>
    {open ? <section className="notification-panel" id="notification-panel" aria-label="Notifications">
      <header><div><h2>Notifications</h2><span>{unread} unread</span></div><div><button className="inline-button" onClick={() => { setActionError(''); refreshAll(); }}>Refresh</button>{unread ? <button className="inline-button" onClick={markAllRead}>Mark all read</button> : null}</div></header>
      {error ? <p className="notification-error" role="alert">{error}</p> : null}
      {listQuery.isPending ? <div className="data-state" role="status">Loading alerts…</div> : !items.length ? <div className="notification-empty">You’re all caught up.</div> : <div className="notification-list">{items.map((item) => <button className={`notification-item ${item.read_at ? 'is-read' : 'is-unread'}`} key={item.id} onClick={() => markRead(item)}>
        <span className="notification-kind" aria-hidden="true">{item.kind === 'grade' ? '✓' : item.kind.includes('deadline') ? '◷' : item.kind === 'complaint' ? '!' : '•'}</span><span className="notification-copy"><strong>{item.title}</strong><span>{item.body}</span><time dateTime={item.created_at}>{timeLabel(item.available_at)}</time></span><span className="sr-only">{item.read_at ? 'Read' : 'Unread'}</span>
      </button>)}</div>}
      <footer><button className="inline-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Newer</button><span>Page {page} of {pages}</span><button className="inline-button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Older</button></footer>
    </section> : null}
  </div>;
}

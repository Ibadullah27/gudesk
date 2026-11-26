import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api.js';
import { supabase } from '../../lib/supabaseClient.js';

function byTime(messages) { return [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)); }
function messageTime(value) { return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }

/**
 * Course chat room. Unlike the rest of the app this does not use TanStack Query:
 * messages are a live Supabase Realtime stream merged with cursor-paginated history
 * and scroll position, so it owns that state locally (see docs/ASSUMPTIONS.md).
 */
export default function CourseChatDialog({ course, role, profileId, onClose }) {
  const dialog = useRef(null);
  const list = useRef(null);
  const stickToBottom = useRef(true);
  const [messages, setMessages] = useState([]);
  const [meta, setMeta] = useState({ has_more: false, before: null });
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [realtime, setRealtime] = useState('connecting');
  const canSend = role === 'teacher' || role === 'student';
  const canModerate = role === 'admin' || role === 'teacher';

  useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal(); return () => { if (dialog.current?.open) dialog.current.close(); }; }, []);

  const loadLatest = useCallback(async (replace = false) => {
    const result = await apiFetch(`/courses/${course.id}/chat`);
    setMessages((current) => replace ? result.data : byTime([...current, ...result.data].filter((message, index, all) => all.findIndex((item) => item.id === message.id) === index)));
    setMeta((current) => replace ? result.meta : {
      has_more: current.has_more || result.meta.has_more,
      before: current.has_more ? current.before : result.meta.before,
    });
  }, [course.id]);

  useEffect(() => {
    let current = true;
    setLoading(true); setError(''); stickToBottom.current = true;
    loadLatest(true).catch((reason) => { if (current) setError(reason.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [loadLatest]);

  useEffect(() => {
    let active = true; let channel; let retryTimer; let retryCount = 0; let connectionId = 0;
    const connect = () => {
      if (!active) return;
      const currentConnection = ++connectionId;
      setRealtime('connecting');
      channel = supabase.channel(`course-chat-${course.id}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `course_id=eq.${course.id}` }, (payload) => {
          if (payload.eventType === 'DELETE') setMessages((current) => current.filter((item) => item.id !== payload.old.id));
          if (payload.eventType === 'INSERT') loadLatest(false).catch((reason) => setError(reason.message));
        })
        .subscribe((status) => {
          if (!active || currentConnection !== connectionId) return;
          if (status === 'SUBSCRIBED') { retryCount = 0; setRealtime('connected'); return; }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setRealtime('reconnecting');
            clearTimeout(retryTimer);
            const delay = Math.min(1000 * (2 ** retryCount), 30000); retryCount += 1;
            retryTimer = window.setTimeout(() => { const previous = channel; channel = null; if (previous) supabase.removeChannel(previous); connect(); }, delay);
          }
        });
    };
    connect();
    return () => { active = false; clearTimeout(retryTimer); if (channel) supabase.removeChannel(channel); };
  }, [course.id, loadLatest]);

  useEffect(() => {
    if (stickToBottom.current && list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages]);

  function onScroll(event) {
    const node = event.currentTarget;
    stickToBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 70;
  }

  async function loadOlder() {
    if (!meta.has_more || !meta.before || loadingOlder) return;
    const node = list.current; const previousHeight = node?.scrollHeight ?? 0; const previousTop = node?.scrollTop ?? 0;
    setLoadingOlder(true); setError(''); stickToBottom.current = false;
    try {
      const result = await apiFetch(`/courses/${course.id}/chat?before=${encodeURIComponent(meta.before)}`);
      setMessages((current) => byTime([...result.data, ...current].filter((message, index, all) => all.findIndex((item) => item.id === message.id) === index)));
      setMeta(result.meta);
      requestAnimationFrame(() => { if (node) node.scrollTop = previousTop + (node.scrollHeight - previousHeight); });
    } catch (reason) { setError(reason.message); }
    finally { setLoadingOlder(false); }
  }

  async function send(event) {
    event.preventDefault(); const cleanBody = body.trim();
    if (!cleanBody || sending) return;
    setSending(true); setError(''); stickToBottom.current = true;
    try {
      const result = await apiFetch(`/courses/${course.id}/chat`, { method: 'POST', body: JSON.stringify({ body: cleanBody }) });
      setMessages((current) => byTime([...current.filter((item) => item.id !== result.data.id), result.data]));
      setBody('');
    } catch (reason) { setError(reason.message); }
    finally { setSending(false); }
  }

  async function remove(message) {
    if (!window.confirm('Remove this message from the classroom chat?')) return;
    setError('');
    try { await apiFetch(`/chat/${message.id}`, { method: 'DELETE' }); setMessages((current) => current.filter((item) => item.id !== message.id)); }
    catch (reason) { setError(reason.message); }
  }

  return <dialog className="roster-dialog chat-dialog" ref={dialog} onCancel={onClose}>
    <div className="roster-panel"><header className="roster-heading"><div><p className="eyebrow">{course.code} · CLASSROOM CHAT</p><h2>{course.title}</h2><p className="chat-connection"><span className={`connection-indicator ${realtime}`} />{realtime === 'connected' ? 'Live updates connected' : realtime === 'reconnecting' ? 'Connection lost · reconnecting' : 'Connecting to live chat…'}</p></div><button className="dialog-close" aria-label="Close classroom chat" onClick={onClose}>×</button></header>
      {error ? <div className="form-alert" role="alert">{error}</div> : null}
      {meta.has_more ? <button className="secondary-button chat-load-older" disabled={loadingOlder || loading} onClick={loadOlder}>{loadingOlder ? 'Loading older messages…' : 'Load older messages'}</button> : null}
      <div className="chat-message-list" ref={list} onScroll={onScroll} role="log" aria-label={`${course.title} chat messages`} aria-live="polite" aria-relevant="additions text">
        {loading ? <div className="data-state" role="status">Loading chat…</div> : !messages.length ? <div className="empty-state"><h3>Start the conversation</h3><p>Messages shared with this course will appear here.</p></div> : messages.map((message) => <article className={`chat-message ${message.sender_id === profileId ? 'own-message' : ''}`} key={message.id}>
          <div className="chat-message-heading"><strong>{message.sender_name}{message.sender_id === profileId ? ' · You' : ''}</strong><time dateTime={message.created_at}>{messageTime(message.created_at)}</time>{canModerate ? <button className="inline-button remove-student" aria-label={`Delete message from ${message.sender_name}`} onClick={() => remove(message)}>Delete</button> : null}</div>
          <p>{message.body}</p>
        </article>)}
      </div>
      {canSend ? <form className="chat-compose" onSubmit={send}><label htmlFor="chat-message">Message <span>{body.trim().length}/2000</span></label><textarea id="chat-message" rows="2" maxLength="2000" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a message to your course…" /><div><small>Messages are visible to course members.</small><button className="primary-button" disabled={sending || !body.trim()}>{sending ? 'Sending…' : 'Send message'}</button></div></form> : <p className="chat-readonly-note">Administrator view · read only</p>}
    </div>
  </dialog>;
}

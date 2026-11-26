import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api.js';
import { EMPTY_PAGE, useApiQuery } from '../../lib/queryClient.js';
import { useNoticeState } from '../../components/ToastContext.jsx';
import Pagination from './Pagination.jsx';

const blankForm = { title: '', body: '', course_id: '' };
const dateLabel = (value) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export default function AnnouncementsWorkspace({ role, compact = false }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [actionError, setError] = useState('');
  const [notice, setNotice] = useNoticeState();
  const [form, setForm] = useState(blankForm);
  const [editing, setEditing] = useState(null);
  const canPublish = role === 'admin' || role === 'teacher';
  const pageSize = compact ? 5 : 10;

  const feedQuery = useApiQuery(['announcements'], '/announcements', { page, pageSize });
  const { data: items, meta } = feedQuery.data ?? EMPTY_PAGE;
  const loading = feedQuery.isPending;
  // Teachers pick one of their own courses when posting.
  const coursesQuery = useApiQuery(['courses'], '/courses', { page: 1, pageSize: 100 }, { enabled: role === 'teacher' && !compact });
  const courses = coursesQuery.data?.data ?? [];
  const error = actionError || feedQuery.error?.message || coursesQuery.error?.message || '';
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['announcements'] });

  function resetForm() { setEditing(null); setForm(blankForm); }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const payload = { title: form.title.trim(), body: form.body.trim(), ...(role === 'teacher' ? { course_id: form.course_id } : { course_id: null }) };
      await apiFetch(editing ? `/announcements/${editing.id}` : '/announcements', {
        method: editing ? 'PATCH' : 'POST', body: JSON.stringify(editing ? { title: payload.title, body: payload.body } : payload),
      });
      setNotice(editing ? 'Announcement updated.' : 'Announcement posted.'); resetForm(); setPage(1); refresh();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  function beginEdit(item) { setEditing(item); setForm({ title: item.title, body: item.body, course_id: item.course_id ?? '' }); setError(''); setNotice(''); }
  async function remove(item) {
    if (!window.confirm(`Delete “${item.title}”?`)) return;
    setBusy(true); setError(''); setNotice('');
    try { await apiFetch(`/announcements/${item.id}`, { method: 'DELETE' }); setNotice('Announcement deleted.'); refresh(); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  return <section className={`classroom-section announcements-section ${compact ? 'announcements-compact' : ''}`} aria-labelledby={compact ? 'dashboard-announcements-heading' : 'announcements-heading'}>
    <div className="section-heading"><div><p className="eyebrow">CLASSROOM BULLETIN</p><h1 id={compact ? 'dashboard-announcements-heading' : 'announcements-heading'}>{compact ? 'Latest announcements' : 'Announcements'}</h1></div>{!compact ? <span className="count-pill">{meta.total} total</span> : null}</div>
    {error ? <div className="form-alert" role="alert">{error} <button className="inline-button" onClick={() => { setError(''); feedQuery.refetch(); }}>Retry</button></div> : null}
    {notice ? <p className="success-alert" role="status">{notice}</p> : null}
    {canPublish && !compact ? <form className="announcement-form" onSubmit={save}>
      <div className="form-title"><h2>{editing ? 'Edit announcement' : role === 'admin' ? 'New global announcement' : 'New course announcement'}</h2>{editing ? <button type="button" className="inline-button" onClick={resetForm}>Cancel</button> : null}</div>
      <label>Title<input required minLength="2" maxLength="180" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label>Message<textarea required minLength="2" maxLength="10000" rows="4" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
      {role === 'teacher' ? <label>Course<select required value={form.course_id} onChange={(event) => setForm({ ...form, course_id: event.target.value })}><option value="">Choose a course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label> : <p className="announcement-scope-note">This message will be visible to all classroom members.</p>}
      <button className="primary-button" disabled={busy || (role === 'teacher' && !courses.length)}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Post announcement'}</button>
      {role === 'teacher' && !courses.length ? <small className="deadline-message">No courses are assigned to your account.</small> : null}
    </form> : null}
    {loading ? <div className="data-state" role="status">Loading announcements…</div> : null}
    {!loading && !items.length ? <div className="empty-state"><h2>No announcements yet</h2><p>New classroom updates will appear here.</p></div> : null}
    {!loading && items.length ? <div className="announcement-feed">{items.map((item) => <article className="announcement-card" key={item.id}>
      <div className="announcement-card-header"><div><span className="announcement-scope">{item.scope === 'global' ? 'All classroom members' : `${item.course?.code ?? 'Course'} · ${item.course?.title ?? 'Course announcement'}`}</span><h2>{item.title}</h2></div><time dateTime={item.created_at}>{dateLabel(item.created_at)}</time></div>
      <p>{item.body}</p><div className="announcement-card-footer"><span>Posted by {item.author_name}</span>{item.can_edit && !compact ? <div><button className="inline-button" disabled={busy} onClick={() => beginEdit(item)}>Edit</button><button className="inline-button remove-student" disabled={busy} onClick={() => remove(item)}>Delete</button></div> : null}</div>
    </article>)}</div> : null}
    {!compact ? <Pagination meta={meta} page={page} setPage={setPage} /> : null}
  </section>;
}

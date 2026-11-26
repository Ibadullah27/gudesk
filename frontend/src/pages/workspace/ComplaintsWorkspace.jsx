import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api.js';
import { EMPTY_PAGE, useApiQuery } from '../../lib/queryClient.js';
import { useNoticeState } from '../../components/ToastContext.jsx';
import Pagination from './Pagination.jsx';

const categories = ['academic', 'marks', 'teacher', 'technical', 'other'];
const statuses = ['open', 'in_review', 'resolved', 'rejected'];
const emptyForm = { category: 'academic', course_id: '', subject: '', description: '' };
const labelize = (value) => value.replaceAll('_', ' ');
const dateLabel = (value) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export default function ComplaintsWorkspace({ role }) {
  const isAdmin = role === 'admin';
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setError] = useState('');
  const [notice, setNotice] = useNoticeState();
  const [form, setForm] = useState(emptyForm);

  // Admins read the whole queue; students and teachers read only their own complaints.
  const listQuery = useApiQuery(
    isAdmin ? ['complaints', 'queue'] : ['complaints', 'mine'],
    isAdmin ? '/complaints' : '/complaints/mine',
    { page, pageSize: 20, ...(isAdmin ? { status: statusFilter, category: categoryFilter } : {}) },
  );
  const { data: items, meta } = listQuery.data ?? EMPTY_PAGE;
  const loading = listQuery.isPending;
  const coursesQuery = useApiQuery(['courses'], '/courses', { page: 1, pageSize: 100 }, { enabled: !isAdmin });
  const courses = coursesQuery.data?.data ?? [];
  const error = actionError || listQuery.error?.message || coursesQuery.error?.message || '';
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['complaints'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  async function submitComplaint(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await apiFetch('/complaints', { method: 'POST', body: JSON.stringify({ ...form, course_id: form.course_id || null }) });
      setForm(emptyForm); setNotice('Your complaint was submitted to the administration team.'); setPage(1); refresh();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function updateComplaint(id, changes) {
    setBusy(true); setError(''); setNotice('');
    try {
      await apiFetch(`/complaints/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
      setNotice('Complaint status and response saved.'); refresh();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  return <section className="classroom-section complaints-workspace" aria-labelledby="complaints-heading">
    <div className="section-heading"><div><p className="eyebrow">{isAdmin ? 'ADMIN REVIEW QUEUE' : 'PRIVATE SUPPORT CHANNEL'}</p><h1 id="complaints-heading">Complaints</h1></div><span className="count-pill">{meta.total} total</span></div>
    {error ? <div className="form-alert" role="alert">{error} <button className="inline-button" onClick={() => { setError(''); listQuery.refetch(); }}>Retry</button></div> : null}
    {notice ? <p className="success-alert" role="status">{notice}</p> : null}
    {!isAdmin ? <form className="complaint-form" onSubmit={submitComplaint}>
      <div className="form-title"><h2>New complaint</h2><span className="helper-tag">Private to you and administrators</span></div>
      <div className="assignment-form-row"><label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category} value={category}>{labelize(category)}</option>)}</select></label><label>Course <span className="optional-label">Optional</span><select value={form.course_id} onChange={(event) => setForm({ ...form, course_id: event.target.value })}><option value="">General complaint</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label></div>
      <label>Subject<input required minLength="1" maxLength="150" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></label>
      <label>Description<textarea required minLength="1" maxLength="3000" rows="4" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      <button className="primary-button" disabled={busy}>{busy ? 'Submitting…' : 'Submit complaint'}</button>
    </form> : <div className="complaint-filters"><label>Status<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}</select></label><label>Category<select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }}><option value="">All categories</option>{categories.map((category) => <option key={category} value={category}>{labelize(category)}</option>)}</select></label></div>}
    {loading ? <div className="data-state" role="status">Loading complaints…</div> : null}
    {!loading && !items.length ? <div className="empty-state"><h2>{isAdmin ? 'Queue is clear' : 'No complaints submitted'}</h2><p>{isAdmin ? 'Complaints requiring review will appear here.' : 'Your submitted complaints and responses will appear here.'}</p></div> : null}
    {!loading && items.length ? <div className="complaint-list">{items.map((item) => <article className="complaint-card" key={item.id}>
      <header><div><div className="complaint-card-tags"><span className={`status-tag status-${item.status}`}>{labelize(item.status)}</span><span className="complaint-category">{labelize(item.category)}</span>{item.course ? <span className="complaint-category">{item.course.code}</span> : null}</div><h2>{item.subject}</h2></div><time dateTime={item.created_at}>{dateLabel(item.created_at)}</time></header>
      {isAdmin ? <p className="complaint-author">From {item.complainant?.full_name ?? 'Account unavailable'}{item.complainant?.roll_no ? ` · ${item.complainant.roll_no}` : ''} · {item.complainant?.role ?? 'user'}</p> : null}
      <p className="complaint-description">{item.description}</p>
      {isAdmin ? <ComplaintReviewForm complaint={item} disabled={busy} onSave={updateComplaint} /> : item.admin_response ? <div className="complaint-response"><strong>Administration response</strong><p>{item.admin_response}</p>{item.resolver?.full_name ? <small>Responded by {item.resolver.full_name}</small> : null}</div> : <p className="complaint-pending-response">The administration team has not responded yet.</p>}
      {!isAdmin && item.updated_at !== item.created_at ? <small className="complaint-updated">Updated {dateLabel(item.updated_at)}</small> : null}
    </article>)}</div> : null}
    <Pagination meta={meta} page={page} setPage={setPage} />
  </section>;
}

function ComplaintReviewForm({ complaint, disabled, onSave }) {
  const [status, setStatus] = useState(complaint.status);
  const [response, setResponse] = useState(complaint.admin_response ?? '');
  useEffect(() => { setStatus(complaint.status); setResponse(complaint.admin_response ?? ''); }, [complaint.status, complaint.admin_response]);
  return <form className="complaint-review-form" onSubmit={(event) => { event.preventDefault(); onSave(complaint.id, { status, admin_response: response.trim() || null }); }}>
    <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((option) => <option key={option} value={option}>{labelize(option)}</option>)}</select></label>
    <label>Response{['resolved', 'rejected'].includes(status) ? <span className="required-hint">Required to close</span> : null}<textarea rows="3" maxLength="5000" required={['resolved', 'rejected'].includes(status)} value={response} onChange={(event) => setResponse(event.target.value)} /></label>
    <button className="secondary-button" disabled={disabled || (status === complaint.status && response === (complaint.admin_response ?? ''))}>Save response</button>
  </form>;
}

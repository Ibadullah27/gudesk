import { useEffect, useRef, useState } from 'react';
import { useApiQuery } from '../../lib/queryClient.js';
import { env } from '../../config/env.js';
import { supabase } from '../../lib/supabaseClient.js';
import Pagination from './Pagination.jsx';

export default function CourseGradebookDialog({ course, onClose }) {
  const dialog = useRef(null);
  const [page, setPage] = useState(1);
  const gradebookQuery = useApiQuery(['courses', course.id, 'gradebook'], `/courses/${course.id}/gradebook`, { page, pageSize: 20 });
  const gradebook = gradebookQuery.data ?? { assessments: [], data: [], meta: { page: 1, pageSize: 20, total: 0 } };
  const loading = gradebookQuery.isPending;
  const [actionError, setError] = useState('');
  const error = actionError || gradebookQuery.error?.message || '';
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal(); return () => { if (dialog.current?.open) dialog.current.close(); }; }, []);
  async function exportCsv() {
    setBusy(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${env.VITE_API_URL}/courses/${course.id}/gradebook.csv?page=${page}&pageSize=20`, { headers: { Authorization: `Bearer ${session?.access_token}` } });
      if (!response.ok) { const payload = await response.json(); throw new Error(payload.error?.message || 'CSV export failed.'); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `${course.code.toLowerCase()}-gradebook-page-${page}.csv`; anchor.click(); URL.revokeObjectURL(url);
    } catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }
  const { data: rows, assessments, meta } = gradebook;
  return <dialog className="roster-dialog gradebook-dialog" ref={dialog} onCancel={onClose}>
    <div className="roster-panel"><header className="roster-heading"><div><p className="eyebrow">ASSESSMENT RECORDS</p><h2>{course.title} gradebook</h2><p>{course.code} · {meta.total} enrolled students</p></div><button className="dialog-close" aria-label="Close gradebook" onClick={onClose}>×</button></header>
      <div className="gradebook-toolbar"><p>Pending work is excluded from course percentages until it is graded.</p><button className="secondary-button" disabled={busy || loading || !rows.length} onClick={exportCsv}>Export this page as CSV</button></div>
      {error ? <p className="form-alert" role="alert">{error}</p> : null}
      {loading ? <div className="data-state" role="status">Loading gradebook…</div> : !rows.length ? <div className="empty-state"><h3>No enrolled students</h3><p>Enroll students in this course to populate the gradebook.</p></div> : <div className="gradebook-list">{rows.map(({ student, grades, summary }) => <article className="gradebook-student" key={student.id}>
        <header><div><h3>{student.full_name}</h3><small>{student.roll_no || student.email}</small></div><span className="gradebook-summary">{summary.percentage == null ? 'No graded work' : `${summary.percentage}%`}<small>{summary.obtained} / {summary.possible} · {summary.graded_count} graded</small></span></header>
        {assessments.length ? <div className="gradebook-items">{grades.map((grade) => <div className="gradebook-item" key={`${grade.kind}-${grade.id}`}><div><strong>{grade.title}</strong><small>{grade.kind} {grade.feedback ? `· ${grade.feedback}` : ''}</small></div><span className={`status-tag ${grade.status === 'graded' ? 'is-active' : ''}`}>{grade.status === 'graded' ? `${grade.obtained} / ${grade.total}` : grade.status.replaceAll('_', ' ')}</span></div>)}</div> : <p className="empty-state">No assessments in this course yet.</p>}
      </article>)}</div>}
      <Pagination meta={meta} page={page} setPage={setPage} />
    </div>
  </dialog>;
}

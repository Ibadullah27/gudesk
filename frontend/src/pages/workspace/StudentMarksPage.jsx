import { useState } from 'react';
import { EMPTY_PAGE, useApiQuery } from '../../lib/queryClient.js';
import Pagination from './Pagination.jsx';

export default function StudentMarksPage() {
  const [page, setPage] = useState(1);
  const marksQuery = useApiQuery(['me', 'marks'], '/me/marks', { page, pageSize: 20 });
  const result = marksQuery.data ?? EMPTY_PAGE;
  const loading = marksQuery.isPending;
  const error = marksQuery.error?.message ?? '';
  const refresh = () => marksQuery.refetch();

  return <section className="classroom-section" aria-labelledby="marks-heading">
    <div className="section-heading"><div><p className="eyebrow">YOUR ACADEMIC RECORD</p><h1 id="marks-heading">Marks</h1></div><button className="secondary-button" disabled={marksQuery.isFetching} onClick={refresh}>{marksQuery.isFetching && !loading ? 'Refreshing…' : 'Refresh'}</button></div>
    <p className="marks-explainer">Course percentages use graded assessments only. Pending or unfinished work is shown separately and does not count as zero.</p>
    {error ? <div className="form-alert" role="alert">{error} <button className="inline-button" onClick={refresh}>Retry</button></div> : null}
    {loading ? <div className="data-state" role="status">Loading marks…</div> : null}
    {!loading && !error && !result.data.length ? <div className="empty-state"><h2>No course marks yet</h2><p>Your enrolled courses and graded work will appear here.</p></div> : null}
    {!loading && !error ? <div className="marks-course-list">{result.data.map((course) => <article className="marks-course-card" key={course.id}>
      <header><div><span className="course-code">{course.code}</span><h2>{course.title}</h2></div><strong className="marks-course-total">{course.summary.percentage == null ? '—' : `${course.summary.percentage}%`}<small>{course.summary.percentage == null ? 'No graded work' : `${course.summary.obtained} / ${course.summary.possible} points`}</small></strong></header>
      {!course.items.length ? <p className="empty-state">No assignments or published quizzes in this course.</p> : <div className="student-marks-list">{course.items.map((item) => <article className="student-mark-row" key={`${item.kind}-${item.id}`}><div><strong>{item.title}</strong><small>{item.kind}{item.graded_at ? ` · ${new Date(item.graded_at).toLocaleDateString()}` : ''}{item.is_late ? ' · submitted late' : ''}</small>{item.feedback ? <p>{item.feedback}</p> : null}</div><span className={`status-tag ${item.status === 'graded' ? 'is-active' : ''}`}>{item.status === 'graded' ? `${item.obtained} / ${item.total}` : item.status.replaceAll('_', ' ')}</span></article>)}</div>}
    </article>)}</div> : null}
    <Pagination meta={result.meta} page={page} setPage={setPage} />
  </section>;
}

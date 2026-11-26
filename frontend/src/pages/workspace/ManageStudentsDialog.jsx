import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api.js';
import { EMPTY_PAGE, useApiQuery } from '../../lib/queryClient.js';
import { useNoticeState } from '../../components/ToastContext.jsx';
import Pagination from './Pagination.jsx';

export default function ManageStudentsDialog({ course, onClose }) {
  const dialogRef = useRef(null);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [csv, setCsv] = useState('roll_no\n');
  const [bulkResult, setBulkResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setError] = useState('');
  const [notice, setNotice] = useNoticeState();
  const studentsQuery = useApiQuery(['courses', course.id, 'students'], `/courses/${course.id}/students`, { page, pageSize: 20, search: searchTerm });
  const { data: students, meta } = studentsQuery.data ?? EMPTY_PAGE;
  const loading = studentsQuery.isPending;
  const error = actionError || studentsQuery.error?.message || '';
  // Roster changes also change course access, gradebooks, and dashboard counts.
  const reloadRoster = () => {
    queryClient.invalidateQueries({ queryKey: ['courses', course.id] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open) dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  function runSearch(event) {
    event.preventDefault(); setPage(1); setSearchTerm(search.trim());
  }

  function toggle(student) {
    if (!student.is_active && !student.enrolled) return;
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(student.id)) next.delete(student.id); else next.add(student.id);
      return next;
    });
  }

  async function saveSelection() {
    if (!selected.size) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await apiFetch(`/courses/${course.id}/enroll`, {
        method: 'POST', body: JSON.stringify({ student_ids: [...selected] }),
      });
      setNotice(`${result.data.enrolled} student(s) enrolled; ${result.data.already_enrolled} were already enrolled.`);
      setSelected(new Set()); reloadRoster();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function remove(student) {
    setBusy(true); setError(''); setNotice('');
    try {
      await apiFetch(`/courses/${course.id}/enroll/${student.id}`, { method: 'DELETE' });
      setNotice(`${student.full_name} was removed from the course. Previous submissions and marks are retained.`);
      reloadRoster();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function importRollNumbers(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice(''); setBulkResult(null);
    try {
      const result = await apiFetch(`/courses/${course.id}/enroll/bulk`, {
        method: 'POST', body: JSON.stringify({ csv }),
      });
      setBulkResult(result.data);
      setNotice(`${result.data.enrolled} student(s) enrolled; ${result.data.already_enrolled} were already enrolled.`);
      reloadRoster();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  return (
    <dialog className="roster-dialog" ref={dialogRef} onClose={onClose} aria-labelledby="roster-title">
      <div className="roster-panel">
        <header className="roster-heading"><div><p className="eyebrow">{course.code} · CLASS ROSTER</p><h2 id="roster-title">Manage students</h2><p>{course.title}</p></div><button className="dialog-close" type="button" onClick={onClose} aria-label="Close student manager">×</button></header>
        {error ? <p className="form-alert" role="alert">{error} <button className="inline-button" onClick={() => { setError(''); studentsQuery.refetch(); }}>Retry</button></p> : null}
        {notice ? <p className="success-alert" role="status">{notice}</p> : null}
        <div className="roster-tools">
          <form className="search-bar" role="search" onSubmit={runSearch}><label className="sr-only" htmlFor="student-roster-search">Search students by name or roll number</label><input id="student-roster-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find by name or roll number" /><button className="secondary-button">Search</button></form>
          <span className="count-pill">{meta.total} students</span>
        </div>
        {selected.size ? <div className="selection-bar"><span>{selected.size} selected</span><button className="primary-button" type="button" disabled={busy} onClick={saveSelection}>{busy ? 'Saving…' : 'Enroll selected'}</button></div> : null}
        {loading ? <div className="data-state" role="status">Loading student list…</div> : null}
        {!loading && !error && !students.length ? <div className="empty-state"><h3>No students found</h3><p>Try a different name or roll number.</p></div> : null}
        {!loading && students.length ? <div className="roster-list">{students.map((student) => <div className="roster-student" key={student.id}>
          {!student.enrolled ? <input type="checkbox" aria-label={`Select ${student.full_name}`} checked={selected.has(student.id)} disabled={!student.is_active || busy} onChange={() => toggle(student)} /> : <span className="roster-check" aria-hidden="true">✓</span>}
          <div className="roster-student-info"><strong>{student.full_name}</strong><span>{student.roll_no || 'No roll number'}{!student.is_active ? ' · Inactive account' : ''}</span></div>
          {student.enrolled ? <><span className="status-tag is-active">Enrolled</span><button className="inline-button remove-student" disabled={busy} onClick={() => remove(student)}>Remove</button></> : <span className="status-tag">Not enrolled</span>}
        </div>)}</div> : null}
        <Pagination meta={meta} page={page} setPage={setPage} />
        <form className="bulk-enroll-form" onSubmit={importRollNumbers}>
          <div><h3>Import by roll number</h3><p>Paste one roll number per line, or a CSV with a <code>roll_no</code> column.</p></div>
          <label className="sr-only" htmlFor="roll-number-csv">Roll numbers CSV</label><textarea id="roll-number-csv" rows="3" value={csv} onChange={(event) => setCsv(event.target.value)} />
          <button className="secondary-button" disabled={busy}>Import roll numbers</button>
          {bulkResult?.unknown_roll_numbers?.length ? <p className="form-alert" role="status">Not found or inactive: {bulkResult.unknown_roll_numbers.join(', ')}</p> : null}
        </form>
      </div>
    </dialog>
  );
}

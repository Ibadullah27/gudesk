import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api.js';
import { EMPTY_PAGE, useApiQuery } from '../../lib/queryClient.js';
import { useNoticeState } from '../../components/ToastContext.jsx';
import { ACCEPTED_UPLOAD_FILES, getUploadMimeType, uploadToSignedUrl, validateUploadFile } from '../../lib/fileUploads.js';
import { supabase } from '../../lib/supabaseClient.js';
import Pagination from './Pagination.jsx';

const emptyForm = { title: '', description: '', total_marks: '100', due_at: '', allow_late: false };

function toLocalDateTime(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function displayDate(value) {
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function fileSize(bytes) {
  const size = Number(bytes) || 0;
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CourseAssignmentsDialog({ course, role, onClose }) {
  const dialogRef = useRef(null);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [actionError, setError] = useState('');
  const [notice, setNotice] = useNoticeState();
  const [progress, setProgress] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [attachment, setAttachment] = useState(null);
  const [submissionsFor, setSubmissionsFor] = useState(null);
  const [submissionPage, setSubmissionPage] = useState(1);
  const [studentAssignment, setStudentAssignment] = useState(null);
  const [mySubmission, setMySubmission] = useState(null);
  const [submissionFile, setSubmissionFile] = useState(null);
  const [textAnswer, setTextAnswer] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open) dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  const assignmentsQuery = useApiQuery(['courses', course.id, 'assignments', role], `/courses/${course.id}/assignments`, { page, pageSize: 20 });
  const { data: assignments, meta } = assignmentsQuery.data ?? EMPTY_PAGE;
  const loading = assignmentsQuery.isPending;
  // Teachers only: the roster for the assignment whose submissions are open.
  const submissionsQuery = useApiQuery(
    ['assignments', submissionsFor?.id, 'submissions'],
    `/assignments/${submissionsFor?.id}/submissions`,
    { page: submissionPage, pageSize: 20 },
    { enabled: role === 'teacher' && Boolean(submissionsFor) },
  );
  const submissionData = submissionsQuery.data ?? EMPTY_PAGE;
  const submissionsLoading = submissionsQuery.isPending;
  const error = actionError || assignmentsQuery.error?.message || submissionsQuery.error?.message || '';
  // Coursework changes ripple into the gradebook, student marks, and dashboards.
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['courses', course.id] });
    queryClient.invalidateQueries({ queryKey: ['assignments'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['me', 'marks'] });
  };

  async function uploadAssignmentAttachment(assignmentId, file) {
    const mimeType = getUploadMimeType(file);
    const grant = await apiFetch(`/assignments/${assignmentId}/attachment/upload-url`, {
      method: 'POST', body: JSON.stringify({ file_name: file.name, mime_type: mimeType, size_bytes: file.size }),
    });
    const { data: { session } } = await supabase.auth.getSession();
    await uploadToSignedUrl(grant.data.signed_url, file, mimeType, session?.access_token, setProgress);
    await apiFetch(`/assignments/${assignmentId}`, { method: 'PATCH', body: JSON.stringify({ attachment_path: grant.data.file_path }) });
  }

  async function saveAssignment(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice(''); setProgress(null);
    let savedAssignment;
    try {
      const payload = {
        title: form.title.trim(), description: form.description.trim() || null,
        total_marks: Number(form.total_marks), due_at: new Date(form.due_at).toISOString(), allow_late: form.allow_late,
      };
      if (editing) {
        const result = await apiFetch(`/assignments/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        savedAssignment = result.data;
      } else {
        const result = await apiFetch(`/courses/${course.id}/assignments`, { method: 'POST', body: JSON.stringify(payload) });
        savedAssignment = result.data;
      }
      if (attachment) await uploadAssignmentAttachment(savedAssignment.id, attachment);
      setNotice(`${editing ? 'Assignment updated' : 'Assignment created'}${attachment ? ' with attachment' : ''}.`);
      setShowForm(false); setEditing(null); setForm(emptyForm); setAttachment(null); setProgress(null);
      refresh();
    } catch (reason) {
      setError(reason.message);
      if (savedAssignment) {
        setNotice('The assignment was saved, but its attachment did not finish. Edit it to retry the attachment upload.');
        setShowForm(false); setEditing(null); setForm(emptyForm); setAttachment(null); refresh();
      }
    } finally { setBusy(false); }
  }

  function beginEdit(assignment) {
    setError(''); setNotice(''); setEditing(assignment);
    setForm({ title: assignment.title, description: assignment.description || '', total_marks: String(assignment.total_marks), due_at: toLocalDateTime(assignment.due_at), allow_late: assignment.allow_late });
    setAttachment(null); setShowForm(true);
  }

  async function removeAssignment(assignment) {
    setError(''); setNotice('');
    try {
      await apiFetch(`/assignments/${assignment.id}`, { method: 'DELETE' });
      setNotice('Assignment deleted.'); refresh();
    } catch (reason) {
      if (reason.code === 'CONFIRM_DELETE') {
        const count = reason.details.find((detail) => detail.field === 'submission_count')?.count;
        if (!window.confirm(`This assignment has ${count ?? 'existing'} submission(s). Delete the assignment and all submissions?`)) return;
        try {
          await apiFetch(`/assignments/${assignment.id}?confirm=true`, { method: 'DELETE' });
          setNotice('Assignment and its submissions deleted.'); refresh();
        } catch (confirmedError) { setError(confirmedError.message); }
      } else setError(reason.message);
    }
  }

  async function openStudentSubmission(assignment) {
    setError(''); setNotice(''); setStudentAssignment(assignment); setSubmissionFile(null); setMySubmission(null); setTextAnswer('');
    try {
      const result = await apiFetch(`/assignments/${assignment.id}/my-submission`);
      setMySubmission(result.data);
      setTextAnswer(result.data?.text_answer || '');
    } catch (reason) { setError(reason.message); }
  }

  async function submitWork(event) {
    event.preventDefault();
    const submissionForm = event.currentTarget.closest('form');
    const fileError = validateUploadFile(submissionFile);
    if (fileError) { setError(fileError); return; }
    const assignment = studentAssignment;
    setBusy(true); setError(''); setNotice(''); setProgress(0);
    try {
      const mimeType = getUploadMimeType(submissionFile);
      const grant = await apiFetch(`/assignments/${assignment.id}/submission/upload-url`, {
        method: 'POST', body: JSON.stringify({ file_name: submissionFile.name, mime_type: mimeType, size_bytes: submissionFile.size }),
      });
      const { data: { session } } = await supabase.auth.getSession();
      await uploadToSignedUrl(grant.data.signed_url, submissionFile, mimeType, session?.access_token, setProgress);
      const result = await apiFetch(`/assignments/${assignment.id}/submit`, {
        method: 'POST', body: JSON.stringify({ file_path: grant.data.file_path, text_answer: textAnswer.trim() || null }),
      });
      setMySubmission(result.data); setSubmissionFile(null); setProgress(null);
      const fileInput = submissionForm?.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
      setNotice(result.data.is_late ? 'Submission received after the deadline.' : 'Your work was submitted on time.');
      refresh();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function downloadAssignment(assignment) {
    setBusy(true); setError('');
    try {
      const result = await apiFetch(`/assignments/${assignment.id}/attachment/download`);
      window.location.assign(result.data.signed_url);
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function downloadSubmission(submission) {
    setBusy(true); setError('');
    try {
      const result = await apiFetch(`/submissions/${submission.id}/download`);
      window.location.assign(result.data.signed_url);
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function gradeSubmission(submissionId, marks, feedback) {
    setBusy(true); setError(''); setNotice('');
    try {
      await apiFetch(`/submissions/${submissionId}/grade`, { method: 'PATCH', body: JSON.stringify({ marks_obtained: Number(marks), feedback: feedback.trim() || null }) });
      setNotice('Grade saved.'); refresh();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  function closeForm() {
    setShowForm(false); setEditing(null); setForm(emptyForm); setAttachment(null); setProgress(null);
  }

  return (
    <dialog className="roster-dialog assignment-dialog" ref={dialogRef} onClose={onClose} aria-labelledby="assignments-title">
      <div className="roster-panel">
        <header className="roster-heading"><div><p className="eyebrow">{course.code} · COURSEWORK</p><h2 id="assignments-title">Assignments</h2><p>{course.title}</p></div><button className="dialog-close" type="button" onClick={onClose} aria-label="Close assignments">×</button></header>
        {error ? <p className="form-alert" role="alert">{error}</p> : null}
        {notice ? <p className="success-alert" role="status">{notice}</p> : null}
        {role === 'teacher' && !showForm ? <button className="primary-button assignment-create-button" onClick={() => { setShowForm(true); setEditing(null); setForm(emptyForm); }}>Create assignment</button> : null}
        {role === 'teacher' && showForm ? <form className="assignment-form" onSubmit={saveAssignment}>
          <div className="form-title"><h3>{editing ? 'Edit assignment' : 'New assignment'}</h3><button type="button" className="inline-button" onClick={closeForm}>Cancel</button></div>
          <label>Title<input required minLength="2" maxLength="160" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
          <label>Description <span className="optional-label">Optional</span><textarea rows="3" maxLength="5000" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <div className="assignment-form-row"><label>Total marks<input type="number" min="0.01" max="9999.99" step="0.01" required value={form.total_marks} onChange={(event) => setForm({ ...form, total_marks: event.target.value })} /></label><label>Due date and time<input type="datetime-local" required value={form.due_at} onChange={(event) => setForm({ ...form, due_at: event.target.value })} /></label></div>
          <label className="checkbox-label"><input type="checkbox" checked={form.allow_late} onChange={(event) => setForm({ ...form, allow_late: event.target.checked })} /> Accept late submissions</label>
          <label>Attachment <span className="optional-label">Optional · max 20 MB</span><input type="file" accept={ACCEPTED_UPLOAD_FILES} onChange={(event) => { const selected = event.target.files?.[0]; const message = selected ? validateUploadFile(selected) : ''; if (message) { setError(message); event.target.value = ''; setAttachment(null); } else setAttachment(selected || null); }} /></label>
          {attachment ? <small className="selected-file">{attachment.name} · {fileSize(attachment.size)}</small> : null}
          {progress !== null ? <div className="upload-progress" role="status"><span>Uploading</span><progress max="100" value={progress}>{progress}%</progress><strong>{progress}%</strong></div> : null}
          <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create assignment'}</button>
        </form> : null}
        <div className="assignment-list-heading"><h3>Course assignments</h3><span className="count-pill">{meta.total} total</span></div>
        {loading ? <div className="data-state" role="status">Loading assignments…</div> : null}
        {!loading && !error && assignments.length === 0 ? <div className="empty-state"><h3>No assignments yet</h3><p>New course work will appear here.</p></div> : null}
        {!loading && assignments.length ? <div className="assignment-list">{assignments.map((assignment) => <article className="assignment-card" key={assignment.id}>
          <div className="assignment-card-heading"><div><span className="assignment-due">Due {displayDate(assignment.due_at)}</span><h3>{assignment.title}</h3></div><span className="marks-pill">{assignment.total_marks} marks</span></div>
          {assignment.description ? <p className="assignment-description">{assignment.description}</p> : null}
          <div className="assignment-card-meta"><span>{assignment.allow_late ? 'Late work accepted' : 'No late work'}</span>{assignment.has_attachment ? <button className="inline-button" disabled={busy} onClick={() => downloadAssignment(assignment)}>Download attachment</button> : null}</div>
          {role === 'teacher' ? <div className="assignment-card-actions"><button className="secondary-button" onClick={() => { setSubmissionsFor(assignment); setSubmissionPage(1); }}>View submissions</button><button className="inline-button" onClick={() => beginEdit(assignment)}>Edit</button><button className="inline-button remove-student" onClick={() => removeAssignment(assignment)}>Delete</button></div> : <>{assignment.my_submission?.marks_obtained !== null && assignment.my_submission?.marks_obtained !== undefined ? <p className="assignment-grade-result"><strong>{assignment.my_submission.marks_obtained} / {assignment.total_marks}</strong>{assignment.my_submission.feedback ? ` · ${assignment.my_submission.feedback}` : ''}</p> : assignment.my_submission ? <p className="assignment-grade-result">Grade pending</p> : null}<div className="assignment-card-actions"><span className={`status-tag ${assignment.my_submission ? 'is-active' : ''}`}>{assignment.my_submission ? assignment.my_submission.is_late ? 'Submitted late' : 'Submitted' : 'Not submitted'}</span><button className="secondary-button" onClick={() => openStudentSubmission(assignment)}>{assignment.my_submission ? 'Resubmit work' : 'Submit work'}</button></div></>}
          {role === 'teacher' && submissionsFor?.id === assignment.id ? <SubmissionRoster assignment={assignment} data={submissionData} loading={submissionsLoading} page={submissionPage} setPage={setSubmissionPage} busy={busy} onDownload={downloadSubmission} onGrade={gradeSubmission} onClose={() => setSubmissionsFor(null)} /> : null}
          {role === 'student' && studentAssignment?.id === assignment.id ? <form className="student-submission-form" onSubmit={submitWork}>
            <div className="form-title"><h4>{mySubmission ? 'Replace your submission' : 'Submit your work'}{mySubmission ? <span className="status-tag is-active">{mySubmission.is_late ? 'Late' : 'Received'}</span> : null}</h4><button type="button" className="inline-button" onClick={() => setStudentAssignment(null)}>Close</button></div>
            {mySubmission ? <p className="previous-submission">Last submitted {displayDate(mySubmission.submitted_at)}{mySubmission.file_name ? ` · ${mySubmission.file_name}` : ''}</p> : null}
            <label>Work file<input type="file" accept={ACCEPTED_UPLOAD_FILES} required onChange={(event) => { const selected = event.target.files?.[0]; const message = selected ? validateUploadFile(selected) : ''; if (message) { setError(message); event.target.value = ''; setSubmissionFile(null); } else setSubmissionFile(selected || null); }} /></label>
            <label>Notes <span className="optional-label">Optional</span><textarea rows="3" maxLength="10000" value={textAnswer} onChange={(event) => setTextAnswer(event.target.value)} /></label>
            {progress !== null ? <div className="upload-progress" role="status"><span>Uploading</span><progress max="100" value={progress}>{progress}%</progress><strong>{progress}%</strong></div> : null}
            <button className="primary-button" disabled={busy || (Date.now() > Date.parse(assignment.due_at) && !assignment.allow_late)}>{busy ? 'Submitting…' : mySubmission ? 'Upload replacement' : 'Upload and submit'}</button>
            {Date.now() > Date.parse(assignment.due_at) && !assignment.allow_late ? <small className="deadline-message">The deadline has passed. Late submissions are disabled.</small> : null}
          </form> : null}
        </article>)}</div> : null}
        <Pagination meta={meta} page={page} setPage={setPage} />
      </div>
    </dialog>
  );
}

function SubmissionRoster({ assignment, data, loading, page, setPage, busy, onDownload, onGrade, onClose }) {
  return <section className="submission-roster" aria-label="Assignment submissions">
    <div className="form-title"><h4>Student submissions</h4><button className="inline-button" onClick={onClose}>Close</button></div>
    {loading ? <div className="data-state" role="status">Loading submissions…</div> : !data.data.length ? <div className="empty-state"><p>No submissions have been received for this assignment.</p></div> : <div className="submission-list">{data.data.map(({ student, submission, status }) => <article className="submission-row" key={student.id}>
      <div><strong>{student.full_name}</strong><small>{student.roll_no || 'Student'}</small></div>
      <span className={`status-tag ${status === 'submitted' ? 'is-active' : ''}`}>{status.replace('_', ' ')}</span>
      {submission ? <div className="submission-row-detail"><small>{displayDate(submission.submitted_at)}{submission.is_late ? ' · late' : ' · on time'}</small>{submission.text_answer ? <p>{submission.text_answer}</p> : null}{submission.marks_obtained !== null ? <p><strong>Grade: {submission.marks_obtained} / {assignment.total_marks}</strong>{submission.feedback ? ` · ${submission.feedback}` : ''}</p> : null}<form className="grade-submission-form" onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); onGrade(submission.id, values.get('marks'), values.get('feedback') || ''); }}><label>Marks out of {assignment.total_marks}<input name="marks" type="number" min="0" max={assignment.total_marks} step="0.01" required defaultValue={submission.marks_obtained ?? ''} /></label><label>Feedback<textarea name="feedback" rows="2" maxLength="5000" defaultValue={submission.feedback ?? ''} /></label><button className="secondary-button" disabled={busy}>{submission.marks_obtained === null ? 'Save grade' : 'Update grade'}</button></form></div> : null}
      {submission?.file_path ? <button className="inline-button" disabled={busy} onClick={() => onDownload(submission)}>Download file</button> : null}
    </article>)}</div>}
    <Pagination meta={data.meta} page={page} setPage={setPage} />
  </section>;
}

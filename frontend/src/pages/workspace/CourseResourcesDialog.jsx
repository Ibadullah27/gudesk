import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api.js';
import { EMPTY_PAGE, useApiQuery } from '../../lib/queryClient.js';
import { useNoticeState } from '../../components/ToastContext.jsx';
import { supabase } from '../../lib/supabaseClient.js';
import { ACCEPTED_UPLOAD_FILES, MAX_UPLOAD_SIZE, getUploadMimeType, uploadToSignedUrl } from '../../lib/fileUploads.js';
import Pagination from './Pagination.jsx';

function formatSize(size) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CourseResourcesDialog({ course, role, profileId, onClose }) {
  const dialogRef = useRef(null);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [actionError, setError] = useState('');
  const [notice, setNotice] = useNoticeState();
  const resourcesQuery = useApiQuery(['courses', course.id, 'resources'], `/courses/${course.id}/resources`, { page, pageSize: 20 });
  const { data: resources, meta } = resourcesQuery.data ?? EMPTY_PAGE;
  const loading = resourcesQuery.isPending;
  const error = actionError || resourcesQuery.error?.message || '';
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['courses', course.id, 'resources'] });
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open) dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  // If a delete empties the current page, step back to the previous one.
  const pageIsEmpty = resourcesQuery.isSuccess && !resourcesQuery.isPlaceholderData
    && !resources.length && page > 1 && meta.total > 0;
  useEffect(() => { if (pageIsEmpty) setPage((value) => value - 1); }, [pageIsEmpty]);

  function selectFile(nextFile, input) {
    setError(''); setNotice(''); setProgress(null);
    if (!nextFile) { setFile(null); return; }
    const mimeType = getUploadMimeType(nextFile);
    if (!mimeType) { setFile(null); if (input) input.value = ''; setError('Choose a PDF, DOCX, PPTX, XLSX, TXT, PNG, JPG, or ZIP file.'); return; }
    if (nextFile.size < 1 || nextFile.size > MAX_UPLOAD_SIZE) { setFile(null); if (input) input.value = ''; setError('Files must be between 1 byte and 20 MB.'); return; }
    setFile(nextFile);
    setTitle((current) => current || nextFile.name.replace(/\.[^.]+$/, '').slice(0, 160));
  }

  async function upload(event) {
    event.preventDefault();
    const uploadForm = event.currentTarget.closest('form');
    if (!file) { setError('Choose a file before uploading.'); return; }
    const mimeType = getUploadMimeType(file);
    setBusy(true); setError(''); setNotice(''); setProgress(0);
    try {
      const uploadGrant = await apiFetch(`/courses/${course.id}/resources/upload-url`, {
        method: 'POST',
        body: JSON.stringify({ file_name: file.name, mime_type: mimeType, size_bytes: file.size }),
      });
      const { data: { session } } = await supabase.auth.getSession();
      await uploadToSignedUrl(uploadGrant.data.signed_url, file, mimeType, session?.access_token, setProgress);
      setProgress(100);
      await apiFetch(`/courses/${course.id}/resources`, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(), description: description.trim() || null,
          file_path: uploadGrant.data.file_path, file_name: file.name,
          mime_type: mimeType, size_bytes: file.size,
        }),
      });
      setNotice('Resource uploaded and shared with the course.');
      setFile(null); setTitle(''); setDescription(''); setProgress(null);
      const input = uploadForm?.querySelector('input[type="file"]');
      if (input) input.value = '';
      setPage(1); refresh();
    } catch (reason) {
      setError(reason.message);
    } finally { setBusy(false); }
  }

  async function download(resource) {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await apiFetch(`/resources/${resource.id}/download`);
      window.location.assign(result.data.signed_url);
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function remove(resource) {
    setBusy(true); setError(''); setNotice('');
    try {
      await apiFetch(`/resources/${resource.id}`, { method: 'DELETE' });
      setNotice(`Removed ${resource.title} and its stored file.`);
      refresh();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  return (
    <dialog className="roster-dialog resource-dialog" ref={dialogRef} onClose={onClose} aria-labelledby="resources-title">
      <div className="roster-panel">
        <header className="roster-heading"><div><p className="eyebrow">{course.code} · COURSE MATERIAL</p><h2 id="resources-title">Resources</h2><p>{course.title}</p></div><button className="dialog-close" type="button" onClick={onClose} aria-label="Close course resources">×</button></header>
        {error ? <p className="form-alert" role="alert">{error}</p> : null}
        {notice ? <p className="success-alert" role="status">{notice}</p> : null}
        {role === 'teacher' ? <form className="resource-upload-form" onSubmit={upload}>
          <h3>Share a resource</h3>
          <label>Title<input required minLength="2" maxLength="160" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Description <span className="optional-label">Optional</span><textarea rows="2" maxLength="2000" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label>File<input type="file" accept={ACCEPTED_UPLOAD_FILES} onChange={(event) => selectFile(event.target.files?.[0], event.target)} aria-describedby="resource-file-rules" /></label>
          <small id="resource-file-rules">PDF, DOCX, PPTX, XLSX, TXT, PNG, JPG, or ZIP. Maximum size 20 MB.</small>
          {file ? <small className="selected-file">{file.name} · {formatSize(file.size)}</small> : null}
          {progress !== null ? <div className="upload-progress" role="status"><span>Uploading</span><progress max="100" value={progress}>{progress}%</progress><strong>{progress}%</strong></div> : null}
          <button className="primary-button" disabled={busy || !file}>{busy ? 'Uploading…' : 'Upload resource'}</button>
          {error && file && !busy ? <button type="button" className="inline-button retry-upload" onClick={upload}>Retry upload</button> : null}
        </form> : null}
        <div className="resource-list-heading"><h3>Shared files</h3><span className="count-pill">{meta.total} resources</span></div>
        {loading ? <div className="data-state" role="status">Loading resources…</div> : null}
        {!loading && !error && resources.length === 0 ? <div className="empty-state"><h3>No resources yet</h3><p>Course files shared by the teacher will appear here.</p></div> : null}
        {!loading && resources.length ? <div className="resource-list">{resources.map((resource) => <article className="resource-item" key={resource.id}>
          <span className="resource-file-icon" aria-hidden="true">{resource.file_name.split('.').pop().toUpperCase()}</span>
          <div className="resource-item-info"><h4>{resource.title}</h4><p>{resource.description || resource.file_name}</p><small>{formatSize(Number(resource.size_bytes))} · {new Date(resource.created_at).toLocaleDateString()}</small></div>
          <div className="resource-item-actions"><button className="secondary-button" disabled={busy} onClick={() => download(resource)}>Download</button>{role === 'teacher' && resource.uploaded_by === profileId ? <button className="inline-button remove-student" disabled={busy} onClick={() => remove(resource)}>Delete</button> : null}</div>
        </article>)}</div> : null}
        <Pagination meta={meta} page={page} setPage={setPage} />
      </div>
    </dialog>
  );
}

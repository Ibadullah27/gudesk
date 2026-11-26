import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api.js';
import { EMPTY_PAGE, useApiQuery } from '../../lib/queryClient.js';
import { useNoticeState } from '../../components/ToastContext.jsx';
import ManageStudentsDialog from './ManageStudentsDialog.jsx';
import Pagination from './Pagination.jsx';
import CourseResourcesDialog from './CourseResourcesDialog.jsx';
import CourseChatDialog from './CourseChatDialog.jsx';

const emptyUser = { full_name: '', email: '', role: 'student', roll_no: '' };
const emptyCourse = { code: '', title: '', description: '', teacher_id: '' };

function ErrorNotice({ children }) { return children ? <p className="form-alert" role="alert">{children}</p> : null; }
function SuccessNotice({ children }) { return children ? <p className="success-alert" role="status">{children}</p> : null; }

/** Admin panel. `section` comes from the URL (/admin/users or /admin/courses). */
export default function AdminWorkspace({ profileId, section = 'users' }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [actionError, setError] = useState('');
  const [userForm, setUserForm] = useState(emptyUser);
  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [editingUser, setEditingUser] = useState(null);
  const [editingCourse, setEditingCourse] = useState(null);
  const [rosterCourse, setRosterCourse] = useState(null);
  const [resourcesCourse, setResourcesCourse] = useState(null);
  const [chatCourse, setChatCourse] = useState(null);
  const [notice, setNotice] = useNoticeState();
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [csv, setCsv] = useState('email,full_name,role,roll_no\n');
  const [bulkResults, setBulkResults] = useState([]);

  const usersQuery = useApiQuery(
    ['admin', 'users'], '/admin/users',
    { page, pageSize: 20, search: searchQuery, role: roleFilter, active: activeFilter },
    { enabled: section === 'users' },
  );
  const coursesQuery = useApiQuery(['courses'], '/courses', { page, pageSize: 20, search: searchQuery }, { enabled: section === 'courses' });
  const teachersQuery = useApiQuery(['courses', 'teachers'], '/courses/teachers', {}, { enabled: section === 'courses' });
  const listQuery = section === 'users' ? usersQuery : coursesQuery;
  const users = usersQuery.data?.data ?? [];
  const courses = coursesQuery.data?.data ?? [];
  const teachers = teachersQuery.data?.data ?? [];
  const meta = listQuery.data?.meta ?? EMPTY_PAGE.meta;
  const loading = listQuery.isPending;
  const error = actionError || listQuery.error?.message || teachersQuery.error?.message || '';
  // Account and course changes affect lists, teacher choices, and dashboard metrics.
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin'] });
    queryClient.invalidateQueries({ queryKey: ['courses'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  function runSearch(event) {
    event.preventDefault();
    setPage(1); setSearchQuery(search.trim());
  }

  async function submitUser(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice(''); setSecret('');
    try {
      if (editingUser) {
        const data = { full_name: userForm.full_name, role: userForm.role, ...(userForm.role === 'student' ? { roll_no: userForm.roll_no } : {}) };
        const result = await apiFetch(`/admin/users/${editingUser.id}`, { method: 'PATCH', body: JSON.stringify(data) });
        setNotice(`Updated ${result.data.full_name}.`);
      } else {
        const result = await apiFetch('/admin/users', { method: 'POST', body: JSON.stringify(userForm) });
        setNotice(`Created ${result.data.user.full_name}. Share the temporary password securely.`);
        setSecret(result.data.temporary_password);
      }
      setEditingUser(null); setUserForm(emptyUser); refresh();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function updateUser(user, changes) {
    setError(''); setNotice(''); setSecret('');
    try {
      const result = await apiFetch(`/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify(changes) });
      setNotice(`${result.data.full_name} was ${changes.is_active === false ? 'deactivated' : 'updated'}.`);
      refresh();
    } catch (reason) { setError(reason.message); }
  }

  async function resetPassword(user) {
    setError(''); setNotice(''); setSecret('');
    try {
      const result = await apiFetch(`/admin/users/${user.id}/reset-password`, { method: 'POST' });
      setNotice(`Temporary password created for ${user.full_name}. Share it securely; they must change it at next login.`);
      setSecret(result.data.temporary_password);
      refresh();
    } catch (reason) { setError(reason.message); }
  }

  async function submitCsv(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice(''); setSecret('');
    try {
      const result = await apiFetch('/admin/users/bulk', { method: 'POST', body: JSON.stringify({ csv }) });
      setNotice(`${result.data.created} account(s) created; ${result.data.failed} row(s) need attention.`);
      setBulkResults(result.data.results);
      refresh();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function submitCourse(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const result = await apiFetch(editingCourse ? `/courses/${editingCourse.id}` : '/courses', {
        method: editingCourse ? 'PATCH' : 'POST', body: JSON.stringify(courseForm),
      });
      setNotice(`${result.data.code} ${editingCourse ? 'updated' : 'created'}.`);
      setCourseForm(emptyCourse); setEditingCourse(null); refresh();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  return (
    <section className="classroom-section" aria-labelledby="admin-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">INSTITUTION CONTROL</p>
          <h1 id="admin-heading">{section === 'users' ? 'User accounts' : 'Courses'}</h1>
          <p className="section-subtitle">{section === 'users'
            ? 'Create accounts, reset passwords, and control who can sign in. There is no public sign up.'
            : 'Create courses, assign a teacher, and manage each course roster, resources, and chat.'}</p>
        </div>
        <span className="count-pill">{meta.total} {section === 'users' ? 'accounts' : 'courses'}</span>
      </div>
      <ErrorNotice>{error}</ErrorNotice><SuccessNotice>{notice}</SuccessNotice>
      {secret ? <div className="secret-card"><span>Temporary password</span><code>{secret}</code><button className="secondary-button" onClick={() => navigator.clipboard?.writeText(secret)}>Copy password</button></div> : null}
      {bulkResults.length ? <div className="bulk-results" role="status"><h2>Import results</h2>{bulkResults.map((result) => <p key={result.row}><strong>Row {result.row}:</strong> {result.status === 'created' ? `${result.user.full_name} · ${result.user.email} · temporary password ` : result.message}{result.status === 'created' ? <code>{result.temporary_password}</code> : null}</p>)}</div> : null}
      {section === 'users' ? <>
        <div className="admin-grid">
          <form className="panel-form" onSubmit={submitUser}>
            <div className="form-title"><h2>{editingUser ? 'Edit account' : 'Create account'}</h2>{editingUser ? <button type="button" className="inline-button" onClick={() => { setEditingUser(null); setUserForm(emptyUser); }}>Cancel</button> : null}</div>
            <label>Full name<input required minLength="2" maxLength="120" value={userForm.full_name} onChange={(event) => setUserForm({ ...userForm, full_name: event.target.value })} /></label>
            {!editingUser ? <label>Email<input type="email" required maxLength="254" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></label> : <label>Email<input value={userForm.email} disabled /></label>}
            <label>Role<select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}><option value="student">Student</option><option value="teacher">Teacher</option><option value="admin">Admin</option></select></label>
            {userForm.role === 'student' ? <label>Roll number<input required maxLength="40" value={userForm.roll_no} onChange={(event) => setUserForm({ ...userForm, roll_no: event.target.value })} /></label> : null}
            <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : editingUser ? 'Save changes' : 'Create account'}</button>
          </form>
          <form className="panel-form csv-form" onSubmit={submitCsv}>
            <div className="form-title"><h2>Import accounts</h2><span className="helper-tag">CSV · up to 100</span></div>
            <p>Required headers: <code>email,full_name,role</code>. Student rows also need <code>roll_no</code>.</p>
            <label htmlFor="account-csv">Paste CSV contents</label><textarea id="account-csv" rows="6" value={csv} onChange={(event) => setCsv(event.target.value)} aria-describedby="csv-example" />
            <small id="csv-example">Each account gets a unique temporary password that must be shared securely.</small>
            <button className="secondary-button" disabled={busy}>Import accounts</button>
          </form>
        </div>
        <div className="list-toolbar">
          <form className="search-bar" onSubmit={runSearch}><label className="sr-only" htmlFor="account-search">Search accounts</label><input id="account-search" placeholder="Search name, email, roll number" value={search} onChange={(event) => setSearch(event.target.value)} /><button className="secondary-button">Search</button></form>
          <label className="filter-label">Role<select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }}><option value="">All roles</option><option value="admin">Admin</option><option value="teacher">Teacher</option><option value="student">Student</option></select></label>
          <label className="filter-label">Status<select value={activeFilter} onChange={(event) => { setActiveFilter(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="true">Active</option><option value="false">Inactive</option></select></label>
        </div>
        <ErrorNotice>{error && !users.length ? error : ''}</ErrorNotice>
        <DataState loading={loading} error={error} items={users} noun="accounts" />
        {!loading && users.length ? <div className="responsive-table"><table><thead><tr><th>Account</th><th>Role / ID</th><th>Status</th><th>Actions</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}>
          <td data-label="Account"><strong>{user.full_name}</strong><small>{user.email}</small></td><td data-label="Role / ID"><span className="role-tag">{user.role}</span><small>{user.roll_no || '—'}</small></td><td data-label="Status"><span className={`status-tag ${user.is_active ? 'is-active' : ''}`}>{user.is_active ? 'Active' : 'Inactive'}</span>{user.must_change_password ? <small>Password change required</small> : null}</td>
          <td data-label="Actions"><div className="row-actions"><button className="inline-button" onClick={() => { setEditingUser(user); setUserForm({ full_name: user.full_name, email: user.email, role: user.role, roll_no: user.roll_no || '' }); }}>Edit</button><button className="inline-button" onClick={() => resetPassword(user)}>Reset password</button>{user.id !== profileId ? <button className="inline-button" onClick={() => { if (!user.is_active || window.confirm(`Deactivate ${user.full_name}? They will no longer be able to sign in.`)) updateUser(user, { is_active: !user.is_active }); }}>{user.is_active ? 'Deactivate' : 'Reactivate'}</button> : <span className="helper-tag">You</span>}</div></td>
        </tr>)}</tbody></table></div> : null}
      </> : <>
        <div className="admin-grid course-admin-grid">
          <form className="panel-form" onSubmit={submitCourse}>
            <div className="form-title"><h2>{editingCourse ? 'Edit course' : 'Create course'}</h2>{editingCourse ? <button type="button" className="inline-button" onClick={() => { setEditingCourse(null); setCourseForm(emptyCourse); }}>Cancel</button> : null}</div>
            <label>Course code<input required minLength="2" maxLength="30" pattern="[A-Za-z0-9_-]+" value={courseForm.code} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value })} /></label>
            <label>Course title<input required minLength="2" maxLength="160" value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} /></label>
            <label>Description<textarea rows="3" maxLength="2000" value={courseForm.description} onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })} /></label>
            <label>Assigned teacher<select required value={courseForm.teacher_id} onChange={(event) => setCourseForm({ ...courseForm, teacher_id: event.target.value })}><option value="">Choose an active teacher</option>{teachers.map((teacher) => <option value={teacher.id} key={teacher.id}>{teacher.full_name} · {teacher.email}</option>)}</select></label>
            <button className="primary-button" disabled={busy || !teachers.length}>{busy ? 'Saving…' : editingCourse ? 'Save course' : 'Create course'}</button>
            {!teachers.length ? <small>Create an active teacher account before adding courses.</small> : null}
          </form>
          <div className="panel-form csv-form">
            <div className="form-title"><h2>Enrolling students</h2><span className="helper-tag">Roster</span></div>
            <p>Use <strong>Manage students</strong> on any course below to search students by name or roll number, select many at once, or paste a CSV of roll numbers.</p>
            <p>Duplicate enrollments are ignored, unknown roll numbers are reported back, and removing a student keeps their past submissions and marks.</p>
          </div>
        </div>
        <div className="list-toolbar"><form className="search-bar" onSubmit={runSearch}><label className="sr-only" htmlFor="course-admin-search">Search courses</label><input id="course-admin-search" placeholder="Search course title or code" value={search} onChange={(event) => setSearch(event.target.value)} /><button className="secondary-button">Search</button></form></div>
        <DataState loading={loading} error={error} items={courses} noun="courses" />
        {!loading && courses.length ? <div className="responsive-table"><table><thead><tr><th>Course</th><th>Teacher</th><th>Created</th><th>Action</th></tr></thead><tbody>{courses.map((course) => <tr key={course.id}><td data-label="Course"><strong>{course.title}</strong><small>{course.code}</small></td><td data-label="Teacher">{course.teacher?.full_name || '—'}<small>{course.teacher?.email || ''}</small></td><td data-label="Created">{new Date(course.created_at).toLocaleDateString()}</td><td data-label="Action"><div className="row-actions"><button className="inline-button" onClick={() => setResourcesCourse(course)}>Resources</button><button className="inline-button" onClick={() => setRosterCourse(course)}>Manage students</button><button className="inline-button" onClick={() => setChatCourse(course)}>Read chat</button><button className="inline-button" onClick={() => { setEditingCourse(course); setCourseForm({ code: course.code, title: course.title, description: course.description || '', teacher_id: course.teacher_id }); }}>Edit</button></div></td></tr>)}</tbody></table></div> : null}
      </>}
      <Pagination meta={meta} page={page} setPage={setPage} />
      {rosterCourse ? <ManageStudentsDialog key={rosterCourse.id} course={rosterCourse} onClose={() => setRosterCourse(null)} /> : null}
      {resourcesCourse ? <CourseResourcesDialog key={resourcesCourse.id} course={resourcesCourse} role="admin" profileId={profileId} onClose={() => setResourcesCourse(null)} /> : null}
      {chatCourse ? <CourseChatDialog key={chatCourse.id} course={chatCourse} role="admin" profileId={profileId} onClose={() => setChatCourse(null)} /> : null}
    </section>
  );
}

function DataState({ loading, error, items, noun }) {
  if (loading) return <div className="data-state" role="status">Loading {noun}…</div>;
  if (error && !items.length) return <div className="empty-state"><h2>Could not load {noun}</h2><p>{error}</p></div>;
  if (!items.length) return <div className="empty-state"><span>◌</span><h2>No {noun} found</h2><p>Try a different search or add your first {noun.slice(0, -1)}.</p></div>;
  return null;
}

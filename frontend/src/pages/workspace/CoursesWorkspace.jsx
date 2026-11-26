import { useState } from 'react';
import { EMPTY_PAGE, useApiQuery } from '../../lib/queryClient.js';
import ManageStudentsDialog from './ManageStudentsDialog.jsx';
import Pagination from './Pagination.jsx';
import CourseResourcesDialog from './CourseResourcesDialog.jsx';
import CourseAssignmentsDialog from './CourseAssignmentsDialog.jsx';
import CourseQuizzesDialog from './CourseQuizzesDialog.jsx';
import CourseGradebookDialog from './CourseGradebookDialog.jsx';
import CourseChatDialog from './CourseChatDialog.jsx';

/** Course cards for teachers and students. `compact` shows a short dashboard preview. */
export default function CoursesWorkspace({ role, profileId, compact = false, onViewAll }) {
  const pageSize = compact ? 6 : 20;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [rosterCourse, setRosterCourse] = useState(null);
  const [resourcesCourse, setResourcesCourse] = useState(null);
  const [assignmentsCourse, setAssignmentsCourse] = useState(null);
  const [quizzesCourse, setQuizzesCourse] = useState(null);
  const [gradebookCourse, setGradebookCourse] = useState(null);
  const [chatCourse, setChatCourse] = useState(null);

  const coursesQuery = useApiQuery(['courses'], '/courses', { page, pageSize, search: query });
  const { data: items, meta } = coursesQuery.data ?? EMPTY_PAGE;
  const loading = coursesQuery.isPending;
  const error = coursesQuery.error?.message ?? '';

  function searchCourses(event) {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  return (
    <section className="classroom-section" aria-labelledby="courses-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{role === 'teacher' ? 'YOUR TEACHING' : 'YOUR LEARNING'}</p>
          {compact
            ? <h2 id="courses-heading">Your courses</h2>
            : <h1 id="courses-heading">Courses</h1>}
        </div>
        {compact && onViewAll && meta.total > 0
          ? <button type="button" className="secondary-button" onClick={onViewAll}>View all {meta.total}</button>
          : <span className="count-pill">{meta.total} total</span>}
      </div>
      {!compact ? (
        <form className="search-bar" onSubmit={searchCourses} role="search">
          <label className="sr-only" htmlFor="course-search">Search courses</label>
          <input id="course-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by course title or code" />
          <button className="secondary-button" type="submit">Search</button>
        </form>
      ) : null}
      {loading ? <div className="data-state" role="status">Loading courses…</div> : null}
      {error ? <div className="form-alert" role="alert">{error} <button className="inline-button" onClick={() => coursesQuery.refetch()}>Retry</button></div> : null}
      {!loading && !error && items.length === 0 ? <div className="empty-state"><span>◌</span><h2>No courses yet</h2><p>Courses assigned to your account will appear here.</p></div> : null}
      {!loading && items.length > 0 ? (
        <div className="course-grid">
          {items.map((course) => <article className="course-card" key={course.id}>
            <div className="course-card-top"><span className="course-code">{course.code}</span><span className="status-dot" title="Active course" aria-hidden="true" /></div>
            <h2>{course.title}</h2>
            <p>{course.description || 'No course description yet.'}</p>
            <div className="course-teacher">Teacher <strong>{course.teacher?.full_name ?? 'Teacher account unavailable'}</strong></div>
            <div className="course-card-actions" aria-label={`${course.code} tools`}>
              <button className="secondary-button" onClick={() => setResourcesCourse(course)}>Resources</button>
              <button className="secondary-button" onClick={() => setAssignmentsCourse(course)}>Assignments</button>
              <button className="secondary-button" onClick={() => setQuizzesCourse(course)}>Quizzes</button>
              <button className="secondary-button" onClick={() => setChatCourse(course)}>Class chat</button>
              {role === 'teacher' ? <>
                <button className="secondary-button" onClick={() => setGradebookCourse(course)}>Gradebook</button>
                <button className="secondary-button" onClick={() => setRosterCourse(course)}>Students</button>
              </> : null}
            </div>
          </article>)}
        </div>
      ) : null}
      {!compact ? <Pagination meta={meta} page={page} setPage={setPage} /> : null}
      {rosterCourse ? <ManageStudentsDialog key={rosterCourse.id} course={rosterCourse} onClose={() => setRosterCourse(null)} /> : null}
      {resourcesCourse ? <CourseResourcesDialog key={resourcesCourse.id} course={resourcesCourse} role={role} profileId={profileId} onClose={() => setResourcesCourse(null)} /> : null}
      {assignmentsCourse ? <CourseAssignmentsDialog key={assignmentsCourse.id} course={assignmentsCourse} role={role} onClose={() => setAssignmentsCourse(null)} /> : null}
      {quizzesCourse ? <CourseQuizzesDialog key={quizzesCourse.id} course={quizzesCourse} role={role} onClose={() => setQuizzesCourse(null)} /> : null}
      {gradebookCourse ? <CourseGradebookDialog key={gradebookCourse.id} course={gradebookCourse} onClose={() => setGradebookCourse(null)} /> : null}
      {chatCourse ? <CourseChatDialog key={chatCourse.id} course={chatCourse} role={role} profileId={profileId} onClose={() => setChatCourse(null)} /> : null}
    </section>
  );
}

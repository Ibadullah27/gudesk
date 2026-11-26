import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api.js';
import { EMPTY_PAGE, useApiQuery } from '../../lib/queryClient.js';
import { useNoticeState } from '../../components/ToastContext.jsx';
import Pagination from './Pagination.jsx';

const blankQuestion = () => ({ question_text: '', options: ['', '', '', ''], correct_index: 0, marks: 1 });
const blankQuiz = () => ({ title: '', instructions: '', duration_minutes: 20, opens_at: '', closes_at: '' });
// Autosave notices fire on every answer, so keep them inline instead of toasting.
const QUIZ_TOAST_FILTER = (message) => !/^Answer saved|save automatically/.test(message);
const showTime = (value) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export default function CourseQuizzesDialog({ course, role, onClose }) {
  const dialog = useRef(null);
  const answersRef = useRef({});
  const saveQueue = useRef(Promise.resolve());
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [actionError, setError] = useState('');
  const [notice, setNotice] = useNoticeState(QUIZ_TOAST_FILTER);
  const [quizForm, setQuizForm] = useState(blankQuiz);
  const [questions, setQuestions] = useState([blankQuestion()]);
  const [builder, setBuilder] = useState(null);
  const [resultsQuiz, setResultsQuiz] = useState(null);
  const [resultPage, setResultPage] = useState(1);

  const quizzesQuery = useApiQuery(['courses', course.id, 'quizzes', role], `/courses/${course.id}/quizzes`, { page, pageSize: 20 });
  const { data: items, meta } = quizzesQuery.data ?? EMPTY_PAGE;
  const loading = quizzesQuery.isPending;
  const resultsQuery = useApiQuery(
    ['quizzes', resultsQuiz?.id, 'results'],
    `/quizzes/${resultsQuiz?.id}/results`,
    { page: resultPage, pageSize: 20 },
    { enabled: Boolean(resultsQuiz) },
  );
  const results = resultsQuiz ? { quiz: resultsQuiz, ...(resultsQuery.data ?? EMPTY_PAGE) } : null;
  const error = actionError || quizzesQuery.error?.message || resultsQuery.error?.message || '';
  // Quiz changes affect results, the gradebook, student marks, and dashboards.
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['courses', course.id] });
    queryClient.invalidateQueries({ queryKey: ['quizzes'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['me', 'marks'] });
  };
  const [attempt, setAttempt] = useState(null);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal(); return () => { if (dialog.current?.open) dialog.current.close(); }; }, []);

  useEffect(() => {
    if (!attempt?.deadline) return undefined;
    const tick = () => setRemaining(Math.max(0, Math.ceil((Date.parse(attempt.deadline) - Date.now()) / 1000)));
    tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer);
  }, [attempt?.deadline]);
  useEffect(() => {
    if (!attempt || remaining !== 0 || busy) return;
    submitQuiz(true);
  }, [remaining, attempt, busy]);

  function updateQuestion(index, changes) { setQuestions((all) => all.map((question, i) => i === index ? { ...question, ...changes } : question)); }
  async function createQuiz(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const created = await apiFetch(`/courses/${course.id}/quizzes`, { method: 'POST', body: JSON.stringify({ ...quizForm, duration_minutes: Number(quizForm.duration_minutes), opens_at: new Date(quizForm.opens_at).toISOString(), closes_at: new Date(quizForm.closes_at).toISOString() }) });
      setBuilder(created.data); setNotice('Quiz created. Add questions before publishing.'); refresh();
      setQuizForm(blankQuiz()); setQuestions([blankQuestion()]);
    } catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }
  async function saveQuestions(quiz) {
    const filtered = questions.map((item) => ({ ...item, options: item.options.map((option) => option.trim()), marks: Number(item.marks) }));
    if (filtered.some((item) => item.options.length < 2 || item.options.some((option) => !option) || item.correct_index >= item.options.length)) { setError('Each question needs at least two filled options and a valid correct answer.'); return; }
    setBusy(true); setError('');
    try { await apiFetch(`/quizzes/${quiz.id}/questions`, { method: 'PUT', body: JSON.stringify({ questions: filtered }) }); setBuilder(null); setNotice('Questions saved. The quiz is ready to publish.'); refresh(); }
    catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }
  async function publish(quiz, is_published) {
    setBusy(true); setError('');
    try { await apiFetch(`/quizzes/${quiz.id}/publish`, { method: 'PATCH', body: JSON.stringify({ is_published }) }); setNotice(is_published ? 'Quiz published to enrolled students.' : 'Quiz unpublished.'); refresh(); }
    catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }
  function viewResults(quiz, requestedPage = 1) {
    setError(''); setResultPage(requestedPage); setResultsQuiz(quiz);
  }
  async function startQuiz(quiz) {
    setBusy(true); setError('');
    try {
      const result = await apiFetch(`/quizzes/${quiz.id}/start`, { method: 'POST' });
      answersRef.current = result.data.attempt.answers ?? {};
      setRemaining(Math.max(0, Math.ceil((Date.parse(result.data.attempt.deadline) - Date.now()) / 1000)));
      setActiveQuiz({ ...quiz, questions: result.data.questions }); setAttempt(result.data.attempt); setNotice('Your answers save automatically as you choose them.');
    } catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }
  async function answer(questionId, optionIndex) {
    const updated = { ...answersRef.current, [questionId]: optionIndex }; answersRef.current = updated;
    setActiveQuiz((value) => ({ ...value, savedAnswers: updated }));
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => apiFetch(`/quizzes/${activeQuiz.id}/attempt`, { method: 'PATCH', body: JSON.stringify({ answers: updated }) }));
    try { await saveQueue.current; setNotice('Answer saved.'); }
    catch (reason) { setError(reason.message); if (reason.code === 'QUIZ_UNAVAILABLE') submitQuiz(true); }
  }
  async function submitQuiz(automatic = false) {
    if (!activeQuiz || busy) return;
    setBusy(true);
    try {
      await saveQueue.current.catch(() => {});
      const result = await apiFetch(`/quizzes/${activeQuiz.id}/submit`, { method: 'POST' });
      setAttempt(null); setActiveQuiz(null); setNotice(`${automatic ? 'Time is up. ' : ''}Quiz submitted: ${result.data.score} / ${result.data.total_marks} marks.`); refresh();
    } catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }
  const clock = `${Math.floor(remaining / 60).toString().padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`;

  return <dialog className="roster-dialog quiz-dialog" ref={dialog} onCancel={onClose}>
    <div className="roster-panel">
      <header className="roster-heading"><div><p className="eyebrow">CLASSROOM ASSESSMENTS</p><h2>{course.title} quizzes</h2><p>Timed multiple choice quizzes with automatic scoring.</p></div><button className="dialog-close" aria-label="Close quizzes" onClick={onClose}>×</button></header>
      {error ? <div className="form-alert" role="alert">{error}</div> : null}{notice ? <div className="success-alert" role="status">{notice}</div> : null}
      {role === 'teacher' && !builder ? <form className="assignment-form quiz-create-form" onSubmit={createQuiz}>
        <h3>Create a quiz</h3><label>Title<input required minLength="2" maxLength="160" value={quizForm.title} onChange={(event) => setQuizForm({ ...quizForm, title: event.target.value })} /></label>
        <label>Instructions <span className="optional-label">Optional</span><textarea rows="2" maxLength="5000" value={quizForm.instructions} onChange={(event) => setQuizForm({ ...quizForm, instructions: event.target.value })} /></label>
        <div className="assignment-form-row"><label>Duration (minutes)<input type="number" min="1" max="600" required value={quizForm.duration_minutes} onChange={(event) => setQuizForm({ ...quizForm, duration_minutes: event.target.value })} /></label><label>Opens<input required type="datetime-local" value={quizForm.opens_at} onChange={(event) => setQuizForm({ ...quizForm, opens_at: event.target.value })} /></label><label>Closes<input required type="datetime-local" value={quizForm.closes_at} onChange={(event) => setQuizForm({ ...quizForm, closes_at: event.target.value })} /></label></div>
        <button className="primary-button" disabled={busy}>{busy ? 'Creating…' : 'Create quiz and add questions'}</button>
      </form> : null}
      {builder ? <section className="quiz-builder"><div className="assignment-list-heading"><h3>Build: {builder.title}</h3><button className="inline-button" onClick={() => setBuilder(null)}>Close</button></div>
        {questions.map((question, index) => <article className="quiz-question-editor" key={index}><div className="assignment-list-heading"><h4>Question {index + 1}</h4>{questions.length > 1 ? <button className="inline-button remove-student" onClick={() => setQuestions((all) => all.filter((_, i) => i !== index))}>Remove</button> : null}</div>
          <label>Question<textarea rows="2" value={question.question_text} onChange={(event) => updateQuestion(index, { question_text: event.target.value })} /></label>
          <div className="quiz-options-editor">{question.options.map((option, optionIndex) => <label key={optionIndex}>Option {optionIndex + 1}<input value={option} onChange={(event) => updateQuestion(index, { options: question.options.map((value, i) => i === optionIndex ? event.target.value : value) })} /></label>)}</div>
          <div className="assignment-form-row"><label>Correct option<select value={question.correct_index} onChange={(event) => updateQuestion(index, { correct_index: Number(event.target.value) })}>{question.options.map((_, i) => <option key={i} value={i}>Option {i + 1}</option>)}</select></label><label>Marks<input type="number" min="0.01" max="999.99" step="0.01" value={question.marks} onChange={(event) => updateQuestion(index, { marks: event.target.value })} /></label></div>
        </article>)}
        <div className="assignment-card-actions"><button className="secondary-button" onClick={() => setQuestions((all) => [...all, blankQuestion()])}>Add question</button><button className="primary-button" disabled={busy} onClick={() => saveQuestions(builder)}>{busy ? 'Saving…' : 'Save questions'}</button></div>
      </section> : null}
      {activeQuiz ? <section className="quiz-taker"><header className="quiz-taker-heading"><div><p className="eyebrow">IN PROGRESS</p><h3>{activeQuiz.title}</h3></div><strong className={remaining < 60 ? 'quiz-clock urgent' : 'quiz-clock'} aria-live="polite">{clock}</strong></header>
        {activeQuiz.instructions ? <p className="assignment-description">{activeQuiz.instructions}</p> : null}
        {activeQuiz.questions.map((question, index) => <fieldset className="quiz-question" key={question.id}><legend>{index + 1}. {question.question_text} <small>{question.marks} marks</small></legend>{question.options.map((option, optionIndex) => <label key={optionIndex}><input type="radio" name={question.id} checked={(activeQuiz.savedAnswers ?? answersRef.current)[question.id] === optionIndex} onChange={() => answer(question.id, optionIndex)} />{option}</label>)}</fieldset>)}
        <button className="primary-button" disabled={busy} onClick={() => submitQuiz(false)}>{busy ? 'Submitting…' : 'Submit quiz'}</button>
      </section> : null}
      {results ? <section className="submission-roster"><div className="form-title"><h4>Results: {results.quiz.title}</h4><button className="inline-button" onClick={() => setResultsQuiz(null)}>Close</button></div>{resultsQuery.isPending ? <div className="data-state" role="status">Loading results…</div> : results.data.length ? <div className="submission-list">{results.data.map((row) => <article className="submission-row" key={row.id}><div><strong>{row.student?.full_name ?? 'Student'}</strong><small>{row.student?.roll_no ?? 'No roll number'} · started {showTime(row.started_at)}</small></div><span className={`status-tag ${row.submitted_at ? 'is-active' : ''}`}>{row.submitted_at ? `${row.score} / ${row.total_marks}` : 'In progress'}</span></article>)}</div> : <div className="empty-state"><p>No attempts yet.</p></div>}<Pagination meta={results.meta} page={resultPage} setPage={setResultPage} /></section> : null}
      {!builder && !activeQuiz && !results ? <section className="quiz-list"><div className="assignment-list-heading"><h3>{role === 'teacher' ? 'Your quizzes' : 'Available quizzes'}</h3><span className="count-pill">{meta.total} total</span></div>
        {loading ? <div className="data-state" role="status">Loading quizzes…</div> : items.length ? items.map((quiz) => <article className="assignment-card" key={quiz.id}><div className="assignment-card-heading"><div><span className="assignment-due">{showTime(quiz.opens_at)} – {showTime(quiz.closes_at)}</span><h3>{quiz.title}</h3></div><span className="marks-pill">{quiz.duration_minutes} min</span></div>{quiz.instructions ? <p className="assignment-description">{quiz.instructions}</p> : null}
          {role === 'teacher' ? <div className="assignment-card-actions"><span className={`status-tag ${quiz.is_published ? 'is-active' : ''}`}>{quiz.is_published ? 'Published' : 'Draft'}</span><button className="secondary-button" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { const response = await apiFetch(`/quizzes/${quiz.id}/questions`); setQuestions(response.data.map(({ question_text, options, correct_index, marks }) => ({ question_text, options, correct_index, marks }))); setBuilder(quiz); } catch (reason) { setError(reason.message); } finally { setBusy(false); } }}>Edit questions</button>{!quiz.is_published ? <button className="secondary-button" disabled={busy} onClick={() => publish(quiz, true)}>Publish</button> : <button className="inline-button" disabled={busy} onClick={() => publish(quiz, false)}>Unpublish</button>}<button className="inline-button" disabled={busy} onClick={() => { setResultPage(1); viewResults(quiz, 1); }}>Results</button></div>
            : <div className="assignment-card-actions">{quiz.my_attempt?.submitted_at ? <span className="status-tag is-active">Score {quiz.my_attempt.score}</span> : quiz.my_attempt ? <span className="status-tag">Attempt in progress</span> : <span className="status-tag">One attempt</span>}{!quiz.my_attempt ? <button className="secondary-button" disabled={busy || Date.now() < Date.parse(quiz.opens_at) || Date.now() > Date.parse(quiz.closes_at)} onClick={() => startQuiz(quiz)}>Start quiz</button> : null}</div>}
        </article>) : <div className="empty-state"><h3>{role === 'teacher' ? 'No quizzes yet' : 'No published quizzes'}</h3><p>Quizzes for this course will appear here.</p></div>}
        <Pagination meta={meta} page={page} setPage={setPage} />
      </section> : null}
    </div>
  </dialog>;
}

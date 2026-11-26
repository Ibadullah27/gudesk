import { gradesService } from '../services/grades.service.js';

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function gradebookCsv(gradebook) {
  const assessments = gradebook.assessments;
  const headers = ['Student', 'Roll number', ...assessments.map((item) => `${item.kind}: ${item.title}`), 'Graded total earned', 'Graded total possible', 'Percentage'];
  const rows = gradebook.data.map(({ student, grades, summary }) => [
    student.full_name, student.roll_no,
    ...grades.map((grade) => grade.status === 'graded' ? `${grade.obtained} / ${grade.total}` : grade.status.replaceAll('_', ' ')),
    summary.obtained, summary.possible, summary.percentage == null ? 'Pending' : `${summary.percentage}%`,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export const gradesController = {
  async grade(req, res) {
    res.json({ data: await gradesService.grade(req.params.id, req.body, req.auth.profile, req.auth.accessToken) });
  },
  async gradebook(req, res) {
    res.json(await gradesService.gradebook(req.params.id, req.validated.query, req.auth.profile));
  },
  async gradebookCsv(req, res) {
    const result = await gradesService.gradebook(req.params.id, req.validated.query, req.auth.profile);
    const filename = `${result.course.code.toLowerCase()}-gradebook-page-${result.meta.page}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/[^a-z0-9._-]/gi, '-') }"`);
    res.send(`\uFEFF${gradebookCsv(result)}`);
  },
  async myMarks(req, res) {
    const result = await gradesService.studentMarks(req.auth.profile, req.auth.accessToken, req.validated.query);
    res.json(result);
  },
};

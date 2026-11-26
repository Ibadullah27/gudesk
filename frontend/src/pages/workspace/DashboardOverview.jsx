import { useApiQuery } from '../../lib/queryClient.js';

function deadlineLabel(value) {
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

const METRIC_ICONS = {
  'Courses': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  'Students': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  'Assignments': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  'Quizzes': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  'Announcements': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  'Complaints': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  'Teachers': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
};

function getIcon(label) {
  for (const [key, icon] of Object.entries(METRIC_ICONS)) {
    if (label.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
    </svg>
  );
}

function StatSkeleton() {
  return (
    <div className="dashboard-stat-grid">
      {[1, 2, 3].map((i) => (
        <div key={i} className="dashboard-stat skeleton" />
      ))}
    </div>
  );
}

export default function DashboardOverview({ role }) {
  // Role is part of the key so a role switch never shows another role's metrics.
  const dashboardQuery = useApiQuery(['dashboard', role], '/dashboard');
  const data = dashboardQuery.data?.data ?? null;
  const loading = dashboardQuery.isPending;
  const error = dashboardQuery.error?.message ?? '';

  return (
    <section className="dashboard-overview" aria-label={`${role} dashboard overview`}>
      {error ? (
        <div className="form-alert" role="alert">
          {error}
          <button className="inline-button" onClick={() => dashboardQuery.refetch()}>Retry</button>
        </div>
      ) : null}

      {loading ? <StatSkeleton /> : data ? (
        <>
          {/* ── Stat cards ── */}
          <div className="dashboard-stat-grid">
            {data.metrics.map((metric, i) => (
              <article className={`dashboard-stat ${i === 0 ? 'stat-accent' : ''}`} key={metric.label}>
                <div className="stat-icon">{getIcon(metric.label)}</div>
                <div className="stat-body">
                  <span className="stat-label">{metric.label}</span>
                  <strong className="stat-value">{metric.value}</strong>
                </div>
              </article>
            ))}
          </div>

          {/* ── Upcoming deadlines ── */}
          {role !== 'admin' ? (
            <section className="dashboard-deadlines" aria-labelledby="deadline-heading">
              <div className="section-heading" style={{ marginBottom: 16 }}>
                <div>
                  <p className="eyebrow">PLAN AHEAD</p>
                  <h2 id="deadline-heading" style={{ margin: '6px 0 0', fontSize: 22 }}>Upcoming deadlines</h2>
                </div>
              </div>
              {data.deadlines.length ? (
                <div className="deadline-list">
                  {data.deadlines.map((item) => (
                    <article className="deadline-item" key={`${item.kind}-${item.id}`}>
                      <div className="deadline-kind-badge">{item.kind}</div>
                      <div className="deadline-info">
                        <strong>{item.title}</strong>
                        <span>{item.course?.code ?? ''}</span>
                      </div>
                      <time dateTime={item.due_at} className="deadline-time">{deadlineLabel(item.due_at)}</time>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state dashboard-empty">
                  <span>🎉</span>
                  <h2>All caught up!</h2>
                  <p>No upcoming deadlines right now.</p>
                </div>
              )}
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

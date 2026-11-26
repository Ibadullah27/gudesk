import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider.jsx';
import { GuestRoute, ProtectedRoute } from './auth/ProtectedRoute.jsx';
import { RoleRoute } from './auth/RoleRoute.jsx';
import NotificationCenter from './components/NotificationCenter.jsx';
import BrandMark from './components/BrandMark.jsx';
import { ToastProvider } from './components/ToastContext.jsx';

const ChangePasswordPage     = lazy(() => import('./pages/auth/ChangePasswordPage.jsx'));
const ForgotPasswordPage     = lazy(() => import('./pages/auth/ForgotPasswordPage.jsx'));
const LoginPage              = lazy(() => import('./pages/auth/LoginPage.jsx'));
const ResetPasswordPage      = lazy(() => import('./pages/auth/ResetPasswordPage.jsx'));
const AdminWorkspace         = lazy(() => import('./pages/workspace/AdminWorkspace.jsx'));
const CoursesWorkspace       = lazy(() => import('./pages/workspace/CoursesWorkspace.jsx'));
const StudentMarksPage       = lazy(() => import('./pages/workspace/StudentMarksPage.jsx'));
const AnnouncementsWorkspace = lazy(() => import('./pages/workspace/AnnouncementsWorkspace.jsx'));
const ComplaintsWorkspace    = lazy(() => import('./pages/workspace/ComplaintsWorkspace.jsx'));
const ProfileWorkspace       = lazy(() => import('./pages/workspace/ProfileWorkspace.jsx'));
const DashboardOverview      = lazy(() => import('./pages/workspace/DashboardOverview.jsx'));

function RouteLoading() {
  return (
    <main className="auth-loading" aria-live="polite">
      <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
      Opening GU-DESK…
    </main>
  );
}

function SectionLoading() {
  return <div className="data-state" role="status">Loading…</div>;
}

/* ── Icons (stroke icons share one wrapper) ── */
function Icon({ children, size = 19 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const ICONS = {
  dashboard: <Icon><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Icon>,
  users: <Icon><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Icon>,
  courses: <Icon><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></Icon>,
  marks: <Icon><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></Icon>,
  announcements: <Icon><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></Icon>,
  complaints: <Icon><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><line x1="12" y1="7.5" x2="12" y2="11" /><line x1="12" y1="14" x2="12.01" y2="14" /></Icon>,
  profile: <Icon><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Icon>,
  moon: <Icon size={18}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></Icon>,
  sun: <Icon size={18}><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></Icon>,
  signout: <Icon size={16}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></Icon>,
  menu: <Icon size={22}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></Icon>,
};

/**
 * Sidebar sections per role (spec §8: clean sidebar layout per role).
 * Each section is a real URL: /{role}/{section}; the dashboard is /{role}.
 */
const NAV_BY_ROLE = {
  admin: [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'users', label: 'Users' },
    { key: 'courses', label: 'Courses' },
    { key: 'announcements', label: 'Announcements' },
    { key: 'complaints', label: 'Complaints' },
  ],
  teacher: [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'courses', label: 'My courses' },
    { key: 'announcements', label: 'Announcements' },
    { key: 'complaints', label: 'Complaints' },
  ],
  student: [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'courses', label: 'My courses' },
    { key: 'marks', label: 'My marks' },
    { key: 'announcements', label: 'Announcements' },
    { key: 'complaints', label: 'Complaints' },
  ],
};
const ACCOUNT_NAV = [{ key: 'profile', label: 'Profile' }];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function useTheme() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('gudesk-theme') === 'dark'; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : '';
    try { localStorage.setItem('gudesk-theme', dark ? 'dark' : 'light'); } catch { /* storage unavailable */ }
  }, [dark]);
  return [dark, () => setDark((value) => !value)];
}

function NavButton({ item, active, onSelect }) {
  return (
    <button
      type="button"
      className={`sidebar-nav-btn ${active ? 'active' : ''}`}
      onClick={() => onSelect(item.key)}
      aria-current={active ? 'page' : undefined}
    >
      <span className="sidebar-nav-icon">{ICONS[item.key]}</span>
      <span className="sidebar-nav-label">{item.label}</span>
    </button>
  );
}

/** Dashboard content per role. */
function Dashboard({ profile, goTo }) {
  const firstName = profile.full_name.split(' ')[0];
  const intro = {
    admin: 'Manage accounts, courses, and institution-wide notices from one place.',
    teacher: 'Your courses, ungraded work, and upcoming deadlines at a glance.',
    student: 'Your courses, pending work, and upcoming deadlines at a glance.',
  }[profile.role];

  return (
    <>
      <div className="page-intro">
        <p className="eyebrow">{profile.role} workspace</p>
        <h1>{greeting()}, <em>{firstName}.</em></h1>
        <p>{intro}</p>
      </div>
      <DashboardOverview role={profile.role} />
      {profile.role === 'admin' ? (
        <section className="quick-actions" aria-label="Quick actions">
          <button type="button" className="quick-action" onClick={() => goTo('users')}>
            <span className="quick-action-icon">{ICONS.users}</span>
            <span><strong>Manage users</strong><small>Create accounts, reset passwords, import CSV</small></span>
          </button>
          <button type="button" className="quick-action" onClick={() => goTo('courses')}>
            <span className="quick-action-icon">{ICONS.courses}</span>
            <span><strong>Manage courses</strong><small>Assign teachers and enroll students</small></span>
          </button>
          <button type="button" className="quick-action" onClick={() => goTo('complaints')}>
            <span className="quick-action-icon">{ICONS.complaints}</span>
            <span><strong>Review complaints</strong><small>Respond to open and in-review items</small></span>
          </button>
        </section>
      ) : (
        <CoursesWorkspace role={profile.role} profileId={profile.id} compact onViewAll={() => goTo('courses')} />
      )}
      <AnnouncementsWorkspace role={profile.role} compact />
    </>
  );
}

function WorkspaceHome() {
  const { profile, setProfile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, toggleTheme] = useTheme();

  const navItems = NAV_BY_ROLE[profile.role] ?? [];
  const allItems = [...navItems, ...ACCOUNT_NAV];
  const section = location.pathname.split('/')[2] || 'dashboard';
  const current = allItems.find((item) => item.key === section);

  // Close the mobile drawer whenever the page changes.
  useEffect(() => { setSidebarOpen(false); }, [section]);
  // Move focus/scroll to the top of a new page.
  useEffect(() => { window.scrollTo({ top: 0 }); }, [section]);

  // Unknown or other-role sections fall back to this role's dashboard.
  if (!current) return <Navigate to={`/${profile.role}`} replace />;

  function goTo(key) {
    navigate(key === 'dashboard' ? `/${profile.role}` : `/${profile.role}/${key}`);
  }

  const initials = profile.full_name
    ? profile.full_name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()
    : 'U';

  function renderSection() {
    switch (section) {
      case 'users': return <AdminWorkspace key="users" section="users" profileId={profile.id} />;
      case 'courses':
        return profile.role === 'admin'
          ? <AdminWorkspace key="courses" section="courses" profileId={profile.id} />
          : <CoursesWorkspace role={profile.role} profileId={profile.id} />;
      case 'marks': return <StudentMarksPage />;
      case 'announcements': return <AnnouncementsWorkspace role={profile.role} />;
      case 'complaints': return <ComplaintsWorkspace role={profile.role} />;
      case 'profile': return <ProfileWorkspace onProfileUpdated={(changes) => setProfile((value) => ({ ...value, ...changes }))} />;
      default: return <Dashboard profile={profile} goTo={goTo} />;
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      {sidebarOpen ? <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" /> : null}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} aria-label="Sidebar">
        <div className="sidebar-brand">
          <BrandMark />
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">GU-DESK</span>
            <span className="sidebar-brand-sub">GU School of Technology</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <p className="sidebar-group-label">Workspace</p>
          {navItems.map((item) => <NavButton key={item.key} item={item} active={item.key === section} onSelect={goTo} />)}
          <p className="sidebar-group-label">Account</p>
          {ACCOUNT_NAV.map((item) => <NavButton key={item.key} item={item} active={item.key === section} onSelect={goTo} />)}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="sidebar-theme-btn" onClick={toggleTheme} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
            {dark ? ICONS.sun : ICONS.moon}
            <span>{dark ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <div className="sidebar-user">
            <div className="sidebar-user-avatar" aria-hidden="true">{initials}</div>
            <div className="sidebar-user-info">
              <strong>{profile.full_name}</strong>
              <span className="sidebar-user-role">{profile.role}{profile.roll_no ? ` · ${profile.roll_no}` : ''}</span>
            </div>
            <button type="button" className="sidebar-signout" onClick={signOut} aria-label="Sign out" title="Sign out">
              {ICONS.signout}
            </button>
          </div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button type="button" className="topbar-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">{ICONS.menu}</button>
          <div className="topbar-brand">
            <BrandMark className="brand-mark-mobile" />
            <span className="topbar-name">GU-DESK</span>
          </div>
          <div className="topbar-title">
            <span>{profile.role}</span>
            <strong>{current.label}</strong>
          </div>
          <div className="topbar-actions">
            <button type="button" className="topbar-theme-btn" onClick={toggleTheme} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
              {dark ? ICONS.sun : ICONS.moon}
            </button>
            <NotificationCenter profileId={profile.id} />
          </div>
        </header>

        <main id="main-content" className="page-content" tabIndex={-1}>
          <Suspense fallback={<SectionLoading />}>
            <div className="page-enter" key={section}>{renderSection()}</div>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/login"           element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password"  element={<ResetPasswordPage />} />
          <Route path="/change-password" element={<ProtectedRoute allowPasswordChange><ChangePasswordPage /></ProtectedRoute>} />
          <Route path="/admin/*"   element={<RoleRoute roles={['admin']}><WorkspaceHome /></RoleRoute>} />
          <Route path="/teacher/*" element={<RoleRoute roles={['teacher']}><WorkspaceHome /></RoleRoute>} />
          <Route path="/student/*" element={<RoleRoute roles={['student']}><WorkspaceHome /></RoleRoute>} />
          <Route path="/"          element={<ProtectedRoute><RoleHome /></ProtectedRoute>} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ToastProvider>
  );
}

/** `/` redirects to the signed-in user's role dashboard. */
function RoleHome() {
  const { profile } = useAuth();
  return <Navigate to={`/${profile.role}`} replace />;
}

export default App;

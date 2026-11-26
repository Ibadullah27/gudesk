import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider.jsx';

function LoadingState() {
  return <main className="auth-loading" aria-live="polite"><span className="loading-dot" />Checking your session…</main>;
}

export function ProtectedRoute({ children, allowPasswordChange = false }) {
  const { profile, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <LoadingState />;
  if (!profile) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (profile.must_change_password && !allowPasswordChange) return <Navigate to="/change-password" replace />;
  if (!profile.must_change_password && location.pathname === '/change-password') {
    return <Navigate to={`/${profile.role}`} replace />;
  }
  return children;
}

export function GuestRoute({ children }) {
  const { profile, isLoading } = useAuth();
  if (isLoading) return <LoadingState />;
  if (profile) return <Navigate to={profile.must_change_password ? '/change-password' : `/${profile.role}`} replace />;
  return children;
}

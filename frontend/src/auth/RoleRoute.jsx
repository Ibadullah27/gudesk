import { Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import { useAuth } from './AuthProvider.jsx';

export function RoleRoute({ roles, children }) {
  const { profile } = useAuth();
  return (
    <ProtectedRoute>
      {roles.includes(profile?.role) ? children : <Navigate to={`/${profile?.role ?? ''}`} replace />}
    </ProtectedRoute>
  );
}

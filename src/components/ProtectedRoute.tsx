import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';

export default function ProtectedRoute({ children, allowedRoles }: { children: JSX.Element; allowedRoles?: Role[] }) {
  const { user, role, loading } = useAuth();

  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && role && !allowedRoles.includes(role)) return <Navigate to="/" replace />;

  return children;
}

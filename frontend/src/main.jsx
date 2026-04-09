import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';
import WorkerDashboard from './pages/WorkerDashboard';
import AdminDashboard from './pages/AdminDashboard';

function PrivateRoute({ children, adminOnly = false }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-sm text-slate-600">Loading account...</div>;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!user.active) return <div className="p-6 text-center text-red-600">Your account is disabled. Contact an admin.</div>;
  if (adminOnly && !isAdmin) return <Navigate to="/worker" replace />;
  return children;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={(
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            )}
          >
            <Route index element={<Navigate to="/worker" replace />} />
            <Route path="worker" element={<WorkerDashboard />} />
            <Route
              path="admin"
              element={(
                <PrivateRoute adminOnly>
                  <AdminDashboard />
                </PrivateRoute>
              )}
            />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  </React.StrictMode>
);

import { Link, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import SalesPage from './pages/SalesPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import ProductsPage from './pages/ProductsPage';
import MapPage from './pages/MapPage';

function Shell({ children }: { children: React.ReactNode }) {
  const { role, logout, user } = useAuth();
  return (
    <div className="mx-auto max-w-6xl p-4">
      {user && (
        <nav className="mb-4 flex flex-wrap gap-2 rounded-xl bg-white p-3 shadow">
          <Link to="/" className="px-2 py-1">Sales</Link>
          <Link to="/map" className="px-2 py-1">Map</Link>
          {role === 'admin' && (
            <>
              <Link to="/admin" className="px-2 py-1">Dashboard</Link>
              <Link to="/products" className="px-2 py-1">Products</Link>
            </>
          )}
          <button className="ml-auto" onClick={() => logout()}>Logout</button>
        </nav>
      )}
      {children}
    </div>
  );
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute allowedRoles={['worker', 'admin']}>
              <SalesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/map"
          element={
            <ProtectedRoute allowedRoles={['worker', 'admin']}>
              <MapPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ProductsPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Shell>
  );
}

import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function NavLink({ to, children }) {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link
      to={to}
      className={`rounded-md px-3 py-2 text-sm font-medium ${active ? 'bg-blue-100 text-blue-700' : 'text-slate-700 hover:bg-slate-100'}`}
    >
      {children}
    </Link>
  );
}

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <header className="mb-4 rounded-xl bg-white p-4 shadow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">WheelyDealy</h1>
            <p className="text-sm text-slate-600">
              {user?.name} • {user?.role}
            </p>
          </div>
          <button className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white" onClick={logout}>
            Logout
          </button>
        </div>
        <nav className="mt-3 flex flex-wrap gap-2">
          <NavLink to="/worker">Worker Dashboard</NavLink>
          {isAdmin && <NavLink to="/admin">Admin Dashboard</NavLink>}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}

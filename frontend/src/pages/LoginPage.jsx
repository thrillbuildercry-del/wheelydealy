import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { loginWithGoogle, loginWithEmail, signupWithEmail } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const onEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        await signupWithEmail(form);
      } else {
        await loginWithEmail(form);
      }
      navigate('/worker');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/worker');
    } catch (err) {
      setError(err.message || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg">
        <h1 className="text-xl font-bold">WheelyDealy Login</h1>
        <p className="mt-1 text-sm text-slate-600">Simple sign in for workers and admins.</p>

        <div className="mt-4 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm">
          <button className={`rounded-md p-2 ${mode === 'login' ? 'bg-white shadow' : ''}`} onClick={() => setMode('login')}>Sign In</button>
          <button className={`rounded-md p-2 ${mode === 'signup' ? 'bg-white shadow' : ''}`} onClick={() => setMode('signup')}>Create Account</button>
        </div>

        <form className="mt-4 space-y-3" onSubmit={onEmailSubmit}>
          {mode === 'signup' && (
            <input
              className="w-full rounded-lg border p-2"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              required
            />
          )}
          <input
            className="w-full rounded-lg border p-2"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border p-2"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            required
            minLength={6}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button disabled={loading} className="w-full rounded-lg bg-blue-600 p-2 font-medium text-white disabled:opacity-60">
            {loading ? 'Please wait...' : mode === 'signup' ? 'Create Worker Account' : 'Sign In'}
          </button>
        </form>

        <div className="my-4 text-center text-xs text-slate-500">OR</div>

        <button
          onClick={onGoogle}
          disabled={loading}
          className="w-full rounded-lg border border-slate-300 p-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
        >
          Continue with Google
        </button>

        <p className="mt-4 text-xs text-slate-500">
          New signups are created as <strong>worker</strong>. Admins can promote users from the Admin Dashboard.
        </p>
      </div>
    </div>
  );
}

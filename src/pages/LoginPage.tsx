import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (user) return <Navigate to="/" />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
    } catch {
      setError('Invalid credentials');
    }
  };

  return (
    <form onSubmit={onSubmit} className="card mx-auto mt-20 max-w-md space-y-3">
      <h1 className="text-xl font-bold">Sign in</h1>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p className="text-red-600">{error}</p>}
      <button className="w-full bg-blue-600 text-white">Login</button>
    </form>
  );
}

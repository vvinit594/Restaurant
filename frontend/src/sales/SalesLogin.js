import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Loader from '../components/Loader';
import { useSalesAuth } from './auth/SalesAuthContext';

export default function SalesLogin() {
  const { login, isAuthenticated, isSalesPerson, bootstrapping } = useSalesAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from || '/sales/dashboard';

  if (bootstrapping) {
    return <Loader variant="fullscreen" label="Checking sales session…" />;
  }

  if (isAuthenticated && isSalesPerson) {
    return <Navigate to="/sales/dashboard" replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    setLoading(true);
    try {
      await login({ email: trimmedEmail, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <form className="admin-login-card" onSubmit={onSubmit}>
        <div className="admin-login-brand">
          <span className="admin-pill">DilYum</span>
          <h1>Sales Login</h1>
          <p className="admin-muted">Sign in to your Sales Person panel.</p>
        </div>
        {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}
        <label className="admin-field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </label>
        <label className="admin-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </label>
        <button type="submit" className="admin-btn admin-btn-primary" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

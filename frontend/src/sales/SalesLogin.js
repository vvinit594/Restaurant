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
    if (!trimmedEmail) {
      setError('Please enter your sales email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
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
      <div className="admin-login-card">
        <div className="admin-login-brand">
          <span className="admin-pill">DILYUM</span>
          <h1>Sales Person Login</h1>
          <p>Sign in to onboard restaurants, track QR codes, and view commissions.</p>
        </div>

        <form className="admin-form" onSubmit={onSubmit} noValidate>
          <label className="admin-field">
            <span>Sales Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sales@example.com"
              required
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
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </label>

          {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}

          <button
            type="submit"
            className="admin-btn admin-btn-primary admin-btn-block"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Next'}
          </button>
        </form>
      </div>
    </div>
  );
}

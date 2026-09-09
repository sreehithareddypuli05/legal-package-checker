import { useEffect, useState } from 'react';
import { Globe2, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { login } from '../services/api';

export default function Login({ registered = false }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [registeredMessage, setRegisteredMessage] = useState('');

  useEffect(() => {
    if (registered) {
      setRegisteredMessage('Account created successfully. Please sign in.');
    }

    const params = new URLSearchParams(location.search);
    const oauthError = params.get('error');

    if (oauthError) {
      setError(oauthError);
    }
  }, [location.search, registered]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      const data = await login(email, password);

      localStorage.setItem('lm_token', data.token);
      localStorage.setItem('lm_user', JSON.stringify(data.user));

      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  const googleUrl = `${
    import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'
  }/api/auth/google`;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <ShieldCheck size={28} />
        </div>

        <div className="auth-heading">
          <p className="eyebrow">LEGAL METROLOGY · SIH26034</p>
          <h1>Welcome back</h1>
          <p>Sign in to continue to MetrologyCheck.</p>
        </div>

        {registeredMessage && <div className="success">{registeredMessage}</div>}

        {error && <div className="error">{error}</div>}

        <form className="auth-form" onSubmit={submit}>
          <label>
            Email address
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </label>

          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="or-divider">
          <span>OR</span>
        </div>

        <a className="google-button" href={googleUrl}>
          <Globe2 size={18} />
          Continue with Google
        </a>

        <p className="auth-switch">
          Don't have an account? <Link to="/signup">Create an account</Link>
        </p>

        <small className="auth-note">
          New accounts are created as Inspector accounts. Supervisor and Admin
          roles are assigned by an authorized administrator.
        </small>
      </div>
    </div>
  );
}

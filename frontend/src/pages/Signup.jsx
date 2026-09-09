import { useState } from 'react';
import { Globe2, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { signup } from '../services/api';

export default function Signup() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);

    try {
      await signup(name, email, password);
      navigate('/login?registered=1', { replace: true });
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
      <div className="auth-card auth-card-signup">
        <div className="auth-logo">
          <ShieldCheck size={28} />
        </div>

        <div className="auth-heading">
          <p className="eyebrow">CREATE ACCOUNT</p>
          <h1>Get started</h1>
          <p>Create your Inspector account to begin inspections.</p>
        </div>

        {error && <div className="error">{error}</div>}

        <form className="auth-form" onSubmit={submit}>
          <label>
            Full name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              type="text"
              placeholder="Your full name"
              autoComplete="name"
              minLength={2}
              required
            />
          </label>

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
              placeholder="At least 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <label>
            Confirm password
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              placeholder="Re-enter your password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="or-divider">
          <span>OR</span>
        </div>

        <a className="google-button" href={googleUrl}>
          <Globe2 size={18} />
          Sign up with Google
        </a>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>

        <small className="auth-note">
          Google accounts are automatically registered and signed in as an
          Inspector on their first login.
        </small>
      </div>
    </div>
  );
}

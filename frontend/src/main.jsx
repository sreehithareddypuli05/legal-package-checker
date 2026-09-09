import { useEffect, useState } from 'react';
import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import './styles.css';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Inspect from './pages/Inspect';
import Login from './pages/Login';
import Result from './pages/Result';
import Signup from './pages/Signup';
import Layout from './components/Layout';
import { me } from './services/api';

function Protected() {
  const [status, setStatus] = useState('checking');
  const token = localStorage.getItem('lm_token');

  useEffect(() => {
    if (!token) {
      setStatus('unauthenticated');
      return;
    }

    me()
      .then((data) => {
        localStorage.setItem('lm_user', JSON.stringify(data.user));
        setStatus('authenticated');
      })
      .catch(() => {
        localStorage.removeItem('lm_token');
        localStorage.removeItem('lm_user');
        setStatus('unauthenticated');
      });
  }, [token]);

  if (status === 'checking') {
    return (
      <div className="auth-loading">
        <div className="spinner" />
        <p>Checking your session…</p>
      </div>
    );
  }

  return status === 'authenticated' ? (
    <Layout />
  ) : (
    <Navigate to="/login" replace />
  );
}

function OAuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');

    if (token) {
      localStorage.setItem('lm_token', token);
      navigate('/dashboard', { replace: true });
      return;
    }

    navigate('/login?error=Google%20login%20failed', { replace: true });
  }, [location.search, navigate]);

  return (
    <div className="auth-loading">
      <div className="spinner" />
      <p>Completing Google authentication…</p>
    </div>
  );
}

function LoginRoute() {
  const location = useLocation();
  const registered = new URLSearchParams(location.search).get('registered');

  return <Login registered={registered === '1'} />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/oauth-callback" element={<OAuthCallback />} />

      <Route element={<Protected />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/inspect" element={<Inspect />} />
        <Route path="/history" element={<History />} />
        <Route path="/result/:id" element={<Result />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

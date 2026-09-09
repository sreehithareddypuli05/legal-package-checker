const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const BACKEND =
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

function authHeaders() {
  const token = localStorage.getItem('lm_token');

  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(url, options = {}) {
  const response = await fetch(`${API}${url}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Request failed.');
  }

  return data;
}

export const signup = (name, email, password) =>
  request('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

export const login = (email, password) =>
  request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

export const me = () => request('/auth/me');

export const getInspections = () => request('/inspections');

export const getInspection = (id) => request(`/inspections/${id}`);

export async function createInspection(data) {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (key === 'images') {
      value.forEach((file) => formData.append('images', file));
    } else {
      formData.append(key, value ?? '');
    }
  });

  return request('/inspections', {
    method: 'POST',
    body: formData,
  });
}

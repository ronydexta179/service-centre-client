import { io } from 'socket.io-client';

const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export async function apiRequest(user, path, { method = 'GET', body, headers = {}, forceRefreshToken = false } = {}) {
  const token = await user.getIdToken(forceRefreshToken);
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || `Request failed (${response.status})`);
  }

  return response.status === 204 ? null : response.json();
}

export async function connectRealtime(user) {
  const token = await user.getIdToken();
  return io(apiUrl, { auth: { token } });
}

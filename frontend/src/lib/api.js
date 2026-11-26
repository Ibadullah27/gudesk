import { env } from '../config/env.js';
import { supabase } from './supabaseClient.js';

export async function apiFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(`${env.VITE_API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options.headers,
    },
  });
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : null;
  if (!response.ok) {
    const error = new Error(payload?.error?.message ?? `Request failed (${response.status})`);
    error.code = payload?.error?.code;
    error.details = payload?.error?.details ?? [];
    error.status = response.status;
    // Spec §7.1: expired or revoked tokens redirect to login. Signing out fires
    // SIGNED_OUT, which clears the profile so ProtectedRoute sends the user to /login.
    if (session && response.status === 401 && error.code === 'UNAUTHORIZED') {
      await supabase.auth.signOut().catch(() => {});
    }
    throw error;
  }
  if (!payload) throw new Error('The server returned an unexpected response.');
  return payload;
}

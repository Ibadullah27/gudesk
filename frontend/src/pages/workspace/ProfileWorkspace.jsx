import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api.js';
import { useApiQuery } from '../../lib/queryClient.js';
import { useNoticeState } from '../../components/ToastContext.jsx';
import { uploadToSignedUrl } from '../../lib/fileUploads.js';
import { supabase } from '../../lib/supabaseClient.js';

const blankProfile = { full_name: '', phone: '', contact_email: '' };
const allowedPhotoTypes = new Map([['image/jpeg', '.jpg,.jpeg'], ['image/png', '.png'], ['image/webp', '.webp']]);

export default function ProfileWorkspace({ onProfileUpdated }) {
  const profileQuery = useApiQuery(['me', 'profile'], '/me/profile');
  const data = profileQuery.data?.data ?? null;
  const loading = profileQuery.isPending;
  const [form, setForm] = useState(blankProfile);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [photo, setPhoto] = useState(null);
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setError] = useState('');
  const [notice, setNotice] = useNoticeState();
  const error = actionError || profileQuery.error?.message || '';
  const refresh = () => profileQuery.refetch();

  // Reset the editable fields whenever a fresh profile arrives from the server.
  const loadedProfile = data?.profile;
  useEffect(() => {
    if (!loadedProfile) return;
    setForm({ full_name: loadedProfile.full_name ?? '', phone: loadedProfile.phone ?? '', contact_email: loadedProfile.contact_email ?? '' });
  }, [loadedProfile]);

  async function saveProfile(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await apiFetch('/me/profile', { method: 'PATCH', body: JSON.stringify({ full_name: form.full_name.trim(), phone: form.phone.trim() || null, contact_email: form.contact_email.trim() || null }) });
      onProfileUpdated?.({ full_name: form.full_name.trim() }); setNotice('Profile details updated.'); refresh();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function uploadPhoto(event) {
    event.preventDefault(); setError(''); setNotice('');
    if (!photo) { setError('Choose a profile photo first.'); return; }
    if (!allowedPhotoTypes.has(photo.type)) { setError('Choose a JPG, PNG, or WebP photo.'); return; }
    if (!photo.size || photo.size > 5 * 1024 * 1024) { setError('Profile photos must be 5 MB or smaller.'); return; }
    setBusy(true); setProgress(0);
    try {
      const grant = await apiFetch('/me/profile/photo/upload-url', { method: 'POST', body: JSON.stringify({ file_name: photo.name, mime_type: photo.type, size_bytes: photo.size }) });
      const { data: { session } } = await supabase.auth.getSession();
      await uploadToSignedUrl(grant.data.signed_url, photo, photo.type, session?.access_token, setProgress);
      await apiFetch('/me/profile/photo', { method: 'PATCH', body: JSON.stringify({ file_path: grant.data.file_path }) });
      setPhoto(null); setProgress(null); setNotice('Profile photo updated.'); refresh();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function removePhoto() {
    setBusy(true); setError(''); setNotice('');
    try { await apiFetch('/me/profile/photo', { method: 'DELETE' }); setNotice('Profile photo removed.'); refresh(); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function changePassword(event) {
    event.preventDefault(); setError(''); setNotice('');
    if (newPassword !== confirmPassword) { setError('The new passwords do not match.'); return; }
    setBusy(true);
    try {
      await apiFetch('/me/profile/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setNotice('Password changed successfully.');
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  if (loading) return <section className="classroom-section"><div className="data-state" role="status">Loading profile…</div></section>;
  if (!data) return <section className="classroom-section"><div className="form-alert" role="alert">{error || 'Could not load your profile.'} <button className="inline-button" onClick={() => refresh()}>Retry</button></div></section>;
  const { profile, role_info: roleInfo } = data;
  const initials = profile.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <section className="classroom-section profile-workspace" aria-labelledby="profile-heading">
    <div className="section-heading"><div><p className="eyebrow">ACCOUNT SETTINGS</p><h1 id="profile-heading">Your profile</h1></div><span className="role-tag">{profile.role}</span></div>
    {error ? <div className="form-alert" role="alert">{error}</div> : null}{notice ? <p className="success-alert" role="status">{notice}</p> : null}
    <div className="profile-grid">
      <section className="profile-card profile-photo-card" aria-labelledby="photo-heading"><h2 id="photo-heading">Profile photo</h2><div className="profile-avatar">{profile.photo_url ? <img src={profile.photo_url} alt={`${profile.full_name} profile`} /> : <span aria-hidden="true">{initials}</span>}</div><form className="profile-photo-form" onSubmit={uploadPhoto}><label>Choose photo<input type="file" accept={Array.from(allowedPhotoTypes.values()).join(',')} onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /></label>{photo ? <small className="selected-file">{photo.name} · {(photo.size / 1024 / 1024).toFixed(1)} MB</small> : null}{progress !== null ? <div className="upload-progress" role="status"><span>Uploading</span><progress max="100" value={progress}>{progress}%</progress><strong>{progress}%</strong></div> : null}<button className="secondary-button" disabled={busy || !photo}>{busy ? 'Uploading…' : 'Update photo'}</button>{profile.photo_url ? <button className="inline-button remove-student" type="button" disabled={busy} onClick={removePhoto}>Remove photo</button> : null}</form><p className="profile-note">JPG, PNG, or WebP · 5 MB maximum</p></section>
      <form className="profile-card profile-details-form" onSubmit={saveProfile}><h2>Contact details</h2><label>Full name<input required minLength="2" maxLength="120" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label><label>Sign-in email<input value={profile.email} readOnly /></label><label>Contact email <span className="optional-label">Optional</span><input type="email" maxLength="254" value={form.contact_email} onChange={(event) => setForm({ ...form, contact_email: event.target.value })} /></label><label>Phone <span className="optional-label">Optional</span><input type="tel" maxLength="30" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></form>
      <section className="profile-card role-info-card"><h2>Account information</h2><dl><div><dt>Role</dt><dd>{profile.role}</dd></div>{profile.role === 'student' ? <div><dt>Roll number</dt><dd>{profile.roll_no || 'Not assigned'}</dd></div> : null}<div><dt>Account since</dt><dd>{new Date(profile.created_at).toLocaleDateString()}</dd></div></dl><h3>{roleInfo.label}</h3>{roleInfo.courses.length ? <ul>{roleInfo.courses.map((course) => <li key={course.id}><span>{course.code}</span>{course.title}</li>)}</ul> : <p className="profile-note">{profile.role === 'admin' ? 'Institution administrator access' : 'No courses assigned yet.'}</p>}</section>
      <form className="profile-card profile-password-form" onSubmit={changePassword}><h2>Change password</h2><p className="profile-note">Confirm your current password before choosing a new one.</p><label>Current password<input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label>New password<input type="password" autoComplete="new-password" required minLength="8" maxLength="128" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label>Confirm new password<input type="password" autoComplete="new-password" required minLength="8" maxLength="128" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label><small className="profile-note">At least 8 characters, including a letter and a number.</small><button className="secondary-button" disabled={busy || !currentPassword || !newPassword || !confirmPassword}>{busy ? 'Updating…' : 'Change password'}</button></form>
    </div>
  </section>;
}

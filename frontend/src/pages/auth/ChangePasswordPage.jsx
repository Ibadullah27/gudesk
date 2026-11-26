import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { passwordFormSchema } from '../../auth/authSchemas.js';
import { apiFetch } from '../../lib/api.js';
import FormField from '../../components/FormField.jsx';
import BrandMark from '../../components/BrandMark.jsx';

export default function ChangePasswordPage() {
  const { profile, setProfile } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ mode: 'onBlur' });

  const onSubmit = async (values) => {
    setFormError('');
    const parsed = passwordFormSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => setError(issue.path[0], { message: issue.message }));
      return;
    }
    try {
      const response = await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword: parsed.data.newPassword }),
      });
      setProfile(response.data);
      navigate(`/${profile.role}`, { replace: true });
    } catch (error) {
      setFormError(error.message || 'The password could not be changed. Please try again.');
    }
  };

  return (
    <main className="auth-page auth-page-centered min-h-screen">
      <section className="auth-panel compact-panel" aria-labelledby="change-title">
        <div className="auth-brand">
          <BrandMark />
          <span>
            <span className="brand-name">GU-DESK</span>
            <span className="brand-sub">Ghazali University · School of Technology</span>
          </span>
        </div>
        <p className="eyebrow">SECURE YOUR ACCOUNT</p>
        <h1 id="change-title">One quick<br /><em>update.</em></h1>
        <p className="auth-intro">Choose a new password to continue to your classroom.</p>
        <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {formError && <div className="form-alert" role="alert">{formError}</div>}
          <FormField label="New password" name="newPassword" type="password" autoComplete="new-password" register={register} error={errors.newPassword} placeholder="At least 8 characters" />
          <FormField label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" register={register} error={errors.confirmPassword} placeholder="Enter it again" />
          <p className="password-hint">Use at least 8 characters with a letter and a number.</p>
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Updating…' : 'Set new password'} <span aria-hidden="true">↗</span>
          </button>
        </form>
      </section>
    </main>
  );
}

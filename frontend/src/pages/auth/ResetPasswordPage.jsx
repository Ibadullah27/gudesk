import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { passwordFormSchema } from '../../auth/authSchemas.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { apiFetch } from '../../lib/api.js';
import { supabase } from '../../lib/supabaseClient.js';
import FormField from '../../components/FormField.jsx';
import BrandMark from '../../components/BrandMark.jsx';

export default function ResetPasswordPage() {
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [formError, setFormError] = useState('');
  const { setProfile } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ mode: 'onBlur' });

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) setHasRecoverySession(Boolean(session));
      if (active) setIsCheckingSession(false);
    }).catch(() => { if (active) setIsCheckingSession(false); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) setHasRecoverySession(true);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

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
      navigate(`/${response.data.role}`, { replace: true });
    } catch (error) {
      setFormError(error.message || 'This reset link may have expired. Request a new one to continue.');
    }
  };

  return (
    <main className="auth-page auth-page-centered min-h-screen">
      <section className="auth-panel compact-panel" aria-labelledby="reset-title">
        <Link className="auth-brand" to="/login">
          <BrandMark />
          <span>
            <span className="brand-name">GU-DESK</span>
            <span className="brand-sub">Ghazali University · School of Technology</span>
          </span>
        </Link>
        <p className="eyebrow">PASSWORD RESET</p>
        <h1 id="reset-title">Make a fresh<br /><em>start.</em></h1>
        {isCheckingSession ? <p className="auth-intro" role="status">Verifying your reset link…</p> : !hasRecoverySession ? (
          <div className="form-alert" role="alert">
            This reset link is missing or has expired. <Link to="/forgot-password">Request another link.</Link>
          </div>
        ) : (
          <>
            <p className="auth-intro">Choose a new password for your account.</p>
            <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
              {formError && <div className="form-alert" role="alert">{formError} <Link to="/forgot-password">Request a fresh link.</Link></div>}
              <FormField label="New password" name="newPassword" type="password" autoComplete="new-password" register={register} error={errors.newPassword} placeholder="At least 8 characters" />
              <FormField label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" register={register} error={errors.confirmPassword} placeholder="Enter it again" />
              <p className="password-hint">Use at least 8 characters with a letter and a number.</p>
              <button className="primary-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save new password'} <span aria-hidden="true">↗</span>
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { forgotPasswordSchema } from '../../auth/authSchemas.js';
import { apiFetch } from '../../lib/api.js';
import FormField from '../../components/FormField.jsx';
import BrandMark from '../../components/BrandMark.jsx';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ mode: 'onBlur' });

  const onSubmit = async (values) => {
    setFormError('');
    const parsed = forgotPasswordSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => setError(issue.path[0], { message: issue.message }));
      return;
    }
    try {
      await apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify(parsed.data) });
      setSent(true);
    } catch {
      setFormError('We could not process that request right now. Please try again shortly.');
    }
  };

  return (
    <main className="auth-page auth-page-centered min-h-screen">
      <section className="auth-panel compact-panel" aria-labelledby="forgot-title">
        <Link className="auth-brand" to="/login">
          <BrandMark />
          <span>
            <span className="brand-name">GU-DESK</span>
            <span className="brand-sub">Ghazali University · School of Technology</span>
          </span>
        </Link>
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h1 id="forgot-title">A way<br /><em>back in.</em></h1>
        {sent ? (
          <div className="success-panel" role="status">
            <p>If an account exists for that email, password reset instructions have been sent.</p>
            <Link className="primary-button button-link" to="/login">Return to sign in <span aria-hidden="true">↗</span></Link>
          </div>
        ) : (
          <>
            <p className="auth-intro">Enter your school email and we’ll send instructions if an account matches.</p>
            <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
              {formError && <div className="form-alert" role="alert">{formError}</div>}
              <FormField label="Email address" name="email" type="email" autoComplete="email" register={register} error={errors.email} placeholder="you@school.edu" />
              <button className="primary-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Sending…' : 'Send reset link'} <span aria-hidden="true">↗</span>
              </button>
            </form>
          </>
        )}
        <p className="auth-footnote"><Link to="/login">← Back to sign in</Link></p>
      </section>
    </main>
  );
}

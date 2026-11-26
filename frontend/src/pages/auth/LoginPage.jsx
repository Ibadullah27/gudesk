import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { loginSchema } from '../../auth/authSchemas.js';
import FormField from '../../components/FormField.jsx';
import BrandMark from '../../components/BrandMark.jsx';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ mode: 'onBlur' });

  const onSubmit = async (values) => {
    setFormError('');
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => setError(issue.path[0], { message: issue.message }));
      return;
    }
    try {
      const profile = await signIn(parsed.data);
      navigate(profile.must_change_password ? '/change-password' : (location.state?.from || `/${profile.role}`), { replace: true });
    } catch (error) {
      setFormError(error.message || 'Unable to sign in. Please try again.');
    }
  };

  return (
    <main className="auth-page min-h-screen">
      <section className="auth-panel" aria-labelledby="login-title">
        <Link className="auth-brand" to="/" aria-label="GU-DESK home">
          <BrandMark />
          <span>
            <span className="brand-name">GU-DESK</span>
            <span className="brand-sub">Ghazali University · School of Technology</span>
          </span>
        </Link>
        <p className="eyebrow">WELCOME BACK</p>
        <h1 id="login-title">Your desk<br /><em>is ready.</em></h1>
        <p className="auth-intro">Sign in with the credentials provided by your administrator to access your academic workspace.</p>
        <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {formError && <div className="form-alert" role="alert">{formError}</div>}
          <FormField label="Email address" name="email" type="email" autoComplete="username" register={register} error={errors.email} placeholder="you@gutech.edu" />
          <FormField label="Password" name="password" type="password" autoComplete="current-password" register={register} error={errors.password} placeholder="Enter your password" />
          <div className="auth-form-meta"><Link to="/forgot-password">Forgot password?</Link></div>
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in to GU-DESK'} <span aria-hidden="true">↗</span>
          </button>
        </form>
        <p className="auth-footnote">Accounts are created by your school administrator. Need help? Contact IT support.</p>
      </section>
      <aside className="auth-aside" aria-hidden="true">
        <div className="auth-aside-grid" />
        <div className="aside-shape">
          <div className="aside-gu-logo">
            <span className="aside-gu-letters">GU</span>
            <span className="aside-gu-sub">TECH</span>
          </div>
        </div>
        <div className="aside-brand-badge">
          <span className="badge-dot" />
          GU-DESK Portal
        </div>
        <p>LEARN WITH<br /><em>purpose.</em></p>
        <small>GU TECH · GHAZALI UNIVERSITY SCHOOL OF TECHNOLOGY</small>
      </aside>
    </main>
  );
}

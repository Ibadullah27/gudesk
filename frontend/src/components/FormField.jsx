export default function FormField({ label, name, register, error, type = 'text', autoComplete, ...inputProps }) {
  const errorId = `${name}-error`;
  return (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...register(name)}
        {...inputProps}
      />
      {error && <span className="field-error" id={errorId}>{error.message}</span>}
    </div>
  );
}

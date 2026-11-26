export default function BrandMark({ className = '', title = 'GU-DESK' }) {
  return (
    <svg className={`brand-mark ${className}`.trim()} viewBox="0 0 32 32" role="img" aria-label={title}>
      <defs>
        <linearGradient id="brand-mark-gradient" x1="3" y1="2" x2="29" y2="31" gradientUnits="userSpaceOnUse">
          <stop stopColor="currentColor" />
          <stop offset="1" stopColor="#d64a4a" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#brand-mark-gradient)" />
      <path d="M9 9.5v7.25c0 3.32 2.36 5.25 7 5.25s7-1.93 7-5.25V9.5h-3.25v7.1c0 1.52-.91 2.3-3.75 2.3s-3.75-.78-3.75-2.3V9.5H9Z" fill="white" />
      <path d="M12 7h8" stroke="white" strokeWidth="1.55" strokeLinecap="round" opacity=".75" />
    </svg>
  );
}

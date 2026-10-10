import { useId } from 'react'

/**
 * Pixo mark: a geometric "P" built from a stem and a rounded bowl, with a detached square
 * "pixel" as the accent. The same geometry is used in /public/favicon.svg and /public/logo.svg.
 */
export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`pg-${id}`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7A73FF" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#pg-${id})`} />
      <rect x="8.5" y="7" width="5" height="18" rx="1.5" fill="#fff" />
      <path d="M13.5 7h4.75a6 6 0 0 1 0 12H13.5v-4.5h4.75a1.5 1.5 0 0 0 0-3H13.5Z" fill="#fff" />
      <rect x="19" y="20.5" width="4.5" height="4.5" rx="1.1" fill="#C9C6FF" />
    </svg>
  )
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={30} />
      <span className="font-brand text-[1.15rem] font-extrabold tracking-[0.06em] text-fg">
        PIXO<span className="ml-1 font-semibold tracking-normal text-brand-fg">AI</span>
      </span>
    </span>
  )
}

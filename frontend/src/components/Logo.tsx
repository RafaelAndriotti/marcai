/** Quadra vista de cima: linhas laterais, rede ao centro, áreas de saque. Decorativo; o nome é o texto "Marcaí". */
export function LogoMark({ className = 'size-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M12 5v14" />
      <path d="M2.5 9.5H7v5H2.5" />
      <path d="M21.5 9.5H17v5h4.5" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2 text-primary">
      <LogoMark />
      <span className="text-base font-semibold tracking-tight text-fg">Marcaí</span>
    </span>
  )
}

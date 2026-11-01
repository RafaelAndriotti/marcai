/** Barra cinza chapa no tamanho real do valor. Sem brilho animado. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`block rounded-sm bg-surface-2 ${className}`} />
}

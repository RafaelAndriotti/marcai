import { RefreshCw, TriangleAlert } from 'lucide-react'

interface Props {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: Props) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-card border border-danger-soft bg-danger-soft/40 px-4 py-12 text-center"
    >
      <span className="grid size-12 place-items-center rounded-full bg-danger-soft text-danger-fg">
        <TriangleAlert className="size-6" aria-hidden="true" />
      </span>
      <p className="font-semibold">Não foi possível carregar os dados</p>
      <p className="max-w-md text-sm text-muted">
        {message ?? 'Verifique sua conexão e se o servidor está em execução.'}
      </p>
      {onRetry && (
        <button type="button" className="btn-ghost" onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Tentar novamente
        </button>
      )}
    </div>
  )
}

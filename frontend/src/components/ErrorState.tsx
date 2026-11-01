import { TriangleAlert } from 'lucide-react'

interface Props {
  /** O que falhou, em palavras do ofício: "as reservas", "os pedidos". */
  what?: string
  message?: string
  onRetry?: () => void
}

/** Erro dentro do bloco que falhou: uma frase e um botão de texto. */
export function ErrorState({ what = 'os dados', message, onRetry }: Props) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-6">
      <TriangleAlert className="size-4 shrink-0 text-danger" strokeWidth={1.5} aria-hidden="true" />
      <p className="text-sm">
        Não foi possível carregar {what}.{' '}
        <span className="text-muted">{message ?? 'Verifique se o servidor está em execução.'}</span>
      </p>
      {onRetry && (
        <button type="button" className="btn-text" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  )
}

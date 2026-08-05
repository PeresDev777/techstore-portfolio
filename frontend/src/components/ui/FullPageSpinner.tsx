/**
 * Indicador de carregamento em tela cheia.
 *
 * Usado nas transições em que a aplicação ainda não sabe o que renderizar (restauração
 * de sessão). `role="status"` deixa o estado explícito para leitores de tela e dá à
 * automação um alvo estável para aguardar o fim do carregamento.
 */
export function FullPageSpinner({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div
      role="status"
      data-testid="page-loading"
      className="flex min-h-dvh flex-col items-center justify-center gap-3"
    >
      <span className="border-brand-600 size-8 animate-spin rounded-full border-3 border-t-transparent" />
      <span className="text-ink-500 text-sm">{label}</span>
    </div>
  )
}

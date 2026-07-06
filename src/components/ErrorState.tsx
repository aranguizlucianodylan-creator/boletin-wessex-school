interface ErrorStateProps {
  title?: string
  message: string
  actionLabel?: string
  onAction?: () => void
}

export const ErrorState = ({
  title = 'No se pudo cargar',
  message,
  actionLabel,
  onAction,
}: ErrorStateProps) => {
  return (
    <div className="error-card">
      <h3>{title}</h3>
      <p>{message}</p>
      {actionLabel && onAction ? (
        <button type="button" className="button button-secondary" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
